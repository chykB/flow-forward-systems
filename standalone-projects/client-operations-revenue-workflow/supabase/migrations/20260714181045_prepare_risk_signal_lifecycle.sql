begin;

alter table public.risk_signals
  add column signal_key text,
  add column source_type text,
  add column source_record_id uuid,
  add column recommended_action text,
  add column last_detected_at timestamptz default now() not null,
  add column updated_at timestamptz default now() not null,
  add column resolved_at timestamptz,
  add column resolution_note text;

update public.risk_signals
set
  signal_key = 'legacy:' || id::text,
  source_type = 'client_record',
  source_record_id = client_workflow_record_id,
  recommended_action = reason,
  last_detected_at = created_at,
  updated_at = created_at,
  resolved_at = case
    when status in ('Resolved', 'Dismissed') then created_at
    else null
  end;

alter table public.risk_signals
  alter column signal_key set not null,
  alter column source_type set not null,
  alter column source_record_id set not null,
  alter column recommended_action set not null,
  add constraint risk_signals_signal_key_nonempty_check
    check (length(btrim(signal_key)) > 0),
  add constraint risk_signals_source_type_check
    check (
      source_type in (
        'client_record',
        'proposal',
        'invoice',
        'workflow_task'
      )
    ),
  add constraint risk_signals_recommended_action_nonempty_check
    check (length(btrim(recommended_action)) > 0),
  add constraint risk_signals_resolution_note_check
    check (
      resolution_note is null
      or length(btrim(resolution_note)) >= 5
    ),
  add constraint risk_signals_resolution_state_check
    check (
      (
        status in ('Open', 'Reviewed')
        and resolved_at is null
      )
      or
      (
        status in ('Resolved', 'Dismissed')
        and resolved_at is not null
      )
    ),
  add constraint risk_signals_workspace_record_signal_key_key
    unique (
      workspace_id,
      client_workflow_record_id,
      signal_key
    );

create index risk_signals_workspace_active_idx
  on public.risk_signals (
    workspace_id,
    client_workflow_record_id,
    status
  )
  where status in ('Open', 'Reviewed');

create index risk_signals_workspace_source_idx
  on public.risk_signals (
    workspace_id,
    source_type,
    source_record_id
  );

create function public.manage_risk_signal_lifecycle()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();

  if new.status in ('Resolved', 'Dismissed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
    new.resolution_note := null;
  end if;

  return new;
end;
$$;

revoke all
  on function public.manage_risk_signal_lifecycle()
  from public, anon;

grant execute
  on function public.manage_risk_signal_lifecycle()
  to authenticated, service_role;

create trigger manage_risk_signal_lifecycle
before insert or update on public.risk_signals
for each row
execute function public.manage_risk_signal_lifecycle();

revoke all on table public.risk_signals from anon;

grant select, insert, update, delete
  on table public.risk_signals
  to authenticated;

grant all
  on table public.risk_signals
  to service_role;

commit;
