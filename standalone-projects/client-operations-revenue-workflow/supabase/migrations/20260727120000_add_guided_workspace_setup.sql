begin;

alter table public.operations_agent_capability_policies
  drop constraint operations_agent_policy_capability_check;

alter table public.operations_agent_capability_policies
  add constraint operations_agent_policy_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup'
      )
    );

alter table public.operations_agent_runs
  drop constraint operations_agent_runs_capability_check;

alter table public.operations_agent_runs
  add constraint operations_agent_runs_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup'
      )
    );

alter table public.operations_agent_usage_events
  drop constraint operations_agent_usage_capability_check;

alter table public.operations_agent_usage_events
  add constraint operations_agent_usage_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup'
      )
    );

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
        'operations_agent.guided_workspace_setup.complete'
      )
    );

create or replace function public.seed_default_operations_agent_policy()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.operations_agent_capability_policies (
    workspace_id,
    capability,
    enabled,
    allowed_mode,
    max_concurrent_runs,
    monthly_cost_limit_usd
  )
  values
    (
      new.id,
      'guided_client_intake',
      true,
      'suggest',
      1,
      5.00
    ),
    (
      new.id,
      'guided_workspace_setup',
      true,
      'suggest',
      1,
      5.00
    )
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.seed_default_operations_agent_policy() is
  'Seeds the Suggest-only Operations Agent capability policies for a new workspace.';

insert into public.operations_agent_capability_policies (
  workspace_id,
  capability,
  enabled,
  allowed_mode,
  max_concurrent_runs,
  monthly_cost_limit_usd
)
select
  workspace.id,
  'guided_workspace_setup',
  true,
  'suggest',
  1,
  5.00
from public.workspaces as workspace
on conflict do nothing;

create table public.workspace_operating_profiles (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  business_type text not null,
  workflow_stages text[] not null,
  common_owners text[] not null,
  working_days text[] not null,
  daily_briefing_enabled boolean not null,
  immediate_failure_alerts_enabled boolean not null,
  opportunity_alerts_enabled boolean not null,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  updated_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_operating_profiles_business_type_check
    check (char_length(btrim(business_type)) between 2 and 120),
  constraint workspace_operating_profiles_stages_check
    check (
      cardinality(workflow_stages) between 1 and 12
      and workflow_stages <@ array[
        'New lead',
        'Qualified lead',
        'Follow-up needed',
        'Discovery or call booked',
        'Proposal sent',
        'Won client',
        'Onboarding',
        'In delivery',
        'Waiting for approval',
        'Payment follow-up',
        'Completed',
        'Lost or inactive'
      ]::text[]
    ),
  constraint workspace_operating_profiles_owners_check
    check (
      cardinality(common_owners) between 1 and 10
      and octet_length(array_to_json(common_owners)::text) <= 4096
    ),
  constraint workspace_operating_profiles_days_check
    check (
      cardinality(working_days) between 1 and 7
      and working_days <@ array[
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ]::text[]
    )
);

comment on table public.workspace_operating_profiles is
  'Reviewed operating preferences for one owner-scoped workspace. Lifecycle values remain the fixed application vocabulary.';

create trigger set_workspace_operating_profile_updated_at
before update on public.workspace_operating_profiles
for each row
execute function public.set_updated_at();

alter table public.workspace_operating_profiles
  enable row level security;

create policy workspace_operating_profiles_owner_select
  on public.workspace_operating_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspaces as workspace
      where workspace.id = workspace_id
        and workspace.owner_id = auth.uid()
    )
  );

create table public.operations_agent_workspace_setup_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  initiated_by uuid not null
    references auth.users(id) on delete restrict,
  draft jsonb not null,
  missing_fields text[] not null default '{}',
  uncertain_fields jsonb not null default '[]'::jsonb,
  clarification_questions text[] not null default '{}',
  state text not null default 'waiting_for_review',
  provider text,
  model text,
  provider_response_id text,
  result_hash text not null,
  approved_configuration jsonb not null default '{}'::jsonb,
  saved_workspace_id uuid
    references public.workspaces(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  unique (run_id),
  unique (id, workspace_id, run_id),
  constraint operations_agent_workspace_setup_state_check
    check (
      state in (
        'waiting_for_review',
        'saved',
        'cancelled'
      )
    ),
  constraint operations_agent_workspace_setup_draft_check
    check (
      jsonb_typeof(draft) = 'object'
      and draft ?& array[
        'businessType',
        'workflowStages',
        'commonOwners',
        'workingDays',
        'dailyBriefingEnabled',
        'immediateFailureAlertsEnabled',
        'opportunityAlertsEnabled',
        'summary'
      ]
      and octet_length(draft::text) <= 32768
    ),
  constraint operations_agent_workspace_setup_missing_check
    check (
      missing_fields <@ array[
        'businessType',
        'workflowStages',
        'commonOwners',
        'workingDays',
        'dailyBriefingEnabled',
        'immediateFailureAlertsEnabled',
        'opportunityAlertsEnabled'
      ]::text[]
      and cardinality(missing_fields) <= 7
    ),
  constraint operations_agent_workspace_setup_uncertain_check
    check (
      jsonb_typeof(uncertain_fields) = 'array'
      and jsonb_array_length(uncertain_fields) <= 7
      and octet_length(uncertain_fields::text) <= 8192
    ),
  constraint operations_agent_workspace_setup_questions_check
    check (
      cardinality(clarification_questions) <= 7
      and octet_length(array_to_json(clarification_questions)::text)
        <= 8192
    ),
  constraint operations_agent_workspace_setup_provider_check
    check (
      provider is null
      or char_length(btrim(provider)) between 2 and 100
    ),
  constraint operations_agent_workspace_setup_model_check
    check (
      model is null
      or char_length(btrim(model)) between 2 and 200
    ),
  constraint operations_agent_workspace_setup_response_check
    check (
      provider_response_id is null
      or char_length(btrim(provider_response_id))
        between 2 and 300
    ),
  constraint operations_agent_workspace_setup_hash_check
    check (result_hash ~ '^[0-9a-f]{64}$'),
  constraint operations_agent_workspace_setup_approved_check
    check (
      jsonb_typeof(approved_configuration) = 'object'
      and octet_length(approved_configuration::text) <= 32768
    ),
  constraint operations_agent_workspace_setup_saved_check
    check (
      (
        state = 'saved'
        and saved_workspace_id = workspace_id
        and approved_configuration <> '{}'::jsonb
      )
      or (
        state <> 'saved'
        and saved_workspace_id is null
      )
    )
);

comment on table public.operations_agent_workspace_setup_drafts is
  'Structured Suggest-mode workspace setup drafts. Nothing changes until the workspace owner reviews and saves the draft.';

create trigger set_operations_agent_workspace_setup_draft_updated_at
before update on public.operations_agent_workspace_setup_drafts
for each row
execute function public.set_updated_at();

create index operations_agent_workspace_setup_workspace_idx
  on public.operations_agent_workspace_setup_drafts (
    workspace_id,
    created_at desc
  );

create or replace function public.cancel_operations_agent_workspace_setup_draft()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.state in ('cancelled', 'expired')
    and old.state is distinct from new.state
  then
    update public.operations_agent_workspace_setup_drafts
    set state = 'cancelled'
    where run_id = new.id
      and workspace_id = new.workspace_id
      and state = 'waiting_for_review';
  end if;

  return new;
end;
$$;

comment on function public.cancel_operations_agent_workspace_setup_draft() is
  'Keeps an unapproved workspace setup draft aligned with a cancelled or expired Operations Agent run.';

revoke all
  on function public.cancel_operations_agent_workspace_setup_draft()
  from public, anon, authenticated;

create trigger cancel_operations_agent_workspace_setup_draft
after update of state on public.operations_agent_runs
for each row
execute function public.cancel_operations_agent_workspace_setup_draft();

alter table public.operations_agent_workspace_setup_drafts
  enable row level security;

create policy operations_agent_workspace_setup_owner_select
  on public.operations_agent_workspace_setup_drafts
  for select
  to authenticated
  using (
    initiated_by = auth.uid()
    and exists (
      select 1
      from public.workspaces as workspace
      where workspace.id = workspace_id
        and workspace.owner_id = auth.uid()
    )
  );

create or replace function public.command_start_operations_agent_run(
  p_workspace_id uuid,
  p_capability text,
  p_objective text,
  p_context jsonb,
  p_limits jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'operations_agent_runs.start';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_policy public.operations_agent_capability_policies%rowtype;
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
  v_limits jsonb := coalesce(p_limits, '{}'::jsonb);
  v_max_model_calls integer := 6;
  v_max_tool_calls integer := 12;
  v_max_retries integer := 2;
  v_max_duration_seconds integer := 900;
  v_max_cost_usd numeric(12, 6) := 0.50;
  v_run public.operations_agent_runs%rowtype;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'A request identifier is required.'
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

  perform 1
  from public.workspaces as workspace
  where workspace.id = p_workspace_id
    and workspace.owner_id = v_actor_id
  for update;

  if p_capability not in (
    'guided_client_intake',
    'guided_workspace_setup'
  ) then
    raise exception 'Choose an available Operations Agent capability.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_objective, ''))) < 3 then
    raise exception 'Describe what the Operations Agent should prepare.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_objective)) > 2000 then
    raise exception 'Keep the Operations Agent objective under 2,000 characters.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_context) <> 'object'
    or octet_length(v_context::text) > 65536
  then
    raise exception 'The Operations Agent context is invalid.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_limits) <> 'object' then
    raise exception 'Operations Agent limits must be an object.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_limits) as supplied(field)
    where supplied.field not in (
      'modelCalls',
      'toolCalls',
      'retries',
      'durationSeconds',
      'costUsd'
    )
  ) then
    raise exception 'Operations Agent limits contain a protected field.'
      using errcode = '22023';
  end if;

  begin
    if v_limits ? 'modelCalls' then
      v_max_model_calls := (v_limits->>'modelCalls')::integer;
    end if;
    if v_limits ? 'toolCalls' then
      v_max_tool_calls := (v_limits->>'toolCalls')::integer;
    end if;
    if v_limits ? 'retries' then
      v_max_retries := (v_limits->>'retries')::integer;
    end if;
    if v_limits ? 'durationSeconds' then
      v_max_duration_seconds :=
        (v_limits->>'durationSeconds')::integer;
    end if;
    if v_limits ? 'costUsd' then
      v_max_cost_usd := (v_limits->>'costUsd')::numeric;
    end if;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
    then
      raise exception 'Operations Agent limits must use valid numbers.'
        using errcode = '22023';
  end;

  if v_max_model_calls not between 1 and 12
    or v_max_tool_calls not between 0 and 30
    or v_max_retries not between 0 and 5
    or v_max_duration_seconds not between 60 and 3600
    or v_max_cost_usd not between 0.01 and 25
  then
    raise exception 'Operations Agent limits are outside the allowed range.'
      using errcode = '22023';
  end if;

  select policy.*
  into v_policy
  from public.operations_agent_capability_policies as policy
  where policy.workspace_id = p_workspace_id
    and policy.capability = p_capability
  for share;

  if not found or not v_policy.enabled then
    raise exception 'This Operations Agent capability is disabled.'
      using errcode = '42501';
  end if;

  if v_policy.allowed_mode <> 'suggest' then
    raise exception 'New Operations Agent capabilities must begin in Suggest mode.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'capability', p_capability,
      'objective', btrim(p_objective),
      'context', v_context,
      'limits', jsonb_build_object(
        'modelCalls', v_max_model_calls,
        'toolCalls', v_max_tool_calls,
        'retries', v_max_retries,
        'durationSeconds', v_max_duration_seconds,
        'costUsd', v_max_cost_usd
      )
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
      raise exception 'This request identifier was already used for a different Operations Agent run.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This Operations Agent run request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  if (
    select count(*)
    from public.operations_agent_runs as run
    where run.workspace_id = p_workspace_id
      and run.state in (
        'queued',
        'running',
        'waiting_for_approval'
      )
  ) >= v_policy.max_concurrent_runs then
    raise exception 'Another Operations Agent run is already active for this workspace.'
      using errcode = 'PT409';
  end if;

  if coalesce(
    (
      select sum(usage.chargeable_cost_usd)
      from public.operations_agent_usage_events as usage
      where usage.workspace_id = p_workspace_id
        and usage.created_at >= date_trunc('month', now())
    ),
    0
  ) + v_max_cost_usd > v_policy.monthly_cost_limit_usd then
    raise exception 'The workspace Operations Agent monthly cost limit has been reached.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_runs (
    workspace_id,
    initiated_by,
    capability,
    mode,
    trigger_type,
    objective,
    context,
    state,
    max_model_calls,
    max_tool_calls,
    max_retries,
    max_duration_seconds,
    max_cost_usd
  )
  values (
    p_workspace_id,
    v_actor_id,
    p_capability,
    'suggest',
    'user',
    btrim(p_objective),
    v_context,
    'queued',
    v_max_model_calls,
    v_max_tool_calls,
    v_max_retries,
    v_max_duration_seconds,
    v_max_cost_usd
  )
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    actor_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    v_run.id,
    v_actor_id,
    'run_started',
    'A Suggest-mode Operations Agent run was queued.',
    jsonb_build_object(
      'capability', v_run.capability,
      'mode', v_run.mode
    )
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'run', to_jsonb(v_run)
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

create or replace function public.assert_guided_workspace_setup_payload(
  p_payload jsonb,
  p_require_complete boolean,
  p_include_summary boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_required_keys text[] := array[
    'businessType',
    'workflowStages',
    'commonOwners',
    'workingDays',
    'dailyBriefingEnabled',
    'immediateFailureAlertsEnabled',
    'opportunityAlertsEnabled'
  ];
begin
  if p_include_summary then
    v_required_keys := array_append(v_required_keys, 'summary');
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or not p_payload ?& v_required_keys
    or exists (
      select 1
      from jsonb_object_keys(p_payload) as supplied(field)
      where not supplied.field = any(v_required_keys)
    )
  then
    raise exception 'The workspace setup contains unsupported or missing fields.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'businessType')
      not in ('string', 'null')
    or (
      jsonb_typeof(p_payload->'businessType') = 'string'
      and char_length(btrim(p_payload->>'businessType'))
        not between 2 and 120
    )
    or (
      p_require_complete
      and jsonb_typeof(p_payload->'businessType') <> 'string'
    )
  then
    raise exception 'The workspace business type is invalid.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'workflowStages') <> 'array'
    or jsonb_array_length(p_payload->'workflowStages') > 12
    or (
      p_require_complete
      and jsonb_array_length(p_payload->'workflowStages') < 1
    )
    or exists (
      select 1
      from jsonb_array_elements(
        p_payload->'workflowStages'
      ) as stage(value)
      where jsonb_typeof(stage.value) <> 'string'
    )
    or exists (
      select 1
      from jsonb_array_elements_text(
        p_payload->'workflowStages'
      ) as stage(value)
      where stage.value not in (
        'New lead',
        'Qualified lead',
        'Follow-up needed',
        'Discovery or call booked',
        'Proposal sent',
        'Won client',
        'Onboarding',
        'In delivery',
        'Waiting for approval',
        'Payment follow-up',
        'Completed',
        'Lost or inactive'
      )
    )
    or (
      select count(*)
      from jsonb_array_elements_text(
        p_payload->'workflowStages'
      )
    ) <> (
      select count(distinct stage.value)
      from jsonb_array_elements_text(
        p_payload->'workflowStages'
      ) as stage(value)
    )
  then
    raise exception 'The workspace workflow stages are invalid.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'commonOwners') <> 'array'
    or jsonb_array_length(p_payload->'commonOwners') > 10
    or (
      p_require_complete
      and jsonb_array_length(p_payload->'commonOwners') < 1
    )
    or exists (
      select 1
      from jsonb_array_elements(
        p_payload->'commonOwners'
      ) as owner(value)
      where jsonb_typeof(owner.value) <> 'string'
    )
    or exists (
      select 1
      from jsonb_array_elements_text(
        p_payload->'commonOwners'
      ) as owner(value)
      where char_length(btrim(owner.value)) not between 1 and 80
    )
    or (
      select count(*)
      from jsonb_array_elements_text(
        p_payload->'commonOwners'
      )
    ) <> (
      select count(distinct lower(btrim(owner.value)))
      from jsonb_array_elements_text(
        p_payload->'commonOwners'
      ) as owner(value)
    )
  then
    raise exception 'The workspace owner labels are invalid.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'workingDays') <> 'array'
    or jsonb_array_length(p_payload->'workingDays') > 7
    or (
      p_require_complete
      and jsonb_array_length(p_payload->'workingDays') < 1
    )
    or exists (
      select 1
      from jsonb_array_elements(
        p_payload->'workingDays'
      ) as day(value)
      where jsonb_typeof(day.value) <> 'string'
    )
    or exists (
      select 1
      from jsonb_array_elements_text(
        p_payload->'workingDays'
      ) as day(value)
      where day.value not in (
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      )
    )
    or (
      select count(*)
      from jsonb_array_elements_text(
        p_payload->'workingDays'
      )
    ) <> (
      select count(distinct day.value)
      from jsonb_array_elements_text(
        p_payload->'workingDays'
      ) as day(value)
    )
  then
    raise exception 'The workspace working days are invalid.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'dailyBriefingEnabled')
      not in ('boolean', 'null')
    or jsonb_typeof(
      p_payload->'immediateFailureAlertsEnabled'
    ) not in ('boolean', 'null')
    or jsonb_typeof(p_payload->'opportunityAlertsEnabled')
      not in ('boolean', 'null')
    or (
      p_require_complete
      and (
        jsonb_typeof(p_payload->'dailyBriefingEnabled')
          <> 'boolean'
        or jsonb_typeof(
          p_payload->'immediateFailureAlertsEnabled'
        ) <> 'boolean'
        or jsonb_typeof(
          p_payload->'opportunityAlertsEnabled'
        ) <> 'boolean'
      )
    )
  then
    raise exception 'The workspace notification preferences are invalid.'
      using errcode = '22023';
  end if;

  if p_include_summary
    and (
      jsonb_typeof(p_payload->'summary') <> 'string'
      or char_length(btrim(p_payload->>'summary'))
        not between 1 and 2000
    )
  then
    raise exception 'The workspace setup summary is invalid.'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.assert_guided_workspace_setup_payload(
  jsonb,
  boolean,
  boolean
) is
  'Internal validation shared by guided workspace setup provider and review commands.';

revoke all
  on function public.assert_guided_workspace_setup_payload(
    jsonb,
    boolean,
    boolean
  )
  from public, anon, authenticated;

create or replace function public.agent_record_guided_workspace_setup_result(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_result_hash text,
  p_draft jsonb,
  p_missing_fields text[],
  p_uncertain_fields jsonb,
  p_clarification_questions text[],
  p_provider text,
  p_model text,
  p_provider_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_estimated_cost_usd numeric,
  p_chargeable_cost_usd numeric,
  p_step_idempotency_key uuid,
  p_usage_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_draft public.operations_agent_workspace_setup_drafts%rowtype;
  v_step public.operations_agent_steps%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or char_length(btrim(coalesce(p_worker_id, ''))) < 2
    or p_step_idempotency_key is null
    or p_usage_idempotency_key is null
    or p_result_hash is null
    or p_result_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Valid workspace setup result identifiers are required.'
      using errcode = '22023';
  end if;

  select draft.*
  into v_draft
  from public.operations_agent_workspace_setup_drafts as draft
  where draft.run_id = p_run_id
    and draft.workspace_id = p_workspace_id;

  if found then
    if v_draft.result_hash is distinct from p_result_hash then
      raise exception 'This Operations Agent run already has a different workspace setup result.'
        using errcode = '22023';
    end if;

    select run.*
    into v_run
    from public.operations_agent_runs as run
    where run.id = p_run_id
      and run.workspace_id = p_workspace_id;

    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'draft', to_jsonb(v_draft)
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

  if v_run.capability <> 'guided_workspace_setup'
    or v_run.mode <> 'suggest'
    or v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This Operations Agent run cannot accept a workspace setup result.'
      using errcode = '22023';
  end if;

  if v_run.execution_deadline_at is null
    or v_run.execution_deadline_at <= now()
    or v_run.lease_expires_at is null
    or v_run.lease_expires_at <= now()
  then
    raise exception 'The Operations Agent worker lease has expired.'
      using errcode = 'PT409';
  end if;

  perform public.assert_guided_workspace_setup_payload(
    p_draft,
    false,
    true
  );

  if not (
    coalesce(p_missing_fields, '{}'::text[]) <@ array[
      'businessType',
      'workflowStages',
      'commonOwners',
      'workingDays',
      'dailyBriefingEnabled',
      'immediateFailureAlertsEnabled',
      'opportunityAlertsEnabled'
    ]::text[]
  )
    or cardinality(coalesce(p_missing_fields, '{}'::text[])) > 7
  then
    raise exception 'The workspace setup missing-field list is invalid.'
      using errcode = '22023';
  end if;

  if p_uncertain_fields is null
    or jsonb_typeof(p_uncertain_fields) <> 'array'
    or jsonb_array_length(p_uncertain_fields) > 7
    or exists (
      select 1
      from jsonb_array_elements(
        p_uncertain_fields
      ) as uncertainty(value)
      where jsonb_typeof(uncertainty.value) <> 'object'
        or uncertainty.value->>'field' not in (
          'businessType',
          'workflowStages',
          'commonOwners',
          'workingDays',
          'dailyBriefingEnabled',
          'immediateFailureAlertsEnabled',
          'opportunityAlertsEnabled'
        )
        or char_length(
          btrim(coalesce(uncertainty.value->>'reason', ''))
        ) not between 2 and 500
    )
  then
    raise exception 'The workspace setup uncertainty list is invalid.'
      using errcode = '22023';
  end if;

  if cardinality(
    coalesce(p_clarification_questions, '{}'::text[])
  ) > 7 then
    raise exception 'The workspace setup question list is invalid.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    output_summary,
    details,
    idempotency_key,
    started_at,
    completed_at
  )
  values (
    p_workspace_id,
    p_run_id,
    'prepare_workspace_setup',
    0,
    'model',
    'Prepare workspace setup',
    'completed',
    1,
    1,
    'Structure stated operating preferences into a reviewable draft.',
    'A reviewable workspace setup draft was prepared.',
    jsonb_build_object(
      'provider', btrim(p_provider),
      'model', btrim(p_model),
      'providerResponseId',
        nullif(btrim(coalesce(p_provider_response_id, '')), ''),
      'missingFieldCount',
        cardinality(coalesce(p_missing_fields, '{}'::text[])),
      'uncertainFieldCount',
        jsonb_array_length(p_uncertain_fields)
    ),
    p_step_idempotency_key,
    now(),
    now()
  )
  returning * into v_step;

  perform public.agent_record_operations_agent_usage(
    p_workspace_id,
    p_run_id,
    v_step.id,
    p_usage_idempotency_key,
    'model',
    btrim(p_provider),
    btrim(p_model),
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_cached_input_tokens, 0),
    0,
    coalesce(p_estimated_cost_usd, 0),
    coalesce(p_chargeable_cost_usd, 0),
    0,
    true,
    'structured_workspace_setup'
  );

  insert into public.operations_agent_workspace_setup_drafts (
    workspace_id,
    run_id,
    initiated_by,
    draft,
    missing_fields,
    uncertain_fields,
    clarification_questions,
    state,
    provider,
    model,
    provider_response_id,
    result_hash
  )
  values (
    p_workspace_id,
    p_run_id,
    v_run.initiated_by,
    p_draft,
    coalesce(p_missing_fields, '{}'::text[]),
    p_uncertain_fields,
    coalesce(p_clarification_questions, '{}'::text[]),
    'waiting_for_review',
    btrim(p_provider),
    btrim(p_model),
    nullif(btrim(coalesce(p_provider_response_id, '')), ''),
    p_result_hash
  )
  returning * into v_draft;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    'review_workspace_setup',
    1,
    'approval',
    'Review workspace setup',
    'waiting_for_approval',
    0,
    1,
    'Review every operating preference before saving.',
    jsonb_build_object('draftId', v_draft.id)
  );

  update public.operations_agent_runs
  set
    state = 'waiting_for_approval',
    plan = jsonb_build_array(
      jsonb_build_object(
        'stepKey', 'prepare_workspace_setup',
        'state', 'completed'
      ),
      jsonb_build_object(
        'stepKey', 'review_workspace_setup',
        'state', 'waiting_for_approval'
      )
    ),
    current_step_index = 1,
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = now() + interval '7 days'
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
    'run_waiting_for_approval',
    'The guided workspace setup draft is waiting for owner review.',
    jsonb_build_object(
      'draftId', v_draft.id,
      'missingFields', v_draft.missing_fields,
      'uncertainFields', v_draft.uncertain_fields
    )
  );

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'draft', to_jsonb(v_draft)
  );
end;
$$;

comment on function public.agent_record_guided_workspace_setup_result(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text[],
  jsonb,
  text[],
  text,
  text,
  text,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  uuid,
  uuid
) is
  'Service-only boundary that records one provider result, usage, durable steps, and a Suggest-mode workspace setup draft.';

create or replace function public.agent_fail_guided_workspace_setup_run(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_failure_code text,
  p_failure_message text,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_step_idempotency_key uuid,
  p_usage_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_step_idempotency_key is null
    or p_usage_idempotency_key is null
  then
    raise exception 'Valid workspace setup failure identifiers are required.'
      using errcode = '22023';
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

  if v_run.state = 'failed' then
    return jsonb_build_object('run', to_jsonb(v_run));
  end if;

  if v_run.capability <> 'guided_workspace_setup'
    or v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This workspace setup preparation cannot be failed by this worker.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    failure_code,
    failure_message,
    idempotency_key,
    started_at,
    completed_at
  )
  values (
    p_workspace_id,
    p_run_id,
    'prepare_workspace_setup',
    0,
    'model',
    'Prepare workspace setup',
    'failed',
    1,
    1,
    'Structure stated operating preferences into a reviewable draft.',
    btrim(p_failure_code),
    left(btrim(p_failure_message), 2000),
    p_step_idempotency_key,
    now(),
    now()
  )
  returning * into v_step;

  perform public.agent_record_operations_agent_usage(
    p_workspace_id,
    p_run_id,
    v_step.id,
    p_usage_idempotency_key,
    'model',
    btrim(p_provider),
    btrim(p_model),
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_cached_input_tokens, 0),
    0,
    0,
    0,
    0,
    false,
    'failed_without_usable_result'
  );

  update public.operations_agent_runs
  set
    state = 'failed',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = null,
    completed_at = now(),
    failed_at = now(),
    failure_code = btrim(p_failure_code),
    failure_message = left(btrim(p_failure_message), 2000)
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
    'run_failed',
    'Workspace setup preparation failed without changing the operating profile.',
    jsonb_build_object('failureCode', v_run.failure_code)
  );

  return jsonb_build_object('run', to_jsonb(v_run));
end;
$$;

comment on function public.agent_fail_guided_workspace_setup_run(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  uuid,
  uuid
) is
  'Service-only failure boundary for guided workspace setup provider or validation failures.';

create or replace function public.command_complete_guided_workspace_setup(
  p_workspace_id uuid,
  p_run_id uuid,
  p_draft_id uuid,
  p_expected_run_updated_at timestamptz,
  p_expected_draft_updated_at timestamptz,
  p_approved_configuration jsonb,
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
    'operations_agent.guided_workspace_setup.complete';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_configuration jsonb := coalesce(
    p_approved_configuration,
    '{}'::jsonb
  );
  v_workflow_stages text[];
  v_common_owners text[];
  v_working_days text[];
  v_run public.operations_agent_runs%rowtype;
  v_draft public.operations_agent_workspace_setup_drafts%rowtype;
  v_profile public.workspace_operating_profiles%rowtype;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_draft_id is null
    or p_idempotency_key is null
    or p_expected_run_updated_at is null
    or p_expected_draft_updated_at is null
  then
    raise exception 'Valid workspace setup review identifiers are required.'
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

  perform public.assert_guided_workspace_setup_payload(
    v_configuration,
    true,
    false
  );

  select array_agg(stage.value order by stage.ordinality)
  into v_workflow_stages
  from jsonb_array_elements_text(
    v_configuration->'workflowStages'
  ) with ordinality as stage(value, ordinality);

  select array_agg(
    btrim(owner.value)
    order by owner.ordinality
  )
  into v_common_owners
  from jsonb_array_elements_text(
    v_configuration->'commonOwners'
  ) with ordinality as owner(value, ordinality);

  select array_agg(day.value order by day.ordinality)
  into v_working_days
  from jsonb_array_elements_text(
    v_configuration->'workingDays'
  ) with ordinality as day(value, ordinality);

  v_request_hash := md5(
    jsonb_build_object(
      'runId', p_run_id,
      'draftId', p_draft_id,
      'expectedRunUpdatedAt', p_expected_run_updated_at,
      'expectedDraftUpdatedAt', p_expected_draft_updated_at,
      'approvedConfiguration', v_configuration
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
      raise exception 'This request identifier was already used for a different workspace setup review.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This workspace setup review is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  perform 1
  from public.workspaces as workspace
  where workspace.id = p_workspace_id
    and workspace.owner_id = v_actor_id
  for update;

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

  select draft.*
  into v_draft
  from public.operations_agent_workspace_setup_drafts as draft
  where draft.id = p_draft_id
    and draft.run_id = p_run_id
    and draft.workspace_id = p_workspace_id
  for update of draft;

  if not found then
    raise exception 'Workspace setup draft not found.'
      using errcode = 'P0002';
  end if;

  if v_run.initiated_by <> v_actor_id
    or v_draft.initiated_by <> v_actor_id
    or v_run.capability <> 'guided_workspace_setup'
    or v_run.mode <> 'suggest'
  then
    raise exception 'This workspace setup draft is unavailable.'
      using errcode = '42501';
  end if;

  if v_run.state <> 'waiting_for_approval'
    or v_draft.state <> 'waiting_for_review'
    or v_run.updated_at <> p_expected_run_updated_at
    or v_draft.updated_at <> p_expected_draft_updated_at
  then
    raise exception 'This workspace setup draft changed elsewhere. Refresh before saving.'
      using errcode = 'PT409';
  end if;

  insert into public.workspace_operating_profiles (
    workspace_id,
    business_type,
    workflow_stages,
    common_owners,
    working_days,
    daily_briefing_enabled,
    immediate_failure_alerts_enabled,
    opportunity_alerts_enabled,
    created_by,
    updated_by
  )
  values (
    p_workspace_id,
    btrim(v_configuration->>'businessType'),
    v_workflow_stages,
    v_common_owners,
    v_working_days,
    (v_configuration->>'dailyBriefingEnabled')::boolean,
    (
      v_configuration->>'immediateFailureAlertsEnabled'
    )::boolean,
    (v_configuration->>'opportunityAlertsEnabled')::boolean,
    v_actor_id,
    v_actor_id
  )
  on conflict (workspace_id) do update
  set
    business_type = excluded.business_type,
    workflow_stages = excluded.workflow_stages,
    common_owners = excluded.common_owners,
    working_days = excluded.working_days,
    daily_briefing_enabled =
      excluded.daily_briefing_enabled,
    immediate_failure_alerts_enabled =
      excluded.immediate_failure_alerts_enabled,
    opportunity_alerts_enabled =
      excluded.opportunity_alerts_enabled,
    updated_by = excluded.updated_by
  returning * into v_profile;

  update public.operations_agent_workspace_setup_drafts
  set
    state = 'saved',
    approved_configuration = v_configuration,
    saved_workspace_id = p_workspace_id
  where id = p_draft_id
    and run_id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_draft;

  update public.operations_agent_steps
  set
    state = 'completed',
    attempt_count = 1,
    output_summary = 'The reviewed workspace setup was saved.',
    completed_at = now()
  where run_id = p_run_id
    and workspace_id = p_workspace_id
    and step_key = 'review_workspace_setup'
    and state = 'waiting_for_approval';

  if not found then
    raise exception 'The workspace setup review step is unavailable.'
      using errcode = 'PT409';
  end if;

  update public.operations_agent_runs
  set
    state = 'completed',
    plan = jsonb_build_array(
      jsonb_build_object(
        'stepKey', 'prepare_workspace_setup',
        'state', 'completed'
      ),
      jsonb_build_object(
        'stepKey', 'review_workspace_setup',
        'state', 'completed'
      )
    ),
    current_step_index = 2,
    approval_expires_at = null,
    completed_at = now(),
    outcome_summary = 'The reviewed workspace setup was saved.'
  where id = p_run_id
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
  values (
    p_workspace_id,
    p_run_id,
    v_actor_id,
    'run_completed',
    'The workspace owner reviewed and saved the operating setup.',
    jsonb_build_object(
      'draftId', v_draft.id,
      'workspaceId', p_workspace_id
    )
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'run', to_jsonb(v_run),
    'draft', to_jsonb(v_draft),
    'profile', to_jsonb(v_profile)
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

comment on function public.command_complete_guided_workspace_setup(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  uuid
) is
  'Owner-only idempotent boundary that saves a reviewed workspace operating profile and completes the Suggest-mode agent run.';

revoke all
  on table public.workspace_operating_profiles
  from public, anon, authenticated;
revoke all
  on table public.operations_agent_workspace_setup_drafts
  from public, anon, authenticated;

grant select
  on table public.workspace_operating_profiles
  to authenticated;
grant select
  on table public.operations_agent_workspace_setup_drafts
  to authenticated;

grant select, insert, update
  on table public.workspace_operating_profiles
  to service_role;
grant select, insert, update
  on table public.operations_agent_workspace_setup_drafts
  to service_role;

revoke all
  on function public.agent_record_guided_workspace_setup_result(
    uuid,
    uuid,
    text,
    text,
    jsonb,
    text[],
    jsonb,
    text[],
    text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    uuid,
    uuid
  )
  from public, anon, authenticated;
grant execute
  on function public.agent_record_guided_workspace_setup_result(
    uuid,
    uuid,
    text,
    text,
    jsonb,
    text[],
    jsonb,
    text[],
    text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    uuid,
    uuid
  )
  to service_role;

revoke all
  on function public.agent_fail_guided_workspace_setup_run(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    uuid,
    uuid
  )
  from public, anon, authenticated;
grant execute
  on function public.agent_fail_guided_workspace_setup_run(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    uuid,
    uuid
  )
  to service_role;

revoke all
  on function public.command_complete_guided_workspace_setup(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    jsonb,
    uuid
  )
  from public, anon, service_role;
grant execute
  on function public.command_complete_guided_workspace_setup(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    jsonb,
    uuid
  )
  to authenticated;

commit;
