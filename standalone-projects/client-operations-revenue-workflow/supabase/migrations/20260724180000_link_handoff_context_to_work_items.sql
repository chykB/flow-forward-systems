begin;

alter table public.handoff_notes
  add column workflow_task_id uuid;

comment on column public.handoff_notes.workflow_task_id is
  'The Handoff Work Item this context prepares. Null identifies a legacy job-level note.';

alter table public.handoff_notes
  add constraint handoff_notes_work_item_engagement_fk
  foreign key (
    workflow_task_id,
    workspace_id,
    client_engagement_id
  )
  references public.workflow_tasks (
    id,
    workspace_id,
    client_engagement_id
  )
  on delete restrict;

create index handoff_notes_work_item_idx
  on public.handoff_notes (
    workspace_id,
    client_engagement_id,
    workflow_task_id,
    created_at desc
  )
  where workflow_task_id is not null;

create or replace function public.command_create_work_item_handoff_context(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_workflow_task_id uuid,
  p_note jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'handoff_notes.create';
  v_client_workflow_record_id uuid;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
  v_note public.handoff_notes%rowtype;
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

  if p_client_engagement_id is null then
    raise exception 'The engagement identifier is required.'
      using errcode = '22023';
  end if;

  if p_workflow_task_id is null then
    raise exception 'Choose the Handoff Work Item.'
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

  if p_note is null or jsonb_typeof(p_note) <> 'object' then
    raise exception 'Handoff context details are required.'
      using errcode = '22023';
  end if;

  if not p_note ?& array[
    'clientWorkflowRecordId',
    'title',
    'note',
    'owner'
  ] then
    raise exception 'Handoff context details are incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_note) as supplied(field)
    where supplied.field not in (
      'clientWorkflowRecordId',
      'title',
      'note',
      'owner'
    )
  ) then
    raise exception 'Handoff context details contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_note->'clientWorkflowRecordId') <> 'string'
    or jsonb_typeof(p_note->'title') <> 'string'
    or jsonb_typeof(p_note->'note') <> 'string'
    or jsonb_typeof(p_note->'owner') <> 'string'
  then
    raise exception 'Handoff context fields must use text values.'
      using errcode = '22023';
  end if;

  begin
    v_client_workflow_record_id :=
      (p_note->>'clientWorkflowRecordId')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The client record identifier is invalid.'
        using errcode = '22023';
  end;

  if char_length(btrim(coalesce(p_note->>'title', ''))) < 3 then
    raise exception 'Enter a short handoff title.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_note->>'title')) > 200 then
    raise exception 'Keep the handoff title under 200 characters.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_note->>'note', ''))) < 10 then
    raise exception 'Add the handoff context.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_note->>'note')) > 5000 then
    raise exception 'Keep the handoff context under 5,000 characters.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_note->>'owner', ''))) < 2 then
    raise exception 'Enter who will receive this handoff.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_note->>'owner')) > 200 then
    raise exception 'Keep the receiving owner under 200 characters.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'workflowTaskId', p_workflow_task_id,
      'clientWorkflowRecordId', v_client_workflow_record_id,
      'title', btrim(p_note->>'title'),
      'note', btrim(p_note->>'note'),
      'owner', btrim(p_note->>'owner')
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
      raise exception 'This request identifier was already used for different handoff context.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This handoff context request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select task.*
  into v_task
  from public.workflow_tasks as task
  where task.id = p_workflow_task_id
    and task.workspace_id = p_workspace_id
    and task.client_engagement_id = p_client_engagement_id
  for update of task;

  if not found then
    raise exception 'Handoff Work Item not found in this job.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_task.client_workflow_record_id,
    false,
    true
  );

  if v_task.client_workflow_record_id
    <> v_client_workflow_record_id
  then
    raise exception 'The Handoff Work Item does not belong to this client record.'
      using errcode = '22023';
  end if;

  if v_task.type <> 'Handoff'
    and v_task.phase <> 'Handoff'
  then
    raise exception 'Choose a Handoff Work Item.'
      using errcode = '22023';
  end if;

  if v_task.status not in (
    'Not started',
    'In progress',
    'Waiting',
    'Blocked'
  ) then
    raise exception 'Add context while the Handoff Work Item is active.'
      using errcode = '22023';
  end if;

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  insert into public.handoff_notes (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    workflow_task_id,
    title,
    note,
    owner
  )
  values (
    p_workspace_id,
    v_task.client_workflow_record_id,
    p_client_engagement_id,
    v_task.id,
    btrim(p_note->>'title'),
    btrim(p_note->>'note'),
    btrim(p_note->>'owner')
  )
  returning * into v_note;

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
    v_task.client_workflow_record_id,
    p_client_engagement_id,
    v_actor_id,
    'Handoff context added',
    format(
      'Handoff context for %s was added for %s.',
      v_task.title,
      v_note.owner
    ),
    v_note.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'handoffNote', to_jsonb(v_note)
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

comment on function public.command_create_work_item_handoff_context(
  uuid,
  uuid,
  uuid,
  jsonb,
  uuid
) is
  'Creates receiving context for one active Handoff Work Item in the selected job.';

revoke execute
  on function public.command_create_engagement_handoff_note(
    uuid,
    uuid,
    jsonb,
    uuid
  )
  from authenticated;

revoke all
  on function public.command_create_work_item_handoff_context(
    uuid,
    uuid,
    uuid,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_work_item_handoff_context(
    uuid,
    uuid,
    uuid,
    jsonb,
    uuid
  )
  to authenticated, service_role;

revoke insert, update, delete
  on table public.handoff_notes
  from anon, authenticated;

grant select
  on table public.handoff_notes
  to authenticated;

commit;
