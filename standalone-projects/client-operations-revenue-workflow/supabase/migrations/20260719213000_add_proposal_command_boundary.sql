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
        'proposal_records.apply_recommendation'
      )
    );

create or replace function public.set_proposal_record_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

comment on function public.set_proposal_record_updated_at() is
  'Maintains the Proposal concurrency token with wall-clock time.';

drop trigger if exists set_proposal_records_updated_at
  on public.proposal_records;

create trigger set_proposal_records_updated_at
before update on public.proposal_records
for each row
execute function public.set_proposal_record_updated_at();

revoke all
  on function public.set_proposal_record_updated_at()
  from public, anon, authenticated;

create or replace function public.assert_valid_proposal_record(
  p_title text,
  p_amount numeric,
  p_currency text,
  p_status text,
  p_sent_at date,
  p_expires_at date,
  p_accepted_at date,
  p_rejected_at date,
  p_revision_requested_at date,
  p_notes text
)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if char_length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'Enter a proposal or quote title.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_title)) > 160 then
    raise exception 'Keep the proposal title under 160 characters.'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount < 0 or p_amount >= 10000000000 then
    raise exception 'Enter a valid proposal amount.'
      using errcode = '22023';
  end if;

  if btrim(coalesce(p_currency, '')) !~ '^[A-Za-z]{3}$' then
    raise exception 'Use a three-letter currency code.'
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in (
    'Not needed',
    'Draft needed',
    'Sent',
    'Revision requested',
    'Accepted',
    'Rejected',
    'Expired'
  ) then
    raise exception 'Choose a valid proposal status.'
      using errcode = '22023';
  end if;

  if p_status in ('Sent', 'Accepted') and p_amount <= 0 then
    raise exception 'Enter the proposed amount.'
      using errcode = '22023';
  end if;

  if (p_status = 'Sent' and p_sent_at is null)
    or (p_status = 'Revision requested' and p_revision_requested_at is null)
    or (p_status = 'Accepted' and p_accepted_at is null)
    or (p_status = 'Rejected' and p_rejected_at is null)
    or (p_status = 'Expired' and p_expires_at is null)
  then
    raise exception 'Enter the date required for this proposal status.'
      using errcode = '22023';
  end if;

  if p_status in ('Revision requested', 'Rejected')
    and char_length(btrim(coalesce(p_notes, ''))) < 5
  then
    raise exception 'Add a short note explaining this decision.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_notes, ''))) > 1000 then
    raise exception 'Keep proposal notes under 1,000 characters.'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.assert_valid_proposal_record(
  text,
  numeric,
  text,
  text,
  date,
  date,
  date,
  date,
  date,
  text
) is
  'Internal validation helper for Proposal command functions.';

revoke all
  on function public.assert_valid_proposal_record(
    text,
    numeric,
    text,
    text,
    date,
    date,
    date,
    date,
    date,
    text
  )
  from public, anon, authenticated;

create or replace function public.command_create_proposal_record(
  p_workspace_id uuid,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'proposal_records.create';
  v_client_workflow_record_id uuid;
  v_title text;
  v_amount numeric;
  v_currency text;
  v_status text;
  v_sent_at date;
  v_expires_at date;
  v_accepted_at date;
  v_rejected_at date;
  v_revision_requested_at date;
  v_notes text;
  v_status_label text;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_proposal public.proposal_records%rowtype;
  v_reconciliation jsonb;
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

  if not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = v_actor_id
  ) then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if p_proposal is null or jsonb_typeof(p_proposal) <> 'object' then
    raise exception 'Proposal details are required.'
      using errcode = '22023';
  end if;

  if not p_proposal ?& array[
    'clientWorkflowRecordId',
    'title',
    'amount',
    'currency',
    'status',
    'sentAt',
    'expiresAt',
    'acceptedAt',
    'rejectedAt',
    'revisionRequestedAt',
    'notes'
  ] then
    raise exception 'Proposal details are incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_proposal) as supplied(field)
    where supplied.field not in (
      'clientWorkflowRecordId',
      'title',
      'amount',
      'currency',
      'status',
      'sentAt',
      'expiresAt',
      'acceptedAt',
      'rejectedAt',
      'revisionRequestedAt',
      'notes'
    )
  ) then
    raise exception 'Proposal details contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_proposal->'clientWorkflowRecordId') <> 'string'
    or jsonb_typeof(p_proposal->'title') <> 'string'
    or jsonb_typeof(p_proposal->'amount') <> 'number'
    or jsonb_typeof(p_proposal->'currency') <> 'string'
    or jsonb_typeof(p_proposal->'status') <> 'string'
    or jsonb_typeof(p_proposal->'sentAt') <> 'string'
    or jsonb_typeof(p_proposal->'expiresAt') <> 'string'
    or jsonb_typeof(p_proposal->'acceptedAt') <> 'string'
    or jsonb_typeof(p_proposal->'rejectedAt') <> 'string'
    or jsonb_typeof(p_proposal->'revisionRequestedAt') <> 'string'
    or jsonb_typeof(p_proposal->'notes') <> 'string'
  then
    raise exception 'Proposal fields use an invalid value type.'
      using errcode = '22023';
  end if;

  begin
    v_client_workflow_record_id :=
      (p_proposal->>'clientWorkflowRecordId')::uuid;
    v_amount := (p_proposal->>'amount')::numeric;
    v_sent_at := nullif(p_proposal->>'sentAt', '')::date;
    v_expires_at := nullif(p_proposal->>'expiresAt', '')::date;
    v_accepted_at := nullif(p_proposal->>'acceptedAt', '')::date;
    v_rejected_at := nullif(p_proposal->>'rejectedAt', '')::date;
    v_revision_requested_at :=
      nullif(p_proposal->>'revisionRequestedAt', '')::date;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Proposal details contain an invalid number, date, or identifier.'
        using errcode = '22023';
  end;

  v_title := btrim(p_proposal->>'title');
  v_currency := upper(btrim(p_proposal->>'currency'));
  v_status := p_proposal->>'status';
  v_notes := btrim(p_proposal->>'notes');

  perform public.assert_valid_proposal_record(
    v_title,
    v_amount,
    v_currency,
    v_status,
    v_sent_at,
    v_expires_at,
    v_accepted_at,
    v_rejected_at,
    v_revision_requested_at,
    v_notes
  );

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientWorkflowRecordId', v_client_workflow_record_id,
      'title', v_title,
      'amount', v_amount,
      'currency', v_currency,
      'status', v_status,
      'sentAt', v_sent_at,
      'expiresAt', v_expires_at,
      'acceptedAt', v_accepted_at,
      'rejectedAt', v_rejected_at,
      'revisionRequestedAt', v_revision_requested_at,
      'notes', v_notes,
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
      raise exception 'This request identifier was already used for different proposal details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This proposal request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  perform 1
  from public.client_workflow_records as client
  where client.id = v_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  insert into public.proposal_records (
    workspace_id,
    client_workflow_record_id,
    title,
    amount,
    currency,
    status,
    sent_at,
    expires_at,
    accepted_at,
    rejected_at,
    revision_requested_at,
    notes
  )
  values (
    p_workspace_id,
    v_client_workflow_record_id,
    v_title,
    v_amount,
    v_currency,
    v_status,
    v_sent_at,
    v_expires_at,
    v_accepted_at,
    v_rejected_at,
    v_revision_requested_at,
    v_notes
  )
  returning * into v_proposal;

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    v_client_workflow_record_id,
    p_evaluation_date
  );

  v_status_label := case v_status
    when 'Not needed' then 'No proposal needed'
    when 'Draft needed' then 'Proposal preparation needed'
    else v_status
  end;

  insert into public.activity_logs (
    workspace_id,
    client_workflow_record_id,
    actor_id,
    action_type,
    note,
    created_at
  )
  values (
    p_workspace_id,
    v_client_workflow_record_id,
    v_actor_id,
    'Proposal or quote added',
    format(
      '%s was added with status: %s.',
      v_proposal.title,
      v_status_label
    ),
    v_proposal.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'proposal', to_jsonb(v_proposal),
    'reconciliation', v_reconciliation
  );

  update public.workspace_command_requests
  set
    response = v_response,
    completed_at = now()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.command_update_proposal_record(
  p_workspace_id uuid,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'proposal_records.update';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_previous public.proposal_records%rowtype;
  v_proposal public.proposal_records%rowtype;
  v_title text;
  v_amount numeric;
  v_currency text;
  v_status text;
  v_sent_at date;
  v_expires_at date;
  v_accepted_at date;
  v_rejected_at date;
  v_revision_requested_at date;
  v_notes text;
  v_old_status_label text;
  v_new_status_label text;
  v_reconciliation jsonb;
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

  if not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = v_actor_id
  ) then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if p_expected_updated_at is null then
    raise exception 'The expected proposal version is required.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Choose at least one proposal change.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'title',
      'amount',
      'currency',
      'status',
      'sentAt',
      'expiresAt',
      'acceptedAt',
      'rejectedAt',
      'revisionRequestedAt',
      'notes'
    )
  ) then
    raise exception 'Proposal changes contain a protected field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'title' and jsonb_typeof(p_updates->'title') <> 'string')
    or (p_updates ? 'amount' and jsonb_typeof(p_updates->'amount') <> 'number')
    or (p_updates ? 'currency' and jsonb_typeof(p_updates->'currency') <> 'string')
    or (p_updates ? 'status' and jsonb_typeof(p_updates->'status') <> 'string')
    or (p_updates ? 'sentAt' and jsonb_typeof(p_updates->'sentAt') <> 'string')
    or (p_updates ? 'expiresAt' and jsonb_typeof(p_updates->'expiresAt') <> 'string')
    or (p_updates ? 'acceptedAt' and jsonb_typeof(p_updates->'acceptedAt') <> 'string')
    or (p_updates ? 'rejectedAt' and jsonb_typeof(p_updates->'rejectedAt') <> 'string')
    or (p_updates ? 'revisionRequestedAt' and jsonb_typeof(p_updates->'revisionRequestedAt') <> 'string')
    or (p_updates ? 'notes' and jsonb_typeof(p_updates->'notes') <> 'string')
  then
    raise exception 'Proposal changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'proposalId', p_proposal_id,
      'expectedUpdatedAt', p_expected_updated_at,
      'updates', p_updates,
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
      raise exception 'This request identifier was already used for a different proposal change.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This proposal request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select proposal.*
  into v_previous
  from public.proposal_records as proposal
  where proposal.id = p_proposal_id
    and proposal.workspace_id = p_workspace_id
  for update of proposal;

  if not found then
    raise exception 'Proposal not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_previous.updated_at is distinct from p_expected_updated_at then
    raise exception 'The proposal changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  begin
    v_title := case when p_updates ? 'title'
      then btrim(p_updates->>'title') else v_previous.title end;
    v_amount := case when p_updates ? 'amount'
      then (p_updates->>'amount')::numeric else v_previous.amount end;
    v_currency := case when p_updates ? 'currency'
      then upper(btrim(p_updates->>'currency')) else v_previous.currency end;
    v_status := case when p_updates ? 'status'
      then p_updates->>'status' else v_previous.status end;
    v_sent_at := case when p_updates ? 'sentAt'
      then nullif(p_updates->>'sentAt', '')::date else v_previous.sent_at end;
    v_expires_at := case when p_updates ? 'expiresAt'
      then nullif(p_updates->>'expiresAt', '')::date else v_previous.expires_at end;
    v_accepted_at := case when p_updates ? 'acceptedAt'
      then nullif(p_updates->>'acceptedAt', '')::date else v_previous.accepted_at end;
    v_rejected_at := case when p_updates ? 'rejectedAt'
      then nullif(p_updates->>'rejectedAt', '')::date else v_previous.rejected_at end;
    v_revision_requested_at := case when p_updates ? 'revisionRequestedAt'
      then nullif(p_updates->>'revisionRequestedAt', '')::date
      else v_previous.revision_requested_at end;
    v_notes := case when p_updates ? 'notes'
      then btrim(p_updates->>'notes') else coalesce(v_previous.notes, '') end;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Proposal changes contain an invalid number or date.'
        using errcode = '22023';
  end;

  perform public.assert_valid_proposal_record(
    v_title,
    v_amount,
    v_currency,
    v_status,
    v_sent_at,
    v_expires_at,
    v_accepted_at,
    v_rejected_at,
    v_revision_requested_at,
    v_notes
  );

  update public.proposal_records
  set
    title = v_title,
    amount = v_amount,
    currency = v_currency,
    status = v_status,
    sent_at = v_sent_at,
    expires_at = v_expires_at,
    accepted_at = v_accepted_at,
    rejected_at = v_rejected_at,
    revision_requested_at = v_revision_requested_at,
    notes = v_notes,
    workflow_action_applied_status = case
      when v_status is distinct from v_previous.status then null
      else workflow_action_applied_status
    end,
    workflow_action_applied_at = case
      when v_status is distinct from v_previous.status then null
      else workflow_action_applied_at
    end
  where id = p_proposal_id
    and workspace_id = p_workspace_id
  returning * into v_proposal;

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    v_proposal.client_workflow_record_id,
    p_evaluation_date
  );

  v_old_status_label := case v_previous.status
    when 'Not needed' then 'No proposal needed'
    when 'Draft needed' then 'Proposal preparation needed'
    else v_previous.status
  end;
  v_new_status_label := case v_proposal.status
    when 'Not needed' then 'No proposal needed'
    when 'Draft needed' then 'Proposal preparation needed'
    else v_proposal.status
  end;

  insert into public.activity_logs (
    workspace_id,
    client_workflow_record_id,
    actor_id,
    action_type,
    note,
    created_at
  )
  values (
    p_workspace_id,
    v_proposal.client_workflow_record_id,
    v_actor_id,
    case
      when v_proposal.status is distinct from v_previous.status
        then 'Proposal status updated'
      else 'Proposal updated'
    end,
    case
      when v_proposal.status is distinct from v_previous.status then format(
        '%s changed from %s to %s.',
        v_proposal.title,
        v_old_status_label,
        v_new_status_label
      )
      else format('%s details were updated.', v_proposal.title)
    end,
    v_proposal.updated_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'proposal', to_jsonb(v_proposal),
    'reconciliation', v_reconciliation
  );

  update public.workspace_command_requests
  set
    response = v_response,
    completed_at = now()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.command_apply_proposal_workflow_recommendation(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_client_workflow_record_id uuid,
  p_expected_proposal_status text,
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
  v_actor_id uuid := auth.uid();
  v_command_name constant text := 'proposal_records.apply_recommendation';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_proposal public.proposal_records%rowtype;
  v_apply_result jsonb;
  v_reconciliation jsonb;
  v_already_applied boolean;
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

  if not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = v_actor_id
  ) then
    raise exception 'Workspace not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if p_expected_proposal_status is null
    or p_expected_proposal_status not in (
    'Not needed',
    'Draft needed',
    'Sent',
    'Revision requested',
    'Accepted',
    'Rejected',
    'Expired'
  ) then
    raise exception 'Choose a valid expected proposal status.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Proposal workflow changes are required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'lifecycleStage',
      'clientType',
      'returningClientStatus',
      'nextAction',
      'nextFollowUpAt',
      'onboardingStatus',
      'priority',
      'estimatedValue'
    )
  ) then
    raise exception 'Proposal workflow changes contain an unsupported field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'lifecycleStage'
      and jsonb_typeof(p_updates->'lifecycleStage') <> 'string')
    or (p_updates ? 'clientType'
      and jsonb_typeof(p_updates->'clientType') <> 'string')
    or (p_updates ? 'returningClientStatus'
      and jsonb_typeof(p_updates->'returningClientStatus') <> 'string')
    or (p_updates ? 'nextAction'
      and jsonb_typeof(p_updates->'nextAction') <> 'string')
    or (p_updates ? 'nextFollowUpAt'
      and jsonb_typeof(p_updates->'nextFollowUpAt') <> 'string')
    or (p_updates ? 'onboardingStatus'
      and jsonb_typeof(p_updates->'onboardingStatus') <> 'string')
    or (p_updates ? 'priority'
      and jsonb_typeof(p_updates->'priority') <> 'string')
    or (p_updates ? 'estimatedValue'
      and jsonb_typeof(p_updates->'estimatedValue') <> 'number')
  then
    raise exception 'Proposal workflow changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if p_updates ? 'lifecycleStage'
    and p_updates->>'lifecycleStage' not in (
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
  then
    raise exception 'Choose a valid workflow stage.'
      using errcode = '22023';
  end if;

  if p_updates ? 'clientType'
    and p_updates->>'clientType' not in (
      'Lead',
      'New client',
      'Active client',
      'Returning client',
      'Past client'
    )
  then
    raise exception 'Choose a valid lead or client status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'returningClientStatus'
    and p_updates->>'returningClientStatus' not in (
      'Not returning',
      'Potential reactivation',
      'Repeat project opportunity',
      'Reactivated',
      'Dormant'
    )
  then
    raise exception 'Choose a valid returning client status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextAction'
    and char_length(btrim(p_updates->>'nextAction')) < 5
  then
    raise exception 'Enter the recommended next action.'
      using errcode = '22023';
  end if;

  if p_updates ? 'nextFollowUpAt'
    and p_updates->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Choose a valid follow-up date.'
      using errcode = '22023';
  end if;

  if p_updates ? 'onboardingStatus'
    and p_updates->>'onboardingStatus' not in (
      'Not started',
      'In progress',
      'Waiting',
      'Blocked',
      'Complete',
      'Not needed'
    )
  then
    raise exception 'Choose a valid onboarding status.'
      using errcode = '22023';
  end if;

  if p_updates ? 'priority'
    and p_updates->>'priority' not in ('High', 'Medium', 'Low')
  then
    raise exception 'Choose a valid priority.'
      using errcode = '22023';
  end if;

  if p_updates ? 'estimatedValue'
    and (p_updates->>'estimatedValue')::numeric < 0
  then
    raise exception 'Enter a valid estimated value.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'proposalId', p_proposal_id,
      'clientWorkflowRecordId', p_client_workflow_record_id,
      'expectedStatus', p_expected_proposal_status,
      'updates', p_updates,
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
      raise exception 'This request identifier was already used for a different proposal recommendation.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This proposal recommendation is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select proposal.*
  into v_proposal
  from public.proposal_records as proposal
  where proposal.id = p_proposal_id
    and proposal.workspace_id = p_workspace_id
  for update of proposal;

  if not found then
    raise exception 'Proposal not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_proposal.client_workflow_record_id
    <> p_client_workflow_record_id
  then
    raise exception 'The proposal is not linked to this client record.'
      using errcode = '22023';
  end if;

  if v_proposal.status <> p_expected_proposal_status then
    raise exception 'The proposal changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  perform 1
  from public.client_workflow_records as client
  where client.id = p_client_workflow_record_id
    and client.workspace_id = p_workspace_id
  for update of client;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  v_apply_result := public.apply_proposal_workflow_recommendation(
    p_workspace_id,
    p_proposal_id,
    p_client_workflow_record_id,
    p_expected_proposal_status,
    p_updates
  );

  v_already_applied := coalesce(
    (v_apply_result->>'alreadyApplied')::boolean,
    false
  );

  v_reconciliation := public.reconcile_client_risk_signals(
    p_workspace_id,
    p_client_workflow_record_id,
    p_evaluation_date
  );

  if not v_already_applied then
    insert into public.activity_logs (
      workspace_id,
      client_workflow_record_id,
      actor_id,
      action_type,
      note,
      created_at
    )
    values (
      p_workspace_id,
      p_client_workflow_record_id,
      v_actor_id,
      'Proposal next step applied',
      format(
        'The recommended next step for "%s" was applied to the client workflow.',
        v_proposal.title
      ),
      coalesce(
        (v_apply_result->'proposal'->>'workflow_action_applied_at')::timestamptz,
        now()
      )
    );
  end if;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'proposal', v_apply_result->'proposal',
    'clientRecord', v_reconciliation->'clientRecord',
    'alreadyApplied', v_already_applied,
    'reconciliation', v_reconciliation
  );

  update public.workspace_command_requests
  set
    response = v_response,
    completed_at = now()
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and command_name = v_command_name
    and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

comment on function public.command_create_proposal_record(
  uuid,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_update_proposal_record(
  uuid,
  uuid,
  timestamptz,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_apply_proposal_workflow_recommendation(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

revoke all
  on function public.apply_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

revoke all
  on function public.command_create_proposal_record(
    uuid,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_proposal_record(
    uuid,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_update_proposal_record(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_proposal_record(
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_apply_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_apply_proposal_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke insert, update, delete
  on table public.proposal_records
  from anon, authenticated;

grant select
  on table public.proposal_records
  to authenticated;

commit;
