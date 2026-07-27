begin;

alter table public.operations_agent_capability_policies
  drop constraint operations_agent_policy_capability_check;

alter table public.operations_agent_capability_policies
  add constraint operations_agent_policy_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup',
        'next_action_update'
      )
    );

alter table public.operations_agent_runs
  drop constraint operations_agent_runs_capability_check;

alter table public.operations_agent_runs
  add constraint operations_agent_runs_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup',
        'next_action_update'
      )
    );

alter table public.operations_agent_usage_events
  drop constraint operations_agent_usage_capability_check;

alter table public.operations_agent_usage_events
  add constraint operations_agent_usage_capability_check
    check (
      capability in (
        'guided_client_intake',
        'guided_workspace_setup',
        'next_action_update'
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

alter table public.operations_agent_approval_requests
  add column executed_by uuid
    references auth.users(id) on delete restrict,
  add column executed_at timestamptz,
  add column execution_outcome text,
  add column execution_result jsonb not null default '{}'::jsonb;

alter table public.operations_agent_approval_requests
  add constraint operations_agent_approvals_execution_outcome_check
    check (
      execution_outcome is null
      or char_length(btrim(execution_outcome)) between 3 and 1000
    ),
  add constraint operations_agent_approvals_execution_result_check
    check (
      jsonb_typeof(execution_result) = 'object'
      and octet_length(execution_result::text) <= 65536
    ),
  add constraint operations_agent_approvals_execution_record_check
    check (
      execution_state not in ('succeeded', 'failed')
      or (
        decision_state = 'approved'
        and executed_by is not null
        and executed_at is not null
        and execution_outcome is not null
      )
    );

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
    'executed_by', p_approval.executed_by,
    'executed_at', p_approval.executed_at,
    'execution_outcome', p_approval.execution_outcome,
    'expires_at', p_approval.expires_at,
    'created_at', p_approval.created_at,
    'updated_at', p_approval.updated_at
  );
$$;

comment on function public.operations_agent_approval_public_json(
  public.operations_agent_approval_requests
) is
  'Returns user-facing approval and execution outcomes while excluding the internal command name, payload, hashes, expected-state snapshot, and raw execution result.';

drop function public.query_operations_agent_approvals(uuid);

create function public.query_operations_agent_approvals(
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
  executed_by uuid,
  executed_at timestamptz,
  execution_outcome text,
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
    approval.executed_by,
    approval.executed_at,
    approval.execution_outcome,
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
  'Owner-only read boundary for user-facing approval and execution outcomes. Protected command arguments and raw results are never returned.';

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
    ),
    (
      new.id,
      'next_action_update',
      true,
      'approval_required',
      1,
      5.00
    )
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.seed_default_operations_agent_policy() is
  'Seeds Suggest-only guided capabilities and the approval-required next-action capability for a new workspace.';

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
  'next_action_update',
  true,
  'approval_required',
  1,
  5.00
from public.workspaces as workspace
on conflict do nothing;

create or replace function public.command_prepare_operations_agent_next_action_update(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_expected_engagement_updated_at timestamptz,
  p_next_action text,
  p_next_follow_up_at date,
  p_assigned_to text,
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
    'operations_agent.next_action.prepare';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_policy public.operations_agent_capability_policies%rowtype;
  v_engagement public.client_engagements%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_run public.operations_agent_runs%rowtype;
  v_approval_step public.operations_agent_steps%rowtype;
  v_tool_step public.operations_agent_steps%rowtype;
  v_approval public.operations_agent_approval_requests%rowtype;
  v_tool_command_id uuid := gen_random_uuid();
  v_expires_at timestamptz := clock_timestamp() + interval '24 hours';
  v_command_input jsonb;
  v_expected_state jsonb;
  v_review_fields jsonb;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_client_engagement_id is null
    or p_expected_engagement_updated_at is null
    or p_idempotency_key is null
  then
    raise exception 'Valid workspace, job, version, and request identifiers are required.'
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

  if char_length(btrim(coalesce(p_next_action, ''))) not between 3 and 500 then
    raise exception 'Enter a next action between 3 and 500 characters.'
      using errcode = '22023';
  end if;

  if p_next_follow_up_at is null
    or p_next_follow_up_at < current_date
  then
    raise exception 'Choose today or a future follow-up date.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_assigned_to, ''))) not between 2 and 160 then
    raise exception 'Enter an owner between 2 and 160 characters.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'expectedUpdatedAt', p_expected_engagement_updated_at,
      'nextAction', btrim(p_next_action),
      'nextFollowUpAt', p_next_follow_up_at,
      'assignedTo', btrim(p_assigned_to)
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
      raise exception 'This request identifier was already used for a different next-action proposal.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This next-action proposal is still being prepared.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select policy.*
  into v_policy
  from public.operations_agent_capability_policies as policy
  where policy.workspace_id = p_workspace_id
    and policy.capability = 'next_action_update'
  for update;

  if not found
    or not v_policy.enabled
    or v_policy.allowed_mode <> 'approval_required'
  then
    raise exception 'Next-action changes are not enabled for this workspace.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.operations_agent_runs as run
    where run.workspace_id = p_workspace_id
      and run.state in (
        'queued',
        'running',
        'waiting_for_approval'
      )
  ) then
    raise exception 'Finish or cancel the current Operations Agent run before preparing another action.'
      using errcode = 'PT409';
  end if;

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Job not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_engagement.updated_at <> p_expected_engagement_updated_at then
    raise exception 'The job changed before this action was prepared. Refresh and review it again.'
      using errcode = 'PT409';
  end if;

  if v_engagement.engagement_status <> 'Active' then
    raise exception 'This job is closed and cannot accept a new next action.'
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

  v_command_input := jsonb_build_object(
    'clientEngagementId', v_engagement.id,
    'expectedUpdatedAt', v_engagement.updated_at,
    'updates', jsonb_build_object(
      'nextAction', btrim(p_next_action),
      'nextFollowUpAt', p_next_follow_up_at,
      'assignedTo', btrim(p_assigned_to)
    ),
    'activityNote',
      'Operations Agent applied the approved next-action change for '
        || v_engagement.title || '.',
    'commandId', v_tool_command_id
  );

  v_expected_state := jsonb_build_object(
    'clientEngagementId', v_engagement.id,
    'updatedAt', v_engagement.updated_at,
    'engagementStatus', v_engagement.engagement_status,
    'nextAction', v_engagement.next_action,
    'nextFollowUpAt', v_engagement.next_follow_up_at,
    'assignedTo', v_engagement.assigned_to
  );

  v_review_fields := jsonb_build_array(
    jsonb_build_object(
      'label', 'Client',
      'value', v_client.name
    ),
    jsonb_build_object(
      'label', 'Job',
      'value', v_engagement.title
    ),
    jsonb_build_object(
      'label', 'Current next action',
      'value', coalesce(nullif(v_engagement.next_action, ''), 'Not set')
    ),
    jsonb_build_object(
      'label', 'Proposed next action',
      'value', btrim(p_next_action)
    ),
    jsonb_build_object(
      'label', 'Follow-up date',
      'value', to_char(p_next_follow_up_at, 'FMMonth DD, YYYY')
    ),
    jsonb_build_object(
      'label', 'Assigned to',
      'value', btrim(p_assigned_to)
    )
  );

  perform public.validate_operations_agent_review_fields(
    v_review_fields
  );

  insert into public.operations_agent_runs (
    workspace_id,
    initiated_by,
    capability,
    mode,
    trigger_type,
    objective,
    context,
    plan,
    state,
    current_step_index,
    max_model_calls,
    max_tool_calls,
    max_retries,
    max_duration_seconds,
    max_cost_usd,
    approval_expires_at,
    started_at
  )
  values (
    p_workspace_id,
    v_actor_id,
    'next_action_update',
    'approval_required',
    'user',
    'Update the next action for ' || v_engagement.title,
    jsonb_build_object(
      'clientEngagementId', v_engagement.id,
      'clientWorkflowRecordId',
        v_engagement.client_workflow_record_id
    ),
    jsonb_build_array(
      jsonb_build_object(
        'step', 'Review the proposed next-action change'
      ),
      jsonb_build_object(
        'step', 'Apply the approved change'
      )
    ),
    'waiting_for_approval',
    0,
    1,
    1,
    1,
    900,
    0.01,
    v_expires_at,
    now()
  )
  returning * into v_run;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    max_attempts,
    input_summary,
    idempotency_key,
    started_at
  )
  values (
    p_workspace_id,
    v_run.id,
    'approval',
    0,
    'approval',
    'Review the proposed next-action change',
    'waiting_for_approval',
    1,
    'Review the exact job, action, date, and owner.',
    p_idempotency_key,
    now()
  )
  returning * into v_approval_step;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    max_attempts,
    tool_name,
    input_summary,
    idempotency_key
  )
  values (
    p_workspace_id,
    v_run.id,
    'apply_next_action',
    1,
    'tool',
    'Apply the approved next-action change',
    'queued',
    1,
    'operations_agent.tools.update_next_action',
    'Apply only the reviewed next action, follow-up date, and owner.',
    v_tool_command_id
  )
  returning * into v_tool_step;

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
    v_run.id,
    v_approval_step.id,
    v_actor_id,
    p_idempotency_key,
    md5(
      jsonb_build_object(
        'runId', v_run.id,
        'stepId', v_approval_step.id,
        'commandInputHash', md5(v_command_input::text)
      )::text
    ),
    'Update the next action for ' || v_engagement.title,
    'Apply the reviewed next action, follow-up date, and owner to this active job.',
    v_review_fields,
    'operations_agent.tools.update_next_action',
    v_command_input,
    md5(v_command_input::text),
    v_expected_state,
    v_expires_at
  )
  returning * into v_approval;

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
      v_run.id,
      v_actor_id,
      'run_started',
      'A protected next-action change was prepared.',
      jsonb_build_object('capability', 'next_action_update')
    ),
    (
      p_workspace_id,
      v_run.id,
      v_actor_id,
      'run_waiting_for_approval',
      'The next-action change is waiting for approval.',
      jsonb_build_object('approvalId', v_approval.id)
    ),
    (
      p_workspace_id,
      v_run.id,
      v_actor_id,
      'approval_requested',
      'Approval was requested for the next-action change.',
      jsonb_build_object('approvalId', v_approval.id)
    );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'approval',
      public.operations_agent_approval_public_json(v_approval),
    'run', to_jsonb(v_run),
    'step', to_jsonb(v_approval_step)
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

comment on function public.command_prepare_operations_agent_next_action_update(
  uuid,
  uuid,
  timestamptz,
  text,
  date,
  text,
  uuid
) is
  'Owner-only command that freezes one active job next-action change behind an explicit approval without mutating workflow state.';

create or replace function public.command_execute_approved_operations_agent_action(
  p_workspace_id uuid,
  p_approval_id uuid,
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
  v_command_name constant text :=
    'operations_agent.approvals.execute';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_approval public.operations_agent_approval_requests%rowtype;
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
  v_policy public.operations_agent_capability_policies%rowtype;
  v_engagement public.client_engagements%rowtype;
  v_tool_command_id uuid;
  v_client_engagement_id uuid;
  v_expected_engagement_updated_at timestamptz;
  v_updates jsonb;
  v_activity_note text;
  v_tool_result jsonb;
  v_failure_code text;
  v_failure_message text;
  v_outcome text;
  v_response jsonb;
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
    raise exception 'Valid approval execution identifiers are required.'
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
      raise exception 'This request identifier was already used for a different approved action.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This approved action is still being applied.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select approval.*
  into v_approval
  from public.operations_agent_approval_requests as approval
  where approval.id = p_approval_id
    and approval.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Approval not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_approval.updated_at <> p_expected_updated_at
    or v_approval.requested_for <> v_actor_id
    or v_approval.decided_by <> v_actor_id
    or v_approval.decision_state <> 'approved'
    or v_approval.execution_state <> 'ready'
  then
    raise exception 'This approved action changed elsewhere. Refresh before applying it.'
      using errcode = 'PT409';
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = v_approval.run_id
    and run.workspace_id = p_workspace_id
  for update;

  if not found
    or v_run.initiated_by <> v_actor_id
    or v_run.capability <> 'next_action_update'
    or v_run.mode <> 'approval_required'
    or v_run.state <> 'queued'
    or v_run.current_step_index <> 1
  then
    raise exception 'This Operations Agent run is not ready to apply the approved action.'
      using errcode = 'PT409';
  end if;

  select step.*
  into v_step
  from public.operations_agent_steps as step
  where step.run_id = v_run.id
    and step.workspace_id = p_workspace_id
    and step.step_index = v_run.current_step_index
  for update;

  if not found
    or v_step.kind <> 'tool'
    or v_step.tool_name <>
      'operations_agent.tools.update_next_action'
    or v_step.state <> 'queued'
  then
    raise exception 'The approved action step is not ready to run.'
      using errcode = 'PT409';
  end if;

  select policy.*
  into v_policy
  from public.operations_agent_capability_policies as policy
  where policy.workspace_id = p_workspace_id
    and policy.capability = 'next_action_update'
  for update;

  if not found
    or not v_policy.enabled
    or v_policy.allowed_mode <> 'approval_required'
  then
    v_failure_code := 'permission_changed';
    v_failure_message :=
      'The next-action capability is no longer enabled for this workspace.';
    v_outcome :=
      'This action is no longer allowed for this workspace. No job details were changed.';
  end if;

  if v_failure_code is null
    and (
      v_approval.command_name <>
        'operations_agent.tools.update_next_action'
      or v_approval.command_input_hash <>
        md5(v_approval.command_input::text)
      or jsonb_typeof(v_approval.command_input) <> 'object'
      or (
        select count(*)
        from jsonb_object_keys(v_approval.command_input)
      ) <> 5
      or not (
        v_approval.command_input
          ?& array[
            'clientEngagementId',
            'expectedUpdatedAt',
            'updates',
            'activityNote',
            'commandId'
          ]
      )
    )
  then
    v_failure_code := 'protected_payload_invalid';
    v_failure_message :=
      'The protected action payload failed its integrity check.';
    v_outcome :=
      'The approved action could not be verified. No job details were changed.';
  end if;

  if v_failure_code is null then
    begin
      v_client_engagement_id :=
        (v_approval.command_input->>'clientEngagementId')::uuid;
      v_expected_engagement_updated_at :=
        (v_approval.command_input->>'expectedUpdatedAt')::timestamptz;
      v_updates := v_approval.command_input->'updates';
      v_activity_note :=
        v_approval.command_input->>'activityNote';
      v_tool_command_id :=
        (v_approval.command_input->>'commandId')::uuid;

      if jsonb_typeof(v_updates) <> 'object'
        or (
          select count(*)
          from jsonb_object_keys(v_updates)
        ) <> 3
        or not (
          v_updates
            ?& array[
              'nextAction',
              'nextFollowUpAt',
              'assignedTo'
            ]
        )
        or v_tool_command_id <> v_step.idempotency_key
      then
        raise exception 'Protected next-action payload is invalid.';
      end if;
    exception
      when others then
        v_failure_code := 'protected_payload_invalid';
        v_failure_message :=
          'The protected action payload failed validation.';
        v_outcome :=
          'The approved action could not be verified. No job details were changed.';
    end;
  end if;

  if v_failure_code is null then
    select engagement.*
    into v_engagement
    from public.client_engagements as engagement
    where engagement.id = v_client_engagement_id
      and engagement.workspace_id = p_workspace_id
    for update;

    if not found then
      v_failure_code := 'job_unavailable';
      v_failure_message :=
        'The target job is no longer available.';
      v_outcome :=
        'The job is no longer available. No job details were changed.';
    elsif v_engagement.engagement_status <> 'Active' then
      v_failure_code := 'job_closed';
      v_failure_message :=
        'The target job was closed before execution.';
      v_outcome :=
        'The job was closed after approval. No job details were changed.';
    elsif v_engagement.updated_at <>
      v_expected_engagement_updated_at
      or v_engagement.updated_at <>
        (v_approval.expected_state->>'updatedAt')::timestamptz
      or v_engagement.next_action is distinct from
        (v_approval.expected_state->>'nextAction')
      or v_engagement.next_follow_up_at is distinct from
        (v_approval.expected_state->>'nextFollowUpAt')::date
      or v_engagement.assigned_to is distinct from
        (v_approval.expected_state->>'assignedTo')
    then
      v_failure_code := 'job_changed';
      v_failure_message :=
        'The target job changed after the action was prepared.';
      v_outcome :=
        'The job changed after this action was approved. Review the current job and prepare a new change.';
    end if;
  end if;

  if v_failure_code is not null then
    update public.operations_agent_approval_requests
    set
      execution_state = 'failed',
      executed_by = v_actor_id,
      executed_at = now(),
      execution_outcome = v_outcome,
      execution_result = jsonb_build_object(
        'code', v_failure_code,
        'message', v_failure_message
      )
    where id = v_approval.id
      and workspace_id = p_workspace_id
    returning * into v_approval;

    update public.operations_agent_steps
    set
      state = 'failed',
      attempt_count = 1,
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      failure_code = v_failure_code,
      failure_message = v_failure_message,
      output_summary = v_outcome
    where id = v_step.id
      and workspace_id = p_workspace_id
      and run_id = v_run.id
    returning * into v_step;

    update public.operations_agent_runs
    set
      state = 'failed',
      tool_calls = least(tool_calls + 1, max_tool_calls),
      completed_at = now(),
      failed_at = now(),
      failure_code = v_failure_code,
      failure_message = v_failure_message,
      outcome_summary = v_outcome
    where id = v_run.id
      and workspace_id = p_workspace_id
    returning * into v_run;

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
      usable_result,
      outcome
    )
    values (
      p_workspace_id,
      v_run.id,
      v_step.id,
      v_step.idempotency_key,
      md5(v_approval.command_input::text),
      'next_action_update',
      'tool',
      'internal_command',
      '',
      false,
      v_failure_code
    );

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
        v_run.id,
        v_actor_id,
        'tool_execution_failed',
        v_outcome,
        jsonb_build_object(
          'approvalId', v_approval.id,
          'code', v_failure_code
        )
      ),
      (
        p_workspace_id,
        v_run.id,
        v_actor_id,
        'run_failed',
        v_outcome,
        jsonb_build_object('code', v_failure_code)
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
  end if;

  update public.operations_agent_approval_requests
  set execution_state = 'running'
  where id = v_approval.id
    and workspace_id = p_workspace_id
  returning * into v_approval;

  update public.operations_agent_steps
  set
    state = 'running',
    attempt_count = 1,
    started_at = now()
  where id = v_step.id
    and workspace_id = p_workspace_id
    and run_id = v_run.id
  returning * into v_step;

  update public.operations_agent_runs
  set state = 'running'
  where id = v_run.id
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
    v_run.id,
    v_actor_id,
    'tool_execution_started',
    'The approved next-action change started.',
    jsonb_build_object('approvalId', v_approval.id)
  );

  begin
    v_tool_result :=
      public.command_update_client_engagement(
        p_workspace_id,
        v_client_engagement_id,
        v_expected_engagement_updated_at,
        v_updates,
        v_activity_note,
        v_tool_command_id
      );
  exception
    when others then
      v_failure_code := 'command_failed';
      v_failure_message :=
        'The approved engagement command failed: ' || sqlerrm;
      v_outcome :=
        'The approved action could not be applied. No unreviewed job change was made.';
  end;

  if v_failure_code is not null then
    update public.operations_agent_approval_requests
    set
      execution_state = 'failed',
      executed_by = v_actor_id,
      executed_at = now(),
      execution_outcome = v_outcome,
      execution_result = jsonb_build_object(
        'code', v_failure_code,
        'message', v_failure_message
      )
    where id = v_approval.id
      and workspace_id = p_workspace_id
    returning * into v_approval;

    update public.operations_agent_steps
    set
      state = 'failed',
      completed_at = now(),
      failure_code = v_failure_code,
      failure_message = v_failure_message,
      output_summary = v_outcome
    where id = v_step.id
      and workspace_id = p_workspace_id
      and run_id = v_run.id
    returning * into v_step;

    update public.operations_agent_runs
    set
      state = 'failed',
      tool_calls = least(tool_calls + 1, max_tool_calls),
      completed_at = now(),
      failed_at = now(),
      failure_code = v_failure_code,
      failure_message = v_failure_message,
      outcome_summary = v_outcome
    where id = v_run.id
      and workspace_id = p_workspace_id
    returning * into v_run;

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
      usable_result,
      outcome
    )
    values (
      p_workspace_id,
      v_run.id,
      v_step.id,
      v_step.idempotency_key,
      md5(v_approval.command_input::text),
      'next_action_update',
      'tool',
      'internal_command',
      '',
      false,
      v_failure_code
    );

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
        v_run.id,
        v_actor_id,
        'tool_execution_failed',
        v_outcome,
        jsonb_build_object(
          'approvalId', v_approval.id,
          'code', v_failure_code
        )
      ),
      (
        p_workspace_id,
        v_run.id,
        v_actor_id,
        'run_failed',
        v_outcome,
        jsonb_build_object('code', v_failure_code)
      );
  else
    v_outcome :=
      'The approved next action was applied to '
        || v_engagement.title || '.';

    update public.operations_agent_approval_requests
    set
      execution_state = 'succeeded',
      executed_by = v_actor_id,
      executed_at = now(),
      execution_outcome = v_outcome,
      execution_result = jsonb_build_object(
        'commandResponse', v_tool_result
      )
    where id = v_approval.id
      and workspace_id = p_workspace_id
    returning * into v_approval;

    update public.operations_agent_steps
    set
      state = 'completed',
      completed_at = now(),
      output_summary = v_outcome
    where id = v_step.id
      and workspace_id = p_workspace_id
      and run_id = v_run.id
    returning * into v_step;

    update public.operations_agent_runs
    set
      state = 'completed',
      current_step_index = 2,
      tool_calls = least(tool_calls + 1, max_tool_calls),
      completed_at = now(),
      outcome_summary = v_outcome
    where id = v_run.id
      and workspace_id = p_workspace_id
    returning * into v_run;

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
      usable_result,
      outcome
    )
    values (
      p_workspace_id,
      v_run.id,
      v_step.id,
      v_step.idempotency_key,
      md5(v_approval.command_input::text),
      'next_action_update',
      'tool',
      'internal_command',
      '',
      true,
      'completed'
    );

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
        v_run.id,
        v_actor_id,
        'tool_execution_succeeded',
        v_outcome,
        jsonb_build_object('approvalId', v_approval.id)
      ),
      (
        p_workspace_id,
        v_run.id,
        v_actor_id,
        'run_completed',
        v_outcome,
        jsonb_build_object('approvalId', v_approval.id)
      );
  end if;

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

comment on function public.command_execute_approved_operations_agent_action(
  uuid,
  uuid,
  timestamptz,
  uuid
) is
  'Owner-only execution boundary that rechecks policy, approval integrity, target scope, active status, and freshness before invoking the existing idempotent engagement command.';

revoke all
  on function public.command_prepare_operations_agent_next_action_update(
    uuid,
    uuid,
    timestamptz,
    text,
    date,
    text,
    uuid
  )
  from public, anon;
grant execute
  on function public.command_prepare_operations_agent_next_action_update(
    uuid,
    uuid,
    timestamptz,
    text,
    date,
    text,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_execute_approved_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  from public, anon;
grant execute
  on function public.command_execute_approved_operations_agent_action(
    uuid,
    uuid,
    timestamptz,
    uuid
  )
  to authenticated;

revoke all
  on function public.query_operations_agent_approvals(uuid)
  from public, anon;
grant execute
  on function public.query_operations_agent_approvals(uuid)
  to authenticated;

commit;
