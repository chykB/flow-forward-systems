-- V2 Supabase schema for Client Operations & Revenue Workflow System
-- Purpose: account-based storage for private beta users.
-- This schema assumes Supabase Auth is enabled.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null references public.client_workflow_records(id) on delete cascade,
  title text not null,
  type text not null,
  owner text not null,
  due_date date not null,
  status text not null,
  criticality text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handoff_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null references public.client_workflow_records(id) on delete cascade,
  title text not null,
  note text not null,
  owner text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_workflow_record_id uuid not null references public.client_workflow_records(id) on delete cascade,
  action_type text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx
  on public.workspaces(owner_id);

create index if not exists client_workflow_records_workspace_id_idx
  on public.client_workflow_records(workspace_id);

create index if not exists client_workflow_records_next_follow_up_at_idx
  on public.client_workflow_records(next_follow_up_at);

create index if not exists workflow_tasks_workspace_id_idx
  on public.workflow_tasks(workspace_id);

create index if not exists workflow_tasks_record_id_idx
  on public.workflow_tasks(client_workflow_record_id);

create index if not exists handoff_notes_workspace_id_idx
  on public.handoff_notes(workspace_id);

create index if not exists activity_logs_workspace_id_idx
  on public.activity_logs(workspace_id);

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
  exists (
    select 1 from public.workspaces
    where workspaces.id = activity_logs.workspace_id
    and workspaces.owner_id = auth.uid()
  )
);