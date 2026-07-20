begin;

create or replace function public.workflow_phase_rank(
  p_phase text
)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case p_phase
    when 'Lead' then 1
    when 'Proposal' then 2
    when 'Onboarding' then 3
    when 'Delivery' then 4
    when 'Approval' then 5
    when 'Payment' then 6
    when 'Handoff' then 7
    else 0
  end;
$$;

create or replace function public.client_engagement_stage_phase_rank(
  p_lifecycle_stage text
)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case p_lifecycle_stage
    when 'Proposal sent' then 2
    when 'Won client' then 3
    when 'Onboarding' then 3
    when 'In delivery' then 4
    when 'Waiting for approval' then 5
    when 'Payment follow-up' then 6
    when 'Completed' then 7
    when 'Lost or inactive' then 7
    else 1
  end;
$$;

create or replace function public.workflow_task_has_unresolved_dependency(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_workflow_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
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
      and dependency.workflow_task_id = p_workflow_task_id
      and prerequisite.status not in (
        'Complete',
        'Not needed'
      )
  );
$$;

revoke all
  on function public.workflow_phase_rank(text)
  from public, anon, authenticated;

revoke all
  on function public.client_engagement_stage_phase_rank(text)
  from public, anon, authenticated;

revoke all
  on function public.workflow_task_has_unresolved_dependency(
    uuid,
    uuid,
    uuid
  )
  from public, anon, authenticated;

with migrated_future_work as (
  update public.workflow_tasks as task
  set status = 'Planned'
  from public.client_engagements as engagement
  where engagement.id = task.client_engagement_id
    and engagement.workspace_id = task.workspace_id
    and engagement.client_workflow_record_id =
      task.client_workflow_record_id
    and task.status in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked'
    )
    and public.workflow_phase_rank(task.phase) >
      public.client_engagement_stage_phase_rank(
        engagement.lifecycle_stage
      )
  returning
    task.workspace_id,
    task.client_workflow_record_id,
    task.client_engagement_id,
    task.title,
    task.phase,
    engagement.lifecycle_stage
)
insert into public.activity_logs (
  workspace_id,
  client_workflow_record_id,
  client_engagement_id,
  actor_id,
  action_type,
  note
)
select
  migrated.workspace_id,
  migrated.client_workflow_record_id,
  migrated.client_engagement_id,
  workspace.owner_id,
  'Work item planned',
  format(
    '%s was moved to Planned because the %s phase comes after the current %s stage.',
    migrated.title,
    migrated.phase,
    migrated.lifecycle_stage
  )
from migrated_future_work as migrated
join public.workspaces as workspace
  on workspace.id = migrated.workspace_id;

create or replace function public.reconcile_client_engagement_risk_signals(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_evaluation_date date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client public.client_workflow_records%rowtype;
  v_engagement public.client_engagements%rowtype;
  v_candidate record;
  v_candidate_keys text[] := array[]::text[];
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_return_signals jsonb;
  v_previous_health integer;
  v_health integer;
  v_changed boolean;
  v_now timestamptz := now();
  v_activity_note text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  if abs(p_evaluation_date - current_date) > 1 then
    raise exception 'The evaluation date is outside the allowed range.'
      using errcode = '22023';
  end if;

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  join public.client_workflow_records as client
    on client.id = engagement.client_workflow_record_id
    and client.workspace_id = engagement.workspace_id
  join public.workspaces as workspace
    on workspace.id = client.workspace_id
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
    and workspace.owner_id = auth.uid()
  for update of engagement, client;

  if not found then
    raise exception 'Engagement not found or unavailable.'
      using errcode = 'P0002';
  end if;

  select client.*
  into v_client
  from public.client_workflow_records as client
  where client.id = v_engagement.client_workflow_record_id
    and client.workspace_id = p_workspace_id;

  v_previous_health := v_engagement.workflow_health_score;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'signalKey', signal.signal_key,
        'sourceType', signal.source_type,
        'sourceRecordId', signal.source_record_id,
        'riskType', signal.risk_type,
        'severity', signal.severity,
        'reason', signal.reason,
        'recommendedAction', signal.recommended_action,
        'status', signal.status,
        'resolvedAt', signal.resolved_at,
        'resolutionNote', signal.resolution_note
      )
      order by signal.signal_key
    ),
    '[]'::jsonb
  )
  into v_before_snapshot
  from public.risk_signals as signal
  where signal.workspace_id = p_workspace_id
    and signal.client_engagement_id =
      p_client_engagement_id;

  for v_candidate in
    select
      format(
        'client_engagement:%s:overdue_follow_up',
        v_engagement.id
      ) as signal_key,
      'client_record'::text as source_type,
      v_client.id as source_record_id,
      'overdue_follow_up'::text as risk_type,
      'Medium'::text as severity,
      format(
        'The scheduled client follow-up was due on %s.',
        v_engagement.next_follow_up_at
      ) as reason,
      format(
        'Complete the overdue follow-up for %s and set a new follow-up date.',
        v_client.name
      ) as recommended_action
    where v_engagement.next_follow_up_at < p_evaluation_date
      and v_engagement.engagement_status = 'Active'
      and v_engagement.lifecycle_stage not in (
        'Completed',
        'Lost or inactive'
      )

    union all

    select
      format('proposal:%s:expired', proposal.id),
      'proposal',
      proposal.id,
      'proposal_expired',
      'Medium',
      case
        when proposal.expires_at is not null then format(
          'Proposal "%s" expired on %s.',
          proposal.title,
          proposal.expires_at
        )
        else format(
          'Proposal "%s" is marked as expired.',
          proposal.title
        )
      end,
      format(
        'Review "%s" and either renew, revise, or close the proposal.',
        proposal.title
      )
    from public.proposal_records as proposal
    where proposal.workspace_id = p_workspace_id
      and proposal.client_engagement_id =
        p_client_engagement_id
      and (
        proposal.status = 'Expired'
        or (
          proposal.status = 'Sent'
          and proposal.expires_at < p_evaluation_date
        )
      )

    union all

    select
      format('invoice:%s:disputed', invoice.id),
      'invoice',
      invoice.id,
      'invoice_disputed',
      'Critical',
      format(
        'Payment for %s is disputed.',
        reference.invoice_reference
      ),
      format(
        'Review the dispute for %s and record an explicit resolution before sending reminders.',
        reference.invoice_reference
      )
    from public.invoice_records as invoice
    cross join lateral (
      select coalesce(
        nullif(btrim(invoice.invoice_number), ''),
        'this invoice'
      ) as invoice_reference
    ) as reference
    where invoice.workspace_id = p_workspace_id
      and invoice.client_engagement_id =
        p_client_engagement_id
      and invoice.status = 'Disputed'

    union all

    select
      format('invoice:%s:overdue', invoice.id),
      'invoice',
      invoice.id,
      'invoice_overdue',
      'High',
      case
        when invoice.due_date is not null then format(
          '%s was due on %s.',
          reference.invoice_reference,
          invoice.due_date
        )
        else format(
          '%s is marked as overdue.',
          reference.invoice_reference
        )
      end,
      format(
        'Review %s and send a human-approved payment reminder.',
        reference.invoice_reference
      )
    from public.invoice_records as invoice
    cross join lateral (
      select coalesce(
        nullif(btrim(invoice.invoice_number), ''),
        'this invoice'
      ) as invoice_reference
    ) as reference
    where invoice.workspace_id = p_workspace_id
      and invoice.client_engagement_id =
        p_client_engagement_id
      and (
        invoice.status = 'Overdue'
        or (
          invoice.status in ('Sent', 'Due soon')
          and invoice.due_date < p_evaluation_date
        )
      )

    union all

    select
      format(
        'workflow_task:%s:delivery_blocked',
        task.id
      ),
      'workflow_task',
      task.id,
      'delivery_blocked',
      task.criticality,
      format(
        'Delivery work item "%s" is blocked.',
        task.title
      ),
      format(
        'Resolve the blocker for "%s" with %s, then update the work item status.',
        task.title,
        task.owner
      )
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Delivery'
      and task.status = 'Blocked'
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:delivery_delayed',
        task.id
      ),
      'workflow_task',
      task.id,
      'delivery_delayed',
      task.criticality,
      format(
        'Delivery work item "%s" was due on %s.',
        task.title,
        task.due_date
      ),
      format(
        'Follow up on "%s" with %s, then update the delivery work item status.',
        task.title,
        task.owner
      )
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Delivery'
      and task.due_date < p_evaluation_date
      and task.status in (
        'Not started',
        'In progress',
        'Waiting'
      )
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:approval_delayed',
        task.id
      ),
      'workflow_task',
      task.id,
      'approval_delayed',
      task.criticality,
      case
        when task.status = 'Blocked' then format(
          'Approval work item "%s" is blocked.',
          task.title
        )
        else format(
          'Approval work item "%s" was due on %s.',
          task.title,
          task.due_date
        )
      end,
      case
        when task.status = 'Blocked' then format(
          'Resolve the approval blocker for "%s" with %s, then update the work item status.',
          task.title,
          task.owner
        )
        else format(
          'Follow up on "%s" with %s, then update the approval work item status.',
          task.title,
          task.owner
        )
      end
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Approval'
      and (
        task.status = 'Blocked'
        or (
          task.due_date < p_evaluation_date
          and task.status in (
            'Not started',
            'In progress',
            'Waiting'
          )
        )
      )
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:handoff_delayed',
        task.id
      ),
      'workflow_task',
      task.id,
      'handoff_delayed',
      task.criticality,
      case
        when task.status = 'Blocked' then format(
          'Handoff work item "%s" is blocked.',
          task.title
        )
        else format(
          'Handoff work item "%s" was due on %s.',
          task.title,
          task.due_date
        )
      end,
      case
        when task.status = 'Blocked' then format(
          'Resolve the handoff blocker for "%s" with %s, then update the work item status.',
          task.title,
          task.owner
        )
        else format(
          'Follow up on "%s" with %s, then update the handoff work item status.',
          task.title,
          task.owner
        )
      end
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Handoff'
      and (
        task.status = 'Blocked'
        or (
          task.due_date < p_evaluation_date
          and task.status in (
            'Not started',
            'In progress',
            'Waiting'
          )
        )
      )
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:onboarding_delayed',
        task.id
      ),
      'workflow_task',
      task.id,
      'onboarding_delayed',
      task.criticality,
      case
        when task.status = 'Blocked' then format(
          'Onboarding work item "%s" is blocked.',
          task.title
        )
        else format(
          'Onboarding work item "%s" was due on %s.',
          task.title,
          task.due_date
        )
      end,
      case
        when task.status = 'Blocked' then format(
          'Resolve the onboarding blocker for "%s" with %s, then update the work item status.',
          task.title,
          task.owner
        )
        else format(
          'Follow up on "%s" with %s, then update the onboarding work item status.',
          task.title,
          task.owner
        )
      end
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Onboarding'
      and (
        task.status = 'Blocked'
        or (
          task.due_date < p_evaluation_date
          and task.status in (
            'Not started',
            'In progress',
            'Waiting'
          )
        )
      )
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:payment_blocked',
        task.id
      ),
      'workflow_task',
      task.id,
      'payment_blocked',
      task.criticality,
      format(
        'Payment work item "%s" is blocked.',
        task.title
      ),
      format(
        'Resolve the payment blocker for "%s" with %s, then update the work item status.',
        task.title,
        task.owner
      )
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Payment'
      and task.status = 'Blocked'
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )

    union all

    select
      format(
        'workflow_task:%s:follow_up_blocked',
        task.id
      ),
      'workflow_task',
      task.id,
      'follow_up_blocked',
      task.criticality,
      format(
        'Follow-up work item "%s" is blocked.',
        task.title
      ),
      format(
        'Resolve the follow-up blocker for "%s" with %s, then update the work item status.',
        task.title,
        task.owner
      )
    from public.workflow_tasks as task
    where task.workspace_id = p_workspace_id
      and task.client_engagement_id =
        p_client_engagement_id
      and task.type = 'Follow-up'
      and task.status = 'Blocked'
      and not public.workflow_task_has_unresolved_dependency(
        p_workspace_id,
        p_client_engagement_id,
        task.id
      )
  loop
    v_candidate_keys := array_append(
      v_candidate_keys,
      v_candidate.signal_key
    );

    insert into public.risk_signals as current_signal (
      workspace_id,
      client_workflow_record_id,
      client_engagement_id,
      signal_key,
      source_type,
      source_record_id,
      risk_type,
      severity,
      reason,
      recommended_action,
      status,
      last_detected_at
    )
    values (
      p_workspace_id,
      v_client.id,
      p_client_engagement_id,
      v_candidate.signal_key,
      v_candidate.source_type,
      v_candidate.source_record_id,
      v_candidate.risk_type,
      v_candidate.severity,
      v_candidate.reason,
      v_candidate.recommended_action,
      'Open',
      v_now
    )
    on conflict on constraint
      risk_signals_workspace_record_signal_key_key
    do update set
      source_type = excluded.source_type,
      source_record_id = excluded.source_record_id,
      risk_type = excluded.risk_type,
      severity = excluded.severity,
      reason = excluded.reason,
      recommended_action = excluded.recommended_action,
      last_detected_at = excluded.last_detected_at,
      status = case
        when current_signal.status = 'Dismissed'
          then 'Dismissed'
        when current_signal.status = 'Reviewed'
          then 'Reviewed'
        else 'Open'
      end;
  end loop;

  update public.risk_signals as signal
  set
    status = 'Resolved',
    resolution_note =
      'Automatically resolved because the workflow condition is no longer active.'
  where signal.workspace_id = p_workspace_id
    and signal.client_engagement_id =
      p_client_engagement_id
    and signal.risk_type in (
      'overdue_follow_up',
      'proposal_expired',
      'invoice_overdue',
      'invoice_disputed',
      'delivery_blocked',
      'delivery_delayed',
      'approval_delayed',
      'handoff_delayed',
      'onboarding_delayed',
      'payment_blocked',
      'follow_up_blocked'
    )
    and signal.status in ('Open', 'Reviewed')
    and not (
      signal.signal_key = any(v_candidate_keys)
    );

  select greatest(
    0,
    100 - coalesce(
      sum(
        case signal.severity
          when 'Low' then 5
          when 'Medium' then 10
          when 'High' then 20
          when 'Critical' then 35
          else 0
        end
      ),
      0
    )
  )::integer
  into v_health
  from public.risk_signals as signal
  where signal.workspace_id = p_workspace_id
    and signal.client_engagement_id =
      p_client_engagement_id
    and signal.status in ('Open', 'Reviewed');

  if v_previous_health is distinct from v_health then
    update public.client_engagements
    set workflow_health_score = v_health
    where id = p_client_engagement_id
      and workspace_id = p_workspace_id
    returning * into v_engagement;

    if v_engagement.is_primary then
      update public.client_workflow_records
      set workflow_health_score = v_health
      where id = v_client.id
        and workspace_id = p_workspace_id
      returning * into v_client;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'signalKey', signal.signal_key,
        'sourceType', signal.source_type,
        'sourceRecordId', signal.source_record_id,
        'riskType', signal.risk_type,
        'severity', signal.severity,
        'reason', signal.reason,
        'recommendedAction', signal.recommended_action,
        'status', signal.status,
        'resolvedAt', signal.resolved_at,
        'resolutionNote', signal.resolution_note
      )
      order by signal.signal_key
    ),
    '[]'::jsonb
  )
  into v_after_snapshot
  from public.risk_signals as signal
  where signal.workspace_id = p_workspace_id
    and signal.client_engagement_id =
      p_client_engagement_id;

  v_changed :=
    v_before_snapshot is distinct from v_after_snapshot
    or v_previous_health is distinct from v_health;

  if v_changed then
    v_activity_note := case
      when v_previous_health is distinct from v_health then
        format(
          'Workflow risks were reviewed. Workflow health changed from %s to %s.',
          v_previous_health,
          v_health
        )
      else
        format(
          'Workflow risks were reviewed. Active risks were updated while workflow health remains %s.',
          v_health
        )
    end;

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
      v_client.id,
      p_client_engagement_id,
      auth.uid(),
      'Workflow risk review updated',
      v_activity_note
    );
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(signal)
      order by
        case signal.severity
          when 'Critical' then 4
          when 'High' then 3
          when 'Medium' then 2
          when 'Low' then 1
          else 0
        end desc,
        signal.created_at desc
    ),
    '[]'::jsonb
  )
  into v_return_signals
  from public.risk_signals as signal
  where signal.workspace_id = p_workspace_id
    and signal.client_engagement_id =
      p_client_engagement_id;

  return jsonb_build_object(
    'clientRecord',
    to_jsonb(v_client),
    'clientEngagement',
    to_jsonb(v_engagement),
    'riskSignals',
    v_return_signals,
    'workflowHealthScore',
    v_health,
    'changed',
    v_changed
  );
end;
$$;

comment on function public.reconcile_client_engagement_risk_signals(
  uuid,
  uuid,
  date
) is
  'Reconciles active risks and health for exactly one client engagement. Planned and dependency-blocked downstream work do not create duplicate risk.';

create or replace function public.reconcile_client_risk_signals(
  p_workspace_id uuid,
  p_client_workflow_record_id uuid,
  p_evaluation_date date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_engagement_id uuid;
  v_context_value text;
begin
  v_context_value := nullif(
    current_setting('app.client_engagement_id', true),
    ''
  );

  if v_context_value is not null then
    begin
      v_client_engagement_id := v_context_value::uuid;
    exception
      when invalid_text_representation then
        raise exception 'The engagement context is invalid.'
          using errcode = '22023';
    end;
  else
    select engagement.id
    into v_client_engagement_id
    from public.client_engagements as engagement
    where engagement.workspace_id = p_workspace_id
      and engagement.client_workflow_record_id =
        p_client_workflow_record_id
      and engagement.is_primary;
  end if;

  if v_client_engagement_id is null then
    raise exception 'The client has no primary engagement.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.client_engagements as engagement
    where engagement.id = v_client_engagement_id
      and engagement.workspace_id = p_workspace_id
      and engagement.client_workflow_record_id =
        p_client_workflow_record_id
  ) then
    raise exception 'The engagement context does not match this client.'
      using errcode = '22023';
  end if;

  return public.reconcile_client_engagement_risk_signals(
    p_workspace_id,
    v_client_engagement_id,
    p_evaluation_date
  );
end;
$$;

revoke all
  on function public.reconcile_client_engagement_risk_signals(
    uuid,
    uuid,
    date
  )
  from public, anon;

grant execute
  on function public.reconcile_client_engagement_risk_signals(
    uuid,
    uuid,
    date
  )
  to authenticated, service_role;

revoke all
  on function public.reconcile_client_risk_signals(
    uuid,
    uuid,
    date
  )
  from public, anon;

grant execute
  on function public.reconcile_client_risk_signals(
    uuid,
    uuid,
    date
  )
  to authenticated, service_role;

create or replace function public.enforce_workflow_task_stage_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stage text;
begin
  select engagement.lifecycle_stage
  into v_stage
  from public.client_engagements as engagement
  where engagement.id = new.client_engagement_id
    and engagement.workspace_id = new.workspace_id
    and engagement.client_workflow_record_id =
      new.client_workflow_record_id;

  if not found then
    raise exception 'The Work Item engagement is unavailable.'
      using errcode = 'P0002';
  end if;

  if tg_op = 'UPDATE'
    and old.status <> 'Planned'
    and new.status = 'Planned'
  then
    raise exception 'Active Work Items cannot be moved back to Planned.'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'Planned'
    and new.status not in (
      'Planned',
      'Not started',
      'In progress',
      'Not needed'
    )
  then
    raise exception 'Activate Planned work as Not started or In progress, or mark it Not needed.'
      using errcode = '22023';
  end if;

  if new.status <> 'Planned'
    and public.workflow_phase_rank(new.phase) >
      public.client_engagement_stage_phase_rank(v_stage)
  then
    raise exception 'Future-phase Work Items must remain Planned until the engagement reaches that phase.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_workflow_task_stage_status
  on public.workflow_tasks;

create trigger enforce_workflow_task_stage_status
before insert or update of
  status,
  phase,
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.workflow_tasks
for each row
execute function public.enforce_workflow_task_stage_status();

revoke all
  on function public.enforce_workflow_task_stage_status()
  from public, anon, authenticated;

create or replace function public.command_create_planned_engagement_workflow_task(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_client_workflow_record_id uuid,
  p_title text,
  p_type text,
  p_owner text,
  p_due_date date,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'work_items.create';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
  v_reconciliation jsonb;
  v_response jsonb;
begin
  if p_idempotency_key is null then
    raise exception 'A request identifier is required.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Enter a Work Item title.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_owner, ''))) < 2 then
    raise exception 'Enter who owns this Work Item.'
      using errcode = '22023';
  end if;

  if p_due_date is null or p_evaluation_date is null then
    raise exception 'A due date and evaluation date are required.'
      using errcode = '22023';
  end if;

  if p_type not in (
    'Follow-up',
    'Onboarding',
    'Delivery',
    'Approval',
    'Payment',
    'Handoff'
  ) then
    raise exception 'Choose a valid Work Item type.'
      using errcode = '22023';
  end if;

  if p_criticality not in (
    'Critical',
    'High',
    'Medium',
    'Low'
  ) then
    raise exception 'Choose a valid Work Item criticality.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'clientWorkflowRecordId', p_client_workflow_record_id,
      'title', btrim(p_title),
      'type', p_type,
      'owner', btrim(p_owner),
      'dueDate', p_due_date,
      'status', 'Planned',
      'criticality', p_criticality,
      'phase', p_phase,
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

  if not v_request_claimed then
    select request.request_hash, request.response
    into v_existing_hash, v_existing_response
    from public.workspace_command_requests as request
    where request.workspace_id = p_workspace_id
      and request.actor_id = v_actor_id
      and request.command_name = v_command_name
      and request.idempotency_key = p_idempotency_key;

    if v_existing_hash is distinct from v_request_hash then
      raise exception 'This request identifier was already used for different Work Item details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This Work Item request is already being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  insert into public.workflow_tasks (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    title,
    type,
    owner,
    due_date,
    status,
    criticality,
    phase
  )
  values (
    p_workspace_id,
    p_client_workflow_record_id,
    p_client_engagement_id,
    btrim(p_title),
    p_type,
    btrim(p_owner),
    p_due_date,
    'Planned',
    p_criticality,
    p_phase
  )
  returning * into v_task;

  v_reconciliation :=
    public.reconcile_client_engagement_risk_signals(
      p_workspace_id,
      p_client_engagement_id,
      p_evaluation_date
    );

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
    p_client_workflow_record_id,
    p_client_engagement_id,
    v_actor_id,
    'Work item planned',
    format(
      '%s was planned for the %s phase.',
      v_task.title,
      v_task.phase
    ),
    v_task.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'workItem', to_jsonb(v_task),
    'reconciliation', v_reconciliation
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

revoke all
  on function public.command_create_planned_engagement_workflow_task(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text,
    date,
    uuid
  )
  from public, anon, authenticated;

create or replace function public.command_activate_planned_engagement_workflow_task(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_workflow_task_id uuid,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'work_items.update_status';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_task public.workflow_tasks%rowtype;
  v_reconciliation jsonb;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_evaluation_date is null then
    raise exception 'A request identifier and evaluation date are required.'
      using errcode = '22023';
  end if;

  if p_status not in (
    'Not started',
    'In progress',
    'Not needed'
  ) then
    raise exception 'Activate Planned work as Not started or In progress, or mark it Not needed.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'workItemId', p_workflow_task_id,
      'expectedStatus', 'Planned',
      'status', p_status,
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

  if not v_request_claimed then
    select request.request_hash, request.response
    into v_existing_hash, v_existing_response
    from public.workspace_command_requests as request
    where request.workspace_id = p_workspace_id
      and request.actor_id = v_actor_id
      and request.command_name = v_command_name
      and request.idempotency_key = p_idempotency_key;

    if v_existing_hash is distinct from v_request_hash then
      raise exception 'This request identifier was already used for a different Work Item status change.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This Work Item request is already being processed.'
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

  if v_task.status <> 'Planned' then
    raise exception 'The Work Item status changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  update public.workflow_tasks
  set status = p_status
  where id = p_workflow_task_id
    and workspace_id = p_workspace_id
    and client_engagement_id = p_client_engagement_id
  returning * into v_task;

  v_reconciliation :=
    public.reconcile_client_engagement_risk_signals(
      p_workspace_id,
      p_client_engagement_id,
      p_evaluation_date
    );

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
    'Work item activated',
    format(
      '%s changed from Planned to %s.',
      v_task.title,
      v_task.status
    ),
    v_task.updated_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'workItem', to_jsonb(v_task),
    'reconciliation', v_reconciliation
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

revoke all
  on function public.command_activate_planned_engagement_workflow_task(
    uuid,
    uuid,
    uuid,
    text,
    date,
    uuid
  )
  from public, anon, authenticated;

create or replace function public.command_create_engagement_proposal_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal jsonb,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  begin
    v_client_workflow_record_id :=
      (p_proposal->>'clientWorkflowRecordId')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The Proposal client identifier is invalid.'
        using errcode = '22023';
  end;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    false,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_create_proposal_record(
    p_workspace_id,
    p_proposal,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'proposal'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'This request identifier belongs to a different engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

create or replace function public.command_update_engagement_proposal_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_proposal_id uuid,
  p_expected_updated_at timestamptz,
  p_updates jsonb,
  p_evaluation_date date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_workflow_record_id uuid;
  v_response jsonb;
begin
  select proposal.client_workflow_record_id
  into v_client_workflow_record_id
  from public.proposal_records as proposal
  where proposal.id = p_proposal_id
    and proposal.workspace_id = p_workspace_id
    and proposal.client_engagement_id = p_client_engagement_id;

  if not found then
    raise exception 'Proposal not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    false,
    true
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_response := public.command_update_proposal_record(
    p_workspace_id,
    p_proposal_id,
    p_expected_updated_at,
    p_updates,
    p_evaluation_date,
    p_idempotency_key
  );

  if (v_response->'proposal'->>'client_engagement_id')::uuid
    <> p_client_engagement_id
  then
    raise exception 'The updated Proposal does not match this engagement.'
      using errcode = '22023';
  end if;

  return v_response;
end;
$$;

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
      p_client_workflow_record_id;

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
    and task.client_engagement_id = p_client_engagement_id;

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

revoke insert, delete
  on table public.risk_signals
  from authenticated;

revoke update
  on table public.risk_signals
  from authenticated;

grant select
  on table public.risk_signals
  to authenticated;

grant update (status, resolution_note)
  on table public.risk_signals
  to authenticated;

commit;
