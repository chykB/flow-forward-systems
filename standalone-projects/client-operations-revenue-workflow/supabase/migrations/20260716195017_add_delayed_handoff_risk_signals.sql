begin;

alter table public.risk_signals
  drop constraint risk_signals_risk_type_check,
  drop constraint risk_signals_source_risk_type_check;

alter table public.risk_signals
  add constraint risk_signals_risk_type_check
    check (
      risk_type in (
        'overdue_follow_up',
        'proposal_expired',
        'invoice_overdue',
        'invoice_disputed',
        'delivery_blocked',
        'approval_delayed',
        'handoff_delayed'
      )
    ),
  add constraint risk_signals_source_risk_type_check
    check (
      (risk_type = 'overdue_follow_up' and source_type = 'client_record')
      or (risk_type = 'proposal_expired' and source_type = 'proposal')
      or (
        risk_type in ('invoice_overdue', 'invoice_disputed')
        and source_type = 'invoice'
      )
      or (
        risk_type = 'delivery_blocked'
        and source_type = 'workflow_task'
      )
      or (
        risk_type = 'approval_delayed'
        and source_type = 'workflow_task'
      )
      or (
        risk_type = 'handoff_delayed'
        and source_type = 'workflow_task'
      )
    );

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
  v_client public.client_workflow_records%rowtype;
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

  select client.*
  into v_client
  from public.client_workflow_records as client
  join public.workspaces as workspace
    on workspace.id = client.workspace_id
  where client.id = p_client_workflow_record_id
    and client.workspace_id = p_workspace_id
    and workspace.owner_id = auth.uid()
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_previous_health := v_client.workflow_health_score;

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
    and signal.client_workflow_record_id =
      p_client_workflow_record_id;

  for v_candidate in
    select
      'client_record:overdue_follow_up'::text as signal_key,
      'client_record'::text as source_type,
      v_client.id as source_record_id,
      'overdue_follow_up'::text as risk_type,
      'Medium'::text as severity,
      format(
        'The scheduled client follow-up was due on %s.',
        v_client.next_follow_up_at
      ) as reason,
      format(
        'Complete the overdue follow-up for %s and set a new follow-up date.',
        v_client.name
      ) as recommended_action
    where v_client.next_follow_up_at < p_evaluation_date
      and v_client.lifecycle_stage not in (
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
      and proposal.client_workflow_record_id =
        p_client_workflow_record_id
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
      and invoice.client_workflow_record_id =
        p_client_workflow_record_id
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
      and invoice.client_workflow_record_id =
        p_client_workflow_record_id
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
      and task.client_workflow_record_id =
        p_client_workflow_record_id
      and task.type = 'Delivery'
      and task.status = 'Blocked'

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
      and task.client_workflow_record_id =
        p_client_workflow_record_id
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
      and task.client_workflow_record_id =
        p_client_workflow_record_id
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
  loop
    v_candidate_keys := array_append(
      v_candidate_keys,
      v_candidate.signal_key
    );

    insert into public.risk_signals as current_signal (
      workspace_id,
      client_workflow_record_id,
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
      p_client_workflow_record_id,
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
    and signal.client_workflow_record_id =
      p_client_workflow_record_id
    and signal.risk_type in (
      'overdue_follow_up',
      'proposal_expired',
      'invoice_overdue',
      'invoice_disputed',
      'delivery_blocked',
      'approval_delayed',
      'handoff_delayed'
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
    and signal.client_workflow_record_id =
      p_client_workflow_record_id
    and signal.status in ('Open', 'Reviewed');

  if v_previous_health is distinct from v_health then
    update public.client_workflow_records
    set workflow_health_score = v_health
    where id = p_client_workflow_record_id
      and workspace_id = p_workspace_id
    returning * into v_client;
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
    and signal.client_workflow_record_id =
      p_client_workflow_record_id;

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
      actor_id,
      action_type,
      note
    )
    values (
      p_workspace_id,
      p_client_workflow_record_id,
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
    and signal.client_workflow_record_id =
      p_client_workflow_record_id;

  return jsonb_build_object(
    'clientRecord',
    to_jsonb(v_client),
    'riskSignals',
    v_return_signals,
    'workflowHealthScore',
    v_health,
    'changed',
    v_changed
  );
end;
$$;

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