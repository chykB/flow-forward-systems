begin;

alter table public.workspace_command_requests
  drop constraint workspace_command_requests_name_check;

alter table public.workspace_command_requests
  add constraint workspace_command_requests_name_check
    check (
      command_name in (
        'work_items.create',
        'work_items.update_status',
        'client_records.create',
        'client_records.update',
        'handoff_notes.create',
        'proposal_records.create',
        'proposal_records.update',
        'proposal_records.apply_recommendation',
        'client_engagements.create',
        'client_engagements.update',
        'engagement_follow_ups.complete'
      )
    );

alter table public.client_engagements
  alter column next_follow_up_at drop not null;

alter table public.client_workflow_records
  alter column next_follow_up_at drop not null;

create table public.engagement_follow_ups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_workflow_record_id uuid not null,
  client_engagement_id uuid not null,
  actor_id uuid not null,
  outcome text not null,
  note text not null,
  completed_at timestamptz not null default now(),
  next_action text not null,
  next_follow_up_at date,
  assigned_to text not null,
  created_at timestamptz not null default now(),
  constraint engagement_follow_ups_engagement_fk
    foreign key (
      client_engagement_id,
      workspace_id,
      client_workflow_record_id
    )
    references public.client_engagements (
      id,
      workspace_id,
      client_workflow_record_id
    )
    on delete cascade,
  constraint engagement_follow_ups_actor_fk
    foreign key (actor_id)
    references auth.users(id)
    on delete restrict,
  constraint engagement_follow_ups_outcome_check
    check (
      outcome in (
        'Replied',
        'No response',
        'Meeting booked',
        'Decision received',
        'Not proceeding',
        'Other'
      )
    ),
  constraint engagement_follow_ups_note_check
    check (
      length(btrim(note)) between 5 and 2000
    ),
  constraint engagement_follow_ups_next_action_check
    check (
      length(btrim(next_action)) between 3 and 1000
    ),
  constraint engagement_follow_ups_owner_check
    check (
      length(btrim(assigned_to)) between 2 and 200
    )
);

comment on table public.engagement_follow_ups is
  'Immutable engagement-scoped follow-up outcomes and the next schedule chosen when each follow-up was completed.';

create index engagement_follow_ups_workspace_completed_idx
  on public.engagement_follow_ups (
    workspace_id,
    completed_at desc
  );

create index engagement_follow_ups_engagement_completed_idx
  on public.engagement_follow_ups (
    client_engagement_id,
    completed_at desc
  );

alter table public.engagement_follow_ups
  enable row level security;

create policy "Users can read follow-ups in owned workspaces"
on public.engagement_follow_ups
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = engagement_follow_ups.workspace_id
      and workspace.owner_id = auth.uid()
  )
);

revoke all
  on table public.engagement_follow_ups
  from anon, authenticated;

grant select
  on table public.engagement_follow_ups
  to authenticated;

grant all
  on table public.engagement_follow_ups
  to service_role;

create or replace function public.command_complete_engagement_follow_up(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_expected_updated_at timestamptz,
  p_completion jsonb,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text :=
    'engagement_follow_ups.complete';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_engagement public.client_engagements%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_follow_up public.engagement_follow_ups%rowtype;
  v_outcome text;
  v_note text;
  v_next_action text;
  v_next_follow_up_at date;
  v_assigned_to text;
  v_reconciliation jsonb;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or p_client_engagement_id is null
    or p_expected_updated_at is null
    or p_evaluation_date is null
  then
    raise exception 'Follow-up command identifiers, expected version, and evaluation date are required.'
      using errcode = '22023';
  end if;

  if abs(p_evaluation_date - current_date) > 1 then
    raise exception 'The evaluation date is outside the allowed range.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = v_actor_id
  ) then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if p_completion is null
    or jsonb_typeof(p_completion) <> 'object'
    or p_completion = '{}'::jsonb
  then
    raise exception 'Follow-up completion details are required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_completion) as supplied(field)
    where supplied.field not in (
      'outcome',
      'note',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo'
    )
  ) or not (
    p_completion ? 'outcome'
    and p_completion ? 'note'
    and p_completion ? 'nextAction'
    and p_completion ? 'nextFollowUpAt'
    and p_completion ? 'assignedTo'
  ) then
    raise exception 'Follow-up completion details are incomplete or contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_completion->'outcome') <> 'string'
    or jsonb_typeof(p_completion->'note') <> 'string'
    or jsonb_typeof(p_completion->'nextAction') <> 'string'
    or jsonb_typeof(p_completion->'assignedTo') <> 'string'
    or jsonb_typeof(p_completion->'nextFollowUpAt')
      not in ('string', 'null')
  then
    raise exception 'Follow-up completion details use an invalid value type.'
      using errcode = '22023';
  end if;

  v_outcome := p_completion->>'outcome';
  v_note := btrim(p_completion->>'note');
  v_next_action := btrim(p_completion->>'nextAction');
  v_assigned_to := btrim(p_completion->>'assignedTo');

  begin
    v_next_follow_up_at := case
      when jsonb_typeof(p_completion->'nextFollowUpAt') =
        'null'
      then null
      else (p_completion->>'nextFollowUpAt')::date
    end;
  exception
    when invalid_text_representation
      or datetime_field_overflow
    then
      raise exception 'Choose a valid next follow-up date.'
        using errcode = '22023';
  end;

  if v_outcome not in (
    'Replied',
    'No response',
    'Meeting booked',
    'Decision received',
    'Not proceeding',
    'Other'
  ) then
    raise exception 'Choose a valid follow-up outcome.'
      using errcode = '22023';
  end if;

  if length(v_note) < 5 or length(v_note) > 2000 then
    raise exception 'Add a follow-up note between 5 and 2,000 characters.'
      using errcode = '22023';
  end if;

  if length(v_next_action) < 3
    or length(v_next_action) > 1000
  then
    raise exception 'Enter a next action between 3 and 1,000 characters.'
      using errcode = '22023';
  end if;

  if length(v_assigned_to) < 2
    or length(v_assigned_to) > 200
  then
    raise exception 'Enter a follow-up owner between 2 and 200 characters.'
      using errcode = '22023';
  end if;

  if v_next_follow_up_at is not null
    and v_next_follow_up_at < p_evaluation_date
  then
    raise exception 'The next follow-up date cannot be in the past.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'completion', p_completion,
      'evaluationDate', p_evaluation_date
    )::text
  );

  insert into public.workspace_command_requests (
    workspace_id,
    actor_id,
    command_name,
    idempotency_key,
    request_hash
  )
  values (
    p_workspace_id,
    v_actor_id,
    v_command_name,
    p_idempotency_key,
    v_request_hash
  )
  on conflict do nothing
  returning true into v_request_claimed;

  if not coalesce(v_request_claimed, false) then
    select request.request_hash, request.response
    into v_existing_hash, v_existing_response
    from public.workspace_command_requests as request
    where request.workspace_id = p_workspace_id
      and request.actor_id = v_actor_id
      and request.command_name = v_command_name
      and request.idempotency_key = p_idempotency_key;

    if v_existing_hash is distinct from v_request_hash then
      raise exception 'This request identifier was already used for a different follow-up completion.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This follow-up request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Engagement not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_engagement.updated_at <> p_expected_updated_at then
    raise exception 'The engagement changed before this follow-up was completed.'
      using errcode = 'PT409';
  end if;

  if v_engagement.engagement_status <> 'Active' then
    raise exception 'This engagement is closed and cannot receive a follow-up.'
      using errcode = '22023';
  end if;

  select client.*
  into v_client
  from public.client_workflow_records as client
  where client.id = v_engagement.client_workflow_record_id
    and client.workspace_id = p_workspace_id;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  insert into public.engagement_follow_ups (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    actor_id,
    outcome,
    note,
    next_action,
    next_follow_up_at,
    assigned_to
  )
  values (
    p_workspace_id,
    v_client.id,
    v_engagement.id,
    v_actor_id,
    v_outcome,
    v_note,
    v_next_action,
    v_next_follow_up_at,
    v_assigned_to
  )
  returning * into v_follow_up;

  update public.client_engagements
  set
    next_action = v_next_action,
    next_follow_up_at = v_next_follow_up_at,
    assigned_to = v_assigned_to,
    updated_at = clock_timestamp()
  where id = v_engagement.id
    and workspace_id = p_workspace_id
  returning * into v_engagement;

  if v_engagement.is_primary then
    update public.client_workflow_records
    set
      next_action = v_next_action,
      next_follow_up_at = v_next_follow_up_at,
      assigned_to = v_assigned_to,
      updated_at = clock_timestamp()
    where id = v_client.id
      and workspace_id = p_workspace_id
    returning * into v_client;
  end if;

  insert into public.activity_logs (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    actor_id,
    action_type,
    note
  )
  values (
    p_workspace_id,
    v_client.id,
    v_engagement.id,
    v_actor_id,
    'Follow-up completed',
    format(
      'Follow-up outcome: %s. %s',
      v_outcome,
      v_note
    )
  );

  v_reconciliation :=
    public.reconcile_client_engagement_risk_signals(
      p_workspace_id,
      v_engagement.id,
      p_evaluation_date
    );

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id;

  select client.*
  into v_client
  from public.client_workflow_records as client
  where client.id = v_engagement.client_workflow_record_id
    and client.workspace_id = p_workspace_id;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'followUp', to_jsonb(v_follow_up),
    'clientRecord', to_jsonb(v_client),
    'clientEngagement', to_jsonb(v_engagement),
    'reconciliation', v_reconciliation
  );

  update public.workspace_command_requests
  set
    response = v_response,
    completed_at = now()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

comment on function public.command_complete_engagement_follow_up(
  uuid,
  uuid,
  timestamptz,
  jsonb,
  date,
  uuid
) is
  'Records one immutable follow-up outcome, updates the next schedule, and reconciles engagement risks atomically.';

revoke all
  on function public.command_complete_engagement_follow_up(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_complete_engagement_follow_up(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  to authenticated, service_role;

commit;
