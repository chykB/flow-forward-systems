begin;

create table public.client_engagements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_workflow_record_id uuid not null,
  title text not null,
  engagement_status text not null default 'Active',
  lifecycle_stage text not null,
  priority text not null,
  estimated_value numeric(12, 2) not null default 0,
  workflow_health_score integer not null default 100,
  next_action text not null,
  next_follow_up_at date not null,
  assigned_to text not null,
  onboarding_status text not null,
  delivery_status text not null,
  approval_status text not null,
  payment_status text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_engagements_record_workspace_fk
    foreign key (workspace_id, client_workflow_record_id)
    references public.client_workflow_records(workspace_id, id)
    on delete cascade,
  constraint client_engagements_identity_workspace_unique
    unique (id, workspace_id, client_workflow_record_id),
  constraint client_engagements_title_check
    check (length(btrim(title)) >= 2),
  constraint client_engagements_status_check
    check (
      engagement_status in (
        'Active',
        'Completed',
        'Cancelled'
      )
    ),
  constraint client_engagements_lifecycle_stage_check
    check (
      lifecycle_stage in (
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
    ),
  constraint client_engagements_priority_check
    check (priority in ('High', 'Medium', 'Low')),
  constraint client_engagements_estimated_value_check
    check (estimated_value >= 0),
  constraint client_engagements_health_score_check
    check (
      workflow_health_score >= 0
      and workflow_health_score <= 100
    ),
  constraint client_engagements_onboarding_status_check
    check (
      onboarding_status in (
        'Not started',
        'In progress',
        'Waiting',
        'Blocked',
        'Complete',
        'Not needed'
      )
    ),
  constraint client_engagements_delivery_status_check
    check (
      delivery_status in (
        'Not started',
        'In progress',
        'Waiting',
        'Blocked',
        'Complete',
        'Not needed'
      )
    ),
  constraint client_engagements_approval_status_check
    check (
      approval_status in (
        'Not started',
        'In progress',
        'Waiting',
        'Blocked',
        'Complete',
        'Not needed'
      )
    ),
  constraint client_engagements_payment_status_check
    check (
      payment_status in (
        'Not started',
        'In progress',
        'Waiting',
        'Blocked',
        'Complete',
        'Not needed'
      )
    )
);

comment on table public.client_engagements is
  'One opportunity, job, project, or retainer cycle for a durable client relationship.';

comment on column public.client_engagements.is_primary is
  'Compatibility engagement mirrored from the existing client workflow fields during rollout.';

create unique index client_engagements_one_primary_per_client_idx
  on public.client_engagements (
    workspace_id,
    client_workflow_record_id
  )
  where is_primary;

create index client_engagements_workspace_status_idx
  on public.client_engagements (
    workspace_id,
    engagement_status,
    lifecycle_stage
  );

create or replace function public.set_client_engagement_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger set_client_engagement_updated_at
before update on public.client_engagements
for each row
execute function public.set_client_engagement_updated_at();

create or replace function public.ensure_primary_client_engagement(
  p_workspace_id uuid,
  p_client_workflow_record_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client public.client_workflow_records%rowtype;
  v_engagement_id uuid;
begin
  select *
  into v_client
  from public.client_workflow_records
  where workspace_id = p_workspace_id
    and id = p_client_workflow_record_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The client record does not exist in this workspace.';
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
    is_primary,
    created_at,
    updated_at
  )
  values (
    v_client.workspace_id,
    v_client.id,
    coalesce(
      nullif(btrim(v_client.interest), ''),
      v_client.name || ' engagement'
    ),
    case
      when v_client.lifecycle_stage = 'Completed' then 'Completed'
      when v_client.lifecycle_stage = 'Lost or inactive' then 'Cancelled'
      else 'Active'
    end,
    v_client.lifecycle_stage,
    v_client.priority,
    v_client.estimated_value,
    v_client.workflow_health_score,
    v_client.next_action,
    v_client.next_follow_up_at,
    v_client.assigned_to,
    v_client.onboarding_status,
    v_client.delivery_status,
    v_client.approval_status,
    v_client.payment_status,
    true,
    v_client.created_at,
    v_client.updated_at
  )
  on conflict (
    workspace_id,
    client_workflow_record_id
  )
  where is_primary
  do update set
    lifecycle_stage = excluded.lifecycle_stage,
    priority = excluded.priority,
    estimated_value = excluded.estimated_value,
    workflow_health_score = excluded.workflow_health_score,
    next_action = excluded.next_action,
    next_follow_up_at = excluded.next_follow_up_at,
    assigned_to = excluded.assigned_to,
    onboarding_status = excluded.onboarding_status,
    delivery_status = excluded.delivery_status,
    approval_status = excluded.approval_status,
    payment_status = excluded.payment_status,
    engagement_status = excluded.engagement_status
  returning id into v_engagement_id;

  return v_engagement_id;
end;
$$;

comment on function public.ensure_primary_client_engagement(uuid, uuid) is
  'Creates or refreshes the compatibility engagement for one client workflow record.';

revoke all
  on function public.ensure_primary_client_engagement(uuid, uuid)
  from public, anon, authenticated;

grant execute
  on function public.ensure_primary_client_engagement(uuid, uuid)
  to service_role;

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
  is_primary,
  created_at,
  updated_at
)
select
  record.workspace_id,
  record.id,
  coalesce(
    nullif(btrim(record.interest), ''),
    record.name || ' engagement'
  ),
  case
    when record.lifecycle_stage = 'Completed' then 'Completed'
    when record.lifecycle_stage = 'Lost or inactive' then 'Cancelled'
    else 'Active'
  end,
  record.lifecycle_stage,
  record.priority,
  record.estimated_value,
  record.workflow_health_score,
  record.next_action,
  record.next_follow_up_at,
  record.assigned_to,
  record.onboarding_status,
  record.delivery_status,
  record.approval_status,
  record.payment_status,
  true,
  record.created_at,
  record.updated_at
from public.client_workflow_records as record;

create or replace function public.sync_primary_engagement_from_client_record()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.ensure_primary_client_engagement(
    new.workspace_id,
    new.id
  );

  return new;
end;
$$;

comment on function public.sync_primary_engagement_from_client_record() is
  'Compatibility trigger removed after client workflow fields move fully to engagement commands.';

revoke all
  on function public.sync_primary_engagement_from_client_record()
  from public, anon, authenticated;

create trigger sync_primary_engagement_from_client_record
after insert or update of
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
  payment_status
on public.client_workflow_records
for each row
execute function public.sync_primary_engagement_from_client_record();

alter table public.activity_logs
  add column client_engagement_id uuid;

alter table public.handoff_notes
  add column client_engagement_id uuid;

alter table public.invoice_records
  add column client_engagement_id uuid;

alter table public.proposal_records
  add column client_engagement_id uuid;

alter table public.risk_signals
  add column client_engagement_id uuid;

alter table public.workflow_tasks
  add column client_engagement_id uuid,
  add column phase text;

update public.activity_logs as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.handoff_notes as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.invoice_records as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.proposal_records as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.risk_signals as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.workflow_tasks as child
set client_engagement_id = engagement.id
from public.client_engagements as engagement
where engagement.workspace_id = child.workspace_id
  and engagement.client_workflow_record_id =
    child.client_workflow_record_id
  and engagement.is_primary;

update public.workflow_tasks as task
set phase = case
  when task.type = 'Onboarding' then 'Onboarding'
  when task.type = 'Delivery' then 'Delivery'
  when task.type = 'Approval' then 'Approval'
  when task.type = 'Payment' then 'Payment'
  when task.type = 'Handoff' then 'Handoff'
  else case engagement.lifecycle_stage
    when 'Proposal sent' then 'Proposal'
    when 'Won client' then 'Onboarding'
    when 'Onboarding' then 'Onboarding'
    when 'In delivery' then 'Delivery'
    when 'Waiting for approval' then 'Approval'
    when 'Payment follow-up' then 'Payment'
    when 'Completed' then 'Handoff'
    when 'Lost or inactive' then 'Handoff'
    else 'Lead'
  end
end
from public.client_engagements as engagement
where engagement.id = task.client_engagement_id;

alter table public.activity_logs
  alter column client_engagement_id set not null;

alter table public.handoff_notes
  alter column client_engagement_id set not null;

alter table public.invoice_records
  alter column client_engagement_id set not null;

alter table public.proposal_records
  alter column client_engagement_id set not null;

alter table public.risk_signals
  alter column client_engagement_id set not null;

alter table public.workflow_tasks
  alter column client_engagement_id set not null,
  alter column phase set not null,
  drop constraint workflow_tasks_status_check,
  add constraint workflow_tasks_status_check
    check (
      status in (
        'Planned',
        'Not started',
        'In progress',
        'Waiting',
        'Blocked',
        'Complete',
        'Not needed'
      )
    ),
  add constraint workflow_tasks_phase_check
    check (
      phase in (
        'Lead',
        'Proposal',
        'Onboarding',
        'Delivery',
        'Approval',
        'Payment',
        'Handoff'
      )
    );

alter table public.activity_logs
  add constraint activity_logs_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade;

alter table public.handoff_notes
  add constraint handoff_notes_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade;

alter table public.invoice_records
  add constraint invoice_records_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade;

alter table public.proposal_records
  add constraint proposal_records_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade;

alter table public.risk_signals
  add constraint risk_signals_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade;

alter table public.workflow_tasks
  add constraint workflow_tasks_engagement_workspace_fk
  foreign key (
    client_engagement_id,
    workspace_id,
    client_workflow_record_id
  )
  references public.client_engagements (
    id,
    workspace_id,
    client_workflow_record_id
  )
  on delete cascade,
  add constraint workflow_tasks_identity_engagement_unique
    unique (id, workspace_id, client_engagement_id);

create or replace function public.assign_primary_client_engagement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.client_engagement_id is null then
    new.client_engagement_id :=
      public.ensure_primary_client_engagement(
        new.workspace_id,
        new.client_workflow_record_id
      );
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
  'Compatibility trigger that assigns the primary engagement when an existing command omits engagement context.';

revoke all
  on function public.assign_primary_client_engagement()
  from public, anon, authenticated;

create trigger assign_activity_log_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.activity_logs
for each row
execute function public.assign_primary_client_engagement();

create trigger assign_handoff_note_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.handoff_notes
for each row
execute function public.assign_primary_client_engagement();

create trigger assign_invoice_record_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.invoice_records
for each row
execute function public.assign_primary_client_engagement();

create trigger assign_proposal_record_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.proposal_records
for each row
execute function public.assign_primary_client_engagement();

create trigger assign_risk_signal_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.risk_signals
for each row
execute function public.assign_primary_client_engagement();

create trigger assign_workflow_task_engagement
before insert or update of
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.workflow_tasks
for each row
execute function public.assign_primary_client_engagement();

create or replace function public.assign_workflow_task_phase()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stage text;
begin
  if new.phase is not null then
    return new;
  end if;

  select lifecycle_stage
  into v_stage
  from public.client_engagements
  where id = new.client_engagement_id
    and workspace_id = new.workspace_id
    and client_workflow_record_id =
      new.client_workflow_record_id;

  new.phase := case
    when new.type = 'Onboarding' then 'Onboarding'
    when new.type = 'Delivery' then 'Delivery'
    when new.type = 'Approval' then 'Approval'
    when new.type = 'Payment' then 'Payment'
    when new.type = 'Handoff' then 'Handoff'
    else case v_stage
      when 'Proposal sent' then 'Proposal'
      when 'Won client' then 'Onboarding'
      when 'Onboarding' then 'Onboarding'
      when 'In delivery' then 'Delivery'
      when 'Waiting for approval' then 'Approval'
      when 'Payment follow-up' then 'Payment'
      when 'Completed' then 'Handoff'
      when 'Lost or inactive' then 'Handoff'
      else 'Lead'
    end
  end;

  return new;
end;
$$;

comment on function public.assign_workflow_task_phase() is
  'Compatibility default for commands created before Work Item phase becomes an explicit input.';

revoke all
  on function public.assign_workflow_task_phase()
  from public, anon, authenticated;

create trigger assign_workflow_task_phase
before insert or update of
  type,
  phase,
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.workflow_tasks
for each row
execute function public.assign_workflow_task_phase();

create table public.workflow_task_dependencies (
  workspace_id uuid not null,
  client_engagement_id uuid not null,
  workflow_task_id uuid not null,
  depends_on_workflow_task_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (
    workspace_id,
    workflow_task_id,
    depends_on_workflow_task_id
  ),
  constraint workflow_task_dependencies_no_self_reference
    check (workflow_task_id <> depends_on_workflow_task_id),
  constraint workflow_task_dependencies_task_fk
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
    on delete cascade,
  constraint workflow_task_dependencies_prerequisite_fk
    foreign key (
      depends_on_workflow_task_id,
      workspace_id,
      client_engagement_id
    )
    references public.workflow_tasks (
      id,
      workspace_id,
      client_engagement_id
    )
    on delete cascade,
  constraint workflow_task_dependencies_actor_fk
    foreign key (created_by)
    references auth.users(id)
    on delete restrict
);

comment on table public.workflow_task_dependencies is
  'Directed prerequisites used to distinguish root blockers from downstream impacted work.';

alter table public.client_engagements enable row level security;
alter table public.workflow_task_dependencies enable row level security;

create policy "Users can read engagements in owned workspaces"
on public.client_engagements
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = client_engagements.workspace_id
      and workspace.owner_id = auth.uid()
  )
);

create policy "Users can read task dependencies in owned workspaces"
on public.workflow_task_dependencies
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = workflow_task_dependencies.workspace_id
      and workspace.owner_id = auth.uid()
  )
);

revoke all
  on table public.client_engagements
  from anon, authenticated;

grant select
  on table public.client_engagements
  to authenticated;

grant all
  on table public.client_engagements
  to service_role;

revoke all
  on table public.workflow_task_dependencies
  from anon, authenticated;

grant select
  on table public.workflow_task_dependencies
  to authenticated;

grant all
  on table public.workflow_task_dependencies
  to service_role;

commit;
