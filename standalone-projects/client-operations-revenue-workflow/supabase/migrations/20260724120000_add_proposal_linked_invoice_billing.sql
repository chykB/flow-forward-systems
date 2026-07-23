begin;

alter table public.invoice_records
  add column proposal_record_id uuid,
  add column proposal_title_snapshot text not null default '',
  add column proposal_amount_snapshot numeric(12, 2),
  add column billing_basis text not null default 'Custom',
  add column billing_percentage numeric(5, 2);

alter table public.invoice_records
  add constraint invoice_records_billing_basis_check
  check (
    billing_basis in (
      'Custom',
      'Full proposal',
      'Deposit',
      'Milestone',
      'Remaining balance'
    )
  ),
  add constraint invoice_records_proposal_billing_check
  check (
    (
      proposal_record_id is null
      and proposal_title_snapshot = ''
      and proposal_amount_snapshot is null
      and billing_basis = 'Custom'
      and billing_percentage is null
    )
    or
    (
      proposal_record_id is not null
      and length(btrim(proposal_title_snapshot)) >= 2
      and proposal_amount_snapshot >= 0
      and (
        (
          billing_basis = 'Deposit'
          and billing_percentage > 0
          and billing_percentage <= 100
        )
        or
        (
          billing_basis <> 'Deposit'
          and billing_percentage is null
        )
      )
    )
  );

alter table public.proposal_records
  add constraint proposal_records_invoice_ownership_unique
  unique (
    id,
    workspace_id,
    client_engagement_id,
    client_workflow_record_id
  );

alter table public.invoice_records
  add constraint invoice_records_proposal_ownership_fk
  foreign key (
    proposal_record_id,
    workspace_id,
    client_engagement_id,
    client_workflow_record_id
  )
  references public.proposal_records (
    id,
    workspace_id,
    client_engagement_id,
    client_workflow_record_id
  )
  on delete restrict;

create index invoice_records_proposal_record_id_idx
  on public.invoice_records (proposal_record_id)
  where proposal_record_id is not null;

create or replace function public.enforce_proposal_invoice_snapshot()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.proposal_record_id is distinct from new.proposal_record_id
    or old.proposal_title_snapshot is distinct from
      new.proposal_title_snapshot
    or old.proposal_amount_snapshot is distinct from
      new.proposal_amount_snapshot
    or old.billing_basis is distinct from new.billing_basis
    or old.billing_percentage is distinct from
      new.billing_percentage
  then
    raise exception 'Proposal billing details cannot be changed after the invoice is created.'
      using errcode = '22023';
  end if;

  if old.proposal_record_id is not null
    and (
      old.amount is distinct from new.amount
      or old.currency is distinct from new.currency
    )
  then
    raise exception 'Void this proposal-linked invoice and issue a replacement to change its billed value.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.enforce_proposal_invoice_snapshot() is
  'Keeps proposal ownership, billing basis, proposal snapshots, amount, and currency immutable after invoice creation.';

revoke all
  on function public.enforce_proposal_invoice_snapshot()
  from public;

drop trigger if exists enforce_proposal_invoice_snapshot
  on public.invoice_records;

create trigger enforce_proposal_invoice_snapshot
before update
on public.invoice_records
for each row
execute function public.enforce_proposal_invoice_snapshot();

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
  v_proposal_record_id uuid;
  v_proposal_title_snapshot text := '';
  v_proposal_amount_snapshot numeric;
  v_billing_basis text;
  v_billing_percentage numeric;
  v_invoice_number text;
  v_requested_amount numeric;
  v_amount numeric;
  v_currency text;
  v_description text;
  v_status text;
  v_payment_link text;
  v_sent_at date;
  v_due_date date;
  v_paid_at date;
  v_dispute_reason text;
  v_already_invoiced numeric := 0;
  v_remaining_amount numeric := 0;
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_proposal public.proposal_records%rowtype;
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
    'proposalRecordId',
    'billingBasis',
    'billingPercentage',
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
      'proposalRecordId',
      'billingBasis',
      'billingPercentage',
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
    or jsonb_typeof(p_invoice->'proposalRecordId') <> 'string'
    or jsonb_typeof(p_invoice->'billingBasis') <> 'string'
    or jsonb_typeof(p_invoice->'billingPercentage')
      not in ('number', 'null')
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
    v_proposal_record_id :=
      nullif(p_invoice->>'proposalRecordId', '')::uuid;
    v_billing_percentage :=
      nullif(p_invoice->>'billingPercentage', '')::numeric;
    v_requested_amount := (p_invoice->>'amount')::numeric;
    v_amount := v_requested_amount;
    v_sent_at := nullif(p_invoice->>'sentAt', '')::date;
    v_due_date := nullif(p_invoice->>'dueDate', '')::date;
    v_paid_at := nullif(p_invoice->>'paidAt', '')::date;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception 'Invoice details contain an invalid number, date, or identifier.'
        using errcode = '22023';
  end;

  v_billing_basis := p_invoice->>'billingBasis';
  v_invoice_number := btrim(p_invoice->>'invoiceNumber');
  v_currency := upper(btrim(p_invoice->>'currency'));
  v_description := btrim(p_invoice->>'description');
  v_status := p_invoice->>'status';
  v_payment_link := btrim(p_invoice->>'paymentLink');
  v_dispute_reason := btrim(p_invoice->>'disputeReason');

  if v_billing_basis not in (
    'Custom',
    'Full proposal',
    'Deposit',
    'Milestone',
    'Remaining balance'
  ) then
    raise exception 'Choose a valid proposal billing option.'
      using errcode = '22023';
  end if;

  if v_billing_basis = 'Deposit'
    and (
      v_billing_percentage is null
      or v_billing_percentage <= 0
      or v_billing_percentage > 100
    )
  then
    raise exception 'Enter a deposit percentage greater than zero and no more than 100.'
      using errcode = '22023';
  end if;

  if v_billing_basis <> 'Deposit'
    and v_billing_percentage is not null
  then
    raise exception 'A billing percentage can only be used for a deposit.'
      using errcode = '22023';
  end if;

  if p_evaluation_date is null then
    raise exception 'An evaluation date is required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'clientEngagementId', p_client_engagement_id,
      'clientWorkflowRecordId', v_client_workflow_record_id,
      'proposalRecordId', v_proposal_record_id,
      'billingBasis', v_billing_basis,
      'billingPercentage', v_billing_percentage,
      'invoiceNumber', v_invoice_number,
      'amount', v_requested_amount,
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

  perform public.assert_client_engagement_context(
    p_workspace_id,
    p_client_engagement_id,
    v_client_workflow_record_id,
    false,
    true
  );

  if v_status = 'Not needed' then
    if v_proposal_record_id is not null then
      raise exception 'An invoice marked not needed cannot be linked to a proposal.'
        using errcode = '22023';
    end if;

    v_billing_basis := 'Custom';
    v_billing_percentage := null;
  elsif v_proposal_record_id is null then
    if v_billing_basis <> 'Custom'
      or v_billing_percentage is not null
    then
      raise exception 'An invoice without a proposal must use a custom amount.'
        using errcode = '22023';
    end if;
  else
    select proposal.*
    into v_proposal
    from public.proposal_records as proposal
    where proposal.id = v_proposal_record_id
      and proposal.workspace_id = p_workspace_id
      and proposal.client_engagement_id =
        p_client_engagement_id
      and proposal.client_workflow_record_id =
        v_client_workflow_record_id
    for update;

    if not found then
      raise exception 'Choose an accepted proposal from this job.'
        using errcode = '22023';
    end if;

    if v_proposal.status <> 'Accepted' then
      raise exception 'Only an accepted proposal can be used for an invoice.'
        using errcode = '22023';
    end if;

    v_proposal_title_snapshot := v_proposal.title;
    v_proposal_amount_snapshot := v_proposal.amount;
    v_currency := v_proposal.currency;

    select coalesce(sum(existing.amount), 0)
    into v_already_invoiced
    from public.invoice_records as existing
    where existing.workspace_id = p_workspace_id
      and existing.client_engagement_id =
        p_client_engagement_id
      and existing.proposal_record_id =
        v_proposal_record_id
      and existing.status not in ('Not needed', 'Voided');

    v_remaining_amount :=
      greatest(v_proposal.amount - v_already_invoiced, 0);

    case v_billing_basis
      when 'Full proposal' then
        if v_already_invoiced > 0 then
          raise exception 'Part of this proposal has already been invoiced. Use the remaining balance or another partial amount.'
            using errcode = '22023';
        end if;
        v_amount := v_proposal.amount;
      when 'Deposit' then
        v_amount := round(
          v_proposal.amount * v_billing_percentage / 100,
          2
        );
      when 'Remaining balance' then
        if v_remaining_amount <= 0 then
          raise exception 'This proposal has no remaining balance to invoice.'
            using errcode = '22023';
        end if;
        v_amount := v_remaining_amount;
      when 'Milestone' then
        null;
      when 'Custom' then
        null;
    end case;

    if v_amount > v_remaining_amount then
      raise exception 'The invoice amount cannot exceed the proposal balance.'
        using errcode = '22023';
    end if;
  end if;

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

  perform set_config(
    'app.client_engagement_id',
    p_client_engagement_id::text,
    true
  );

  insert into public.invoice_records (
    workspace_id,
    client_workflow_record_id,
    client_engagement_id,
    proposal_record_id,
    proposal_title_snapshot,
    proposal_amount_snapshot,
    billing_basis,
    billing_percentage,
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
    v_proposal_record_id,
    v_proposal_title_snapshot,
    v_proposal_amount_snapshot,
    v_billing_basis,
    v_billing_percentage,
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
      '%s was added with status: %s.%s',
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
      end,
      case
        when v_proposal_record_id is null then ''
        else format(
          ' Based on proposal "%s" using %s billing.',
          v_proposal_title_snapshot,
          lower(v_billing_basis)
        )
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

comment on function public.command_create_engagement_invoice_record(
  uuid,
  uuid,
  jsonb,
  date,
  uuid
) is
  'Creates an engagement-owned invoice with optional accepted-proposal billing snapshots, idempotency, reconciliation, and Activity.';

revoke all
  on function public.command_create_engagement_invoice_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  from public;

revoke all
  on function public.command_create_engagement_invoice_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  from anon;

grant execute
  on function public.command_create_engagement_invoice_record(
    uuid,
    uuid,
    jsonb,
    date,
    uuid
  )
  to authenticated;

commit;
