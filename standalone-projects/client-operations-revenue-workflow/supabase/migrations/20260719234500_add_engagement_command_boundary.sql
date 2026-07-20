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
        'client_engagements.update'
      )
    );

create or replace function public.assign_primary_client_engagement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_requested_engagement_id uuid;
begin
  begin
    v_requested_engagement_id := nullif(
      current_setting('app.client_engagement_id', true),
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The command engagement context is invalid.'
        using errcode = '22023';
  end;

  if new.client_engagement_id is null then
    new.client_engagement_id := coalesce(
      v_requested_engagement_id,
      public.ensure_primary_client_engagement(
        new.workspace_id,
        new.client_workflow_record_id
      )
    );
  end if;

  if v_requested_engagement_id is not null
    and new.client_engagement_id <> v_requested_engagement_id
  then
    raise exception 'The saved record does not match the command engagement.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.client_engagements as engagement
    where engagement.id = new.client_engagement_id
      and engagement.workspace_id = new.workspace_id
      and engagement.client_workflow_record_id =
        new.client_workflow_record_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'The engagement does not belong to this client and workspace.';
  end if;

  return new;
end;
$$;

comment on function public.assign_primary_client_engagement() is
  'Assigns an explicit command engagement when supplied, otherwise the primary compatibility engagement.';

revoke all
  on function public.assign_primary_client_engagement()
  from public, anon, authenticated;

create or replace function public.assign_workflow_task_phase()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_requested_phase text := nullif(
    current_setting('app.workflow_task_phase', true),
    ''
  );
  v_stage text;
begin
  if new.phase is not null then
    if v_requested_phase is not null
      and new.phase <> v_requested_phase
    then
      raise exception 'The saved Work Item phase does not match the command phase.'
        using errcode = '22023';
    end if;

    return new;
  end if;

  if v_requested_phase is not null then
    if v_requested_phase not in (
      'Lead',
      'Proposal',
      'Onboarding',
      'Delivery',
      'Approval',
      'Payment',
      'Handoff'
    ) then
      raise exception 'The command Work Item phase is invalid.'
        using errcode = '22023';
    end if;

    new.phase := v_requested_phase;
    return new;
  end if;

  select lifecycle_stage
  into v_stage
  from public.client_engagements
  where id = new.client_engagement_id
    and workspace_id = new.workspace_id
    and client_workflow_record_id =
      new.client_workflow_record_id;

  new.phase := case v_stage
    when 'Proposal sent' then 'Proposal'
    when 'Won client' then 'Onboarding'
    when 'Onboarding' then 'Onboarding'
    when 'In delivery' then 'Delivery'
    when 'Waiting for approval' then 'Approval'
    when 'Payment follow-up' then 'Payment'
    when 'Completed' then 'Handoff'
    when 'Lost or inactive' then 'Handoff'
    else 'Lead'
  end;

  return new;
end;
$$;

comment on function public.assign_workflow_task_phase() is
  'Uses explicit command phase context and retains a stage-based compatibility fallback.';

revoke all
  on function public.assign_workflow_task_phase()
  from public, anon, authenticated;

create or replace function public.assert_client_engagement_context(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_client_workflow_record_id uuid,
  p_require_primary boolean,
  p_require_active boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_engagement public.client_engagements%rowtype;
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

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
    and engagement.client_workflow_record_id =
      p_client_workflow_record_id;

  if not found then
    raise exception 'Engagement not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if p_require_primary and not v_engagement.is_primary then
    raise exception 'Additional engagement operations will be enabled after engagement-scoped risk reconciliation is installed.'
      using errcode = '22023';
  end if;

  if p_require_active
    and v_engagement.engagement_status <> 'Active'
  then
    raise exception 'This engagement is closed and cannot accept new workflow changes.'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.assert_client_engagement_context(
  uuid,
  uuid,
  uuid,
  boolean,
  boolean
) is
  'Validates authenticated workspace, client, engagement, rollout, and active-state ownership.';

revoke all
  on function public.assert_client_engagement_context(
    uuid,
    uuid,
    uuid,
    boolean,
    boolean
  )
  from public, anon, authenticated;

create or replace function public.assert_valid_client_engagement(
  p_title text,
  p_lifecycle_stage text,
  p_priority text,
  p_estimated_value numeric,
  p_next_action text,
  p_next_follow_up_at date,
  p_assigned_to text,
  p_onboarding_status text,
  p_delivery_status text,
  p_approval_status text,
  p_payment_status text
)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if length(btrim(p_title)) < 2
    or length(btrim(p_title)) > 200
  then
    raise exception 'Enter an engagement title between 2 and 200 characters.'
      using errcode = '22023';
  end if;

  if p_lifecycle_stage not in (
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
  ) then
    raise exception 'Choose a valid engagement stage.'
      using errcode = '22023';
  end if;

  if p_priority not in ('High', 'Medium', 'Low') then
    raise exception 'Choose a valid engagement priority.'
      using errcode = '22023';
  end if;

  if p_estimated_value is null or p_estimated_value < 0 then
    raise exception 'Enter a valid engagement value.'
      using errcode = '22023';
  end if;

  if length(btrim(p_next_action)) < 3
    or length(btrim(p_next_action)) > 1000
  then
    raise exception 'Enter an engagement next action between 3 and 1,000 characters.'
      using errcode = '22023';
  end if;

  if p_next_follow_up_at is null then
    raise exception 'Choose an engagement follow-up date.'
      using errcode = '22023';
  end if;

  if length(btrim(p_assigned_to)) < 2
    or length(btrim(p_assigned_to)) > 200
  then
    raise exception 'Enter an engagement owner between 2 and 200 characters.'
      using errcode = '22023';
  end if;

  if p_onboarding_status not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_delivery_status not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_approval_status not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_payment_status not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) then
    raise exception 'Choose valid engagement workflow statuses.'
      using errcode = '22023';
  end if;
end;
$$;

revoke all
  on function public.assert_valid_client_engagement(
    text,
    text,
    text,
    numeric,
    text,
    date,
    text,
    text,
    text,
    text,
    text
  )
  from public, anon, authenticated;

create or replace function public.command_create_client_engagement(
  p_workspace_id uuid,
  p_engagement jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'client_engagements.create';
  v_client_workflow_record_id uuid;
  v_title text;
  v_lifecycle_stage text;
  v_priority text;
  v_estimated_value numeric;
  v_next_action text;
  v_next_follow_up_at date;
  v_assigned_to text;
  v_onboarding_status text;
  v_delivery_status text;
  v_approval_status text;
  v_payment_status text;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_engagement public.client_engagements%rowtype;
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

  if p_engagement is null
    or jsonb_typeof(p_engagement) <> 'object'
    or not p_engagement ?& array[
      'clientWorkflowRecordId',
      'title',
      'lifecycleStage',
      'priority',
      'estimatedValue',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'onboardingStatus',
      'deliveryStatus',
      'approvalStatus',
      'paymentStatus'
    ]
  then
    raise exception 'Engagement details are incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_engagement) as supplied(field)
    where supplied.field not in (
      'clientWorkflowRecordId',
      'title',
      'lifecycleStage',
      'priority',
      'estimatedValue',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'onboardingStatus',
      'deliveryStatus',
      'approvalStatus',
      'paymentStatus'
    )
  ) then
    raise exception 'Engagement details contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_engagement->'clientWorkflowRecordId') <> 'string'
    or jsonb_typeof(p_engagement->'title') <> 'string'
    or jsonb_typeof(p_engagement->'lifecycleStage') <> 'string'
    or jsonb_typeof(p_engagement->'priority') <> 'string'
    or jsonb_typeof(p_engagement->'estimatedValue') <> 'number'
    or jsonb_typeof(p_engagement->'nextAction') <> 'string'
    or jsonb_typeof(p_engagement->'nextFollowUpAt') <> 'string'
    or jsonb_typeof(p_engagement->'assignedTo') <> 'string'
    or jsonb_typeof(p_engagement->'onboardingStatus') <> 'string'
    or jsonb_typeof(p_engagement->'deliveryStatus') <> 'string'
    or jsonb_typeof(p_engagement->'approvalStatus') <> 'string'
    or jsonb_typeof(p_engagement->'paymentStatus') <> 'string'
  then
    raise exception 'Engagement fields use an invalid value type.'
      using errcode = '22023';
  end if;

  begin
    v_client_workflow_record_id :=
      (p_engagement->>'clientWorkflowRecordId')::uuid;
    v_estimated_value :=
      (p_engagement->>'estimatedValue')::numeric;
    v_next_follow_up_at :=
      (p_engagement->>'nextFollowUpAt')::date;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Engagement details contain an invalid identifier, number, or date.'
        using errcode = '22023';
  end;

  v_title := btrim(p_engagement->>'title');
  v_lifecycle_stage := p_engagement->>'lifecycleStage';
  v_priority := p_engagement->>'priority';
  v_next_action := btrim(p_engagement->>'nextAction');
  v_assigned_to := btrim(p_engagement->>'assignedTo');
  v_onboarding_status := p_engagement->>'onboardingStatus';
  v_delivery_status := p_engagement->>'deliveryStatus';
  v_approval_status := p_engagement->>'approvalStatus';
  v_payment_status := p_engagement->>'paymentStatus';

  perform public.assert_valid_client_engagement(
    v_title,
    v_lifecycle_stage,
    v_priority,
    v_estimated_value,
    v_next_action,
    v_next_follow_up_at,
    v_assigned_to,
    v_onboarding_status,
    v_delivery_status,
    v_approval_status,
    v_payment_status
  );

  v_request_hash := md5(
    jsonb_build_object(
      'clientWorkflowRecordId', v_client_workflow_record_id,
      'title', v_title,
      'lifecycleStage', v_lifecycle_stage,
      'priority', v_priority,
      'estimatedValue', v_estimated_value,
      'nextAction', v_next_action,
      'nextFollowUpAt', v_next_follow_up_at,
      'assignedTo', v_assigned_to,
      'onboardingStatus', v_onboarding_status,
      'deliveryStatus', v_delivery_status,
      'approvalStatus', v_approval_status,
      'paymentStatus', v_payment_status
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
      raise exception 'This request identifier was already used for different engagement details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This engagement request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  perform 1
  from public.client_workflow_records as client
  where client.id = v_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  insert into public.client_engagements (
    workspace_id,
    client_workflow_record_id,
    title,
    engagement_status,
    lifecycle_stage,
    priority,
    estimated_value,
    workflow_health_score,
    next_action,
    next_follow_up_at,
    assigned_to,
    onboarding_status,
    delivery_status,
    approval_status,
    payment_status,
    is_primary
  )
  values (
    p_workspace_id,
    v_client_workflow_record_id,
    v_title,
    'Active',
    v_lifecycle_stage,
    v_priority,
    v_estimated_value,
    100,
    v_next_action,
    v_next_follow_up_at,
    v_assigned_to,
    v_onboarding_status,
    v_delivery_status,
    v_approval_status,
    v_payment_status,
    false
  )
  returning * into v_engagement;

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
    v_client_workflow_record_id,
    v_engagement.id,
    v_actor_id,
    'Engagement created',
    format('%s was added as a new engagement.', v_engagement.title),
    v_engagement.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'clientEngagement', to_jsonb(v_engagement)
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

create or replace function public.command_update_client_engagement(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_expected_updated_at timestamptz,
  p_updates jsonb,
  p_activity_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'client_engagements.update';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_engagement public.client_engagements%rowtype;
  v_title text;
  v_lifecycle_stage text;
  v_priority text;
  v_estimated_value numeric;
  v_next_action text;
  v_next_follow_up_at date;
  v_assigned_to text;
  v_onboarding_status text;
  v_delivery_status text;
  v_approval_status text;
  v_payment_status text;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or p_client_engagement_id is null
    or p_expected_updated_at is null
  then
    raise exception 'Engagement command identifiers and expected version are required.'
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

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Engagement changes are required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'title',
      'lifecycleStage',
      'priority',
      'estimatedValue',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'onboardingStatus',
      'deliveryStatus',
      'approvalStatus',
      'paymentStatus'
    )
  ) then
    raise exception 'Engagement changes contain a protected field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'title'
      and jsonb_typeof(p_updates->'title') <> 'string')
    or (p_updates ? 'lifecycleStage'
      and jsonb_typeof(p_updates->'lifecycleStage') <> 'string')
    or (p_updates ? 'priority'
      and jsonb_typeof(p_updates->'priority') <> 'string')
    or (p_updates ? 'estimatedValue'
      and jsonb_typeof(p_updates->'estimatedValue') <> 'number')
    or (p_updates ? 'nextAction'
      and jsonb_typeof(p_updates->'nextAction') <> 'string')
    or (p_updates ? 'nextFollowUpAt'
      and jsonb_typeof(p_updates->'nextFollowUpAt') <> 'string')
    or (p_updates ? 'assignedTo'
      and jsonb_typeof(p_updates->'assignedTo') <> 'string')
    or (p_updates ? 'onboardingStatus'
      and jsonb_typeof(p_updates->'onboardingStatus') <> 'string')
    or (p_updates ? 'deliveryStatus'
      and jsonb_typeof(p_updates->'deliveryStatus') <> 'string')
    or (p_updates ? 'approvalStatus'
      and jsonb_typeof(p_updates->'approvalStatus') <> 'string')
    or (p_updates ? 'paymentStatus'
      and jsonb_typeof(p_updates->'paymentStatus') <> 'string')
  then
    raise exception 'Engagement changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if p_activity_note is null
    or length(btrim(p_activity_note)) < 5
    or length(btrim(p_activity_note)) > 2000
  then
    raise exception 'Describe the engagement change.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'updates', p_updates,
      'activityNote', btrim(p_activity_note)
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
      raise exception 'This request identifier was already used for different engagement changes.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This engagement request is still being processed.'
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
    raise exception 'The engagement changed before this update was saved.'
      using errcode = 'PT409';
  end if;

  if v_engagement.engagement_status <> 'Active' then
    raise exception 'This engagement is closed and cannot be updated.'
      using errcode = '22023';
  end if;

  begin
    v_title := case when p_updates ? 'title'
      then btrim(p_updates->>'title') else v_engagement.title end;
    v_lifecycle_stage := case when p_updates ? 'lifecycleStage'
      then p_updates->>'lifecycleStage' else v_engagement.lifecycle_stage end;
    v_priority := case when p_updates ? 'priority'
      then p_updates->>'priority' else v_engagement.priority end;
    v_estimated_value := case when p_updates ? 'estimatedValue'
      then (p_updates->>'estimatedValue')::numeric else v_engagement.estimated_value end;
    v_next_action := case when p_updates ? 'nextAction'
      then btrim(p_updates->>'nextAction') else v_engagement.next_action end;
    v_next_follow_up_at := case when p_updates ? 'nextFollowUpAt'
      then (p_updates->>'nextFollowUpAt')::date else v_engagement.next_follow_up_at end;
    v_assigned_to := case when p_updates ? 'assignedTo'
      then btrim(p_updates->>'assignedTo') else v_engagement.assigned_to end;
    v_onboarding_status := case when p_updates ? 'onboardingStatus'
      then p_updates->>'onboardingStatus' else v_engagement.onboarding_status end;
    v_delivery_status := case when p_updates ? 'deliveryStatus'
      then p_updates->>'deliveryStatus' else v_engagement.delivery_status end;
    v_approval_status := case when p_updates ? 'approvalStatus'
      then p_updates->>'approvalStatus' else v_engagement.approval_status end;
    v_payment_status := case when p_updates ? 'paymentStatus'
      then p_updates->>'paymentStatus' else v_engagement.payment_status end;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Engagement changes contain an invalid number or date.'
        using errcode = '22023';
  end;

  perform public.assert_valid_client_engagement(
    v_title,
    v_lifecycle_stage,
    v_priority,
    v_estimated_value,
    v_next_action,
    v_next_follow_up_at,
    v_assigned_to,
    v_onboarding_status,
    v_delivery_status,
    v_approval_status,
    v_payment_status
  );

  update public.client_engagements
  set
    title = v_title,
    lifecycle_stage = v_lifecycle_stage,
    priority = v_priority,
    estimated_value = v_estimated_value,
    next_action = v_next_action,
    next_follow_up_at = v_next_follow_up_at,
    assigned_to = v_assigned_to,
    onboarding_status = v_onboarding_status,
    delivery_status = v_delivery_status,
    approval_status = v_approval_status,
    payment_status = v_payment_status,
    updated_at = clock_timestamp()
  where id = v_engagement.id
  returning * into v_engagement;

  if v_engagement.is_primary then
    update public.client_workflow_records
    set
      lifecycle_stage = v_engagement.lifecycle_stage,
      priority = v_engagement.priority,
      estimated_value = v_engagement.estimated_value,
      next_action = v_engagement.next_action,
      next_follow_up_at = v_engagement.next_follow_up_at,
      assigned_to = v_engagement.assigned_to,
      onboarding_status = v_engagement.onboarding_status,
      delivery_status = v_engagement.delivery_status,
      approval_status = v_engagement.approval_status,
      payment_status = v_engagement.payment_status,
      updated_at = clock_timestamp()
    where id = v_engagement.client_workflow_record_id
      and workspace_id = p_workspace_id;

    select engagement.*
    into v_engagement
    from public.client_engagements as engagement
    where engagement.id = p_client_engagement_id;
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
    v_engagement.client_workflow_record_id,
    v_engagement.id,
    v_actor_id,
    'Engagement updated',
    btrim(p_activity_note)
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'clientEngagement', to_jsonb(v_engagement)
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

create or replace function public.command_create_engagement_handoff_note(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_note jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  begin
    v_client_workflow_record_id :=
      (p_note->>'clientWorkflowRecordId')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The handoff client identifier is invalid.'
        using errcode = '22023';
  end;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    false,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_create_handoff_note(
    p_workspace_id,
    p_note,
    p_idempotency_key
  );

  if (v_response->'handoffNote'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'This request identifier belongs to a different engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_create_engagement_proposal_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal jsonb,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  begin
    v_client_workflow_record_id :=
      (p_proposal->>'clientWorkflowRecordId')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The Proposal client identifier is invalid.'
        using errcode = '22023';
  end;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    true,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_create_proposal_record(
    p_workspace_id,
    p_proposal,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'proposal'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'This request identifier belongs to a different engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_update_engagement_proposal_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal_id uuid,
  p_expected_updated_at timestamptz,
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
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  select proposal.client_workflow_record_id
  into v_client_workflow_record_id
  from public.proposal_records as proposal
  where proposal.id = p_proposal_id
    and proposal.workspace_id = p_workspace_id
    and proposal.client_engagement_id = p_client_engagement_id;

  if not found then
    raise exception 'Proposal not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    true,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_update_proposal_record(
    p_workspace_id,
    p_proposal_id,
    p_expected_updated_at,
    p_updates,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'proposal'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'The updated Proposal does not match this engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_apply_engagement_proposal_workflow_recommendation(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal_id uuid,
  p_client_workflow_record_id uuid,
  p_expected_proposal_status text,
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
  v_response jsonb;
begin
  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    p_client_workflow_record_id,
    true,
    true
  );

  if not exists (
    select 1
    from public.proposal_records as proposal
    where proposal.id = p_proposal_id
      and proposal.workspace_id = p_workspace_id
      and proposal.client_workflow_record_id =
        p_client_workflow_record_id
      and proposal.client_engagement_id =
        p_client_engagement_id
  ) then
    raise exception 'Proposal not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response :=
    public.command_apply_proposal_workflow_recommendation(
      p_workspace_id,
      p_proposal_id,
      p_client_workflow_record_id,
      p_expected_proposal_status,
      p_updates,
      p_evaluation_date,
      p_idempotency_key
    );

  if (v_response->'proposal'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'The Proposal recommendation does not match this engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_create_engagement_workflow_task(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_client_workflow_record_id uuid,
  p_title text,
  p_type text,
  p_owner text,
  p_due_date date,
  p_status text,
  p_criticality text,
  p_phase text,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_response jsonb;
begin
  if p_phase not in (
    'Lead',
    'Proposal',
    'Onboarding',
    'Delivery',
    'Approval',
    'Payment',
    'Handoff'
  ) then
    raise exception 'Choose a valid Work Item phase.'
      using errcode = '22023';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    p_client_workflow_record_id,
    true,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );
  perform set_config(
    'app.workflow_task_phase',
    p_phase,
    true
  );

  v_response := public.command_create_workflow_task(
    p_workspace_id,
    p_client_workflow_record_id,
    p_title,
    p_type,
    p_owner,
    p_due_date,
    p_status,
    p_criticality,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'workItem'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
    or v_response->'workItem'->>'phase' <> p_phase
  then
    raise exception 'This request identifier belongs to different Work Item engagement context.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_update_engagement_workflow_task_status(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_workflow_task_id uuid,
  p_expected_status text,
  p_status text,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  select task.client_workflow_record_id
  into v_client_workflow_record_id
  from public.workflow_tasks as task
  where task.id = p_workflow_task_id
    and task.workspace_id = p_workspace_id
    and task.client_engagement_id = p_client_engagement_id;

  if not found then
    raise exception 'Work Item not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    true,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_update_workflow_task_status(
    p_workspace_id,
    p_workflow_task_id,
    p_expected_status,
    p_status,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'workItem'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'The updated Work Item does not match this engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

comment on function public.command_create_client_engagement(
  uuid,
  jsonb,
  uuid
) is
  'Creates one non-primary Active engagement with idempotency and Activity ownership.';

comment on function public.command_update_client_engagement(
  uuid,
  uuid,
  timestamptz,
  jsonb,
  text,
  uuid
) is
  'Updates whitelisted engagement fields with optimistic concurrency and Activity ownership.';

revoke all
  on function public.command_create_client_engagement(
    uuid,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_client_engagement(
    uuid,
    jsonb,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_update_client_engagement(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    text,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_client_engagement(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    text,
    uuid
  )
  to authenticated, service_role;

revoke execute
  on function public.command_create_handoff_note(
    uuid,
    jsonb,
    uuid
  )
  from authenticated;

revoke execute
  on function public.command_create_proposal_record(
    uuid,
    jsonb,
    date,
    uuid
  )
  from authenticated;

revoke execute
  on function public.command_update_proposal_record(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from authenticated;

revoke execute
  on function public.command_apply_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    date,
    uuid
  )
  from authenticated;

revoke execute
  on function public.command_create_workflow_task(
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text,
    date,
    uuid
  )
  from authenticated;

revoke execute
  on function public.command_update_workflow_task_status(
    uuid,
    uuid,
    text,
    text,
    date,
    uuid
  )
  from authenticated;

revoke all
  on function public.command_create_engagement_handoff_note(
    uuid,
    uuid,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_engagement_handoff_note(
    uuid,
    uuid,
    jsonb,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_create_engagement_proposal_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_engagement_proposal_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_update_engagement_proposal_record(
    uuid,
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_engagement_proposal_record(
    uuid,
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_apply_engagement_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
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
    jsonb,
    date,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_create_engagement_workflow_task(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text,
    text,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_engagement_workflow_task(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text,
    text,
    date,
    uuid
  )
  to authenticated, service_role;

revoke all
  on function public.command_update_engagement_workflow_task_status(
    uuid,
    uuid,
    uuid,
    text,
    text,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_engagement_workflow_task_status(
    uuid,
    uuid,
    uuid,
    text,
    text,
    date,
    uuid
  )
  to authenticated, service_role;

commit;
