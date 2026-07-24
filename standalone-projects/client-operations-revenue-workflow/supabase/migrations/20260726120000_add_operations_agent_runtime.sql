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
        'operations_agent_runs.cancel'
      )
    );

create table public.operations_agent_capability_policies (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  capability text not null,
  enabled boolean not null default true,
  allowed_mode text not null default 'suggest',
  max_concurrent_runs integer not null default 1,
  monthly_cost_limit_usd numeric(12, 6) not null default 5.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, capability),
  constraint operations_agent_policy_capability_check
    check (capability in ('guided_client_intake')),
  constraint operations_agent_policy_mode_check
    check (
      allowed_mode in (
        'suggest',
        'approval_required',
        'delegated'
      )
    ),
  constraint operations_agent_policy_concurrency_check
    check (max_concurrent_runs = 1),
  constraint operations_agent_policy_cost_check
    check (
      monthly_cost_limit_usd >= 0
      and monthly_cost_limit_usd <= 10000
    )
);

comment on table public.operations_agent_capability_policies is
  'Workspace kill switches and ceilings for Operations Agent capabilities. The first capability is Suggest-only guided client intake.';

create trigger set_operations_agent_policy_updated_at
before update on public.operations_agent_capability_policies
for each row
execute function public.set_updated_at();

create table public.operations_agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  initiated_by uuid not null
    references auth.users(id) on delete restrict,
  capability text not null,
  mode text not null default 'suggest',
  trigger_type text not null default 'user',
  objective text not null,
  context jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  state text not null default 'queued',
  current_step_index integer not null default 0,
  model_calls integer not null default 0,
  tool_calls integer not null default 0,
  retry_count integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  chargeable_cost_usd numeric(12, 6) not null default 0,
  max_model_calls integer not null default 6,
  max_tool_calls integer not null default 12,
  max_retries integer not null default 2,
  max_duration_seconds integer not null default 900,
  max_cost_usd numeric(12, 6) not null default 0.50,
  worker_id text,
  lease_expires_at timestamptz,
  execution_deadline_at timestamptz,
  approval_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  outcome_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint operations_agent_runs_capability_check
    check (capability in ('guided_client_intake')),
  constraint operations_agent_runs_mode_check
    check (
      mode in (
        'suggest',
        'approval_required',
        'delegated'
      )
    ),
  constraint operations_agent_runs_trigger_check
    check (
      trigger_type in (
        'user',
        'durable_event',
        'scheduled'
      )
    ),
  constraint operations_agent_runs_state_check
    check (
      state in (
        'queued',
        'running',
        'waiting_for_approval',
        'completed',
        'failed',
        'cancelled',
        'expired',
        'partially_completed'
      )
    ),
  constraint operations_agent_runs_objective_check
    check (
      char_length(btrim(objective)) between 3 and 2000
    ),
  constraint operations_agent_runs_context_check
    check (
      jsonb_typeof(context) = 'object'
      and octet_length(context::text) <= 65536
    ),
  constraint operations_agent_runs_plan_check
    check (
      jsonb_typeof(plan) = 'array'
      and octet_length(plan::text) <= 131072
    ),
  constraint operations_agent_runs_counts_check
    check (
      current_step_index >= 0
      and model_calls between 0 and max_model_calls
      and tool_calls between 0 and max_tool_calls
      and retry_count between 0 and max_retries
      and max_model_calls between 1 and 12
      and max_tool_calls between 0 and 30
      and max_retries between 0 and 5
      and max_duration_seconds between 60 and 3600
    ),
  constraint operations_agent_runs_cost_check
    check (
      estimated_cost_usd >= 0
      and chargeable_cost_usd >= 0
      and chargeable_cost_usd <= estimated_cost_usd
      and chargeable_cost_usd <= max_cost_usd
      and max_cost_usd between 0.01 and 25
    ),
  constraint operations_agent_runs_terminal_check
    check (
      (
        state in (
          'completed',
          'failed',
          'cancelled',
          'expired',
          'partially_completed'
        )
        and completed_at is not null
      )
      or (
        state in (
          'queued',
          'running',
          'waiting_for_approval'
        )
        and completed_at is null
      )
    ),
  constraint operations_agent_runs_cancelled_check
    check (
      (state = 'cancelled' and cancelled_at is not null)
      or (state <> 'cancelled' and cancelled_at is null)
    ),
  constraint operations_agent_runs_failed_check
    check (
      (
        state = 'failed'
        and failed_at is not null
        and char_length(btrim(coalesce(failure_code, ''))) >= 2
        and char_length(btrim(coalesce(failure_message, ''))) >= 3
      )
      or (
        state <> 'failed'
        and failed_at is null
        and failure_code is null
        and failure_message is null
      )
    )
);

comment on table public.operations_agent_runs is
  'Durable, provider-neutral Operations Agent runs. Manual workflows remain authoritative and available when runs are unavailable.';

create trigger set_operations_agent_run_updated_at
before update on public.operations_agent_runs
for each row
execute function public.set_updated_at();

create unique index operations_agent_runs_one_active_workspace_idx
  on public.operations_agent_runs (workspace_id)
  where state in (
    'queued',
    'running',
    'waiting_for_approval'
  );

create index operations_agent_runs_workspace_history_idx
  on public.operations_agent_runs (
    workspace_id,
    created_at desc
  );

create index operations_agent_runs_service_queue_idx
  on public.operations_agent_runs (
    state,
    created_at
  )
  where state in ('queued', 'running');

create table public.operations_agent_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  step_key text not null,
  step_index integer not null,
  kind text not null,
  title text not null,
  state text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 1,
  tool_name text,
  input_summary text,
  output_summary text,
  details jsonb not null default '{}'::jsonb,
  idempotency_key uuid,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  unique (run_id, step_key),
  unique (run_id, step_index),
  unique (run_id, idempotency_key),
  unique (id, workspace_id, run_id),
  constraint operations_agent_steps_key_check
    check (
      step_key = btrim(step_key)
      and char_length(step_key) between 2 and 100
    ),
  constraint operations_agent_steps_title_check
    check (
      char_length(btrim(title)) between 3 and 200
    ),
  constraint operations_agent_steps_index_check
    check (step_index >= 0),
  constraint operations_agent_steps_kind_check
    check (kind in ('model', 'tool', 'approval', 'system')),
  constraint operations_agent_steps_state_check
    check (
      state in (
        'queued',
        'running',
        'waiting_for_approval',
        'completed',
        'failed',
        'cancelled',
        'expired',
        'partially_completed'
      )
    ),
  constraint operations_agent_steps_attempts_check
    check (
      max_attempts between 1 and 6
      and attempt_count between 0 and max_attempts
    ),
  constraint operations_agent_steps_details_check
    check (
      jsonb_typeof(details) = 'object'
      and octet_length(details::text) <= 131072
    )
);

comment on table public.operations_agent_steps is
  'Bounded durable steps for one Operations Agent run. Step payloads contain summaries and structured state, not unrestricted workspace exports.';

create trigger set_operations_agent_step_updated_at
before update on public.operations_agent_steps
for each row
execute function public.set_updated_at();

create index operations_agent_steps_run_idx
  on public.operations_agent_steps (
    workspace_id,
    run_id,
    step_index
  );

create table public.operations_agent_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  constraint operations_agent_run_events_type_check
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
        'run_partially_completed'
      )
    ),
  constraint operations_agent_run_events_note_check
    check (char_length(btrim(note)) between 3 and 1000),
  constraint operations_agent_run_events_details_check
    check (
      jsonb_typeof(details) = 'object'
      and octet_length(details::text) <= 65536
    )
);

comment on table public.operations_agent_run_events is
  'Append-only lifecycle history for Operations Agent recommendations, approvals, failures, and outcomes.';

create index operations_agent_run_events_run_idx
  on public.operations_agent_run_events (
    workspace_id,
    run_id,
    created_at
  );

create table public.operations_agent_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  step_id uuid,
  idempotency_key uuid not null,
  request_hash text not null,
  capability text not null,
  call_kind text not null,
  provider text not null,
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  tool_fee_usd numeric(12, 6) not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  chargeable_cost_usd numeric(12, 6) not null default 0,
  retry_number integer not null default 0,
  usable_result boolean not null default false,
  outcome text not null,
  created_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  foreign key (step_id, workspace_id, run_id)
    references public.operations_agent_steps(
      id,
      workspace_id,
      run_id
    )
    on delete restrict,
  unique (run_id, idempotency_key),
  constraint operations_agent_usage_capability_check
    check (capability in ('guided_client_intake')),
  constraint operations_agent_usage_kind_check
    check (call_kind in ('model', 'tool')),
  constraint operations_agent_usage_provider_check
    check (char_length(btrim(provider)) between 2 and 100),
  constraint operations_agent_usage_tokens_check
    check (
      input_tokens >= 0
      and output_tokens >= 0
      and cached_input_tokens >= 0
      and cached_input_tokens <= input_tokens
      and retry_number between 0 and 5
    ),
  constraint operations_agent_usage_cost_check
    check (
      tool_fee_usd >= 0
      and estimated_cost_usd >= 0
      and chargeable_cost_usd >= 0
      and chargeable_cost_usd <= estimated_cost_usd
      and (usable_result or chargeable_cost_usd = 0)
    ),
  constraint operations_agent_usage_outcome_check
    check (char_length(btrim(outcome)) between 2 and 500)
);

comment on table public.operations_agent_usage_events is
  'Per-call Operations Agent usage and cost ledger. Provider failures without a usable result cannot consume customer allowance.';

create index operations_agent_usage_workspace_month_idx
  on public.operations_agent_usage_events (
    workspace_id,
    created_at
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
  values (
    new.id,
    'guided_client_intake',
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
  'Seeds the Suggest-only guided client intake policy for a new workspace.';

revoke all
  on function public.seed_default_operations_agent_policy()
  from public, anon, authenticated;

create trigger seed_default_operations_agent_policy
after insert on public.workspaces
for each row
execute function public.seed_default_operations_agent_policy();

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
  'guided_client_intake',
  true,
  'suggest',
  1,
  5.00
from public.workspaces as workspace
on conflict do nothing;

alter table public.operations_agent_capability_policies
  enable row level security;
alter table public.operations_agent_runs
  enable row level security;
alter table public.operations_agent_steps
  enable row level security;
alter table public.operations_agent_run_events
  enable row level security;
alter table public.operations_agent_usage_events
  enable row level security;

create policy operations_agent_policies_owner_select
  on public.operations_agent_capability_policies
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

create policy operations_agent_runs_owner_select
  on public.operations_agent_runs
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

create policy operations_agent_steps_owner_select
  on public.operations_agent_steps
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

create policy operations_agent_events_owner_select
  on public.operations_agent_run_events
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

create policy operations_agent_usage_owner_select
  on public.operations_agent_usage_events
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

  if p_capability <> 'guided_client_intake' then
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

comment on function public.command_start_operations_agent_run(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  uuid
) is
  'Queues one bounded Suggest-mode Operations Agent run for an enabled workspace capability.';

create or replace function public.command_cancel_operations_agent_run(
  p_workspace_id uuid,
  p_run_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'operations_agent_runs.cancel';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
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

  if p_run_id is null or p_expected_updated_at is null then
    raise exception 'The Operations Agent run version is required.'
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
      'runId', p_run_id,
      'expectedUpdatedAt', p_expected_updated_at
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
      raise exception 'This request identifier was already used for a different Operations Agent cancellation.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This Operations Agent cancellation is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
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

  if v_run.initiated_by <> v_actor_id then
    raise exception 'Only the initiating user can cancel this Operations Agent run.'
      using errcode = '42501';
  end if;

  if v_run.updated_at <> p_expected_updated_at then
    raise exception 'This Operations Agent run changed elsewhere. Refresh before trying again.'
      using errcode = 'PT409';
  end if;

  if v_run.state not in (
    'queued',
    'running',
    'waiting_for_approval'
  ) then
    raise exception 'This Operations Agent run can no longer be cancelled.'
      using errcode = '22023';
  end if;

  update public.operations_agent_steps
  set
    state = 'cancelled',
    completed_at = now()
  where workspace_id = p_workspace_id
    and run_id = p_run_id
    and state in (
      'queued',
      'running',
      'waiting_for_approval'
    );

  update public.operations_agent_runs
  set
    state = 'cancelled',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = null,
    cancelled_at = now(),
    completed_at = now(),
    outcome_summary = 'Cancelled by the initiating user.'
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    actor_id,
    event_type,
    note
  )
  values (
    p_workspace_id,
    v_run.id,
    v_actor_id,
    'run_cancelled',
    'The initiating user cancelled the Operations Agent run.'
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

comment on function public.command_cancel_operations_agent_run(
  uuid,
  uuid,
  timestamptz,
  uuid
) is
  'Cancels one active Operations Agent run owned by the initiating workspace user.';

create or replace function public.agent_claim_operations_agent_run(
  p_workspace_id uuid,
  p_run_id uuid,
  p_expected_updated_at timestamptz,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_worker_id, ''))) < 3
    or char_length(btrim(p_worker_id)) > 200
  then
    raise exception 'A valid worker identifier is required.'
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

  if v_run.updated_at <> p_expected_updated_at then
    raise exception 'The Operations Agent run version is stale.'
      using errcode = 'PT409';
  end if;

  if not exists (
    select 1
    from public.operations_agent_capability_policies as policy
    where policy.workspace_id = p_workspace_id
      and policy.capability = v_run.capability
      and policy.enabled
  ) then
    raise exception 'This Operations Agent capability is disabled.'
      using errcode = '42501';
  end if;

  if v_run.state = 'running'
    and v_run.lease_expires_at is not null
    and v_run.lease_expires_at > now()
  then
    raise exception 'This Operations Agent run is already leased.'
      using errcode = 'PT409';
  end if;

  if v_run.state not in ('queued', 'running') then
    raise exception 'This Operations Agent run is not available to claim.'
      using errcode = '22023';
  end if;

  if v_run.execution_deadline_at is not null
    and v_run.execution_deadline_at <= now()
  then
    update public.operations_agent_runs
    set
      state = 'expired',
      worker_id = null,
      lease_expires_at = null,
      completed_at = now(),
      outcome_summary = 'The bounded execution window expired.'
    where id = p_run_id
      and workspace_id = p_workspace_id
    returning * into v_run;

    insert into public.operations_agent_run_events (
      workspace_id,
      run_id,
      event_type,
      note
    )
    values (
      p_workspace_id,
      v_run.id,
      'run_expired',
      'The Operations Agent execution window expired before the run could resume.'
    );

    return jsonb_build_object('run', to_jsonb(v_run));
  end if;

  update public.operations_agent_runs
  set
    state = 'running',
    worker_id = btrim(p_worker_id),
    lease_expires_at = now() + interval '2 minutes',
    execution_deadline_at = coalesce(
      execution_deadline_at,
      now() + make_interval(secs => max_duration_seconds)
    ),
    started_at = coalesce(started_at, now())
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
    v_run.id,
    'run_claimed',
    'A server worker claimed the Operations Agent run.',
    jsonb_build_object('workerId', v_run.worker_id)
  );

  return jsonb_build_object('run', to_jsonb(v_run));
end;
$$;

comment on function public.agent_claim_operations_agent_run(
  uuid,
  uuid,
  timestamptz,
  text
) is
  'Service-only lease boundary for claiming or safely resuming a durable Operations Agent run.';

create or replace function public.agent_transition_operations_agent_run(
  p_workspace_id uuid,
  p_run_id uuid,
  p_expected_updated_at timestamptz,
  p_target_state text,
  p_outcome_summary text,
  p_failure_code text,
  p_failure_message text,
  p_approval_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_event_type text;
  v_note text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
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

  if v_run.updated_at <> p_expected_updated_at then
    raise exception 'The Operations Agent run version is stale.'
      using errcode = 'PT409';
  end if;

  if p_target_state not in (
    'queued',
    'waiting_for_approval',
    'completed',
    'failed',
    'expired',
    'partially_completed'
  ) then
    raise exception 'Choose a valid Operations Agent run transition.'
      using errcode = '22023';
  end if;

  if not (
    (v_run.state = 'running' and p_target_state in (
      'waiting_for_approval',
      'completed',
      'failed',
      'expired',
      'partially_completed'
    ))
    or (
      v_run.state = 'waiting_for_approval'
      and p_target_state in ('queued', 'expired')
    )
    or (
      v_run.state = 'failed'
      and p_target_state = 'queued'
    )
  ) then
    raise exception 'This Operations Agent state transition is not allowed.'
      using errcode = '22023';
  end if;

  if p_target_state = 'queued'
    and v_run.state = 'failed'
    and v_run.retry_count >= v_run.max_retries
  then
    raise exception 'The Operations Agent retry limit has been reached.'
      using errcode = '22023';
  end if;

  if p_target_state = 'waiting_for_approval'
    and (
      p_approval_expires_at is null
      or p_approval_expires_at <= now()
      or p_approval_expires_at > now() + interval '30 days'
    )
  then
    raise exception 'Choose a valid approval expiry within 30 days.'
      using errcode = '22023';
  end if;

  if p_target_state = 'failed'
    and (
      char_length(btrim(coalesce(p_failure_code, ''))) < 2
      or char_length(btrim(coalesce(p_failure_message, ''))) < 3
    )
  then
    raise exception 'Record the Operations Agent failure code and message.'
      using errcode = '22023';
  end if;

  if p_target_state in ('completed', 'partially_completed')
    and char_length(btrim(coalesce(p_outcome_summary, ''))) < 3
  then
    raise exception 'Record the Operations Agent outcome.'
      using errcode = '22023';
  end if;

  update public.operations_agent_runs
  set
    state = p_target_state,
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = case
      when p_target_state = 'waiting_for_approval'
        then p_approval_expires_at
      else null
    end,
    retry_count = case
      when p_target_state = 'queued' and state = 'failed'
        then retry_count + 1
      else retry_count
    end,
    completed_at = case
      when p_target_state in (
        'completed',
        'failed',
        'expired',
        'partially_completed'
      )
        then now()
      else null
    end,
    failed_at = case
      when p_target_state = 'failed' then now()
      else null
    end,
    failure_code = case
      when p_target_state = 'failed'
        then btrim(p_failure_code)
      else null
    end,
    failure_message = case
      when p_target_state = 'failed'
        then btrim(p_failure_message)
      else null
    end,
    outcome_summary = case
      when p_target_state in ('completed', 'partially_completed')
        then btrim(p_outcome_summary)
      when p_target_state = 'expired'
        then coalesce(
          nullif(btrim(coalesce(p_outcome_summary, '')), ''),
          'The Operations Agent run expired.'
        )
      else null
    end
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  v_event_type := case p_target_state
    when 'queued' then 'run_resumed'
    when 'waiting_for_approval' then 'run_waiting_for_approval'
    when 'completed' then 'run_completed'
    when 'failed' then 'run_failed'
    when 'expired' then 'run_expired'
    when 'partially_completed' then 'run_partially_completed'
  end;

  v_note := case p_target_state
    when 'queued' then 'The Operations Agent run was queued to resume.'
    when 'waiting_for_approval' then 'The Operations Agent run is waiting for an exact user approval.'
    when 'completed' then 'The Operations Agent run completed.'
    when 'failed' then 'The Operations Agent run failed without applying a partial workflow change.'
    when 'expired' then 'The Operations Agent run expired.'
    when 'partially_completed' then 'The Operations Agent run stopped with a recorded partial outcome.'
  end;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    v_run.id,
    v_event_type,
    v_note,
    jsonb_strip_nulls(
      jsonb_build_object(
        'failureCode', v_run.failure_code,
        'outcomeSummary', v_run.outcome_summary,
        'approvalExpiresAt', v_run.approval_expires_at
      )
    )
  );

  return jsonb_build_object('run', to_jsonb(v_run));
end;
$$;

comment on function public.agent_transition_operations_agent_run(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz
) is
  'Service-only state machine for waiting, retry, completion, failure, expiry, and partial outcomes.';

create or replace function public.agent_record_operations_agent_usage(
  p_workspace_id uuid,
  p_run_id uuid,
  p_step_id uuid,
  p_idempotency_key uuid,
  p_call_kind text,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_tool_fee_usd numeric,
  p_estimated_cost_usd numeric,
  p_chargeable_cost_usd numeric,
  p_retry_number integer,
  p_usable_result boolean,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_usage public.operations_agent_usage_events%rowtype;
  v_request_hash text;
  v_model_increment integer := 0;
  v_tool_increment integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'A usage request identifier is required.'
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

  if p_call_kind not in ('model', 'tool') then
    raise exception 'Choose a valid Operations Agent call type.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_provider, ''))) < 2
    or char_length(btrim(coalesce(p_outcome, ''))) < 2
  then
    raise exception 'Record the provider and call outcome.'
      using errcode = '22023';
  end if;

  if coalesce(p_input_tokens, 0) < 0
    or coalesce(p_output_tokens, 0) < 0
    or coalesce(p_cached_input_tokens, 0) < 0
    or coalesce(p_cached_input_tokens, 0)
      > coalesce(p_input_tokens, 0)
    or coalesce(p_tool_fee_usd, 0) < 0
    or coalesce(p_estimated_cost_usd, 0) < 0
    or coalesce(p_chargeable_cost_usd, 0) < 0
    or coalesce(p_chargeable_cost_usd, 0)
      > coalesce(p_estimated_cost_usd, 0)
    or coalesce(p_retry_number, 0) not between 0 and 5
  then
    raise exception 'Operations Agent usage values are invalid.'
      using errcode = '22023';
  end if;

  if not coalesce(p_usable_result, false)
    and coalesce(p_chargeable_cost_usd, 0) <> 0
  then
    raise exception 'Provider failures without a usable result cannot consume allowance.'
      using errcode = '22023';
  end if;

  if p_step_id is not null
    and not exists (
      select 1
      from public.operations_agent_steps as step
      where step.id = p_step_id
        and step.workspace_id = p_workspace_id
        and step.run_id = p_run_id
    )
  then
    raise exception 'Operations Agent step not found in this run.'
      using errcode = 'P0002';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'stepId', p_step_id,
      'callKind', p_call_kind,
      'provider', btrim(p_provider),
      'model', btrim(coalesce(p_model, '')),
      'inputTokens', coalesce(p_input_tokens, 0),
      'outputTokens', coalesce(p_output_tokens, 0),
      'cachedInputTokens', coalesce(p_cached_input_tokens, 0),
      'toolFeeUsd', coalesce(p_tool_fee_usd, 0),
      'estimatedCostUsd', coalesce(p_estimated_cost_usd, 0),
      'chargeableCostUsd', coalesce(p_chargeable_cost_usd, 0),
      'retryNumber', coalesce(p_retry_number, 0),
      'usableResult', coalesce(p_usable_result, false),
      'outcome', btrim(p_outcome)
    )::text
  );

  select usage.*
  into v_usage
  from public.operations_agent_usage_events as usage
  where usage.run_id = p_run_id
    and usage.idempotency_key = p_idempotency_key;

  if found then
    if v_usage.request_hash is distinct from v_request_hash then
      raise exception 'This usage request identifier was already used for different Operations Agent usage.'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'usage', to_jsonb(v_usage)
    );
  end if;

  if v_run.state <> 'running' then
    raise exception 'Usage can be recorded only for a running Operations Agent run.'
      using errcode = '22023';
  end if;

  v_model_increment := case
    when p_call_kind = 'model' then 1
    else 0
  end;
  v_tool_increment := case
    when p_call_kind = 'tool' then 1
    else 0
  end;

  if v_run.model_calls + v_model_increment
      > v_run.max_model_calls
    or v_run.tool_calls + v_tool_increment
      > v_run.max_tool_calls
  then
    raise exception 'The Operations Agent call limit has been reached.'
      using errcode = '22023';
  end if;

  if v_run.chargeable_cost_usd
      + coalesce(p_chargeable_cost_usd, 0)
      > v_run.max_cost_usd
  then
    raise exception 'The Operations Agent run cost limit has been reached.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_usage_events (
    workspace_id,
    run_id,
    step_id,
    idempotency_key,
    request_hash,
    capability,
    call_kind,
    provider,
    model,
    input_tokens,
    output_tokens,
    cached_input_tokens,
    tool_fee_usd,
    estimated_cost_usd,
    chargeable_cost_usd,
    retry_number,
    usable_result,
    outcome
  )
  values (
    p_workspace_id,
    p_run_id,
    p_step_id,
    p_idempotency_key,
    v_request_hash,
    v_run.capability,
    p_call_kind,
    btrim(p_provider),
    btrim(coalesce(p_model, '')),
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_cached_input_tokens, 0),
    coalesce(p_tool_fee_usd, 0),
    coalesce(p_estimated_cost_usd, 0),
    coalesce(p_chargeable_cost_usd, 0),
    coalesce(p_retry_number, 0),
    coalesce(p_usable_result, false),
    btrim(p_outcome)
  )
  returning * into v_usage;

  update public.operations_agent_runs
  set
    model_calls = model_calls + v_model_increment,
    tool_calls = tool_calls + v_tool_increment,
    estimated_cost_usd = estimated_cost_usd
      + coalesce(p_estimated_cost_usd, 0),
    chargeable_cost_usd = chargeable_cost_usd
      + coalesce(p_chargeable_cost_usd, 0)
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'usage', to_jsonb(v_usage)
  );
end;
$$;

comment on function public.agent_record_operations_agent_usage(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  integer,
  boolean,
  text
) is
  'Service-only atomic usage ledger and per-run call and cost ceiling enforcement.';

revoke all
  on table public.operations_agent_capability_policies,
    public.operations_agent_runs,
    public.operations_agent_steps,
    public.operations_agent_run_events,
    public.operations_agent_usage_events
  from public, anon, authenticated;

grant select
  on table public.operations_agent_capability_policies,
    public.operations_agent_runs,
    public.operations_agent_steps,
    public.operations_agent_run_events,
    public.operations_agent_usage_events
  to authenticated;

grant all
  on table public.operations_agent_capability_policies,
    public.operations_agent_runs,
    public.operations_agent_steps,
    public.operations_agent_run_events,
    public.operations_agent_usage_events
  to service_role;

revoke all
  on function public.command_start_operations_agent_run(
    uuid,
    text,
    text,
    jsonb,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_start_operations_agent_run(
    uuid,
    text,
    text,
    jsonb,
    jsonb,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_cancel_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_cancel_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  to authenticated;

revoke all
  on function public.agent_claim_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    text
  )
  from public, anon, authenticated;

grant execute
  on function public.agent_claim_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    text
  )
  to service_role;

revoke all
  on function public.agent_transition_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    text,
    text,
    text,
    text,
    timestamptz
  )
  from public, anon, authenticated;

grant execute
  on function public.agent_transition_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    text,
    text,
    text,
    text,
    timestamptz
  )
  to service_role;

revoke all
  on function public.agent_record_operations_agent_usage(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    numeric,
    integer,
    boolean,
    text
  )
  from public, anon, authenticated;

grant execute
  on function public.agent_record_operations_agent_usage(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    numeric,
    integer,
    boolean,
    text
  )
  to service_role;

commit;
