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
        'invoice_records.apply_recommendation'
      )
    );

create or replace function public.set_invoice_record_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

comment on function public.set_invoice_record_updated_at() is
  'Maintains the Invoice concurrency token with wall-clock time.';

drop trigger if exists set_invoice_records_updated_at
  on public.invoice_records;

create trigger set_invoice_records_updated_at
before update on public.invoice_records
for each row
execute function public.set_invoice_record_updated_at();

revoke all
  on function public.set_invoice_record_updated_at()
  from public, anon, authenticated;

create or replace function public.keep_single_invoice_workflow_action_marker()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.workflow_action_applied_status is not null
    and (
      old.workflow_action_applied_status
        is distinct from new.workflow_action_applied_status
      or old.workspace_id is distinct from new.workspace_id
      or old.client_workflow_record_id
        is distinct from new.client_workflow_record_id
      or old.client_engagement_id
        is distinct from new.client_engagement_id
    )
  then
    update public.invoice_records
    set
      workflow_action_applied_status = null,
      workflow_action_applied_at = null
    where workspace_id = new.workspace_id
      and client_workflow_record_id = new.client_workflow_record_id
      and client_engagement_id = new.client_engagement_id
      and id <> new.id
      and workflow_action_applied_status is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists keep_single_invoice_workflow_action_marker
  on public.invoice_records;

create trigger keep_single_invoice_workflow_action_marker
before update of
  workflow_action_applied_status,
  workspace_id,
  client_workflow_record_id,
  client_engagement_id
on public.invoice_records
for each row
execute function public.keep_single_invoice_workflow_action_marker();

revoke all
  on function public.keep_single_invoice_workflow_action_marker()
  from public, anon, authenticated;

create or replace function public.assert_valid_invoice_record(
  p_invoice_number text,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_status text,
  p_payment_link text,
  p_sent_at date,
  p_due_date date,
  p_paid_at date,
  p_dispute_reason text,
  p_dispute_resolution_outcome text,
  p_dispute_resolution_note text
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_invoice_issued boolean;
  v_invoice_needed boolean;
begin
  if p_status is null or p_status not in (
    'Not needed',
    'Draft needed',
    'Sent',
    'Due soon',
    'Overdue',
    'Paid',
    'Disputed',
    'Voided'
  ) then
    raise exception 'Choose a valid invoice status.'
      using errcode = '22023';
  end if;

  v_invoice_issued := p_status not in (
    'Not needed',
    'Draft needed',
    'Voided'
  );
  v_invoice_needed := p_status <> 'Not needed';

  if v_invoice_issued
    and char_length(btrim(coalesce(p_invoice_number, ''))) < 2
  then
    raise exception 'Enter the invoice number before issuing it.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_invoice_number, ''))) > 80 then
    raise exception 'Keep the invoice number under 80 characters.'
      using errcode = '22023';
  end if;

  if p_amount is null
    or p_amount < 0
    or p_amount >= 10000000000
    or (v_invoice_issued and p_amount <= 0)
  then
    raise exception 'Enter a valid invoice amount.'
      using errcode = '22023';
  end if;

  if v_invoice_needed
    and btrim(coalesce(p_currency, '')) !~ '^[A-Za-z]{3}$'
  then
    raise exception 'Use a three-letter currency code.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_description, ''))) < 5 then
    raise exception 'Add a short invoice description.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_description)) > 500 then
    raise exception 'Keep the invoice description under 500 characters.'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_payment_link, '')), '') is not null
    and btrim(p_payment_link) !~* '^https?://.+'
  then
    raise exception 'Enter a valid payment link beginning with http or https.'
      using errcode = '22023';
  end if;

  if p_status in ('Sent', 'Due soon', 'Overdue', 'Disputed')
    and (p_sent_at is null or p_due_date is null)
  then
    raise exception 'Enter both the sent date and due date.'
      using errcode = '22023';
  end if;

  if p_sent_at is not null
    and p_due_date is not null
    and p_due_date < p_sent_at
  then
    raise exception 'The due date cannot be before the sent date.'
      using errcode = '22023';
  end if;

  if p_status = 'Paid' and p_paid_at is null then
    raise exception 'Enter the date payment was received.'
      using errcode = '22023';
  end if;

  if p_sent_at is not null
    and p_paid_at is not null
    and p_paid_at < p_sent_at
  then
    raise exception 'The payment date cannot be before the sent date.'
      using errcode = '22023';
  end if;

  if p_status = 'Disputed'
    and char_length(btrim(coalesce(p_dispute_reason, ''))) < 5
  then
    raise exception 'Add a short explanation of the payment dispute.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_dispute_reason, ''))) > 1000 then
    raise exception 'Keep the dispute reason under 1,000 characters.'
      using errcode = '22023';
  end if;

  if p_dispute_resolution_outcome is not null
    and p_dispute_resolution_outcome not in (
      'Payment received',
      'Payment still due',
      'Invoice voided or replaced'
    )
  then
    raise exception 'Choose a valid dispute resolution outcome.'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_dispute_resolution_note, ''))) > 1000 then
    raise exception 'Keep the dispute resolution note under 1,000 characters.'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.assert_valid_invoice_record(
  text,
  numeric,
  text,
  text,
  text,
  text,
  date,
  date,
  date,
  text,
  text,
  text
) is
  'Internal validation helper for Invoice command functions.';

revoke all
  on function public.assert_valid_invoice_record(
    text,
    numeric,
    text,
    text,
    text,
    text,
    date,
    date,
    date,
    text,
    text,
    text
  )
  from public, anon, authenticated;

create or replace function public.command_create_engagement_invoice_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_invoice jsonb,
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
  v_command_name constant text := 'invoice_records.create';
  v_client_workflow_record_id uuid;
  v_invoice_number text;
  v_amount numeric;
  v_currency text;
  v_description text;
  v_status text;
  v_payment_link text;
  v_sent_at date;
  v_due_date date;
  v_paid_at date;
  v_dispute_reason text;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_invoice public.invoice_records%rowtype;
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

  if p_invoice is null or jsonb_typeof(p_invoice) <> 'object' then
    raise exception 'Invoice details are required.'
      using errcode = '22023';
  end if;

  if not p_invoice ?& array[
    'clientWorkflowRecordId',
    'invoiceNumber',
    'amount',
    'currency',
    'description',
    'status',
    'paymentLink',
    'sentAt',
    'dueDate',
    'paidAt',
    'disputeReason'
  ] then
    raise exception 'Invoice details are incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_invoice) as supplied(field)
    where supplied.field not in (
      'clientWorkflowRecordId',
      'invoiceNumber',
      'amount',
      'currency',
      'description',
      'status',
      'paymentLink',
      'sentAt',
      'dueDate',
      'paidAt',
      'disputeReason'
    )
  ) then
    raise exception 'Invoice details contain a protected field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_invoice->'clientWorkflowRecordId') <> 'string'
    or jsonb_typeof(p_invoice->'invoiceNumber') <> 'string'
    or jsonb_typeof(p_invoice->'amount') <> 'number'
    or jsonb_typeof(p_invoice->'currency') <> 'string'
    or jsonb_typeof(p_invoice->'description') <> 'string'
    or jsonb_typeof(p_invoice->'status') <> 'string'
    or jsonb_typeof(p_invoice->'paymentLink') <> 'string'
    or jsonb_typeof(p_invoice->'sentAt') <> 'string'
    or jsonb_typeof(p_invoice->'dueDate') <> 'string'
    or jsonb_typeof(p_invoice->'paidAt') <> 'string'
    or jsonb_typeof(p_invoice->'disputeReason') <> 'string'
  then
    raise exception 'Invoice fields use an invalid value type.'
      using errcode = '22023';
  end if;

  begin
    v_client_workflow_record_id :=
      (p_invoice->>'clientWorkflowRecordId')::uuid;
    v_amount := (p_invoice->>'amount')::numeric;
    v_sent_at := nullif(p_invoice->>'sentAt', '')::date;
    v_due_date := nullif(p_invoice->>'dueDate', '')::date;
    v_paid_at := nullif(p_invoice->>'paidAt', '')::date;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Invoice details contain an invalid number, date, or identifier.'
        using errcode = '22023';
  end;

  v_invoice_number := btrim(p_invoice->>'invoiceNumber');
  v_currency := upper(btrim(p_invoice->>'currency'));
  v_description := btrim(p_invoice->>'description');
  v_status := p_invoice->>'status';
  v_payment_link := btrim(p_invoice->>'paymentLink');
  v_dispute_reason := btrim(p_invoice->>'disputeReason');

  perform public.assert_valid_invoice_record(
    v_invoice_number,
    v_amount,
    v_currency,
    v_description,
    v_status,
    v_payment_link,
    v_sent_at,
    v_due_date,
    v_paid_at,
    v_dispute_reason,
    null,
    null
  );

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    false,
    true
  );

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'clientWorkflowRecordId', v_client_workflow_record_id,
      'invoiceNumber', v_invoice_number,
      'amount', v_amount,
      'currency', v_currency,
      'description', v_description,
      'status', v_status,
      'paymentLink', v_payment_link,
      'sentAt', v_sent_at,
      'dueDate', v_due_date,
      'paidAt', v_paid_at,
      'disputeReason', v_dispute_reason,
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
      raise exception 'This request identifier was already used for different invoice details.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This invoice request is still being processed.'
        using errcode = 'PT409';
    end if;

    if (v_existing_response->'invoice'->>'client_engagement_id')::uuid
      <> p_client_engagement_id
    then
      raise exception 'This request identifier belongs to a different engagement.'
        using errcode = '22023';
    end if;

    return v_existing_response;
  end if;

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  insert into public.invoice_records (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    invoice_number,
    amount,
    currency,
    description,
    status,
    payment_link,
    sent_at,
    due_date,
    paid_at,
    dispute_reason
  )
  values (
    p_workspace_id,
    v_client_workflow_record_id,
    p_client_engagement_id,
    nullif(v_invoice_number, ''),
    v_amount,
    v_currency,
    v_description,
    v_status,
    nullif(v_payment_link, ''),
    v_sent_at,
    v_due_date,
    v_paid_at,
    nullif(v_dispute_reason, '')
  )
  returning * into v_invoice;

  v_reconciliation := public.reconcile_client_engagement_risk_signals(
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
    v_client_workflow_record_id,
    p_client_engagement_id,
    v_actor_id,
    'Invoice added',
    format(
      '%s was added with status: %s.',
      case
        when v_status = 'Not needed' then 'Invoice not needed'
        when nullif(v_invoice_number, '') is not null
          then format('Invoice %s', v_invoice_number)
        else 'Invoice preparation'
      end,
      case
        when v_status = 'Draft needed' then 'Invoice preparation needed'
        when v_status = 'Not needed' then 'Invoice not needed'
        else v_status
      end
    ),
    v_invoice.created_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'invoice', to_jsonb(v_invoice),
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

create or replace function public.command_update_engagement_invoice_record(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_invoice_id uuid,
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
  v_command_name constant text := 'invoice_records.update';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_previous public.invoice_records%rowtype;
  v_invoice public.invoice_records%rowtype;
  v_invoice_number text;
  v_amount numeric;
  v_currency text;
  v_description text;
  v_status text;
  v_payment_link text;
  v_sent_at date;
  v_due_date date;
  v_paid_at date;
  v_dispute_reason text;
  v_resolution_outcome text;
  v_resolution_note text;
  v_action_type text;
  v_activity_note text;
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

  if p_expected_updated_at is null then
    raise exception 'The expected invoice version is required.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Choose at least one invoice change.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'invoiceNumber',
      'amount',
      'currency',
      'description',
      'status',
      'paymentLink',
      'sentAt',
      'dueDate',
      'paidAt',
      'disputeReason',
      'disputeResolutionOutcome',
      'disputeResolutionNote'
    )
  ) then
    raise exception 'Invoice changes contain a protected field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'invoiceNumber' and jsonb_typeof(p_updates->'invoiceNumber') <> 'string')
    or (p_updates ? 'amount' and jsonb_typeof(p_updates->'amount') <> 'number')
    or (p_updates ? 'currency' and jsonb_typeof(p_updates->'currency') <> 'string')
    or (p_updates ? 'description' and jsonb_typeof(p_updates->'description') <> 'string')
    or (p_updates ? 'status' and jsonb_typeof(p_updates->'status') <> 'string')
    or (p_updates ? 'paymentLink' and jsonb_typeof(p_updates->'paymentLink') <> 'string')
    or (p_updates ? 'sentAt' and jsonb_typeof(p_updates->'sentAt') <> 'string')
    or (p_updates ? 'dueDate' and jsonb_typeof(p_updates->'dueDate') <> 'string')
    or (p_updates ? 'paidAt' and jsonb_typeof(p_updates->'paidAt') <> 'string')
    or (p_updates ? 'disputeReason' and jsonb_typeof(p_updates->'disputeReason') <> 'string')
    or (p_updates ? 'disputeResolutionOutcome' and jsonb_typeof(p_updates->'disputeResolutionOutcome') <> 'string')
    or (p_updates ? 'disputeResolutionNote' and jsonb_typeof(p_updates->'disputeResolutionNote') <> 'string')
  then
    raise exception 'Invoice changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'invoiceId', p_invoice_id,
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
      raise exception 'This request identifier was already used for a different invoice change.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This invoice request is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select invoice.*
  into v_previous
  from public.invoice_records as invoice
  where invoice.id = p_invoice_id
    and invoice.workspace_id = p_workspace_id
    and invoice.client_engagement_id = p_client_engagement_id
  for update of invoice;

  if not found then
    raise exception 'Invoice not found in this engagement.'
      using errcode = 'P0002';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_previous.client_workflow_record_id,
    false,
    true
  );

  if v_previous.updated_at is distinct from p_expected_updated_at then
    raise exception 'The invoice changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  begin
    v_invoice_number := case when p_updates ? 'invoiceNumber'
      then btrim(p_updates->>'invoiceNumber')
      else coalesce(v_previous.invoice_number, '') end;
    v_amount := case when p_updates ? 'amount'
      then (p_updates->>'amount')::numeric else v_previous.amount end;
    v_currency := case when p_updates ? 'currency'
      then upper(btrim(p_updates->>'currency')) else v_previous.currency end;
    v_description := case when p_updates ? 'description'
      then btrim(p_updates->>'description')
      else coalesce(v_previous.description, '') end;
    v_status := case when p_updates ? 'status'
      then p_updates->>'status' else v_previous.status end;
    v_payment_link := case when p_updates ? 'paymentLink'
      then btrim(p_updates->>'paymentLink')
      else coalesce(v_previous.payment_link, '') end;
    v_sent_at := case when p_updates ? 'sentAt'
      then nullif(p_updates->>'sentAt', '')::date else v_previous.sent_at end;
    v_due_date := case when p_updates ? 'dueDate'
      then nullif(p_updates->>'dueDate', '')::date else v_previous.due_date end;
    v_paid_at := case when p_updates ? 'paidAt'
      then nullif(p_updates->>'paidAt', '')::date else v_previous.paid_at end;
    v_dispute_reason := case when p_updates ? 'disputeReason'
      then btrim(p_updates->>'disputeReason')
      else coalesce(v_previous.dispute_reason, '') end;
    v_resolution_outcome := case when p_updates ? 'disputeResolutionOutcome'
      then nullif(btrim(p_updates->>'disputeResolutionOutcome'), '')
      else v_previous.dispute_resolution_outcome end;
    v_resolution_note := case when p_updates ? 'disputeResolutionNote'
      then nullif(btrim(p_updates->>'disputeResolutionNote'), '')
      else v_previous.dispute_resolution_note end;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Invoice changes contain an invalid number or date.'
        using errcode = '22023';
  end;

  perform public.assert_valid_invoice_record(
    v_invoice_number,
    v_amount,
    v_currency,
    v_description,
    v_status,
    v_payment_link,
    v_sent_at,
    v_due_date,
    v_paid_at,
    v_dispute_reason,
    v_resolution_outcome,
    v_resolution_note
  );

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  update public.invoice_records
  set
    invoice_number = nullif(v_invoice_number, ''),
    amount = v_amount,
    currency = v_currency,
    description = v_description,
    status = v_status,
    payment_link = nullif(v_payment_link, ''),
    sent_at = v_sent_at,
    due_date = v_due_date,
    paid_at = v_paid_at,
    dispute_reason = nullif(v_dispute_reason, ''),
    dispute_resolution_outcome = v_resolution_outcome,
    dispute_resolution_note = v_resolution_note
  where id = p_invoice_id
    and workspace_id = p_workspace_id
    and client_engagement_id = p_client_engagement_id
  returning * into v_invoice;

  v_reconciliation := public.reconcile_client_engagement_risk_signals(
    p_workspace_id,
    p_client_engagement_id,
    p_evaluation_date
  );

  if v_previous.status <> 'Disputed' and v_invoice.status = 'Disputed' then
    v_action_type := 'Invoice dispute opened';
    v_activity_note := format(
      '%s was marked as disputed. Reason: %s',
      coalesce('Invoice ' || nullif(v_invoice.invoice_number, ''), 'The invoice'),
      v_invoice.dispute_reason
    );
  elsif v_previous.status = 'Disputed'
    and v_invoice.status <> 'Disputed'
    and v_invoice.dispute_resolved_at is not null
  then
    v_action_type := 'Invoice dispute resolved';
    v_activity_note := format(
      '%s dispute was resolved. Resolution: %s. %s',
      coalesce('Invoice ' || nullif(v_invoice.invoice_number, ''), 'The invoice'),
      v_invoice.dispute_resolution_outcome,
      v_invoice.dispute_resolution_note
    );
  elsif v_previous.status is distinct from v_invoice.status then
    v_action_type := 'Invoice status updated';
    v_activity_note := format(
      '%s changed from %s to %s.',
      coalesce('Invoice ' || nullif(v_invoice.invoice_number, ''), 'The invoice'),
      v_previous.status,
      v_invoice.status
    );
  else
    v_action_type := 'Invoice payment details updated';
    v_activity_note := format(
      '%s payment details were updated.',
      coalesce('Invoice ' || nullif(v_invoice.invoice_number, ''), 'The invoice')
    );
  end if;

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
    v_invoice.client_workflow_record_id,
    p_client_engagement_id,
    v_actor_id,
    v_action_type,
    v_activity_note,
    v_invoice.updated_at
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'invoice', to_jsonb(v_invoice),
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

create or replace function public.command_apply_engagement_invoice_workflow_recommendation(
  p_workspace_id uuid,
  p_client_engagement_id uuid,
  p_invoice_id uuid,
  p_client_workflow_record_id uuid,
  p_expected_invoice_status text,
  p_effective_invoice_status text,
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
  v_command_name constant text := 'invoice_records.apply_recommendation';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_invoice public.invoice_records%rowtype;
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

  if p_expected_invoice_status is null
    or p_expected_invoice_status not in (
      'Not needed', 'Draft needed', 'Sent', 'Due soon',
      'Overdue', 'Paid', 'Disputed', 'Voided'
    )
    or p_effective_invoice_status is null
    or p_effective_invoice_status not in (
      'Not needed', 'Draft needed', 'Sent', 'Due soon',
      'Overdue', 'Paid', 'Disputed', 'Voided'
    )
  then
    raise exception 'Choose valid invoice workflow statuses.'
      using errcode = '22023';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Invoice workflow changes are required.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as supplied(field)
    where supplied.field not in (
      'paymentStatus',
      'priority',
      'nextAction',
      'nextFollowUpAt'
    )
  ) then
    raise exception 'Invoice workflow changes contain an unsupported field.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'paymentStatus'
      and jsonb_typeof(p_updates->'paymentStatus') <> 'string')
    or (p_updates ? 'priority'
      and jsonb_typeof(p_updates->'priority') <> 'string')
    or (p_updates ? 'nextAction'
      and jsonb_typeof(p_updates->'nextAction') <> 'string')
    or (p_updates ? 'nextFollowUpAt'
      and jsonb_typeof(p_updates->'nextFollowUpAt') <> 'string')
  then
    raise exception 'Invoice workflow changes use an invalid value type.'
      using errcode = '22023';
  end if;

  if (p_updates ? 'paymentStatus'
      and p_updates->>'paymentStatus' not in (
        'Not started', 'In progress', 'Waiting', 'Blocked', 'Complete', 'Not needed'
      ))
    or (p_updates ? 'priority'
      and p_updates->>'priority' not in ('High', 'Medium', 'Low'))
    or (p_updates ? 'nextAction'
      and char_length(btrim(p_updates->>'nextAction')) < 5)
    or (p_updates ? 'nextFollowUpAt'
      and p_updates->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$')
  then
    raise exception 'Invoice workflow changes contain an invalid value.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    p_client_workflow_record_id,
    true,
    true
  );

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'invoiceId', p_invoice_id,
      'clientWorkflowRecordId', p_client_workflow_record_id,
      'expectedStatus', p_expected_invoice_status,
      'effectiveStatus', p_effective_invoice_status,
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
      raise exception 'This request identifier was already used for a different invoice recommendation.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This invoice recommendation is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select invoice.*
  into v_invoice
  from public.invoice_records as invoice
  where invoice.id = p_invoice_id
    and invoice.workspace_id = p_workspace_id
    and invoice.client_workflow_record_id = p_client_workflow_record_id
    and invoice.client_engagement_id = p_client_engagement_id
  for update of invoice;

  if not found then
    raise exception 'Invoice not found in this engagement.'
      using errcode = 'P0002';
  end if;

  if v_invoice.status <> p_expected_invoice_status then
    raise exception 'The invoice changed before this request was saved.'
      using errcode = 'PT409';
  end if;

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  v_apply_result := public.apply_invoice_workflow_recommendation(
    p_workspace_id,
    p_invoice_id,
    p_client_workflow_record_id,
    p_expected_invoice_status,
    p_effective_invoice_status,
    p_updates
  );

  v_already_applied := coalesce(
    (v_apply_result->>'alreadyApplied')::boolean,
    false
  );

  v_reconciliation := public.reconcile_client_engagement_risk_signals(
    p_workspace_id,
    p_client_engagement_id,
    p_evaluation_date
  );

  if not v_already_applied then
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
      'Invoice payment step applied',
      format(
        'The recommended next step for %s was applied to the client workflow.',
        case
          when nullif(v_invoice.invoice_number, '') is not null
            then format('invoice %s', v_invoice.invoice_number)
          else 'the invoice'
        end
      ),
      coalesce(
        (v_apply_result->'invoice'->>'workflow_action_applied_at')::timestamptz,
        now()
      )
    );
  end if;

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'invoice', v_apply_result->'invoice',
    'clientRecord', v_reconciliation->'clientRecord',
    'alreadyApplied', v_already_applied,
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

comment on function public.command_create_engagement_invoice_record(
  uuid,
  uuid,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_update_engagement_invoice_record(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

comment on function public.command_apply_engagement_invoice_workflow_recommendation(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  date,
  uuid
) is
  'Internal authenticated command. Not a versioned public API.';

revoke all
  on function public.apply_invoice_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    text,
    text,
    jsonb
  )
  from public, anon, authenticated;

revoke all
  on function public.command_create_engagement_invoice_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_create_engagement_invoice_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_update_engagement_invoice_record(
    uuid,
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_update_engagement_invoice_record(
    uuid,
    uuid,
    uuid,
    timestamptz,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke all
  on function public.command_apply_engagement_invoice_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    jsonb,
    date,
    uuid
  )
  from public, anon;

grant execute
  on function public.command_apply_engagement_invoice_workflow_recommendation(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    jsonb,
    date,
    uuid
  )
  to authenticated;

revoke insert, update, delete
  on table public.invoice_records
  from anon, authenticated;

grant select
  on table public.invoice_records
  to authenticated;

commit;
