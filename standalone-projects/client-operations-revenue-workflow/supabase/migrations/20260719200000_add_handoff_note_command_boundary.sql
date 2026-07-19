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
        'handoff_notes.create'
      )
    );

create or replace function public.command_create_handoff_note(
  p_workspace_id uuid,
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
    raise exception 'Handoff note details are required.'
      using errcode = '22023';
  end if;

  if not p_note ?& array[
    'clientWorkflowRecordId',
    'title',
    'note',
    'owner'
  ] then
    raise exception 'Handoff note details are incomplete.'
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
    raise exception 'Handoff note details contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_note->'clientWorkflowRecordId') <> 'string'
    or jsonb_typeof(p_note->'title') <> 'string'
    or jsonb_typeof(p_note->'note') <> 'string'
    or jsonb_typeof(p_note->'owner') <> 'string'
  then
    raise exception 'Handoff note fields must use text values.'
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
    raise exception 'Enter a short note title.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_note->>'title')) > 200 then
    raise exception 'Keep the note title under 200 characters.'
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
    raise exception 'Enter who owns this note.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_note->>'owner')) > 200 then
    raise exception 'Keep the owner under 200 characters.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
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
      raise exception 'This request identifier was already used for different handoff note details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This handoff note request is still being processed.'
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

  insert into public.handoff_notes (
    workspace_id,
    client_workflow_record_id,
    title,
    note,
    owner
  )
  values (
    p_workspace_id,
    v_client_workflow_record_id,
    btrim(p_note->>'title'),
    btrim(p_note->>'note'),
    btrim(p_note->>'owner')
  )
  returning * into v_note;

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
    v_client_workflow_record_id,
    v_actor_id,
    'Handoff note added',
    format(
      '%s was added for delegation context.',
      v_note.title
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

comment on function public.command_create_handoff_note(
  uuid,
  jsonb,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

revoke all
  on function public.command_create_handoff_note(
    uuid,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_handoff_note(
    uuid,
    jsonb,
    uuid
  )
  to authenticated;

revoke insert, update, delete
  on table public.handoff_notes
  from anon, authenticated;

grant select
  on table public.handoff_notes
  to authenticated;

commit;
