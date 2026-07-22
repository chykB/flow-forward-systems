begin;

alter table public.workspace_command_requests
  drop constraint workspace_command_requests_name_check;

alter table public.workspace_command_requests
  add constraint workspace_command_requests_name_check
    check (
      command_name in (
        'work_items.create',
        'work_items.update_status',
        'client_records.create',
        'client_records.update',
        'handoff_notes.create',
        'proposal_records.create',
        'proposal_records.update',
        'proposal_records.apply_recommendation',
        'client_engagements.create',
        'client_engagements.update',
        'engagement_follow_ups.complete',
        'invoice_records.create',
        'invoice_records.update',
        'invoice_records.apply_recommendation',
        'risk_signals.review',
        'risk_signals.dismiss'
      )
    );

create or replace function public.command_update_engagement_risk_signal_review(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_risk_signal_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_resolution_note text,
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
  v_command_name text;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_previous public.risk_signals%rowtype;
  v_signal public.risk_signals%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_engagement public.client_engagements%rowtype;
  v_health integer;
  v_return_signals jsonb;
  v_reconciliation jsonb;
  v_activity_note text;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'A request identifier is required.'
      using errcode = '22023';
  end if;

  if p_expected_updated_at is null then
    raise exception 'The expected risk version is required.'
      using errcode = '22023';
  end if;

  if p_action is null
    or p_action not in ('review', 'dismiss')
  then
    raise exception 'Choose a valid risk review action.'
      using errcode = '22023';
  end if;

  if p_action = 'review'
    and nullif(btrim(coalesce(p_resolution_note, '')), '') is not null
  then
    raise exception 'A review acknowledgement cannot include a dismissal reason.'
      using errcode = '22023';
  end if;

  if p_action = 'dismiss'
    and (
      char_length(btrim(coalesce(p_resolution_note, ''))) < 5
      or char_length(btrim(p_resolution_note)) > 1000
    )
  then
    raise exception 'Enter a dismissal reason between 5 and 1,000 characters.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  if abs(p_evaluation_date - current_date) > 1 then
    raise exception 'The evaluation date is outside the allowed range.'
      using errcode = '22023';
  end if;

  v_command_name := case p_action
    when 'review' then 'risk_signals.review'
    else 'risk_signals.dismiss'
  end;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'riskSignalId', p_risk_signal_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'action', p_action,
      'resolutionNote', case
        when p_action = 'dismiss' then btrim(p_resolution_note)
        else null
      end,
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

  if not coalesce(v_request_claimed, false) then
    select request.request_hash, request.response
    into v_existing_hash, v_existing_response
    from public.workspace_command_requests as request
    where request.workspace_id = p_workspace_id
      and request.actor_id = v_actor_id
      and request.command_name = v_command_name
      and request.idempotency_key = p_idempotency_key;

    if v_existing_hash is distinct from v_request_hash then
      raise exception 'This request identifier was already used for a different risk review.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This risk review is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select signal.*
  into v_previous
  from public.risk_signals as signal
  where signal.id = p_risk_signal_id
    and signal.workspace_id = p_workspace_id
    and signal.client_engagement_id = p_client_engagement_id
  for update of signal;

  if not found then
    raise exception 'Risk signal not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_previous.client_workflow_record_id,
    false,
    false
  );

  if v_previous.updated_at is distinct from p_expected_updated_at then
    raise exception 'The risk changed before this review was saved.'
      using errcode = 'PT409';
  end if;

  if p_action = 'review' and v_previous.status <> 'Open' then
    raise exception 'Only an open risk can be marked as reviewed.'
      using errcode = '22023';
  end if;

  if p_action = 'dismiss'
    and v_previous.status not in ('Open', 'Reviewed')
  then
    raise exception 'Only an active risk can be dismissed.'
      using errcode = '22023';
  end if;

  select engagement.*
  into v_engagement
  from public.client_engagements as engagement
  where engagement.id = p_client_engagement_id
    and engagement.workspace_id = p_workspace_id
    and engagement.client_workflow_record_id =
      v_previous.client_workflow_record_id
  for update of engagement;

  update public.risk_signals
  set
    status = case
      when p_action = 'review' then 'Reviewed'
      else 'Dismissed'
    end,
    resolution_note = case
      when p_action = 'dismiss' then btrim(p_resolution_note)
      else null
    end
  where id = p_risk_signal_id
    and workspace_id = p_workspace_id
    and client_engagement_id = p_client_engagement_id
  returning * into v_signal;

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
    and signal.client_engagement_id = p_client_engagement_id
    and signal.status in ('Open', 'Reviewed');

  if v_engagement.workflow_health_score is distinct from v_health then
    update public.client_engagements
    set workflow_health_score = v_health
    where id = p_client_engagement_id
      and workspace_id = p_workspace_id
    returning * into v_engagement;
  end if;

  if v_engagement.is_primary then
    update public.client_workflow_records
    set workflow_health_score = v_health
    where id = v_previous.client_workflow_record_id
      and workspace_id = p_workspace_id
      and workflow_health_score is distinct from v_health
    returning * into v_client;
  end if;

  if v_client.id is null then
    select client.*
    into v_client
    from public.client_workflow_records as client
    where client.id = v_previous.client_workflow_record_id
      and client.workspace_id = p_workspace_id;
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
    and signal.client_engagement_id = p_client_engagement_id;

  v_activity_note := case p_action
    when 'review' then format(
      'Risk marked as reviewed: %s',
      v_signal.reason
    )
    else format(
      'Risk dismissed: %s Reason: %s',
      v_signal.reason,
      v_signal.resolution_note
    )
  end;

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
    v_signal.client_workflow_record_id,
    p_client_engagement_id,
    v_actor_id,
    case p_action
      when 'review' then 'Risk marked reviewed'
      else 'Risk dismissed'
    end,
    v_activity_note,
    v_signal.updated_at
  );

  v_reconciliation := jsonb_build_object(
    'clientRecord', to_jsonb(v_client),
    'clientEngagement', to_jsonb(v_engagement),
    'riskSignals', v_return_signals,
    'workflowHealthScore', v_health,
    'changed', true
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'riskSignal', to_jsonb(v_signal),
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

comment on function public.command_update_engagement_risk_signal_review(
  uuid,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  date,
  uuid
) is
  'Marks an engagement risk as reviewed or dismisses it with an audit note, isolated health update, and idempotent response.';

revoke insert, update, delete
  on table public.risk_signals
  from authenticated;

grant select
  on table public.risk_signals
  to authenticated;

revoke all
  on function public.command_update_engagement_risk_signal_review(
    uuid,
    uuid,
    uuid,
    timestamptz,
    text,
    text,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_engagement_risk_signal_review(
    uuid,
    uuid,
    uuid,
    timestamptz,
    text,
    text,
    date,
    uuid
  )
  to authenticated, service_role;

commit;
