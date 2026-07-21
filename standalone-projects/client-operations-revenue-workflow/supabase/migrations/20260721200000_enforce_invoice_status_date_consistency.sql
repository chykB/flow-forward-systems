begin;

create or replace function public.expected_invoice_tracking_status(
  p_status text,
  p_due_date date,
  p_evaluation_date date
)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_status not in ('Sent', 'Due soon', 'Overdue')
      or p_due_date is null
      or p_evaluation_date is null
      then p_status
    when p_due_date < p_evaluation_date then 'Overdue'
    when p_due_date <= p_evaluation_date + 7 then 'Due soon'
    else 'Sent'
  end;
$$;

comment on function public.expected_invoice_tracking_status(
  text,
  date,
  date
) is
  'Derives sent, due-soon, and overdue Invoice tracking status from the contractual due date.';

revoke all
  on function public.expected_invoice_tracking_status(text, date, date)
  from public, anon, authenticated;

create temporary table invoice_status_date_repairs
on commit drop
as
select
  invoice.id,
  invoice.workspace_id,
  invoice.client_workflow_record_id,
  invoice.client_engagement_id,
  invoice.invoice_number,
  invoice.due_date,
  invoice.status as previous_status,
  public.expected_invoice_tracking_status(
    invoice.status,
    invoice.due_date,
    current_date
  ) as corrected_status
from public.invoice_records as invoice
where invoice.status in ('Sent', 'Due soon', 'Overdue')
  and invoice.due_date is not null
  and invoice.status is distinct from
    public.expected_invoice_tracking_status(
      invoice.status,
      invoice.due_date,
      current_date
    );

update public.invoice_records as invoice
set
  status = repair.corrected_status,
  workflow_action_applied_status = null,
  workflow_action_applied_at = null
from invoice_status_date_repairs as repair
where invoice.id = repair.id;

insert into public.activity_logs (
  workspace_id,
  client_workflow_record_id,
  client_engagement_id,
  actor_id,
  action_type,
  note
)
select
  repair.workspace_id,
  repair.client_workflow_record_id,
  repair.client_engagement_id,
  workspace.owner_id,
  'Invoice timing corrected',
  format(
    '%s changed from %s to %s because its due date is %s.',
    coalesce(
      'Invoice ' || nullif(repair.invoice_number, ''),
      'The invoice'
    ),
    repair.previous_status,
    repair.corrected_status,
    repair.due_date
  )
from invoice_status_date_repairs as repair
join public.workspaces as workspace
  on workspace.id = repair.workspace_id;

do $$
declare
  repair record;
begin
  for repair in
    select distinct
      timing.workspace_id,
      timing.client_engagement_id,
      workspace.owner_id
    from invoice_status_date_repairs as timing
    join public.workspaces as workspace
      on workspace.id = timing.workspace_id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      repair.owner_id::text,
      true
    );

    perform public.reconcile_client_engagement_risk_signals(
      repair.workspace_id,
      repair.client_engagement_id,
      current_date
    );
  end loop;
end;
$$;

create or replace function public.enforce_invoice_status_date_consistency()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_expected_status text;
begin
  v_expected_status := public.expected_invoice_tracking_status(
    new.status,
    new.due_date,
    current_date
  );

  if new.status is distinct from v_expected_status then
    raise exception
      'Invoice status does not match the due date. Use %.',
      v_expected_status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.enforce_invoice_status_date_consistency() is
  'Prevents sent, due-soon, and overdue Invoice states from contradicting the contractual due date.';

drop trigger if exists enforce_invoice_status_date_consistency
  on public.invoice_records;

create trigger enforce_invoice_status_date_consistency
before insert or update of status, due_date
on public.invoice_records
for each row
execute function public.enforce_invoice_status_date_consistency();

revoke all
  on function public.enforce_invoice_status_date_consistency()
  from public, anon, authenticated;

commit;
