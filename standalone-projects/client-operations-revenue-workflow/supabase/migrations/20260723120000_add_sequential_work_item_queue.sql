begin;

create temporary table sequential_work_item_backfill_engagements (
  workspace_id uuid not null,
  client_engagement_id uuid not null,
  primary key (workspace_id, client_engagement_id)
) on commit drop;

with dependency_free_engagements as (
  select engagement.workspace_id, engagement.id
  from public.client_engagements as engagement
  where engagement.engagement_status = 'Active'
    and exists (
      select 1
      from public.workflow_tasks as task
      where task.workspace_id = engagement.workspace_id
        and task.client_engagement_id = engagement.id
        and task.status not in ('Complete', 'Not needed')
    )
    and not exists (
      select 1
      from public.workflow_task_dependencies as dependency
      where dependency.workspace_id = engagement.workspace_id
        and dependency.client_engagement_id = engagement.id
    )
), ordered_work as (
  select
    task.workspace_id,
    task.client_engagement_id,
    task.id as workflow_task_id,
    task.status,
    lag(task.id) over (
      partition by task.workspace_id, task.client_engagement_id
      order by
        public.workflow_phase_rank(task.phase),
        task.created_at,
        task.id
    ) as depends_on_workflow_task_id
  from public.workflow_tasks as task
  join dependency_free_engagements as engagement
    on engagement.workspace_id = task.workspace_id
    and engagement.id = task.client_engagement_id
  where task.status not in ('Complete', 'Not needed')
), inserted_dependencies as (
  insert into public.workflow_task_dependencies (
    workspace_id,
    client_engagement_id,
    workflow_task_id,
    depends_on_workflow_task_id,
    created_by
  )
  select
    ordered.workspace_id,
    ordered.client_engagement_id,
    ordered.workflow_task_id,
    ordered.depends_on_workflow_task_id,
    workspace.owner_id
  from ordered_work as ordered
  join public.workspaces as workspace
    on workspace.id = ordered.workspace_id
  where ordered.depends_on_workflow_task_id is not null
    and ordered.status <> 'In progress'
  on conflict do nothing
  returning workspace_id, client_engagement_id
)
insert into sequential_work_item_backfill_engagements (
  workspace_id,
  client_engagement_id
)
select distinct workspace_id, client_engagement_id
from inserted_dependencies
on conflict do nothing;

do $$
declare
  v_context record;
begin
  for v_context in
    select
      backfill.workspace_id,
      backfill.client_engagement_id,
      engagement.client_workflow_record_id,
      workspace.owner_id
    from sequential_work_item_backfill_engagements as backfill
    join public.client_engagements as engagement
      on engagement.id = backfill.client_engagement_id
      and engagement.workspace_id = backfill.workspace_id
    join public.workspaces as workspace
      on workspace.id = backfill.workspace_id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      v_context.owner_id::text,
      true
    );
    perform set_config(
      'app.client_engagement_id',
      v_context.client_engagement_id::text,
      true
    );
    perform public.reconcile_client_engagement_risk_signals(
      v_context.workspace_id,
      v_context.client_engagement_id,
      current_date
    );
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('app.client_engagement_id', '', true);
end;
$$;

create or replace function public.enforce_work_item_dependency_readiness()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_dependent_status text;
  v_prerequisite_status text;
begin
  select task.status
  into v_dependent_status
  from public.workflow_tasks as task
  where task.id = new.workflow_task_id
    and task.workspace_id = new.workspace_id
    and task.client_engagement_id = new.client_engagement_id;

  select task.status
  into v_prerequisite_status
  from public.workflow_tasks as task
  where task.id = new.depends_on_workflow_task_id
    and task.workspace_id = new.workspace_id
    and task.client_engagement_id = new.client_engagement_id;

  if v_dependent_status in ('In progress', 'Complete')
    and v_prerequisite_status not in ('Complete', 'Not needed')
  then
    raise exception 'Active or completed work cannot wait for an unfinished prerequisite.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.enforce_work_item_dependency_readiness() is
  'Prevents unfinished prerequisites from being attached to work that already started or completed.';

revoke all
  on function public.enforce_work_item_dependency_readiness()
  from public, anon, authenticated;

drop trigger if exists enforce_work_item_dependency_readiness
  on public.workflow_task_dependencies;

create trigger enforce_work_item_dependency_readiness
before insert on public.workflow_task_dependencies
for each row
execute function public.enforce_work_item_dependency_readiness();

create or replace function public.assign_sequential_work_item_dependency()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_previous_task_id uuid;
begin
  if new.client_engagement_id is null
    or new.status = 'Not needed'
  then
    return null;
  end if;

  select candidate.id
  into v_previous_task_id
  from public.workflow_tasks as candidate
  where candidate.workspace_id = new.workspace_id
    and candidate.client_engagement_id = new.client_engagement_id
    and candidate.id <> new.id
    and candidate.status not in ('Complete', 'Not needed')
    and public.workflow_phase_rank(candidate.phase) <=
      public.workflow_phase_rank(new.phase)
  order by
    public.workflow_phase_rank(candidate.phase) desc,
    candidate.created_at desc,
    candidate.id desc
  limit 1;

  if v_previous_task_id is null then
    return null;
  end if;

  if new.status in ('In progress', 'Complete') then
    raise exception 'Finish the current Work Item before starting or completing this one.'
      using errcode = '22023';
  end if;

  if v_actor_id is null then
    select workspace.owner_id
    into v_actor_id
    from public.workspaces as workspace
    where workspace.id = new.workspace_id;
  end if;

  insert into public.workflow_task_dependencies (
    workspace_id,
    client_engagement_id,
    workflow_task_id,
    depends_on_workflow_task_id,
    created_by
  )
  values (
    new.workspace_id,
    new.client_engagement_id,
    new.id,
    v_previous_task_id,
    v_actor_id
  )
  on conflict do nothing;

  return null;
end;
$$;

comment on function public.assign_sequential_work_item_dependency() is
  'Places newly created Work Items after the latest unfinished eligible item in the same engagement.';

revoke all
  on function public.assign_sequential_work_item_dependency()
  from public, anon, authenticated;

drop trigger if exists assign_sequential_work_item_dependency
  on public.workflow_tasks;

create trigger assign_sequential_work_item_dependency
after insert on public.workflow_tasks
for each row
execute function public.assign_sequential_work_item_dependency();

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
  v_engagement public.client_engagements%rowtype;
  v_response jsonb;
begin
  if public.workflow_phase_rank(p_phase) = 0 then
    raise exception 'Choose a valid Work Item phase.'
      using errcode = '22023';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    p_client_workflow_record_id,
    false,
    true
  );

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
    and engagement.client_workflow_record_id =
      p_client_workflow_record_id
  for update of engagement;

  if public.workflow_phase_rank(p_phase) >
      public.client_engagement_stage_phase_rank(
        v_engagement.lifecycle_stage
      )
    and p_status <> 'Planned'
  then
    raise exception 'Future-phase Work Items must be Planned until the engagement reaches that phase.'
      using errcode = '22023';
  end if;

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

  if p_status = 'Planned' then
    v_response :=
      public.command_create_planned_engagement_workflow_task(
        p_workspace_id,
        p_client_engagement_id,
        p_client_workflow_record_id,
        p_title,
        p_type,
        p_owner,
        p_due_date,
        p_criticality,
        p_phase,
        p_evaluation_date,
        p_idempotency_key
      );
  else
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
  end if;

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

comment on function public.command_create_engagement_workflow_task(
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
) is
  'Creates one engagement Work Item and serializes creation so its default sequence is deterministic.';

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
  v_task public.workflow_tasks%rowtype;
  v_response jsonb;
begin
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

  if p_status = 'Planned' and p_expected_status <> 'Planned' then
    raise exception 'Active Work Items cannot be moved back to Planned.'
      using errcode = '22023';
  end if;

  if p_status in ('In progress', 'Complete')
    and public.workflow_task_has_unresolved_dependency(
      p_workspace_id,
      p_client_engagement_id,
      p_workflow_task_id
    )
  then
    raise exception 'Complete the earlier Work Item before starting or completing this one.'
      using errcode = '22023';
  end if;

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  if p_expected_status = 'Planned' then
    v_response :=
      public.command_activate_planned_engagement_workflow_task(
        p_workspace_id,
        p_client_engagement_id,
        p_workflow_task_id,
        p_status,
        p_evaluation_date,
        p_idempotency_key
      );
  else
    v_response := public.command_update_workflow_task_status(
      p_workspace_id,
      p_workflow_task_id,
      p_expected_status,
      p_status,
      p_evaluation_date,
      p_idempotency_key
    );
  end if;

  if (v_response->'workItem'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'The updated Work Item does not match this engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

comment on function public.command_update_engagement_workflow_task_status(
  uuid,
  uuid,
  uuid,
  text,
  text,
  date,
  uuid
) is
  'Updates one engagement Work Item while preventing downstream work from starting before its prerequisites finish.';

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
