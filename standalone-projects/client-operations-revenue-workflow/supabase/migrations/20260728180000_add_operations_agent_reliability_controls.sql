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
        'operations_agent_runs.recover',
        'operations_agent.controls.update',
        'operations_agent.guided_client_intake.complete',
        'operations_agent.guided_workspace_setup.complete',
        'operations_agent.approvals.approve',
        'operations_agent.approvals.reject',
        'operations_agent.next_action.prepare',
        'operations_agent.approvals.execute'
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
        'run_retry_recorded',
        'run_recovered',
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
        'approval_cancelled',
        'tool_execution_started',
        'tool_execution_succeeded',
        'tool_execution_failed'
      )
    );

create or replace function public.enforce_operations_agent_workspace_allowance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_policy public.operations_agent_capability_policies%rowtype;
  v_monthly_chargeable numeric(12, 6);
begin
  if new.chargeable_cost_usd <= 0 then
    return new;
  end if;

  select policy.*
  into v_policy
  from public.operations_agent_capability_policies as policy
  where policy.workspace_id = new.workspace_id
    and policy.capability = new.capability
  for share;

  if not found or not v_policy.enabled then
    raise exception 'This Operations Agent capability is paused.'
      using errcode = '42501';
  end if;

  select coalesce(sum(usage.chargeable_cost_usd), 0)
  into v_monthly_chargeable
  from public.operations_agent_usage_events as usage
  where usage.workspace_id = new.workspace_id
    and usage.created_at >= date_trunc('month', now());

  if v_monthly_chargeable + new.chargeable_cost_usd
      > v_policy.monthly_cost_limit_usd
  then
    raise exception 'The workspace Operations Agent monthly cost limit has been reached.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.enforce_operations_agent_workspace_allowance() is
  'Rejects chargeable Operations Agent usage when a capability is paused or the workspace monthly hard limit would be exceeded.';

revoke all
  on function public.enforce_operations_agent_workspace_allowance()
  from public, anon, authenticated;

create trigger enforce_operations_agent_workspace_allowance
before insert on public.operations_agent_usage_events
for each row
execute function public.enforce_operations_agent_workspace_allowance();

create or replace function public.agent_assert_operations_agent_allowance(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_policy public.operations_agent_capability_policies%rowtype;
  v_monthly_chargeable numeric(12, 6);
  v_reserved_remaining numeric(12, 6);
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
  for share of run;

  if not found then
    raise exception 'Operations Agent run not found.'
      using errcode = 'P0002';
  end if;

  if v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This worker no longer owns the Operations Agent run.'
      using errcode = 'PT409';
  end if;

  if v_run.lease_expires_at is null
    or v_run.lease_expires_at <= now()
    or v_run.execution_deadline_at is null
    or v_run.execution_deadline_at <= now()
  then
    raise exception 'The Operations Agent execution window has expired.'
      using errcode = 'PT409';
  end if;

  select policy.*
  into v_policy
  from public.operations_agent_capability_policies as policy
  where policy.workspace_id = p_workspace_id
    and policy.capability = v_run.capability
  for share of policy;

  if not found or not v_policy.enabled then
    raise exception 'This Operations Agent capability is paused.'
      using errcode = '42501';
  end if;

  select coalesce(sum(usage.chargeable_cost_usd), 0)
  into v_monthly_chargeable
  from public.operations_agent_usage_events as usage
  where usage.workspace_id = p_workspace_id
    and usage.created_at >= date_trunc('month', now());

  v_reserved_remaining := greatest(
    v_run.max_cost_usd - v_run.chargeable_cost_usd,
    0
  );

  if v_monthly_chargeable + v_reserved_remaining
      > v_policy.monthly_cost_limit_usd
  then
    raise exception 'The workspace Operations Agent monthly cost limit has been reached.'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'monthlyChargeableCostUsd', v_monthly_chargeable,
    'reservedRemainingUsd', v_reserved_remaining
  );
end;
$$;

comment on function public.agent_assert_operations_agent_allowance(
  uuid,
  uuid,
  text
) is
  'Service-only preflight that blocks provider calls after a capability pause or a reduced workspace hard limit.';

create or replace function public.agent_record_operations_agent_retry(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_retry_number integer,
  p_failure_code text,
  p_failure_message text,
  p_provider text,
  p_model text,
  p_usage_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_usage public.operations_agent_usage_events%rowtype;
  v_usage_response jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_usage_idempotency_key is null
    or p_retry_number is null
  then
    raise exception 'Valid retry identifiers are required.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_worker_id, ''))) not between 3 and 200
    or char_length(btrim(coalesce(p_failure_code, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_failure_message, ''))) not between 3 and 500
  then
    raise exception 'Valid retry details are required.'
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

  if v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This worker no longer owns the Operations Agent run.'
      using errcode = 'PT409';
  end if;

  if v_run.lease_expires_at is null
    or v_run.lease_expires_at <= now()
    or v_run.execution_deadline_at is null
    or v_run.execution_deadline_at <= now()
  then
    raise exception 'The Operations Agent execution window has expired.'
      using errcode = 'PT409';
  end if;

  if p_retry_number = v_run.retry_count then
    select usage.*
    into v_usage
    from public.operations_agent_usage_events as usage
    where usage.run_id = p_run_id
      and usage.retry_number = p_retry_number
      and usage.call_kind = 'model'
      and usage.outcome = 'retry_scheduled'
    order by usage.created_at
    limit 1;

    if found then
      return jsonb_build_object(
        'run', to_jsonb(v_run),
        'usage', to_jsonb(v_usage)
      );
    end if;
  end if;

  if p_retry_number <> v_run.retry_count + 1
    or p_retry_number > v_run.max_retries
  then
    raise exception 'The Operations Agent retry limit has been reached.'
      using errcode = '22023';
  end if;

  if v_run.model_calls + 1 > v_run.max_model_calls then
    raise exception 'The Operations Agent model-call limit has been reached.'
      using errcode = '22023';
  end if;

  v_usage_response := public.agent_record_operations_agent_usage(
    p_workspace_id,
    p_run_id,
    null,
    p_usage_idempotency_key,
    'model',
    p_provider,
    p_model,
    0,
    0,
    0,
    0,
    0,
    0,
    p_retry_number,
    false,
    'retry_scheduled'
  );

  update public.operations_agent_runs
  set
    retry_count = p_retry_number,
    lease_expires_at = least(
      execution_deadline_at,
      now() + interval '2 minutes'
    )
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
    'run_retry_recorded',
    'A transient provider failure was recorded and a bounded retry was scheduled.',
    jsonb_build_object(
      'retryNumber', p_retry_number,
      'failureCode', btrim(p_failure_code)
    )
  );

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'usage', v_usage_response->'usage'
  );
end;
$$;

comment on function public.agent_record_operations_agent_retry(
  uuid,
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  uuid
) is
  'Service-only durable retry boundary that counts unusable model attempts without charging workspace allowance.';

create or replace function public.query_operations_agent_reliability(
  p_workspace_id uuid
)
returns table (
  workspace_id uuid,
  enabled boolean,
  monthly_cost_limit_usd numeric,
  monthly_estimated_cost_usd numeric,
  monthly_chargeable_cost_usd numeric,
  monthly_remaining_usd numeric,
  usage_percent numeric,
  allowance_level text,
  warning_at_percent integer,
  critical_at_percent integer,
  active_run_count bigint,
  stale_run_count bigint,
  failed_run_count bigint,
  month_started_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = auth.uid()
  ) then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  return query
  with policy_summary as (
    select
      bool_and(policy.enabled) as all_enabled,
      min(policy.monthly_cost_limit_usd) as monthly_limit,
      max(policy.updated_at) as policy_updated_at
    from public.operations_agent_capability_policies as policy
    where policy.workspace_id = p_workspace_id
  ),
  usage_summary as (
    select
      coalesce(sum(usage.estimated_cost_usd), 0) as estimated_cost,
      coalesce(sum(usage.chargeable_cost_usd), 0) as chargeable_cost,
      max(usage.created_at) as usage_updated_at
    from public.operations_agent_usage_events as usage
    where usage.workspace_id = p_workspace_id
      and usage.created_at >= date_trunc('month', now())
  ),
  run_summary as (
    select
      count(*) filter (
        where run.state in (
          'queued',
          'running',
          'waiting_for_approval'
        )
      ) as active_runs,
      count(*) filter (
        where run.state = 'running'
          and (
            run.lease_expires_at is null
            or run.lease_expires_at <= now()
          )
      ) as stale_runs,
      count(*) filter (
        where run.state in ('failed', 'expired')
          and run.created_at >= date_trunc('month', now())
      ) as failed_runs,
      max(run.updated_at) as run_updated_at
    from public.operations_agent_runs as run
    where run.workspace_id = p_workspace_id
  ),
  totals as (
    select
      coalesce(policy_summary.all_enabled, false) as all_enabled,
      coalesce(policy_summary.monthly_limit, 0) as monthly_limit,
      usage_summary.estimated_cost,
      usage_summary.chargeable_cost,
      run_summary.active_runs,
      run_summary.stale_runs,
      run_summary.failed_runs,
      greatest(
        coalesce(
          policy_summary.policy_updated_at,
          date_trunc('month', now())
        ),
        coalesce(
          usage_summary.usage_updated_at,
          date_trunc('month', now())
        ),
        coalesce(
          run_summary.run_updated_at,
          date_trunc('month', now())
        )
      ) as status_updated_at
    from policy_summary
    cross join usage_summary
    cross join run_summary
  )
  select
    p_workspace_id,
    totals.all_enabled,
    totals.monthly_limit,
    totals.estimated_cost,
    totals.chargeable_cost,
    greatest(
      totals.monthly_limit - totals.chargeable_cost,
      0
    ),
    case
      when totals.monthly_limit <= 0 then 100
      else round(
        (totals.chargeable_cost / totals.monthly_limit) * 100,
        2
      )
    end,
    case
      when not totals.all_enabled then 'paused'
      when totals.monthly_limit <= 0
        or totals.chargeable_cost >= totals.monthly_limit
        then 'limit_reached'
      when totals.chargeable_cost
        >= totals.monthly_limit * 0.90
        then 'near_limit'
      when totals.chargeable_cost
        >= totals.monthly_limit * 0.70
        then 'approaching'
      else 'available'
    end,
    70,
    90,
    totals.active_runs,
    totals.stale_runs,
    totals.failed_runs,
    date_trunc('month', now()),
    totals.status_updated_at
  from totals;
end;
$$;

comment on function public.query_operations_agent_reliability(uuid) is
  'Returns owner-safe workspace allowance, warning, and recovery counts without exposing raw provider or worker data.';

create or replace function public.command_recover_operations_agent_run(
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
  v_command_name constant text := 'operations_agent_runs.recover';
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

  if p_workspace_id is null
    or p_run_id is null
    or p_expected_updated_at is null
    or p_idempotency_key is null
  then
    raise exception 'Valid workspace, run, version, and request identifiers are required.'
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
      raise exception 'This request identifier was already used for a different Operations Agent recovery.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This Operations Agent recovery is still being processed.'
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

  if v_run.updated_at <> p_expected_updated_at then
    raise exception 'This Operations Agent run changed elsewhere. Refresh before trying again.'
      using errcode = 'PT409';
  end if;

  if v_run.capability not in (
    'guided_client_intake',
    'guided_workspace_setup'
  ) then
    raise exception 'This Operations Agent run does not support automatic recovery.'
      using errcode = '22023';
  end if;

  if v_run.state = 'queued' then
    null;
  elsif v_run.state <> 'running' then
    raise exception 'This Operations Agent run is no longer recoverable. Continue with the manual workflow.'
      using errcode = '22023';
  elsif v_run.lease_expires_at is not null
    and v_run.lease_expires_at > now()
  then
    raise exception 'This Operations Agent run is still working.'
      using errcode = 'PT409';
  elsif v_run.execution_deadline_at is not null
    and v_run.execution_deadline_at <= now()
  then
    update public.operations_agent_runs
    set
      state = 'expired',
      worker_id = null,
      lease_expires_at = null,
      completed_at = now(),
      outcome_summary =
        'The bounded execution window expired. Continue with the manual workflow.'
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
      p_run_id,
      v_actor_id,
      'run_expired',
      'The run reached its bounded execution deadline before recovery.'
    );
  elsif v_run.retry_count >= v_run.max_retries then
    update public.operations_agent_runs
    set
      state = 'failed',
      worker_id = null,
      lease_expires_at = null,
      completed_at = now(),
      failed_at = now(),
      failure_code = 'recovery_limit_reached',
      failure_message =
        'The bounded recovery limit was reached. Continue with the manual workflow.',
      outcome_summary =
        'The run could not be recovered. Continue with the manual workflow.'
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
      p_run_id,
      v_actor_id,
      'run_failed',
      'The run reached its bounded recovery limit.'
    );
  else
    update public.operations_agent_runs
    set
      state = 'queued',
      retry_count = retry_count + 1,
      worker_id = null,
      lease_expires_at = null,
      outcome_summary =
        'The interrupted run is ready to continue within its original deadline.'
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
      'run_recovered',
      'The workspace owner recovered an interrupted Operations Agent run.',
      jsonb_build_object('retryNumber', v_run.retry_count)
    );
  end if;

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

comment on function public.command_recover_operations_agent_run(
  uuid,
  uuid,
  timestamptz,
  uuid
) is
  'Owner-only idempotent recovery for stale guided runs within their original retry and duration ceilings.';

create or replace function public.command_update_operations_agent_controls(
  p_workspace_id uuid,
  p_enabled boolean,
  p_monthly_cost_limit_usd numeric,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'operations_agent.controls.update';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_status jsonb;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_enabled is null
    or p_monthly_cost_limit_usd is null
    or p_idempotency_key is null
  then
    raise exception 'Valid Operations Agent controls are required.'
      using errcode = '22023';
  end if;

  if p_monthly_cost_limit_usd < 0.10
    or p_monthly_cost_limit_usd > 1000
  then
    raise exception 'Choose a monthly Operations Agent limit between $0.10 and $1,000.'
      using errcode = '22023';
  end if;

  perform 1
  from public.workspaces as workspace
  where workspace.id = p_workspace_id
    and workspace.owner_id = v_actor_id
  for update;

  if not found then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'enabled', p_enabled,
      'monthlyCostLimitUsd',
      round(p_monthly_cost_limit_usd, 6)
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
      raise exception 'This request identifier was already used for different Operations Agent controls.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'These Operations Agent controls are still being updated.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  update public.operations_agent_capability_policies
  set
    enabled = p_enabled,
    monthly_cost_limit_usd =
      round(p_monthly_cost_limit_usd, 6)
  where workspace_id = p_workspace_id;

  if not found then
    raise exception 'Operations Agent controls are unavailable for this workspace.'
      using errcode = 'P0002';
  end if;

  select to_jsonb(status)
  into v_status
  from public.query_operations_agent_reliability(
    p_workspace_id
  ) as status;

  if v_status is null then
    raise exception 'Operations Agent controls could not be confirmed.'
      using errcode = 'P0002';
  end if;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'status', v_status
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

comment on function public.command_update_operations_agent_controls(
  uuid,
  boolean,
  numeric,
  uuid
) is
  'Owner-only idempotent kill switch and monthly Operations Agent hard-limit command.';

revoke all
  on function public.agent_assert_operations_agent_allowance(
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated;

grant execute
  on function public.agent_assert_operations_agent_allowance(
    uuid,
    uuid,
    text
  )
  to service_role;

revoke all
  on function public.agent_record_operations_agent_retry(
    uuid,
    uuid,
    text,
    integer,
    text,
    text,
    text,
    text,
    uuid
  )
  from public, anon, authenticated;

grant execute
  on function public.agent_record_operations_agent_retry(
    uuid,
    uuid,
    text,
    integer,
    text,
    text,
    text,
    text,
    uuid
  )
  to service_role;

revoke all
  on function public.query_operations_agent_reliability(uuid)
  from public, anon;

grant execute
  on function public.query_operations_agent_reliability(uuid)
  to authenticated;

revoke all
  on function public.command_recover_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_recover_operations_agent_run(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_update_operations_agent_controls(
    uuid,
    boolean,
    numeric,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_operations_agent_controls(
    uuid,
    boolean,
    numeric,
    uuid
  )
  to authenticated;

commit;
