begin;

alter table public.workspace_command_requests
  drop constraint workspace_command_requests_name_check;

alter table public.workspace_command_requests
  add constraint workspace_command_requests_name_check
    check (
      command_name in (
        'work_items.create',
        'work_items.update_status',
        'work_items.replace_dependencies',
        'client_records.create',
        'client_records.update',
        'handoff_notes.create',
        'proposal_records.create',
        'proposal_records.update',
        'proposal_records.apply_recommendation',
        'client_engagements.create',
        'client_engagements.update',
        'engagement_follow_ups.complete',
        'invoice_records.create',
        'invoice_records.update',
        'invoice_records.apply_recommendation',
        'risk_signals.review',
        'risk_signals.dismiss',
        'operations_agent_runs.start',
        'operations_agent_runs.cancel',
        'operations_agent.guided_client_intake.complete',
        'operations_agent.guided_workspace_setup.complete',
        'operations_agent.approvals.approve',
        'operations_agent.approvals.reject'
      )
    );

alter table public.operations_agent_run_events
  drop constraint operations_agent_run_events_type_check;

alter table public.operations_agent_run_events
  add constraint operations_agent_run_events_type_check
    check (
      event_type in (
        'run_started',
        'run_claimed',
        'run_waiting_for_approval',
        'run_resumed',
        'run_completed',
        'run_failed',
        'run_cancelled',
        'run_expired',
        'run_partially_completed',
        'approval_requested',
        'approval_approved',
        'approval_rejected',
        'approval_expired',
        'approval_cancelled'
      )
    );

create table public.operations_agent_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  step_id uuid not null,
  requested_for uuid not null
    references auth.users(id) on delete restrict,
  request_idempotency_key uuid not null,
  request_hash text not null,
  action_title text not null,
  action_summary text not null,
  review_fields jsonb not null default '[]'::jsonb,
  command_name text not null,
  command_input jsonb not null,
  command_input_hash text not null,
  expected_state jsonb not null default '{}'::jsonb,
  decision_state text not null default 'pending',
  execution_state text not null default 'not_ready',
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  foreign key (step_id, workspace_id, run_id)
    references public.operations_agent_steps(
      id,
      workspace_id,
      run_id
    )
    on delete cascade,
  unique (run_id, request_idempotency_key),
  unique (id, workspace_id),
  constraint operations_agent_approvals_request_hash_check
    check (request_hash ~ '^[0-9a-f]{32}$'),
  constraint operations_agent_approvals_title_check
    check (char_length(btrim(action_title)) between 3 and 160),
  constraint operations_agent_approvals_summary_check
    check (char_length(btrim(action_summary)) between 3 and 1200),
  constraint operations_agent_approvals_review_fields_check
    check (
      jsonb_typeof(review_fields) = 'array'
      and jsonb_array_length(review_fields) between 1 and 20
      and octet_length(review_fields::text) <= 8192
    ),
  constraint operations_agent_approvals_command_name_check
    check (
      command_name ~
        '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
      and char_length(command_name) between 3 and 160
    ),
  constraint operations_agent_approvals_command_input_check
    check (
      jsonb_typeof(command_input) = 'object'
      and octet_length(command_input::text) <= 65536
    ),
  constraint operations_agent_approvals_command_hash_check
    check (command_input_hash ~ '^[0-9a-f]{32}$'),
  constraint operations_agent_approvals_expected_state_check
    check (
      jsonb_typeof(expected_state) = 'object'
      and octet_length(expected_state::text) <= 32768
    ),
  constraint operations_agent_approvals_decision_check
    check (
      decision_state in (
        'pending',
        'approved',
        'rejected',
        'expired',
        'cancelled'
      )
    ),
  constraint operations_agent_approvals_execution_check
    check (
      execution_state in (
        'not_ready',
        'ready',
        'running',
        'succeeded',
        'failed',
        'cancelled'
      )
    ),
  constraint operations_agent_approvals_decision_note_check
    check (
      decision_note is null
      or char_length(btrim(decision_note)) between 3 and 500
    ),
  constraint operations_agent_approvals_decision_state_check
    check (
      (
        decision_state = 'pending'
        and execution_state = 'not_ready'
        and decided_by is null
        and decided_at is null
        and decision_note is null
      )
      or (
        decision_state = 'approved'
        and execution_state in (
          'ready',
          'running',
          'succeeded',
          'failed',
          'cancelled'
        )
        and decided_by is not null
        and decided_at is not null
      )
      or (
        decision_state = 'rejected'
        and execution_state = 'cancelled'
        and decided_by is not null
        and decided_at is not null
        and decision_note is not null
      )
      or (
        decision_state in ('expired', 'cancelled')
        and execution_state = 'cancelled'
        and decided_by is null
        and decided_at is not null
        and decision_note is not null
      )
    ),
  constraint operations_agent_approvals_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '30 days'
    )
);

comment on table public.operations_agent_approval_requests is
  'Exact, durable approval records for consequential Operations Agent actions. Internal command payloads stay server-only and cannot execute before a recorded user decision.';

create trigger set_operations_agent_approval_updated_at
before update on public.operations_agent_approval_requests
for each row
execute function public.set_updated_at();

create index operations_agent_approvals_workspace_queue_idx
  on public.operations_agent_approval_requests (
    workspace_id,
    decision_state,
    created_at desc
  );

create index operations_agent_approvals_run_idx
  on public.operations_agent_approval_requests (
    workspace_id,
    run_id,
    created_at
  );

create unique index operations_agent_approvals_one_open_step_idx
  on public.operations_agent_approval_requests (step_id)
  where decision_state = 'pending';

create or replace function public.validate_operations_agent_review_fields(
  p_review_fields jsonb
)
returns void
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_field jsonb;
begin
  if jsonb_typeof(p_review_fields) <> 'array'
    or jsonb_array_length(p_review_fields) not between 1 and 20
    or octet_length(p_review_fields::text) > 8192
  then
    raise exception 'Add between 1 and 20 review fields.'
      using errcode = '22023';
  end if;

  for v_field in
    select value
    from jsonb_array_elements(p_review_fields)
  loop
    if jsonb_typeof(v_field) <> 'object'
      or (
        select array_agg(key_name order by key_name)
        from jsonb_object_keys(v_field) as fields(key_name)
      ) <> array['label', 'value']::text[]
      or jsonb_typeof(v_field->'label') <> 'string'
      or jsonb_typeof(v_field->'value') <> 'string'
      or char_length(btrim(v_field->>'label')) not between 1 and 80
      or char_length(btrim(v_field->>'value')) not between 1 and 500
    then
      raise exception 'Each approval review field needs a short label and value.'
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

comment on function public.validate_operations_agent_review_fields(
  jsonb
) is
  'Validates the bounded user-facing fields shown for one exact Operations Agent approval.';

create or replace function public.operations_agent_approval_public_json(
  p_approval public.operations_agent_approval_requests
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', p_approval.id,
    'workspace_id', p_approval.workspace_id,
    'run_id', p_approval.run_id,
    'step_id', p_approval.step_id,
    'requested_for', p_approval.requested_for,
    'action_title', p_approval.action_title,
    'action_summary', p_approval.action_summary,
    'review_fields', p_approval.review_fields,
    'decision', p_approval.decision_state,
    'execution_state', p_approval.execution_state,
    'decided_by', p_approval.decided_by,
    'decided_at', p_approval.decided_at,
    'decision_note', p_approval.decision_note,
    'expires_at', p_approval.expires_at,
    'created_at', p_approval.created_at,
    'updated_at', p_approval.updated_at
  );
$$;

comment on function public.operations_agent_approval_public_json(
  public.operations_agent_approval_requests
) is
  'Returns only the user-facing approval fields and excludes the internal command name, payload, hash, and expected-state snapshot.';

create or replace function public.enforce_operations_agent_approval_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.workspace_id <> old.workspace_id
    or new.run_id <> old.run_id
    or new.step_id <> old.step_id
    or new.requested_for <> old.requested_for
    or new.request_idempotency_key <> old.request_idempotency_key
    or new.request_hash <> old.request_hash
    or new.action_title <> old.action_title
    or new.action_summary <> old.action_summary
    or new.review_fields <> old.review_fields
    or new.command_name <> old.command_name
    or new.command_input <> old.command_input
    or new.command_input_hash <> old.command_input_hash
    or new.expected_state <> old.expected_state
    or new.expires_at <> old.expires_at
    or new.created_at <> old.created_at
  then
    raise exception 'An approval scope cannot change after it is requested.'
      using errcode = '22023';
  end if;

  if old.decision_state <> 'pending'
    and new.decision_state <> old.decision_state
  then
    raise exception 'A recorded approval decision cannot be changed.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger enforce_operations_agent_approval_scope
before update on public.operations_agent_approval_requests
for each row
execute function public.enforce_operations_agent_approval_scope();

alter table public.operations_agent_approval_requests
  enable row level security;

create or replace function public.query_operations_agent_approvals(
  p_workspace_id uuid
)
returns table (
  id uuid,
  workspace_id uuid,
  run_id uuid,
  step_id uuid,
  requested_for uuid,
  action_title text,
  action_summary text,
  review_fields jsonb,
  decision text,
  execution_state text,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
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

  return query
  select
    approval.id,
    approval.workspace_id,
    approval.run_id,
    approval.step_id,
    approval.requested_for,
    approval.action_title,
    approval.action_summary,
    approval.review_fields,
    approval.decision_state,
    approval.execution_state,
    approval.decided_by,
    approval.decided_at,
    approval.decision_note,
    approval.expires_at,
    approval.created_at,
    approval.updated_at
  from public.operations_agent_approval_requests as approval
  where approval.workspace_id = p_workspace_id
    and approval.requested_for = v_actor_id
  order by
    (approval.decision_state = 'pending') desc,
    approval.created_at desc
  limit 50;
end;
$$;

comment on function public.query_operations_agent_approvals(uuid) is
  'Owner-only read boundary for user-facing approval details. Internal command arguments are never returned.';

create or replace function public.agent_create_operations_agent_approval(
  p_workspace_id uuid,
  p_run_id uuid,
  p_step_id uuid,
  p_expected_run_updated_at timestamptz,
  p_expected_step_updated_at timestamptz,
  p_action_title text,
  p_action_summary text,
  p_review_fields jsonb,
  p_command_name text,
  p_command_input jsonb,
  p_expected_state jsonb,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
  v_approval public.operations_agent_approval_requests%rowtype;
  v_request_hash text;
  v_command_input jsonb := coalesce(
    p_command_input,
    '{}'::jsonb
  );
  v_expected_state jsonb := coalesce(
    p_expected_state,
    '{}'::jsonb
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_step_id is null
    or p_expected_run_updated_at is null
    or p_expected_step_updated_at is null
    or p_idempotency_key is null
  then
    raise exception 'Valid approval identifiers are required.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_action_title, '')))
      not between 3 and 160
    or char_length(btrim(coalesce(p_action_summary, '')))
      not between 3 and 1200
  then
    raise exception 'Add a clear approval title and summary.'
      using errcode = '22023';
  end if;

  perform public.validate_operations_agent_review_fields(
    p_review_fields
  );

  if coalesce(p_command_name, '') !~
      '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    or char_length(p_command_name) not between 3 and 160
  then
    raise exception 'Choose a valid protected command name.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_command_input) <> 'object'
    or octet_length(v_command_input::text) > 65536
    or jsonb_typeof(v_expected_state) <> 'object'
    or octet_length(v_expected_state::text) > 32768
  then
    raise exception 'The protected action payload is invalid.'
      using errcode = '22023';
  end if;

  if p_expires_at is null
    or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '30 days'
  then
    raise exception 'Choose an approval expiry within 30 days.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'runId', p_run_id,
      'stepId', p_step_id,
      'expectedRunUpdatedAt', p_expected_run_updated_at,
      'expectedStepUpdatedAt', p_expected_step_updated_at,
      'actionTitle', btrim(p_action_title),
      'actionSummary', btrim(p_action_summary),
      'reviewFields', p_review_fields,
      'commandName', p_command_name,
      'commandInput', v_command_input,
      'expectedState', v_expected_state,
      'expiresAt', p_expires_at
    )::text
  );

  select approval.*
  into v_approval
  from public.operations_agent_approval_requests as approval
  where approval.run_id = p_run_id
    and approval.request_idempotency_key = p_idempotency_key;

  if found then
    if v_approval.workspace_id <> p_workspace_id
      or v_approval.request_hash <> v_request_hash
    then
      raise exception 'This approval request identifier was already used for a different action.'
        using errcode = '22023';
    end if;

    select run.*
    into v_run
    from public.operations_agent_runs as run
    where run.id = p_run_id
      and run.workspace_id = p_workspace_id;

    select step.*
    into v_step
    from public.operations_agent_steps as step
    where step.id = p_step_id
      and step.run_id = p_run_id
      and step.workspace_id = p_workspace_id;

    return jsonb_build_object(
      'approval',
      public.operations_agent_approval_public_json(v_approval),
      'run', to_jsonb(v_run),
      'step', to_jsonb(v_step)
    );
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = p_run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  if not found then
    raise exception 'Operations Agent run not found.'
      using errcode = 'P0002';
  end if;

  select step.*
  into v_step
  from public.operations_agent_steps as step
  where step.id = p_step_id
    and step.run_id = p_run_id
    and step.workspace_id = p_workspace_id
  for update of step;

  if not found then
    raise exception 'Operations Agent approval step not found.'
      using errcode = 'P0002';
  end if;

  if v_run.mode <> 'approval_required'
    or v_run.state <> 'running'
    or v_run.updated_at <> p_expected_run_updated_at
    or v_step.kind <> 'approval'
    or v_step.state <> 'running'
    or v_step.updated_at <> p_expected_step_updated_at
    or v_step.step_index <> v_run.current_step_index
  then
    raise exception 'The proposed action changed before approval was requested.'
      using errcode = 'PT409';
  end if;

  insert into public.operations_agent_approval_requests (
    workspace_id,
    run_id,
    step_id,
    requested_for,
    request_idempotency_key,
    request_hash,
    action_title,
    action_summary,
    review_fields,
    command_name,
    command_input,
    command_input_hash,
    expected_state,
    expires_at
  )
  values (
    p_workspace_id,
    p_run_id,
    p_step_id,
    v_run.initiated_by,
    p_idempotency_key,
    v_request_hash,
    btrim(p_action_title),
    btrim(p_action_summary),
    p_review_fields,
    p_command_name,
    v_command_input,
    md5(v_command_input::text),
    v_expected_state,
    p_expires_at
  )
  returning * into v_approval;

  update public.operations_agent_steps
  set
    state = 'waiting_for_approval',
    input_summary = btrim(p_action_summary)
  where id = p_step_id
    and run_id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_step;

  update public.operations_agent_runs
  set
    state = 'waiting_for_approval',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = p_expires_at
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    'approval_requested',
    'The Operations Agent requested approval for one exact protected action.',
    jsonb_build_object(
      'approvalId', v_approval.id,
      'stepId', p_step_id,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'approval',
    public.operations_agent_approval_public_json(v_approval),
    'run', to_jsonb(v_run),
    'step', to_jsonb(v_step)
  );
end;
$$;

comment on function public.agent_create_operations_agent_approval(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  timestamptz,
  uuid
) is
  'Service-only idempotent boundary that freezes one exact protected action and pauses its approval-required run.';

create or replace function public.command_approve_operations_agent_action(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_expected_updated_at timestamptz,
  p_decision_note text,
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
    'operations_agent.approvals.approve';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_approval public.operations_agent_approval_requests%rowtype;
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
  v_response jsonb;
  v_note text := nullif(btrim(coalesce(p_decision_note, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_approval_id is null
    or p_expected_updated_at is null
    or p_idempotency_key is null
  then
    raise exception 'Valid approval decision identifiers are required.'
      using errcode = '22023';
  end if;

  if v_note is not null
    and char_length(v_note) not between 3 and 500
  then
    raise exception 'Keep the approval note between 3 and 500 characters.'
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

  v_request_hash := md5(
    jsonb_build_object(
      'approvalId', p_approval_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'decisionNote', v_note
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
      raise exception 'This request identifier was already used for a different approval decision.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This approval decision is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select approval.*
  into v_approval
  from public.operations_agent_approval_requests as approval
  where approval.id = p_approval_id
    and approval.workspace_id = p_workspace_id
  for update of approval;

  if not found then
    raise exception 'Approval not found.'
      using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = v_approval.run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  select step.*
  into v_step
  from public.operations_agent_steps as step
  where step.id = v_approval.step_id
    and step.run_id = v_approval.run_id
    and step.workspace_id = p_workspace_id
  for update of step;

  if v_approval.requested_for <> v_actor_id
    or v_approval.decision_state <> 'pending'
    or v_approval.updated_at <> p_expected_updated_at
    or v_approval.expires_at <= clock_timestamp()
    or v_run.mode <> 'approval_required'
    or v_run.state <> 'waiting_for_approval'
    or v_run.approval_expires_at <> v_approval.expires_at
    or v_step.kind <> 'approval'
    or v_step.state <> 'waiting_for_approval'
  then
    raise exception 'This approval changed elsewhere. Refresh before deciding.'
      using errcode = 'PT409';
  end if;

  update public.operations_agent_approval_requests
  set
    decision_state = 'approved',
    execution_state = 'ready',
    decided_by = v_actor_id,
    decided_at = now(),
    decision_note = v_note
  where id = p_approval_id
    and workspace_id = p_workspace_id
  returning * into v_approval;

  update public.operations_agent_steps
  set
    state = 'completed',
    attempt_count = greatest(attempt_count, 1),
    output_summary = 'The workspace owner approved the proposed action.',
    completed_at = now()
  where id = v_approval.step_id
    and run_id = v_approval.run_id
    and workspace_id = p_workspace_id
  returning * into v_step;

  update public.operations_agent_runs
  set
    state = 'queued',
    current_step_index = current_step_index + 1,
    approval_expires_at = null
  where id = v_approval.run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    actor_id,
    event_type,
    note,
    details
  )
  values
    (
      p_workspace_id,
      v_approval.run_id,
      v_actor_id,
      'approval_approved',
      'The workspace owner approved the exact proposed action.',
      jsonb_build_object(
        'approvalId', v_approval.id,
        'stepId', v_approval.step_id
      )
    ),
    (
      p_workspace_id,
      v_approval.run_id,
      v_actor_id,
      'run_resumed',
      'The Operations Agent run was queued to resume after approval.',
      jsonb_build_object('approvalId', v_approval.id)
    );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'approval',
    public.operations_agent_approval_public_json(v_approval),
    'run', to_jsonb(v_run),
    'step', to_jsonb(v_step)
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

comment on function public.command_approve_operations_agent_action(
  uuid,
  uuid,
  timestamptz,
  text,
  uuid
) is
  'Owner-only idempotent decision boundary that approves one immutable Operations Agent action and queues the run to resume.';

create or replace function public.command_reject_operations_agent_action(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_expected_updated_at timestamptz,
  p_decision_note text,
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
    'operations_agent.approvals.reject';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_approval public.operations_agent_approval_requests%rowtype;
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
  v_response jsonb;
  v_note text := btrim(coalesce(p_decision_note, ''));
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_approval_id is null
    or p_expected_updated_at is null
    or p_idempotency_key is null
    or char_length(v_note) not between 3 and 500
  then
    raise exception 'Add a short reason for rejecting this action.'
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

  v_request_hash := md5(
    jsonb_build_object(
      'approvalId', p_approval_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'decisionNote', v_note
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
      raise exception 'This request identifier was already used for a different approval decision.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This approval decision is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select approval.*
  into v_approval
  from public.operations_agent_approval_requests as approval
  where approval.id = p_approval_id
    and approval.workspace_id = p_workspace_id
  for update of approval;

  if not found then
    raise exception 'Approval not found.'
      using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = v_approval.run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  select step.*
  into v_step
  from public.operations_agent_steps as step
  where step.id = v_approval.step_id
    and step.run_id = v_approval.run_id
    and step.workspace_id = p_workspace_id
  for update of step;

  if v_approval.requested_for <> v_actor_id
    or v_approval.decision_state <> 'pending'
    or v_approval.updated_at <> p_expected_updated_at
    or v_approval.expires_at <= clock_timestamp()
    or v_run.mode <> 'approval_required'
    or v_run.state <> 'waiting_for_approval'
    or v_step.kind <> 'approval'
    or v_step.state <> 'waiting_for_approval'
  then
    raise exception 'This approval changed elsewhere. Refresh before deciding.'
      using errcode = 'PT409';
  end if;

  update public.operations_agent_approval_requests
  set
    decision_state = 'rejected',
    execution_state = 'cancelled',
    decided_by = v_actor_id,
    decided_at = now(),
    decision_note = v_note
  where id = p_approval_id
    and workspace_id = p_workspace_id
  returning * into v_approval;

  update public.operations_agent_steps
  set
    state = 'cancelled',
    attempt_count = greatest(attempt_count, 1),
    output_summary = 'The workspace owner rejected the proposed action.',
    completed_at = now()
  where id = v_approval.step_id
    and run_id = v_approval.run_id
    and workspace_id = p_workspace_id
  returning * into v_step;

  update public.operations_agent_runs
  set
    state = 'cancelled',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = null,
    cancelled_at = now(),
    completed_at = now(),
    outcome_summary = 'The proposed action was rejected. No workflow change was applied.'
  where id = v_approval.run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    actor_id,
    event_type,
    note,
    details
  )
  values
    (
      p_workspace_id,
      v_approval.run_id,
      v_actor_id,
      'approval_rejected',
      'The workspace owner rejected the exact proposed action.',
      jsonb_build_object(
        'approvalId', v_approval.id,
        'stepId', v_approval.step_id
      )
    ),
    (
      p_workspace_id,
      v_approval.run_id,
      v_actor_id,
      'run_cancelled',
      'The Operations Agent run ended after the proposed action was rejected.',
      jsonb_build_object('approvalId', v_approval.id)
    );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'approval',
    public.operations_agent_approval_public_json(v_approval),
    'run', to_jsonb(v_run),
    'step', to_jsonb(v_step)
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

comment on function public.command_reject_operations_agent_action(
  uuid,
  uuid,
  timestamptz,
  text,
  uuid
) is
  'Owner-only idempotent decision boundary that rejects one immutable Operations Agent action and ends the run without applying a workflow change.';

create or replace function public.agent_expire_operations_agent_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_approval public.operations_agent_approval_requests%rowtype;
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  select approval.*
  into v_approval
  from public.operations_agent_approval_requests as approval
  where approval.id = p_approval_id
    and approval.workspace_id = p_workspace_id
  for update of approval;

  if not found then
    raise exception 'Approval not found.'
      using errcode = 'P0002';
  end if;

  if v_approval.decision_state <> 'pending'
    or v_approval.updated_at <> p_expected_updated_at
    or v_approval.expires_at > clock_timestamp()
  then
    raise exception 'This approval is not ready to expire.'
      using errcode = 'PT409';
  end if;

  update public.operations_agent_approval_requests
  set
    decision_state = 'expired',
    execution_state = 'cancelled',
    decided_at = now(),
    decision_note = 'The approval window expired before a decision was recorded.'
  where id = p_approval_id
    and workspace_id = p_workspace_id
  returning * into v_approval;

  update public.operations_agent_steps
  set
    state = 'expired',
    output_summary = 'The approval window expired.',
    completed_at = now()
  where id = v_approval.step_id
    and run_id = v_approval.run_id
    and workspace_id = p_workspace_id
  returning * into v_step;

  update public.operations_agent_runs
  set
    state = 'expired',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = null,
    completed_at = now(),
    outcome_summary = 'The proposed action expired without a decision.'
  where id = v_approval.run_id
    and workspace_id = p_workspace_id
    and state = 'waiting_for_approval'
  returning * into v_run;

  if not found then
    raise exception 'The Operations Agent run is not waiting for this approval.'
      using errcode = 'PT409';
  end if;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  values
    (
      p_workspace_id,
      v_approval.run_id,
      'approval_expired',
      'The exact approval request expired without a user decision.',
      jsonb_build_object('approvalId', v_approval.id)
    ),
    (
      p_workspace_id,
      v_approval.run_id,
      'run_expired',
      'The Operations Agent run expired while waiting for approval.',
      jsonb_build_object('approvalId', v_approval.id)
    );

  return jsonb_build_object(
    'approval',
    public.operations_agent_approval_public_json(v_approval),
    'run', to_jsonb(v_run),
    'step', to_jsonb(v_step)
  );
end;
$$;

comment on function public.agent_expire_operations_agent_approval(
  uuid,
  uuid,
  timestamptz
) is
  'Service-only boundary that expires an undecided action and its waiting run without applying a workflow change.';

create or replace function public.sync_operations_agent_approval_on_terminal_run()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.state = old.state
    or new.state not in (
      'completed',
      'failed',
      'cancelled',
      'expired',
      'partially_completed'
    )
  then
    return new;
  end if;

  with changed as (
    update public.operations_agent_approval_requests
    set
      decision_state = case
        when new.state = 'expired' then 'expired'
        else 'cancelled'
      end,
      execution_state = 'cancelled',
      decided_at = now(),
      decision_note = case
        when new.state = 'expired'
          then 'The Operations Agent run expired before a decision was recorded.'
        else 'The Operations Agent run ended before a decision was recorded.'
      end
    where workspace_id = new.workspace_id
      and run_id = new.id
      and decision_state = 'pending'
    returning id
  )
  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  select
    new.workspace_id,
    new.id,
    case
      when new.state = 'expired' then 'approval_expired'
      else 'approval_cancelled'
    end,
    case
      when new.state = 'expired'
        then 'The approval expired when the Operations Agent run ended.'
      else 'The approval was cancelled when the Operations Agent run ended.'
    end,
    jsonb_build_object('approvalId', changed.id)
  from changed;

  with changed as (
    update public.operations_agent_approval_requests
    set execution_state = 'cancelled'
    where workspace_id = new.workspace_id
      and run_id = new.id
      and decision_state = 'approved'
      and execution_state in ('ready', 'running')
    returning id
  )
  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  select
    new.workspace_id,
    new.id,
    'approval_cancelled',
    'The approved action was not executed before the Operations Agent run ended.',
    jsonb_build_object('approvalId', changed.id)
  from changed;

  return new;
end;
$$;

create trigger sync_operations_agent_approval_on_terminal_run
after update of state on public.operations_agent_runs
for each row
execute function public.sync_operations_agent_approval_on_terminal_run();

revoke all
  on table public.operations_agent_approval_requests
  from public, anon, authenticated;
grant select, insert, update
  on table public.operations_agent_approval_requests
  to service_role;

revoke all
  on function public.validate_operations_agent_review_fields(jsonb)
  from public, anon, authenticated;
revoke all
  on function public.operations_agent_approval_public_json(
    public.operations_agent_approval_requests
  )
  from public, anon, authenticated;

revoke all
  on function public.query_operations_agent_approvals(uuid)
  from public, anon;
grant execute
  on function public.query_operations_agent_approvals(uuid)
  to authenticated;

revoke all
  on function public.agent_create_operations_agent_approval(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    text,
    text,
    jsonb,
    text,
    jsonb,
    jsonb,
    timestamptz,
    uuid
  )
  from public, anon, authenticated;
grant execute
  on function public.agent_create_operations_agent_approval(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    text,
    text,
    jsonb,
    text,
    jsonb,
    jsonb,
    timestamptz,
    uuid
  )
  to service_role;

revoke all
  on function public.command_approve_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    text,
    uuid
  )
  from public, anon;
grant execute
  on function public.command_approve_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    text,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_reject_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    text,
    uuid
  )
  from public, anon;
grant execute
  on function public.command_reject_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    text,
    uuid
  )
  to authenticated;

revoke all
  on function public.agent_expire_operations_agent_approval(
    uuid,
    uuid,
    timestamptz
  )
  from public, anon, authenticated;
grant execute
  on function public.agent_expire_operations_agent_approval(
    uuid,
    uuid,
    timestamptz
  )
  to service_role;

commit;
