begin;

drop function if exists
  public.command_apply_engagement_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    date,
    uuid
  );

create or replace function public.command_apply_engagement_proposal_workflow_recommendation(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal_id uuid,
  p_client_workflow_record_id uuid,
  p_expected_proposal_status text,
  p_expected_engagement_updated_at timestamptz,
  p_updates jsonb,
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
    'proposal_records.apply_recommendation';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_proposal public.proposal_records%rowtype;
  v_engagement public.client_engagements%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_reconciliation jsonb;
  v_lifecycle_stage text;
  v_client_type text;
  v_returning_client_status text;
  v_next_action text;
  v_next_follow_up_at date;
  v_onboarding_status text;
  v_priority text;
  v_estimated_value numeric;
  v_already_applied boolean;
  v_applied_at timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or p_client_engagement_id is null
    or p_proposal_id is null
    or p_client_workflow_record_id is null
    or p_expected_engagement_updated_at is null
  then
    raise exception 'Proposal recommendation identifiers and expected job version are required.'
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

  if p_expected_proposal_status is null
    or p_expected_proposal_status not in (
      'Not needed',
      'Draft needed',
      'Sent',
      'Revision requested',
      'Accepted',
      'Rejected',
      'Expired'
    )
  then
    raise exception 'Choose a valid expected proposal status.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Proposal workflow changes are required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'lifecycleStage',
      'clientType',
      'returningClientStatus',
      'nextAction',
      'nextFollowUpAt',
      'onboardingStatus',
      'priority',
      'estimatedValue'
    )
  ) then
    raise exception 'Proposal workflow changes contain an unsupported field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'lifecycleStage'
      and jsonb_typeof(p_updates->'lifecycleStage') <> 'string')
    or (p_updates ? 'clientType'
      and jsonb_typeof(p_updates->'clientType') <> 'string')
    or (p_updates ? 'returningClientStatus'
      and jsonb_typeof(p_updates->'returningClientStatus') <> 'string')
    or (p_updates ? 'nextAction'
      and jsonb_typeof(p_updates->'nextAction') <> 'string')
    or (p_updates ? 'nextFollowUpAt'
      and jsonb_typeof(p_updates->'nextFollowUpAt') <> 'string')
    or (p_updates ? 'onboardingStatus'
      and jsonb_typeof(p_updates->'onboardingStatus') <> 'string')
    or (p_updates ? 'priority'
      and jsonb_typeof(p_updates->'priority') <> 'string')
    or (p_updates ? 'estimatedValue'
      and jsonb_typeof(p_updates->'estimatedValue') <> 'number')
  then
    raise exception 'Proposal workflow changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if p_updates ? 'lifecycleStage'
    and p_updates->>'lifecycleStage' not in (
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
  then
    raise exception 'Choose a valid workflow stage.'
      using errcode = '22023';
  end if;

  if p_updates ? 'clientType'
    and p_updates->>'clientType' not in (
      'Lead',
      'New client',
      'Active client',
      'Returning client',
      'Past client'
    )
  then
    raise exception 'Choose a valid lead or client status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'returningClientStatus'
    and p_updates->>'returningClientStatus' not in (
      'Not returning',
      'Potential reactivation',
      'Repeat project opportunity',
      'Reactivated',
      'Dormant'
    )
  then
    raise exception 'Choose a valid returning client status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextAction'
    and char_length(btrim(p_updates->>'nextAction')) < 5
  then
    raise exception 'Enter the recommended next action.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextFollowUpAt'
    and p_updates->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Choose a valid follow-up date.'
      using errcode = '22023';
  end if;

  if p_updates ? 'onboardingStatus'
    and p_updates->>'onboardingStatus' not in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  then
    raise exception 'Choose a valid onboarding status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'priority'
    and p_updates->>'priority' not in ('High', 'Medium', 'Low')
  then
    raise exception 'Choose a valid priority.'
      using errcode = '22023';
  end if;

  if p_updates ? 'estimatedValue'
    and (p_updates->>'estimatedValue')::numeric < 0
  then
    raise exception 'Enter a valid estimated value.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null
    or abs(p_evaluation_date - current_date) > 1
  then
    raise exception 'The evaluation date is outside the allowed range.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'proposalId', p_proposal_id,
      'clientWorkflowRecordId', p_client_workflow_record_id,
      'expectedStatus', p_expected_proposal_status,
      'expectedEngagementUpdatedAt',
        p_expected_engagement_updated_at,
      'updates', p_updates,
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
      raise exception 'This request identifier was already used for a different proposal recommendation.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This proposal recommendation is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select proposal.*
  into v_proposal
  from public.proposal_records as proposal
  where proposal.id = p_proposal_id
    and proposal.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Proposal not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_proposal.client_workflow_record_id
      <> p_client_workflow_record_id
    or v_proposal.client_engagement_id
      <> p_client_engagement_id
  then
    raise exception 'The Proposal recommendation does not match this job.'
      using errcode = '22023';
  end if;

  if v_proposal.status <> p_expected_proposal_status then
    raise exception 'The proposal changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
    and engagement.client_workflow_record_id =
      p_client_workflow_record_id
  for update;

  if not found then
    raise exception 'Job not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_engagement.engagement_status <> 'Active' then
    raise exception 'This job is closed and cannot accept workflow changes.'
      using errcode = '22023';
  end if;

  select client.*
  into v_client
  from public.client_workflow_records as client
  where client.id = p_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_already_applied :=
    v_proposal.workflow_action_applied_status =
      v_proposal.status;

  if not coalesce(v_already_applied, false) then
    if v_engagement.updated_at
      <> p_expected_engagement_updated_at
    then
      raise exception 'The job changed before this recommendation was applied.'
        using errcode = 'PT409';
    end if;

    if not v_engagement.is_primary
      and (
        p_updates ? 'clientType'
        or p_updates ? 'returningClientStatus'
      )
    then
      raise exception 'Relationship-level changes are available only through the primary job.'
        using errcode = '22023';
    end if;

    begin
      v_lifecycle_stage := case
        when p_updates ? 'lifecycleStage'
          then p_updates->>'lifecycleStage'
        else v_engagement.lifecycle_stage
      end;
      v_client_type := case
        when p_updates ? 'clientType'
          then p_updates->>'clientType'
        else v_client.client_type
      end;
      v_returning_client_status := case
        when p_updates ? 'returningClientStatus'
          then p_updates->>'returningClientStatus'
        else v_client.returning_client_status
      end;
      v_next_action := case
        when p_updates ? 'nextAction'
          then btrim(p_updates->>'nextAction')
        else v_engagement.next_action
      end;
      v_next_follow_up_at := case
        when p_updates ? 'nextFollowUpAt'
          then (p_updates->>'nextFollowUpAt')::date
        else v_engagement.next_follow_up_at
      end;
      v_onboarding_status := case
        when p_updates ? 'onboardingStatus'
          then p_updates->>'onboardingStatus'
        else v_engagement.onboarding_status
      end;
      v_priority := case
        when p_updates ? 'priority'
          then p_updates->>'priority'
        else v_engagement.priority
      end;
      v_estimated_value := case
        when p_updates ? 'estimatedValue'
          then (p_updates->>'estimatedValue')::numeric
        else v_engagement.estimated_value
      end;
    exception
      when invalid_text_representation
        or datetime_field_overflow
      then
        raise exception 'Proposal workflow changes contain an invalid number or date.'
          using errcode = '22023';
    end;

    if public.client_engagement_lifecycle_stage_rank(
        v_lifecycle_stage
      ) <= public.client_engagement_lifecycle_stage_rank(
        v_engagement.lifecycle_stage
      )
    then
      v_lifecycle_stage := v_engagement.lifecycle_stage;
    end if;

    perform public.assert_valid_client_engagement(
      v_engagement.title,
      v_lifecycle_stage,
      v_priority,
      v_estimated_value,
      v_next_action,
      v_next_follow_up_at,
      v_engagement.assigned_to,
      v_onboarding_status,
      v_engagement.delivery_status,
      v_engagement.approval_status,
      v_engagement.payment_status
    );

    update public.client_engagements
    set
      lifecycle_stage = v_lifecycle_stage,
      priority = v_priority,
      estimated_value = v_estimated_value,
      next_action = v_next_action,
      next_follow_up_at = v_next_follow_up_at,
      onboarding_status = v_onboarding_status,
      updated_at = v_applied_at
    where id = v_engagement.id
      and workspace_id = p_workspace_id
    returning * into v_engagement;

    if v_engagement.is_primary then
      update public.client_workflow_records
      set
        lifecycle_stage = v_engagement.lifecycle_stage,
        client_type = v_client_type,
        returning_client_status =
          v_returning_client_status,
        next_action = v_engagement.next_action,
        next_follow_up_at =
          v_engagement.next_follow_up_at,
        onboarding_status =
          v_engagement.onboarding_status,
        priority = v_engagement.priority,
        estimated_value =
          v_engagement.estimated_value,
        updated_at = v_applied_at
      where id = p_client_workflow_record_id
        and workspace_id = p_workspace_id;
    end if;

    update public.proposal_records
    set
      workflow_action_applied_status = status,
      workflow_action_applied_at = v_applied_at,
      updated_at = v_applied_at
    where id = p_proposal_id
      and workspace_id = p_workspace_id
    returning * into v_proposal;
  end if;

  v_reconciliation :=
    public.reconcile_client_engagement_risk_signals(
      p_workspace_id,
      p_client_engagement_id,
      p_evaluation_date
    );

  if not coalesce(v_already_applied, false) then
    insert into public.activity_logs (
      workspace_id,
      client_workflow_record_id,
      client_engagement_id,
      actor_id,
      action_type,
      note,
      created_at
    )
    values (
      p_workspace_id,
      p_client_workflow_record_id,
      p_client_engagement_id,
      v_actor_id,
      'Proposal next step applied',
      format(
        'The recommended next step for "%s" was applied to the selected job.',
        v_proposal.title
      ),
      coalesce(
        v_proposal.workflow_action_applied_at,
        v_applied_at
      )
    );
  end if;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'proposal', to_jsonb(v_proposal),
    'clientRecord', v_reconciliation->'clientRecord',
    'clientEngagement',
      v_reconciliation->'clientEngagement',
    'alreadyApplied',
      coalesce(v_already_applied, false),
    'reconciliation', v_reconciliation
  );

  update public.workspace_command_requests
  set
    response = v_response,
    completed_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

comment on function public.command_apply_engagement_proposal_workflow_recommendation(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  timestamptz,
  jsonb,
  date,
  uuid
) is
  'Applies one Proposal recommendation to its selected Active job without regressing its lifecycle stage, mirrors primary compatibility fields, reconciles only that job, and records idempotent Activity.';

revoke all
  on function public.command_apply_engagement_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_apply_engagement_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  to authenticated, service_role;

commit;
