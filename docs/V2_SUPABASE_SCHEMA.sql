-- V2 Supabase schema for Client Operations & Revenue Workflow System
-- Purpose: account-based storage for private beta users.
-- This schema assumes Supabase Auth is enabled.
--
-- Design goals:
-- - One workspace per user in V2 private beta.
-- - Workspace-owned data.
-- - Row Level Security on every app table.
-- - Composite foreign keys to prevent cross-workspace child records.
-- - CHECK constraints to keep UI dropdown values consistent.
-- - Activity logs include actor_id.
-- - updated_at is maintained by trigger.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_one_per_owner unique (owner_id)
);

create table if not exists public.client_workflow_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  business_name text not null,
  source text not null,
  interest text not null,
  message text not null,
  lifecycle_stage text not null,
  priority text not null,
  risk_level text not null,
  next_action text not null,
  next_follow_up_at date not null,
  assigned_to text not null,
  onboarding_status text not null,
  delivery_status text not null,
  approval_status text not null,
  payment_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_workflow_records_workspace_id_id_unique unique (workspace_id, id),

  constraint client_workflow_records_lifecycle_stage_check check (
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
      'At risk',
      'Completed',
      'Lost or inactive'
    )
  ),

  constraint client_workflow_records_priority_check check (
    priority in ('High', 'Medium', 'Low')
  ),

  constraint client_workflow_records_risk_level_check check (
    risk_level in ('High', 'Medium', 'Low')
  ),

  constraint client_workflow_records_onboarding_status_check check (
    onboarding_status in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  ),

  constraint client_workflow_records_delivery_status_check check (
    delivery_status in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  ),

  constraint client_workflow_records_approval_status_check check (
    approval_status in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  ),

  constraint client_workflow_records_payment_status_check check (
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

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null,
  title text not null,
  type text not null,
  owner text not null,
  due_date date not null,
  status text not null,
  criticality text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflow_tasks_record_workspace_fk foreign key (
    workspace_id,
    client_workflow_record_id
  )
  references public.client_workflow_records(workspace_id, id)
  on delete cascade,

  constraint workflow_tasks_type_check check (
    type in (
      'Follow-up',
      'Onboarding',
      'Delivery',
      'Approval',
      'Payment',
      'Handoff'
    )
  ),

  constraint workflow_tasks_status_check check (
    status in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  ),

  constraint workflow_tasks_criticality_check check (
    criticality in ('Critical', 'High', 'Medium', 'Low')
  )
);

create table if not exists public.handoff_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null,
  title text not null,
  note text not null,
  owner text not null,
  created_at timestamptz not null default now(),

  constraint handoff_notes_record_workspace_fk foreign key (
    workspace_id,
    client_workflow_record_id
  )
  references public.client_workflow_records(workspace_id, id)
  on delete cascade
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  note text not null,
  created_at timestamptz not null default now(),

  constraint activity_logs_record_workspace_fk foreign key (
    workspace_id,
    client_workflow_record_id
  )
  references public.client_workflow_records(workspace_id, id)
  on delete cascade
);

create index if not exists workspaces_owner_id_idx
  on public.workspaces(owner_id);

create index if not exists client_workflow_records_workspace_followup_idx
  on public.client_workflow_records(workspace_id, next_follow_up_at);

create index if not exists client_workflow_records_workspace_stage_idx
  on public.client_workflow_records(workspace_id, lifecycle_stage);

create index if not exists client_workflow_records_workspace_risk_idx
  on public.client_workflow_records(workspace_id, risk_level);

create index if not exists workflow_tasks_workspace_record_idx
  on public.workflow_tasks(workspace_id, client_workflow_record_id);

create index if not exists workflow_tasks_workspace_due_date_idx
  on public.workflow_tasks(workspace_id, due_date);

create index if not exists workflow_tasks_workspace_status_idx
  on public.workflow_tasks(workspace_id, status);

create index if not exists handoff_notes_workspace_record_idx
  on public.handoff_notes(workspace_id, client_workflow_record_id);

create index if not exists activity_logs_workspace_record_created_idx
  on public.activity_logs(workspace_id, client_workflow_record_id, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

drop trigger if exists set_client_workflow_records_updated_at on public.client_workflow_records;
create trigger set_client_workflow_records_updated_at
before update on public.client_workflow_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_workflow_tasks_updated_at on public.workflow_tasks;
create trigger set_workflow_tasks_updated_at
before update on public.workflow_tasks
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.client_workflow_records enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.handoff_notes enable row level security;
alter table public.activity_logs enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read owned workspaces"
on public.workspaces
for select
to authenticated
using (owner_id = auth.uid());

create policy "Users can insert owned workspaces"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update owned workspaces"
on public.workspaces
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete owned workspaces"
on public.workspaces
for delete
to authenticated
using (owner_id = auth.uid());

create policy "Users can read records in owned workspaces"
on public.client_workflow_records
for select
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = client_workflow_records.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can insert records in owned workspaces"
on public.client_workflow_records
for insert
to authenticated
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = client_workflow_records.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can update records in owned workspaces"
on public.client_workflow_records
for update
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = client_workflow_records.workspace_id
    and workspaces.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = client_workflow_records.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can delete records in owned workspaces"
on public.client_workflow_records
for delete
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = client_workflow_records.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can read tasks in owned workspaces"
on public.workflow_tasks
for select
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = workflow_tasks.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can insert tasks in owned workspaces"
on public.workflow_tasks
for insert
to authenticated
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = workflow_tasks.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can update tasks in owned workspaces"
on public.workflow_tasks
for update
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = workflow_tasks.workspace_id
    and workspaces.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = workflow_tasks.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can delete tasks in owned workspaces"
on public.workflow_tasks
for delete
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = workflow_tasks.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can read handoff notes in owned workspaces"
on public.handoff_notes
for select
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = handoff_notes.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can insert handoff notes in owned workspaces"
on public.handoff_notes
for insert
to authenticated
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = handoff_notes.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can update handoff notes in owned workspaces"
on public.handoff_notes
for update
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = handoff_notes.workspace_id
    and workspaces.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = handoff_notes.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can delete handoff notes in owned workspaces"
on public.handoff_notes
for delete
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = handoff_notes.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can read activity logs in owned workspaces"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = activity_logs.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can insert activity logs in owned workspaces"
on public.activity_logs
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.workspaces
    where workspaces.id = activity_logs.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);