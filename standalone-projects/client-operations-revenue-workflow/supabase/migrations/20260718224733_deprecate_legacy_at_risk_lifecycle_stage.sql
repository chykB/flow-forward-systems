begin;

-- Replace the former risk-like stage with the best saved operational stage.
with migrated_records as (
  update public.client_workflow_records
  set lifecycle_stage = case
    when payment_status in ('In progress', 'Waiting', 'Blocked')
      then 'Payment follow-up'
    when approval_status in ('In progress', 'Waiting', 'Blocked')
      then 'Waiting for approval'
    when delivery_status in ('In progress', 'Waiting', 'Blocked')
      then 'In delivery'
    when onboarding_status in ('In progress', 'Waiting', 'Blocked')
      then 'Onboarding'
    when 'Complete' in (
      onboarding_status,
      delivery_status,
      approval_status,
      payment_status
    )
      and onboarding_status in ('Complete', 'Not needed')
      and delivery_status in ('Complete', 'Not needed')
      and approval_status in ('Complete', 'Not needed')
      and payment_status in ('Complete', 'Not needed')
      then 'Completed'
    when client_type = 'Past client'
      then 'Lost or inactive'
    when client_type = 'Lead'
      then 'Follow-up needed'
    else 'Won client'
  end
  where lifecycle_stage = 'At risk'
  returning
    workspace_id,
    id as client_workflow_record_id,
    lifecycle_stage
)
insert into public.activity_logs (
  workspace_id,
  client_workflow_record_id,
  actor_id,
  action_type,
  note
)
select
  migrated.workspace_id,
  migrated.client_workflow_record_id,
  workspace.owner_id,
  'Workflow stage migrated',
  format(
    'The legacy workflow stage was replaced with "%s" based on the saved workflow status. Relationship concern was not changed.',
    migrated.lifecycle_stage
  )
from migrated_records as migrated
join public.workspaces as workspace
  on workspace.id = migrated.workspace_id;

alter table public.client_workflow_records
  drop constraint client_workflow_records_lifecycle_stage_check;

alter table public.client_workflow_records
  add constraint client_workflow_records_lifecycle_stage_check
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
    );

do $$
begin
  if exists (
    select 1
    from public.client_workflow_records
    where lifecycle_stage = 'At risk'
  ) then
    raise exception 'Legacy lifecycle stage migration did not complete';
  end if;
end;
$$;

commit;
