begin;

create table public.workspace_command_requests (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  actor_id uuid not null
    references auth.users(id) on delete cascade,
  command_name text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (
    workspace_id,
    actor_id,
    command_name,
    idempotency_key
  ),
  constraint workspace_command_requests_name_check
    check (
      command_name in (
        'work_items.create',
        'work_items.update_status'
      )
    ),
  constraint workspace_command_requests_completion_check
    check (
      (response is null and completed_at is null)
      or (response is not null and completed_at is not null)
    )
);

comment on table public.workspace_command_requests is
  'Private idempotency ledger for internal application commands. It is not a public API.';

alter table public.workspace_command_requests
  enable row level security;

revoke all
  on table public.workspace_command_requests
  from public, anon, authenticated;

create or replace function public.command_create_workflow_task(
  p_workspace_id uuid,
  p_client_workflow_record_id uuid,
  p_title text,
  p_type text,
  p_owner text,
  p_due_date date,
  p_status text,
  p_criticality text,
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
  v_command_name constant text := 'work_items.create';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
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

  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Enter a work item title.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_owner, ''))) < 2 then
    raise exception 'Enter who owns this work item.'
      using errcode = '22023';
  end if;

  if p_due_date is null then
    raise exception 'Choose a due date.'
      using errcode = '22023';
  end if;

  if p_type is null or p_type not in (
    'Follow-up',
    'Onboarding',
    'Delivery',
    'Approval',
    'Payment',
    'Handoff'
  ) then
    raise exception 'Choose a valid work item type.'
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in (
    'Not started',
    'In progress',
    'Waiting',
    'Blocked',
    'Complete',
    'Not needed'
  ) then
    raise exception 'Choose a valid work item status.'
      using errcode = '22023';
  end if;

  if p_criticality is null or p_criticality not in (
    'Critical',
    'High',
    'Medium',
    'Low'
  ) then
    raise exception 'Choose a valid work item criticality.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientWorkflowRecordId', p_client_workflow_record_id,
      'title', btrim(p_title),
      'type', p_type,
      'owner', btrim(p_owner),
      'dueDate', p_due_date,
      'status', p_status,
      'criticality', p_criticality
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
      raise exception 'This request identifier was already used for different work item details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This work item request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  perform 1
  from public.client_workflow_records as client
  where client.id = p_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  insert into public.workflow_tasks (
    workspace_id,
    client_workflow_record_id,
    title,
    type,
    owner,
    due_date,
    status,
    criticality
  )
  values (
    p_workspace_id,
    p_client_workflow_record_id,
    btrim(p_title),
    p_type,
    btrim(p_owner),
    p_due_date,
    p_status,
    p_criticality
  )
  returning * into v_task;

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
    'Work item added',
    format(
      '%s was added as a %s work item.',
      v_task.title,
      lower(v_task.type)
    ),
    v_task.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'workItem', to_jsonb(v_task),
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

create or replace function public.command_update_workflow_task_status(
  p_workspace_id uuid,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'work_items.update_status';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
  v_previous_status text;
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

  if p_expected_status is null or p_expected_status not in (
    'Not started',
    'In progress',
    'Waiting',
    'Blocked',
    'Complete',
    'Not needed'
  ) then
    raise exception 'The expected work item status is invalid.'
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in (
    'Not started',
    'In progress',
    'Waiting',
    'Blocked',
    'Complete',
    'Not needed'
  ) then
    raise exception 'Choose a valid work item status.'
      using errcode = '22023';
  end if;

  if p_expected_status = p_status then
    raise exception 'Choose a different work item status.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'workItemId', p_workflow_task_id,
      'expectedStatus', p_expected_status,
      'status', p_status
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
      raise exception 'This request identifier was already used for a different status change.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This work item request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select task.*
  into v_task
  from public.workflow_tasks as task
  where task.id = p_workflow_task_id
    and task.workspace_id = p_workspace_id
  for update of task;

  if not found then
    raise exception 'Work item not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_task.status is distinct from p_expected_status then
    raise exception 'The work item status changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  v_previous_status := v_task.status;

  update public.workflow_tasks
  set status = p_status
  where id = p_workflow_task_id
    and workspace_id = p_workspace_id
  returning * into v_task;

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    v_task.client_workflow_record_id,
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
    v_task.client_workflow_record_id,
    v_actor_id,
    'Work item status updated',
    format(
      '%s changed from %s to %s.',
      v_task.title,
      v_previous_status,
      v_task.status
    ),
    v_task.updated_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'workItem', to_jsonb(v_task),
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

comment on function public.command_create_workflow_task(
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
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_update_workflow_task_status(
  uuid,
  uuid,
  text,
  text,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

revoke all
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
  from public, anon;

grant execute
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
  to authenticated;

revoke all
  on function public.command_update_workflow_task_status(
    uuid,
    uuid,
    text,
    text,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_workflow_task_status(
    uuid,
    uuid,
    text,
    text,
    date,
    uuid
  )
  to authenticated;

revoke insert, update, delete
  on table public.workflow_tasks
  from authenticated;

grant select
  on table public.workflow_tasks
  to authenticated;

commit;
