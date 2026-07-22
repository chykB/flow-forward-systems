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
        'risk_signals.dismiss'
      )
    );

create or replace function public.command_replace_engagement_workflow_task_dependencies(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_workflow_task_id uuid,
  p_expected_updated_at timestamptz,
  p_depends_on_workflow_task_ids uuid[],
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
  v_command_name constant text := 'work_items.replace_dependencies';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
  v_requested_ids uuid[] := array[]::uuid[];
  v_existing_ids uuid[] := array[]::uuid[];
  v_prerequisite_count integer := 0;
  v_would_cycle boolean := false;
  v_changed boolean := false;
  v_dependencies jsonb;
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

  if p_expected_updated_at is null then
    raise exception 'The expected Work Item version is required.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  if abs(p_evaluation_date - current_date) > 1 then
    raise exception 'The evaluation date is outside the allowed range.'
      using errcode = '22023';
  end if;

  if cardinality(
    coalesce(
      p_depends_on_workflow_task_ids,
      array[]::uuid[]
    )
  ) > 50 then
    raise exception 'A Work Item cannot have more than 50 prerequisites.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      coalesce(
        p_depends_on_workflow_task_ids,
        array[]::uuid[]
      )
    ) as requested(task_id)
    where requested.task_id is null
  ) then
    raise exception 'A prerequisite identifier cannot be empty.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(normalized.task_id order by normalized.task_id),
    array[]::uuid[]
  )
  into v_requested_ids
  from (
    select distinct requested.task_id
    from unnest(
      coalesce(
        p_depends_on_workflow_task_ids,
        array[]::uuid[]
      )
    ) as requested(task_id)
  ) as normalized;

  if cardinality(v_requested_ids) <>
    cardinality(
      coalesce(
        p_depends_on_workflow_task_ids,
        array[]::uuid[]
      )
    )
  then
    raise exception 'Each prerequisite can be selected only once.'
      using errcode = '22023';
  end if;

  if p_workflow_task_id = any(v_requested_ids) then
    raise exception 'A Work Item cannot depend on itself.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'workItemId', p_workflow_task_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'prerequisiteIds', to_jsonb(v_requested_ids),
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
      raise exception 'This request identifier was already used for different prerequisites.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This prerequisite request is still being processed.'
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
    raise exception 'Work Item not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_task.client_workflow_record_id,
    false,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'The Work Item changed before its prerequisites were saved.'
      using errcode = 'PT409';
  end if;

  select count(*)::integer
  into v_prerequisite_count
  from public.workflow_tasks as prerequisite
  where prerequisite.id = any(v_requested_ids)
    and prerequisite.workspace_id = p_workspace_id
    and prerequisite.client_engagement_id =
      p_client_engagement_id;

  if v_prerequisite_count <> cardinality(v_requested_ids) then
    raise exception 'Every prerequisite must belong to this engagement.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workflow_tasks as prerequisite
    where prerequisite.id = any(v_requested_ids)
      and prerequisite.workspace_id = p_workspace_id
      and prerequisite.client_engagement_id =
        p_client_engagement_id
      and public.workflow_phase_rank(prerequisite.phase) >
        public.workflow_phase_rank(v_task.phase)
  ) then
    raise exception 'A Work Item can depend only on work in the same or an earlier phase.'
      using errcode = '22023';
  end if;

  with recursive prerequisite_chain(task_id) as (
    select requested.task_id
    from unnest(v_requested_ids) as requested(task_id)

    union

    select dependency.depends_on_workflow_task_id
    from public.workflow_task_dependencies as dependency
    join prerequisite_chain as chain
      on chain.task_id = dependency.workflow_task_id
    where dependency.workspace_id = p_workspace_id
      and dependency.client_engagement_id =
        p_client_engagement_id
  )
  select exists (
    select 1
    from prerequisite_chain
    where task_id = p_workflow_task_id
  )
  into v_would_cycle;

  if v_would_cycle then
    raise exception 'These prerequisites would create a dependency cycle.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(
      dependency.depends_on_workflow_task_id
      order by dependency.depends_on_workflow_task_id
    ),
    array[]::uuid[]
  )
  into v_existing_ids
  from public.workflow_task_dependencies as dependency
  where dependency.workspace_id = p_workspace_id
    and dependency.client_engagement_id =
      p_client_engagement_id
    and dependency.workflow_task_id = p_workflow_task_id;

  v_changed := v_existing_ids is distinct from v_requested_ids;

  if v_changed then
    delete from public.workflow_task_dependencies
    where workspace_id = p_workspace_id
      and client_engagement_id = p_client_engagement_id
      and workflow_task_id = p_workflow_task_id;

    insert into public.workflow_task_dependencies (
      workspace_id,
      client_engagement_id,
      workflow_task_id,
      depends_on_workflow_task_id,
      created_by
    )
    select
      p_workspace_id,
      p_client_engagement_id,
      p_workflow_task_id,
      requested.task_id,
      v_actor_id
    from unnest(v_requested_ids) as requested(task_id);

    update public.workflow_tasks
    set updated_at = clock_timestamp()
    where id = p_workflow_task_id
      and workspace_id = p_workspace_id
      and client_engagement_id = p_client_engagement_id
    returning * into v_task;

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
      'Work item dependencies updated',
      format(
        'Prerequisites for %s changed from %s to %s.',
        v_task.title,
        cardinality(v_existing_ids),
        cardinality(v_requested_ids)
      ),
      v_task.updated_at
    );
  end if;

  v_reconciliation :=
    public.reconcile_client_engagement_risk_signals(
      p_workspace_id,
      p_client_engagement_id,
      p_evaluation_date
    );

  select coalesce(
    jsonb_agg(
      to_jsonb(dependency)
      order by
        dependency.workflow_task_id,
        dependency.depends_on_workflow_task_id
    ),
    '[]'::jsonb
  )
  into v_dependencies
  from public.workflow_task_dependencies as dependency
  where dependency.workspace_id = p_workspace_id
    and dependency.client_engagement_id =
      p_client_engagement_id;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'workItem', to_jsonb(v_task),
    'dependencies', v_dependencies,
    'reconciliation', v_reconciliation,
    'changed', v_changed
  );

  update public.workspace_command_requests
  set response = v_response, completed_at = now()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

comment on function public.command_replace_engagement_workflow_task_dependencies(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid[],
  date,
  uuid
) is
  'Replaces one engagement Work Item prerequisite set with ownership, concurrency, cycle, sequencing, idempotency, Activity, and risk reconciliation checks.';

revoke insert, update, delete
  on table public.workflow_task_dependencies
  from authenticated;

grant select
  on table public.workflow_task_dependencies
  to authenticated;

revoke all
  on function public.command_replace_engagement_workflow_task_dependencies(
    uuid,
    uuid,
    uuid,
    timestamptz,
    uuid[],
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_replace_engagement_workflow_task_dependencies(
    uuid,
    uuid,
    uuid,
    timestamptz,
    uuid[],
    date,
    uuid
  )
  to authenticated, service_role;

commit;
