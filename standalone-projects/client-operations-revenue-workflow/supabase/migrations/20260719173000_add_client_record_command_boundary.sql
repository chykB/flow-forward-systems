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
        'client_records.update'
      )
    );

create or replace function public.set_client_workflow_record_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

comment on function public.set_client_workflow_record_updated_at() is
  'Maintains the Client Record concurrency token with wall-clock time.';

drop trigger if exists set_client_workflow_records_updated_at
  on public.client_workflow_records;

create trigger set_client_workflow_records_updated_at
before update on public.client_workflow_records
for each row
execute function public.set_client_workflow_record_updated_at();

revoke all
  on function public.set_client_workflow_record_updated_at()
  from public, anon, authenticated;

create or replace function public.command_create_client_workflow_record(
  p_workspace_id uuid,
  p_record jsonb,
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
  v_command_name constant text := 'client_records.create';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_record public.client_workflow_records%rowtype;
  v_reconciliation jsonb;
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

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Client record details are required.'
      using errcode = '22023';
  end if;

  if not p_record ?& array[
    'name',
    'email',
    'phone',
    'businessName',
    'source',
    'interest',
    'message',
    'lifecycleStage',
    'priority',
    'riskLevel',
    'nextAction',
    'nextFollowUpAt',
    'assignedTo',
    'onboardingStatus',
    'deliveryStatus',
    'approvalStatus',
    'paymentStatus',
    'clientType',
    'returningClientStatus',
    'lastProjectDate',
    'estimatedValue'
  ] then
    raise exception 'Client record details are incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_record) as supplied(field)
    where supplied.field not in (
      'name',
      'email',
      'phone',
      'businessName',
      'source',
      'interest',
      'message',
      'lifecycleStage',
      'priority',
      'riskLevel',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'onboardingStatus',
      'deliveryStatus',
      'approvalStatus',
      'paymentStatus',
      'clientType',
      'returningClientStatus',
      'lastProjectDate',
      'estimatedValue'
    )
  ) then
    raise exception 'Client record details contain a protected field.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'name', ''))) < 2 then
    raise exception 'Enter the lead or client name.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'businessName', ''))) < 2 then
    raise exception 'Enter the business name.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'source', ''))) < 2 then
    raise exception 'Enter where this lead or client came from.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'interest', ''))) < 2 then
    raise exception 'Enter what they are interested in.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'message', ''))) < 10 then
    raise exception 'Add a short context note.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'nextAction', ''))) < 5 then
    raise exception 'Enter the next action.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_record->>'assignedTo', ''))) < 2 then
    raise exception 'Enter the owner.'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_record->>'email', '')), '') is not null
    and btrim(p_record->>'email')
      !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Enter a valid email address.'
      using errcode = '22023';
  end if;

  if p_record->>'lifecycleStage' is null
    or p_record->>'lifecycleStage' not in (
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
    raise exception 'Choose a valid workflow stage.'
      using errcode = '22023';
  end if;

  if p_record->>'priority' is null
    or p_record->>'priority' not in ('High', 'Medium', 'Low')
  then
    raise exception 'Choose a valid priority.'
      using errcode = '22023';
  end if;

  if p_record->>'riskLevel' is null
    or p_record->>'riskLevel' not in ('High', 'Medium', 'Low')
  then
    raise exception 'Choose a valid relationship concern.'
      using errcode = '22023';
  end if;

  if p_record->>'clientType' is null
    or p_record->>'clientType' not in (
    'Lead',
    'New client',
    'Active client',
    'Returning client',
    'Past client'
  ) then
    raise exception 'Choose a valid lead or client status.'
      using errcode = '22023';
  end if;

  if p_record->>'returningClientStatus' is null
    or p_record->>'returningClientStatus' not in (
    'Not returning',
    'Potential reactivation',
    'Repeat project opportunity',
    'Reactivated',
    'Dormant'
  ) then
    raise exception 'Choose a valid returning client status.'
      using errcode = '22023';
  end if;

  if p_record->>'onboardingStatus' is null
    or p_record->>'onboardingStatus' not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_record->>'deliveryStatus' is null
  or p_record->>'deliveryStatus' not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_record->>'approvalStatus' is null
  or p_record->>'approvalStatus' not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) or p_record->>'paymentStatus' is null
  or p_record->>'paymentStatus' not in (
    'Not started', 'In progress', 'Waiting',
    'Blocked', 'Complete', 'Not needed'
  ) then
    raise exception 'Choose valid workflow statuses.'
      using errcode = '22023';
  end if;

  if p_record->>'nextFollowUpAt' is null
    or p_record->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Choose a valid follow-up date.'
      using errcode = '22023';
  end if;

  if nullif(p_record->>'lastProjectDate', '') is not null
    and p_record->>'lastProjectDate' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Choose a valid last project date.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_record->'estimatedValue') <> 'number'
    or (p_record->>'estimatedValue')::numeric < 0
  then
    raise exception 'Enter a valid estimated value.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'record', p_record,
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
      raise exception 'This request identifier was already used for different client record details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This client record request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  insert into public.client_workflow_records (
    workspace_id,
    name,
    email,
    phone,
    business_name,
    source,
    interest,
    message,
    lifecycle_stage,
    priority,
    risk_level,
    next_action,
    next_follow_up_at,
    assigned_to,
    onboarding_status,
    delivery_status,
    approval_status,
    payment_status,
    client_type,
    returning_client_status,
    last_project_date,
    estimated_value
  )
  values (
    p_workspace_id,
    btrim(p_record->>'name'),
    nullif(btrim(coalesce(p_record->>'email', '')), ''),
    nullif(btrim(coalesce(p_record->>'phone', '')), ''),
    btrim(p_record->>'businessName'),
    btrim(p_record->>'source'),
    btrim(p_record->>'interest'),
    btrim(p_record->>'message'),
    p_record->>'lifecycleStage',
    p_record->>'priority',
    p_record->>'riskLevel',
    btrim(p_record->>'nextAction'),
    (p_record->>'nextFollowUpAt')::date,
    btrim(p_record->>'assignedTo'),
    p_record->>'onboardingStatus',
    p_record->>'deliveryStatus',
    p_record->>'approvalStatus',
    p_record->>'paymentStatus',
    p_record->>'clientType',
    p_record->>'returningClientStatus',
    nullif(p_record->>'lastProjectDate', '')::date,
    (p_record->>'estimatedValue')::numeric
  )
  returning * into v_record;

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    v_record.id,
    p_evaluation_date
  );

  insert into public.activity_logs (
    workspace_id,
    client_workflow_record_id,
    actor_id,
    action_type,
    note,
    created_at
  )
  values (
    p_workspace_id,
    v_record.id,
    v_actor_id,
    'Record created',
    format(
      '%s was added to the workflow with next action: %s.',
      v_record.name,
      v_record.next_action
    ),
    v_record.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'clientRecord', v_reconciliation->'clientRecord',
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

create or replace function public.command_update_client_workflow_record(
  p_workspace_id uuid,
  p_client_workflow_record_id uuid,
  p_expected_updated_at timestamptz,
  p_updates jsonb,
  p_activity_note text,
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
  v_command_name constant text := 'client_records.update';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_record public.client_workflow_records%rowtype;
  v_reconciliation jsonb;
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

  if p_expected_updated_at is null then
    raise exception 'The expected record version is required.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Choose at least one client record change.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'name',
      'email',
      'phone',
      'businessName',
      'source',
      'interest',
      'message',
      'lifecycleStage',
      'priority',
      'riskLevel',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'onboardingStatus',
      'deliveryStatus',
      'approvalStatus',
      'paymentStatus',
      'clientType',
      'returningClientStatus',
      'lastProjectDate',
      'estimatedValue'
    )
  ) then
    raise exception 'The client record change contains a protected field.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_activity_note, ''))) < 5
    or char_length(btrim(p_activity_note)) > 1000
  then
    raise exception 'Describe the client record change in normal language.'
      using errcode = '22023';
  end if;

  if p_updates ? 'name'
    and char_length(btrim(coalesce(p_updates->>'name', ''))) < 2
  then
    raise exception 'Enter the lead or client name.'
      using errcode = '22023';
  end if;

  if p_updates ? 'businessName'
    and char_length(btrim(coalesce(p_updates->>'businessName', ''))) < 2
  then
    raise exception 'Enter the business name.'
      using errcode = '22023';
  end if;

  if p_updates ? 'source'
    and char_length(btrim(coalesce(p_updates->>'source', ''))) < 2
  then
    raise exception 'Enter where this lead or client came from.'
      using errcode = '22023';
  end if;

  if p_updates ? 'interest'
    and char_length(btrim(coalesce(p_updates->>'interest', ''))) < 2
  then
    raise exception 'Enter what they are interested in.'
      using errcode = '22023';
  end if;

  if p_updates ? 'message'
    and char_length(btrim(coalesce(p_updates->>'message', ''))) < 10
  then
    raise exception 'Add a short context note.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextAction'
    and char_length(btrim(coalesce(p_updates->>'nextAction', ''))) < 5
  then
    raise exception 'Enter the next action.'
      using errcode = '22023';
  end if;

  if p_updates ? 'assignedTo'
    and char_length(btrim(coalesce(p_updates->>'assignedTo', ''))) < 2
  then
    raise exception 'Enter the owner.'
      using errcode = '22023';
  end if;

  if p_updates ? 'email'
    and nullif(btrim(coalesce(p_updates->>'email', '')), '') is not null
    and btrim(p_updates->>'email')
      !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Enter a valid email address.'
      using errcode = '22023';
  end if;

  if p_updates ? 'lifecycleStage' and (
    p_updates->>'lifecycleStage' is null
    or p_updates->>'lifecycleStage' not in (
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
  ) then
    raise exception 'Choose a valid workflow stage.'
      using errcode = '22023';
  end if;

  if p_updates ? 'priority' and (
    p_updates->>'priority' is null
    or p_updates->>'priority' not in ('High', 'Medium', 'Low')
  ) then
    raise exception 'Choose a valid priority.'
      using errcode = '22023';
  end if;

  if p_updates ? 'riskLevel' and (
    p_updates->>'riskLevel' is null
    or p_updates->>'riskLevel' not in ('High', 'Medium', 'Low')
  ) then
    raise exception 'Choose a valid relationship concern.'
      using errcode = '22023';
  end if;

  if p_updates ? 'clientType' and (
    p_updates->>'clientType' is null
    or p_updates->>'clientType' not in (
      'Lead',
      'New client',
      'Active client',
      'Returning client',
      'Past client'
    )
  ) then
    raise exception 'Choose a valid lead or client status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'returningClientStatus' and (
    p_updates->>'returningClientStatus' is null
    or p_updates->>'returningClientStatus' not in (
      'Not returning',
      'Potential reactivation',
      'Repeat project opportunity',
      'Reactivated',
      'Dormant'
    )
  ) then
    raise exception 'Choose a valid returning client status.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'onboardingStatus' and (
    p_updates->>'onboardingStatus' is null
    or p_updates->>'onboardingStatus' not in (
      'Not started', 'In progress', 'Waiting',
      'Blocked', 'Complete', 'Not needed'
    )
  )) or (p_updates ? 'deliveryStatus' and (
    p_updates->>'deliveryStatus' is null
    or p_updates->>'deliveryStatus' not in (
      'Not started', 'In progress', 'Waiting',
      'Blocked', 'Complete', 'Not needed'
    )
  )) or (p_updates ? 'approvalStatus' and (
    p_updates->>'approvalStatus' is null
    or p_updates->>'approvalStatus' not in (
      'Not started', 'In progress', 'Waiting',
      'Blocked', 'Complete', 'Not needed'
    )
  )) or (p_updates ? 'paymentStatus' and (
    p_updates->>'paymentStatus' is null
    or p_updates->>'paymentStatus' not in (
      'Not started', 'In progress', 'Waiting',
      'Blocked', 'Complete', 'Not needed'
    )
  )) then
    raise exception 'Choose valid workflow statuses.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextFollowUpAt'
    and (
      p_updates->>'nextFollowUpAt' is null
      or p_updates->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$'
    )
  then
    raise exception 'Choose a valid follow-up date.'
      using errcode = '22023';
  end if;

  if p_updates ? 'lastProjectDate'
    and nullif(p_updates->>'lastProjectDate', '') is not null
    and p_updates->>'lastProjectDate' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Choose a valid last project date.'
      using errcode = '22023';
  end if;

  if p_updates ? 'estimatedValue'
    and (
      jsonb_typeof(p_updates->'estimatedValue') <> 'number'
      or (p_updates->>'estimatedValue')::numeric < 0
    )
  then
    raise exception 'Enter a valid estimated value.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientRecordId', p_client_workflow_record_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'updates', p_updates,
      'activityNote', btrim(p_activity_note),
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
      raise exception 'This request identifier was already used for a different client record change.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This client record request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select client.*
  into v_record
  from public.client_workflow_records as client
  where client.id = p_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_record.updated_at is distinct from p_expected_updated_at then
    raise exception 'The client record changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  update public.client_workflow_records
  set
    name = case when p_updates ? 'name'
      then btrim(p_updates->>'name') else name end,
    email = case when p_updates ? 'email'
      then nullif(btrim(coalesce(p_updates->>'email', '')), '')
      else email end,
    phone = case when p_updates ? 'phone'
      then nullif(btrim(coalesce(p_updates->>'phone', '')), '')
      else phone end,
    business_name = case when p_updates ? 'businessName'
      then btrim(p_updates->>'businessName') else business_name end,
    source = case when p_updates ? 'source'
      then btrim(p_updates->>'source') else source end,
    interest = case when p_updates ? 'interest'
      then btrim(p_updates->>'interest') else interest end,
    message = case when p_updates ? 'message'
      then btrim(p_updates->>'message') else message end,
    lifecycle_stage = case when p_updates ? 'lifecycleStage'
      then p_updates->>'lifecycleStage' else lifecycle_stage end,
    priority = case when p_updates ? 'priority'
      then p_updates->>'priority' else priority end,
    risk_level = case when p_updates ? 'riskLevel'
      then p_updates->>'riskLevel' else risk_level end,
    next_action = case when p_updates ? 'nextAction'
      then btrim(p_updates->>'nextAction') else next_action end,
    next_follow_up_at = case when p_updates ? 'nextFollowUpAt'
      then (p_updates->>'nextFollowUpAt')::date
      else next_follow_up_at end,
    assigned_to = case when p_updates ? 'assignedTo'
      then btrim(p_updates->>'assignedTo') else assigned_to end,
    onboarding_status = case when p_updates ? 'onboardingStatus'
      then p_updates->>'onboardingStatus' else onboarding_status end,
    delivery_status = case when p_updates ? 'deliveryStatus'
      then p_updates->>'deliveryStatus' else delivery_status end,
    approval_status = case when p_updates ? 'approvalStatus'
      then p_updates->>'approvalStatus' else approval_status end,
    payment_status = case when p_updates ? 'paymentStatus'
      then p_updates->>'paymentStatus' else payment_status end,
    client_type = case when p_updates ? 'clientType'
      then p_updates->>'clientType' else client_type end,
    returning_client_status = case
      when p_updates ? 'returningClientStatus'
      then p_updates->>'returningClientStatus'
      else returning_client_status end,
    last_project_date = case when p_updates ? 'lastProjectDate'
      then nullif(p_updates->>'lastProjectDate', '')::date
      else last_project_date end,
    estimated_value = case when p_updates ? 'estimatedValue'
      then (p_updates->>'estimatedValue')::numeric
      else estimated_value end,
    updated_at = clock_timestamp()
  where id = p_client_workflow_record_id
    and workspace_id = p_workspace_id
  returning * into v_record;

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    p_client_workflow_record_id,
    p_evaluation_date
  );

  insert into public.activity_logs (
    workspace_id,
    client_workflow_record_id,
    actor_id,
    action_type,
    note,
    created_at
  )
  values (
    p_workspace_id,
    p_client_workflow_record_id,
    v_actor_id,
    'Workflow status updated',
    btrim(p_activity_note),
    v_record.updated_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'clientRecord', v_reconciliation->'clientRecord',
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

comment on function public.command_create_client_workflow_record(
  uuid,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_update_client_workflow_record(
  uuid,
  uuid,
  timestamptz,
  jsonb,
  text,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

revoke all
  on function public.command_create_client_workflow_record(
    uuid,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_client_workflow_record(
    uuid,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_update_client_workflow_record(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    text,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_client_workflow_record(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    text,
    date,
    uuid
  )
  to authenticated;

revoke insert, update, delete
  on table public.client_workflow_records
  from anon, authenticated;

grant select
  on table public.client_workflow_records
  to authenticated;

commit;
