begin;

create or replace function public.client_engagement_lifecycle_stage_rank(
  p_lifecycle_stage text
)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case p_lifecycle_stage
    when 'New lead' then 1
    when 'Qualified lead' then 2
    when 'Follow-up needed' then 3
    when 'Discovery or call booked' then 4
    when 'Proposal sent' then 5
    when 'Won client' then 6
    when 'Onboarding' then 7
    when 'In delivery' then 8
    when 'Waiting for approval' then 9
    when 'Payment follow-up' then 10
    when 'Completed' then 11
    when 'Lost or inactive' then 11
    else 0
  end;
$$;

comment on function public.client_engagement_lifecycle_stage_rank(text) is
  'Returns the forward-only business order for engagement lifecycle stages.';

revoke all
  on function public.client_engagement_lifecycle_stage_rank(text)
  from public, anon, authenticated;

create or replace function public.derive_client_engagement_lifecycle_stage(
  p_workspace_id uuid,
  p_client_engagement_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_engagement public.client_engagements%rowtype;
  v_candidate text;
  v_task_phase_rank integer;
  v_ready_phase_rank integer;
  v_has_unfinished_pre_payment_work boolean;
  v_has_unfinished_work boolean;
  v_has_billing_decision boolean;
  v_has_unsettled_invoice boolean;
  v_has_completion_evidence boolean;
begin
  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id;

  if not found then
    raise exception 'Engagement not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_candidate := v_engagement.lifecycle_stage;

  if v_engagement.engagement_status <> 'Active'
    or v_candidate in ('Completed', 'Lost or inactive')
  then
    return v_candidate;
  end if;

  if exists (
    select 1
    from public.proposal_records as proposal
    where proposal.workspace_id = p_workspace_id
      and proposal.client_engagement_id = p_client_engagement_id
      and proposal.status = 'Accepted'
  ) then
    if public.client_engagement_lifecycle_stage_rank('Won client') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'Won client';
    end if;
  elsif exists (
    select 1
    from public.proposal_records as proposal
    where proposal.workspace_id = p_workspace_id
      and proposal.client_engagement_id = p_client_engagement_id
      and proposal.status in (
        'Sent',
        'Revision requested',
        'Expired'
      )
  ) then
    if public.client_engagement_lifecycle_stage_rank('Proposal sent') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'Proposal sent';
    end if;
  end if;

  select max(public.workflow_phase_rank(task.phase))
  into v_task_phase_rank
  from public.workflow_tasks as task
  where task.workspace_id = p_workspace_id
    and task.client_engagement_id = p_client_engagement_id
    and task.status not in ('Planned', 'Not needed')
    and public.workflow_phase_rank(task.phase) between 3 and 6;

  if coalesce(v_task_phase_rank, 0) >= 6 then
    if public.client_engagement_lifecycle_stage_rank('Payment follow-up') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'Payment follow-up';
    end if;
  elsif coalesce(v_task_phase_rank, 0) = 5 then
    if public.client_engagement_lifecycle_stage_rank('Waiting for approval') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'Waiting for approval';
    end if;
  elsif coalesce(v_task_phase_rank, 0) = 4 then
    if public.client_engagement_lifecycle_stage_rank('In delivery') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'In delivery';
    end if;
  elsif coalesce(v_task_phase_rank, 0) = 3 then
    if public.client_engagement_lifecycle_stage_rank('Onboarding') >
      public.client_engagement_lifecycle_stage_rank(v_candidate)
    then
      v_candidate := 'Onboarding';
    end if;
  end if;

  if public.client_engagement_lifecycle_stage_rank(v_candidate) >=
    public.client_engagement_lifecycle_stage_rank('Won client')
  then
    select min(public.workflow_phase_rank(task.phase))
    into v_ready_phase_rank
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id = p_client_engagement_id
      and task.status = 'Planned'
      and public.workflow_phase_rank(task.phase) between 3 and 6
      and public.workflow_phase_rank(task.phase) >
        public.client_engagement_stage_phase_rank(v_candidate)
      and not exists (
        select 1
        from public.workflow_task_dependencies as dependency
        join public.workflow_tasks as prerequisite
          on prerequisite.id =
            dependency.depends_on_workflow_task_id
          and prerequisite.workspace_id = dependency.workspace_id
          and prerequisite.client_engagement_id =
            dependency.client_engagement_id
        where dependency.workspace_id = p_workspace_id
          and dependency.client_engagement_id =
            p_client_engagement_id
          and dependency.workflow_task_id = task.id
          and prerequisite.status not in (
            'Complete',
            'Not needed'
          )
      );

    if coalesce(v_ready_phase_rank, 0) = 3 then
      v_candidate := 'Onboarding';
    elsif coalesce(v_ready_phase_rank, 0) = 4 then
      v_candidate := 'In delivery';
    elsif coalesce(v_ready_phase_rank, 0) = 5 then
      v_candidate := 'Waiting for approval';
    elsif coalesce(v_ready_phase_rank, 0) = 6 then
      v_candidate := 'Payment follow-up';
    end if;
  end if;

  select exists (
    select 1
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id = p_client_engagement_id
      and public.workflow_phase_rank(task.phase) between 3 and 5
      and task.status not in ('Complete', 'Not needed')
  )
  into v_has_unfinished_pre_payment_work;

  if not v_has_unfinished_pre_payment_work
    and exists (
      select 1
      from public.invoice_records as invoice
      where invoice.workspace_id = p_workspace_id
        and invoice.client_engagement_id = p_client_engagement_id
        and invoice.status in (
          'Sent',
          'Due soon',
          'Overdue',
          'Disputed',
          'Paid'
        )
    )
    and public.client_engagement_lifecycle_stage_rank(
      'Payment follow-up'
    ) > public.client_engagement_lifecycle_stage_rank(v_candidate)
  then
    v_candidate := 'Payment follow-up';
  end if;

  select exists (
    select 1
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id = p_client_engagement_id
      and task.status not in ('Complete', 'Not needed')
  )
  into v_has_unfinished_work;

  select exists (
    select 1
    from public.invoice_records as invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.client_engagement_id = p_client_engagement_id
  )
  into v_has_billing_decision;

  select exists (
    select 1
    from public.invoice_records as invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.client_engagement_id = p_client_engagement_id
      and invoice.status not in ('Paid', 'Not needed', 'Voided')
  )
  into v_has_unsettled_invoice;

  select
    exists (
      select 1
      from public.workflow_tasks as task
      where task.workspace_id = p_workspace_id
        and task.client_engagement_id = p_client_engagement_id
        and task.status = 'Complete'
    )
    or exists (
      select 1
      from public.invoice_records as invoice
      where invoice.workspace_id = p_workspace_id
        and invoice.client_engagement_id = p_client_engagement_id
        and invoice.status = 'Paid'
    )
  into v_has_completion_evidence;

  if v_has_completion_evidence
    and not v_has_unfinished_work
    and v_has_billing_decision
    and not v_has_unsettled_invoice
  then
    v_candidate := 'Completed';
  end if;

  return v_candidate;
end;
$$;

comment on function public.derive_client_engagement_lifecycle_stage(
  uuid,
  uuid
) is
  'Derives the furthest durable engagement stage supported by proposals, ready or active work, and settled billing.';

revoke all
  on function public.derive_client_engagement_lifecycle_stage(
    uuid,
    uuid
  )
  from public, anon, authenticated;

create or replace function public.reconcile_client_engagement_lifecycle_stage(
  p_workspace_id uuid,
  p_client_engagement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_engagement public.client_engagements%rowtype;
  v_previous_stage text;
  v_next_stage text;
  v_changed boolean := false;
begin
  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
  for update of engagement;

  if not found then
    raise exception 'Engagement not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_previous_stage := v_engagement.lifecycle_stage;
  v_next_stage := public.derive_client_engagement_lifecycle_stage(
    p_workspace_id,
    p_client_engagement_id
  );

  if public.client_engagement_lifecycle_stage_rank(v_next_stage) >
    public.client_engagement_lifecycle_stage_rank(v_previous_stage)
  then
    update public.client_engagements
    set
      lifecycle_stage = v_next_stage,
      engagement_status = case
        when v_next_stage = 'Completed' then 'Completed'
        else engagement_status
      end
    where id = p_client_engagement_id
      and workspace_id = p_workspace_id
    returning * into v_engagement;

    if v_engagement.is_primary then
      update public.client_workflow_records
      set lifecycle_stage = v_next_stage,
        updated_at = clock_timestamp()
      where id = v_engagement.client_workflow_record_id
        and workspace_id = p_workspace_id;

      select engagement.*
      into v_engagement
      from public.client_engagements as engagement
      where engagement.id = p_client_engagement_id
        and engagement.workspace_id = p_workspace_id;
    end if;

    if v_actor_id is null then
      select workspace.owner_id
      into v_actor_id
      from public.workspaces as workspace
      where workspace.id = p_workspace_id;
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
      'Workflow stage advanced',
      format(
        'Workflow stage advanced automatically from %s to %s based on completed business milestones.',
        v_previous_stage,
        v_next_stage
      )
    );

    v_changed := true;
  end if;

  return jsonb_build_object(
    'changed', v_changed,
    'previousStage', v_previous_stage,
    'currentStage', v_engagement.lifecycle_stage,
    'clientEngagement', to_jsonb(v_engagement)
  );
end;
$$;

comment on function public.reconcile_client_engagement_lifecycle_stage(
  uuid,
  uuid
) is
  'Advances one engagement to its derived stage without regressing or cancelling it and mirrors primary-stage summaries.';

revoke all
  on function public.reconcile_client_engagement_lifecycle_stage(
    uuid,
    uuid
  )
  from public, anon, authenticated;

create or replace function public.reconcile_engagement_stage_from_child()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_workspace_id uuid;
  v_client_engagement_id uuid;
begin
  if tg_op = 'DELETE' then
    v_workspace_id := old.workspace_id;
    v_client_engagement_id := old.client_engagement_id;
  else
    v_workspace_id := new.workspace_id;
    v_client_engagement_id := new.client_engagement_id;
  end if;

  perform public.reconcile_client_engagement_lifecycle_stage(
    v_workspace_id,
    v_client_engagement_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.reconcile_engagement_stage_from_child() is
  'Reconciles engagement stage after durable proposal, work, dependency, or invoice milestones change.';

revoke all
  on function public.reconcile_engagement_stage_from_child()
  from public, anon, authenticated;

drop trigger if exists reconcile_engagement_stage_from_proposal
  on public.proposal_records;

create trigger reconcile_engagement_stage_from_proposal
after insert or update of status or delete
on public.proposal_records
for each row
execute function public.reconcile_engagement_stage_from_child();

drop trigger if exists reconcile_engagement_stage_from_invoice
  on public.invoice_records;

create trigger reconcile_engagement_stage_from_invoice
after insert or update of status or delete
on public.invoice_records
for each row
execute function public.reconcile_engagement_stage_from_child();

drop trigger if exists reconcile_engagement_stage_from_work_item
  on public.workflow_tasks;

create trigger reconcile_engagement_stage_from_work_item
after insert or update of status, phase or delete
on public.workflow_tasks
for each row
execute function public.reconcile_engagement_stage_from_child();

drop trigger if exists reconcile_engagement_stage_from_dependency
  on public.workflow_task_dependencies;

create trigger reconcile_engagement_stage_from_dependency
after insert or update or delete
on public.workflow_task_dependencies
for each row
execute function public.reconcile_engagement_stage_from_child();

do $$
declare
  v_engagement record;
begin
  for v_engagement in
    select engagement.workspace_id, engagement.id
    from public.client_engagements as engagement
    where engagement.engagement_status = 'Active'
      and engagement.lifecycle_stage not in (
        'Completed',
        'Lost or inactive'
      )
    order by engagement.created_at, engagement.id
  loop
    perform public.reconcile_client_engagement_lifecycle_stage(
      v_engagement.workspace_id,
      v_engagement.id
    );
  end loop;
end;
$$;

commit;
