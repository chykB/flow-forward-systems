begin;

alter table public.workspace_command_requests
  drop constraint workspace_command_requests_name_check;

alter table public.workspace_command_requests
  add constraint workspace_command_requests_name_check
    check (
      command_name in (
        'work_items.create',
        'work_items.update_status',
        'work_items.replace_dependencies',
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
        'risk_signals.dismiss',
        'operations_agent_runs.start',
        'operations_agent_runs.cancel',
        'operations_agent.guided_client_intake.complete'
      )
    );

create table public.operations_agent_client_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  initiated_by uuid not null
    references auth.users(id) on delete restrict,
  draft jsonb not null,
  missing_fields text[] not null default '{}',
  uncertain_fields jsonb not null default '[]'::jsonb,
  clarification_questions text[] not null default '{}',
  state text not null default 'waiting_for_review',
  provider text,
  model text,
  provider_response_id text,
  result_hash text not null,
  approved_record jsonb not null default '{}'::jsonb,
  saved_client_workflow_record_id uuid
    references public.client_workflow_records(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.operations_agent_runs(id, workspace_id)
    on delete cascade,
  unique (run_id),
  unique (id, workspace_id, run_id),
  constraint operations_agent_client_intake_state_check
    check (
      state in (
        'waiting_for_review',
        'saved',
        'cancelled'
      )
    ),
  constraint operations_agent_client_intake_draft_check
    check (
      jsonb_typeof(draft) = 'object'
      and draft ?& array[
        'name',
        'email',
        'businessName',
        'source',
        'interest',
        'clientType',
        'returningClientStatus',
        'lifecycleStage',
        'priority',
        'riskLevel',
        'nextAction',
        'nextFollowUpAt',
        'assignedTo',
        'message',
        'summary'
      ]
      and octet_length(draft::text) <= 32768
    ),
  constraint operations_agent_client_intake_missing_check
    check (
      missing_fields <@ array[
        'name',
        'email',
        'businessName',
        'source',
        'interest',
        'clientType',
        'returningClientStatus',
        'lifecycleStage',
        'priority',
        'riskLevel',
        'nextAction',
        'nextFollowUpAt',
        'assignedTo',
        'message'
      ]::text[]
      and cardinality(missing_fields) <= 14
    ),
  constraint operations_agent_client_intake_uncertain_check
    check (
      jsonb_typeof(uncertain_fields) = 'array'
      and jsonb_array_length(uncertain_fields) <= 14
      and octet_length(uncertain_fields::text) <= 16384
    ),
  constraint operations_agent_client_intake_questions_check
    check (
      cardinality(clarification_questions) <= 14
      and octet_length(array_to_json(clarification_questions)::text)
        <= 16384
    ),
  constraint operations_agent_client_intake_provider_check
    check (
      provider is null
      or char_length(btrim(provider)) between 2 and 100
    ),
  constraint operations_agent_client_intake_model_check
    check (
      model is null
      or char_length(btrim(model)) between 2 and 200
    ),
  constraint operations_agent_client_intake_response_check
    check (
      provider_response_id is null
      or char_length(btrim(provider_response_id))
        between 2 and 300
    ),
  constraint operations_agent_client_intake_hash_check
    check (result_hash ~ '^[0-9a-f]{64}$'),
  constraint operations_agent_client_intake_approved_check
    check (
      jsonb_typeof(approved_record) = 'object'
      and octet_length(approved_record::text) <= 65536
    ),
  constraint operations_agent_client_intake_saved_check
    check (
      (
        state = 'saved'
        and saved_client_workflow_record_id is not null
        and approved_record <> '{}'::jsonb
      )
      or (
        state <> 'saved'
        and saved_client_workflow_record_id is null
      )
    )
);

comment on table public.operations_agent_client_intake_drafts is
  'Structured Suggest-mode client intake drafts. Drafts remain advisory until the initiating user reviews and saves the normal client form.';

create trigger set_operations_agent_client_intake_draft_updated_at
before update on public.operations_agent_client_intake_drafts
for each row
execute function public.set_updated_at();

create index operations_agent_client_intake_workspace_idx
  on public.operations_agent_client_intake_drafts (
    workspace_id,
    created_at desc
  );

create or replace function public.cancel_operations_agent_client_intake_draft()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.state in ('cancelled', 'expired')
    and old.state is distinct from new.state
  then
    update public.operations_agent_client_intake_drafts
    set state = 'cancelled'
    where run_id = new.id
      and workspace_id = new.workspace_id
      and state = 'waiting_for_review';
  end if;

  return new;
end;
$$;

comment on function public.cancel_operations_agent_client_intake_draft() is
  'Keeps an unapproved client intake draft aligned with a cancelled or expired Operations Agent run.';

revoke all
  on function public.cancel_operations_agent_client_intake_draft()
  from public, anon, authenticated;

create trigger cancel_operations_agent_client_intake_draft
after update of state on public.operations_agent_runs
for each row
execute function public.cancel_operations_agent_client_intake_draft();

alter table public.operations_agent_client_intake_drafts
  enable row level security;

create policy operations_agent_client_intake_owner_select
  on public.operations_agent_client_intake_drafts
  for select
  to authenticated
  using (
    initiated_by = auth.uid()
    and exists (
      select 1
      from public.workspaces as workspace
      where workspace.id = workspace_id
        and workspace.owner_id = auth.uid()
    )
  );

create or replace function public.agent_record_guided_client_intake_result(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_result_hash text,
  p_draft jsonb,
  p_missing_fields text[],
  p_uncertain_fields jsonb,
  p_clarification_questions text[],
  p_provider text,
  p_model text,
  p_provider_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_estimated_cost_usd numeric,
  p_chargeable_cost_usd numeric,
  p_step_idempotency_key uuid,
  p_usage_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_draft public.operations_agent_client_intake_drafts%rowtype;
  v_step public.operations_agent_steps%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_step_idempotency_key is null
    or p_usage_idempotency_key is null
    or p_result_hash is null
    or p_result_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Valid guided intake result identifiers are required.'
      using errcode = '22023';
  end if;

  select draft.*
  into v_draft
  from public.operations_agent_client_intake_drafts as draft
  where draft.run_id = p_run_id
    and draft.workspace_id = p_workspace_id;

  if found then
    if v_draft.result_hash is distinct from p_result_hash then
      raise exception 'This Operations Agent run already has a different client intake result.'
        using errcode = '22023';
    end if;

    select run.*
    into v_run
    from public.operations_agent_runs as run
    where run.id = p_run_id
      and run.workspace_id = p_workspace_id;

    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'draft', to_jsonb(v_draft)
    );
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = p_run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  if not found then
    raise exception 'Operations Agent run not found.'
      using errcode = 'P0002';
  end if;

  if v_run.capability <> 'guided_client_intake'
    or v_run.mode <> 'suggest'
    or v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This Operations Agent run cannot accept a guided client intake result.'
      using errcode = '22023';
  end if;

  if v_run.execution_deadline_at is null
    or v_run.execution_deadline_at <= now()
    or v_run.lease_expires_at is null
    or v_run.lease_expires_at <= now()
  then
    raise exception 'The Operations Agent worker lease has expired.'
      using errcode = 'PT409';
  end if;

  if p_draft is null
    or jsonb_typeof(p_draft) <> 'object'
    or not p_draft ?& array[
      'name',
      'email',
      'businessName',
      'source',
      'interest',
      'clientType',
      'returningClientStatus',
      'lifecycleStage',
      'priority',
      'riskLevel',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'message',
      'summary'
    ]
  then
    raise exception 'The guided client intake draft is incomplete.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_draft) as supplied(field)
    where supplied.field not in (
      'name',
      'email',
      'businessName',
      'source',
      'interest',
      'clientType',
      'returningClientStatus',
      'lifecycleStage',
      'priority',
      'riskLevel',
      'nextAction',
      'nextFollowUpAt',
      'assignedTo',
      'message',
      'summary'
    )
  ) then
    raise exception 'The guided client intake draft contains an unsupported field.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_draft->'summary') <> 'string'
    or char_length(btrim(p_draft->>'summary')) not between 1 and 2000
    or exists (
      select 1
      from jsonb_each(p_draft) as item(field, value)
      where item.field <> 'summary'
        and jsonb_typeof(item.value) not in ('string', 'null')
    )
  then
    raise exception 'The guided client intake values are invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'clientType', '') is not null
    and p_draft->>'clientType' not in (
      'Lead',
      'New client',
      'Active client',
      'Returning client',
      'Past client'
    )
  then
    raise exception 'The guided client type is invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'returningClientStatus', '') is not null
    and p_draft->>'returningClientStatus' not in (
      'Not returning',
      'Potential reactivation',
      'Repeat project opportunity',
      'Reactivated',
      'Dormant'
    )
  then
    raise exception 'The guided returning-client status is invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'lifecycleStage', '') is not null
    and p_draft->>'lifecycleStage' not in (
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
    raise exception 'The guided lifecycle stage is invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'priority', '') is not null
    and p_draft->>'priority' not in ('High', 'Medium', 'Low')
  then
    raise exception 'The guided priority is invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'riskLevel', '') is not null
    and p_draft->>'riskLevel' not in ('High', 'Medium', 'Low')
  then
    raise exception 'The guided relationship concern is invalid.'
      using errcode = '22023';
  end if;

  if nullif(p_draft->>'nextFollowUpAt', '') is not null
    and p_draft->>'nextFollowUpAt' !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'The guided follow-up date is invalid.'
      using errcode = '22023';
  end if;

  if p_uncertain_fields is null
    or jsonb_typeof(p_uncertain_fields) <> 'array'
  then
    raise exception 'The guided client intake uncertainty list is invalid.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_uncertain_fields) as uncertainty(value)
    where jsonb_typeof(uncertainty.value) <> 'object'
      or uncertainty.value->>'field' not in (
        'name',
        'email',
        'businessName',
        'source',
        'interest',
        'clientType',
        'returningClientStatus',
        'lifecycleStage',
        'priority',
        'riskLevel',
        'nextAction',
        'nextFollowUpAt',
        'assignedTo',
        'message'
      )
      or char_length(
        btrim(coalesce(uncertainty.value->>'reason', ''))
      ) not between 2 and 500
  ) then
    raise exception 'The guided client intake uncertainty list is invalid.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    output_summary,
    details,
    idempotency_key,
    started_at,
    completed_at
  )
  values (
    p_workspace_id,
    p_run_id,
    'extract_client_intake',
    0,
    'model',
    'Structure client intake',
    'completed',
    1,
    1,
    'Extract only stated client details into a reviewable draft.',
    'A reviewable client intake draft was prepared.',
    jsonb_build_object(
      'provider', btrim(p_provider),
      'model', btrim(p_model),
      'providerResponseId',
        nullif(btrim(coalesce(p_provider_response_id, '')), ''),
      'missingFieldCount',
        cardinality(coalesce(p_missing_fields, '{}'::text[])),
      'uncertainFieldCount',
        jsonb_array_length(p_uncertain_fields)
    ),
    p_step_idempotency_key,
    now(),
    now()
  )
  returning * into v_step;

  perform public.agent_record_operations_agent_usage(
    p_workspace_id,
    p_run_id,
    v_step.id,
    p_usage_idempotency_key,
    'model',
    btrim(p_provider),
    btrim(p_model),
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_cached_input_tokens, 0),
    0,
    coalesce(p_estimated_cost_usd, 0),
    coalesce(p_chargeable_cost_usd, 0),
    0,
    true,
    'structured_client_intake'
  );

  insert into public.operations_agent_client_intake_drafts (
    workspace_id,
    run_id,
    initiated_by,
    draft,
    missing_fields,
    uncertain_fields,
    clarification_questions,
    state,
    provider,
    model,
    provider_response_id,
    result_hash
  )
  values (
    p_workspace_id,
    p_run_id,
    v_run.initiated_by,
    p_draft,
    coalesce(p_missing_fields, '{}'::text[]),
    p_uncertain_fields,
    coalesce(p_clarification_questions, '{}'::text[]),
    'waiting_for_review',
    btrim(p_provider),
    btrim(p_model),
    nullif(btrim(coalesce(p_provider_response_id, '')), ''),
    p_result_hash
  )
  returning * into v_draft;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    'review_client_intake',
    1,
    'approval',
    'Review client intake',
    'waiting_for_approval',
    0,
    1,
    'Review every field before saving the client record.',
    jsonb_build_object('draftId', v_draft.id)
  );

  update public.operations_agent_runs
  set
    state = 'waiting_for_approval',
    plan = jsonb_build_array(
      jsonb_build_object(
        'stepKey', 'extract_client_intake',
        'state', 'completed'
      ),
      jsonb_build_object(
        'stepKey', 'review_client_intake',
        'state', 'waiting_for_approval'
      )
    ),
    current_step_index = 1,
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = now() + interval '7 days'
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    'run_waiting_for_approval',
    'The guided client intake draft is waiting for user review.',
    jsonb_build_object(
      'draftId', v_draft.id,
      'missingFields', v_draft.missing_fields,
      'uncertainFields', v_draft.uncertain_fields
    )
  );

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'draft', to_jsonb(v_draft)
  );
end;
$$;

comment on function public.agent_record_guided_client_intake_result(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  text[],
  jsonb,
  text[],
  text,
  text,
  text,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  uuid,
  uuid
) is
  'Service-only boundary that records one provider result, usage, durable steps, and a Suggest-mode client intake draft.';

create or replace function public.agent_fail_guided_client_intake_run(
  p_workspace_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_failure_code text,
  p_failure_message text,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_input_tokens integer,
  p_step_idempotency_key uuid,
  p_usage_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_run public.operations_agent_runs%rowtype;
  v_step public.operations_agent_steps%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service authorization is required.'
      using errcode = '42501';
  end if;

  if p_workspace_id is null
    or p_run_id is null
    or p_step_idempotency_key is null
    or p_usage_idempotency_key is null
  then
    raise exception 'Valid guided intake failure identifiers are required.'
      using errcode = '22023';
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = p_run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  if not found then
    raise exception 'Operations Agent run not found.'
      using errcode = 'P0002';
  end if;

  if v_run.state = 'failed' then
    return jsonb_build_object('run', to_jsonb(v_run));
  end if;

  if v_run.capability <> 'guided_client_intake'
    or v_run.state <> 'running'
    or v_run.worker_id is distinct from btrim(p_worker_id)
  then
    raise exception 'This guided client intake run cannot be failed by this worker.'
      using errcode = '22023';
  end if;

  insert into public.operations_agent_steps (
    workspace_id,
    run_id,
    step_key,
    step_index,
    kind,
    title,
    state,
    attempt_count,
    max_attempts,
    input_summary,
    failure_code,
    failure_message,
    idempotency_key,
    started_at,
    completed_at
  )
  values (
    p_workspace_id,
    p_run_id,
    'extract_client_intake',
    0,
    'model',
    'Structure client intake',
    'failed',
    1,
    1,
    'Extract only stated client details into a reviewable draft.',
    btrim(p_failure_code),
    left(btrim(p_failure_message), 2000),
    p_step_idempotency_key,
    now(),
    now()
  )
  returning * into v_step;

  perform public.agent_record_operations_agent_usage(
    p_workspace_id,
    p_run_id,
    v_step.id,
    p_usage_idempotency_key,
    'model',
    btrim(p_provider),
    btrim(p_model),
    coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_cached_input_tokens, 0),
    0,
    0,
    0,
    0,
    false,
    'failed_without_usable_result'
  );

  update public.operations_agent_runs
  set
    state = 'failed',
    worker_id = null,
    lease_expires_at = null,
    approval_expires_at = null,
    completed_at = now(),
    failed_at = now(),
    failure_code = btrim(p_failure_code),
    failure_message = left(btrim(p_failure_message), 2000)
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    'run_failed',
    'The guided client intake run failed without changing client records.',
    jsonb_build_object('failureCode', v_run.failure_code)
  );

  return jsonb_build_object('run', to_jsonb(v_run));
end;
$$;

comment on function public.agent_fail_guided_client_intake_run(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  uuid,
  uuid
) is
  'Service-only failure boundary for guided client intake provider or validation failures.';

create or replace function public.command_complete_guided_client_intake(
  p_workspace_id uuid,
  p_run_id uuid,
  p_draft_id uuid,
  p_expected_run_updated_at timestamptz,
  p_expected_draft_updated_at timestamptz,
  p_approved_record jsonb,
  p_evaluation_date date,
  p_client_create_idempotency_key uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_name constant text :=
    'operations_agent.guided_client_intake.complete';
  v_request_hash text;
  v_request_claimed boolean := false;
  v_existing_hash text;
  v_existing_response jsonb;
  v_run public.operations_agent_runs%rowtype;
  v_draft public.operations_agent_client_intake_drafts%rowtype;
  v_client_response jsonb;
  v_client_record_id uuid;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or p_client_create_idempotency_key is null
    or p_idempotency_key = p_client_create_idempotency_key
  then
    raise exception 'Distinct save request identifiers are required.'
      using errcode = '22023';
  end if;

  if p_run_id is null
    or p_draft_id is null
    or p_expected_run_updated_at is null
    or p_expected_draft_updated_at is null
  then
    raise exception 'The guided client intake review version is required.'
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

  if p_approved_record is null
    or jsonb_typeof(p_approved_record) <> 'object'
    or p_evaluation_date is null
  then
    raise exception 'Reviewed client details are required.'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    jsonb_build_object(
      'runId', p_run_id,
      'draftId', p_draft_id,
      'expectedRunUpdatedAt', p_expected_run_updated_at,
      'expectedDraftUpdatedAt', p_expected_draft_updated_at,
      'approvedRecord', p_approved_record,
      'evaluationDate', p_evaluation_date,
      'clientCreateIdempotencyKey',
        p_client_create_idempotency_key
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
      raise exception 'This request identifier was already used for a different guided client intake save.'
        using errcode = '22023';
    end if;

    if v_existing_response is null then
      raise exception 'This guided client intake save is still being processed.'
        using errcode = 'PT409';
    end if;

    return v_existing_response;
  end if;

  select run.*
  into v_run
  from public.operations_agent_runs as run
  where run.id = p_run_id
    and run.workspace_id = p_workspace_id
  for update of run;

  if not found then
    raise exception 'Operations Agent run not found.'
      using errcode = 'P0002';
  end if;

  select draft.*
  into v_draft
  from public.operations_agent_client_intake_drafts as draft
  where draft.id = p_draft_id
    and draft.run_id = p_run_id
    and draft.workspace_id = p_workspace_id
  for update of draft;

  if not found then
    raise exception 'Guided client intake draft not found.'
      using errcode = 'P0002';
  end if;

  if v_run.initiated_by <> v_actor_id
    or v_draft.initiated_by <> v_actor_id
  then
    raise exception 'Only the initiating user can save this guided client intake.'
      using errcode = '42501';
  end if;

  if v_run.capability <> 'guided_client_intake'
    or v_run.mode <> 'suggest'
    or v_run.state <> 'waiting_for_approval'
    or v_draft.state <> 'waiting_for_review'
  then
    raise exception 'This guided client intake is no longer waiting for review.'
      using errcode = '22023';
  end if;

  if v_run.updated_at <> p_expected_run_updated_at
    or v_draft.updated_at <> p_expected_draft_updated_at
  then
    raise exception 'This guided client intake changed elsewhere. Refresh before saving.'
      using errcode = 'PT409';
  end if;

  if v_run.approval_expires_at is null
    or v_run.approval_expires_at <= now()
  then
    raise exception 'This guided client intake review has expired.'
      using errcode = '22023';
  end if;

  v_client_response :=
    public.command_create_client_workflow_record(
      p_workspace_id,
      p_approved_record,
      p_evaluation_date,
      p_client_create_idempotency_key
    );

  v_client_record_id :=
    nullif(v_client_response->'clientRecord'->>'id', '')::uuid;

  if v_client_record_id is null then
    raise exception 'The client record command returned an invalid response.'
      using errcode = 'P0001';
  end if;

  update public.operations_agent_client_intake_drafts
  set
    state = 'saved',
    approved_record = p_approved_record,
    saved_client_workflow_record_id = v_client_record_id
  where id = p_draft_id
    and workspace_id = p_workspace_id
  returning * into v_draft;

  update public.operations_agent_steps
  set
    state = 'completed',
    attempt_count = 1,
    output_summary =
      'The reviewed client intake was saved through the client record command.',
    details = details || jsonb_build_object(
      'clientWorkflowRecordId', v_client_record_id
    ),
    started_at = coalesce(started_at, now()),
    completed_at = now()
  where workspace_id = p_workspace_id
    and run_id = p_run_id
    and step_key = 'review_client_intake'
    and state = 'waiting_for_approval';

  update public.operations_agent_runs
  set
    state = 'completed',
    current_step_index = 2,
    plan = jsonb_build_array(
      jsonb_build_object(
        'stepKey', 'extract_client_intake',
        'state', 'completed'
      ),
      jsonb_build_object(
        'stepKey', 'review_client_intake',
        'state', 'completed'
      )
    ),
    approval_expires_at = null,
    completed_at = now(),
    outcome_summary =
      'The reviewed guided client intake was saved as a client record.'
  where id = p_run_id
    and workspace_id = p_workspace_id
  returning * into v_run;

  insert into public.operations_agent_run_events (
    workspace_id,
    run_id,
    actor_id,
    event_type,
    note,
    details
  )
  values (
    p_workspace_id,
    p_run_id,
    v_actor_id,
    'run_completed',
    'The user reviewed and saved the guided client intake.',
    jsonb_build_object(
      'draftId', p_draft_id,
      'clientWorkflowRecordId', v_client_record_id
    )
  );

  v_response := jsonb_build_object(
    'requestId', p_idempotency_key,
    'run', to_jsonb(v_run),
    'draft', to_jsonb(v_draft),
    'clientRecord', v_client_response->'clientRecord',
    'reconciliation', v_client_response->'reconciliation'
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

comment on function public.command_complete_guided_client_intake(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  date,
  uuid,
  uuid
) is
  'Atomically saves one user-reviewed Suggest-mode client intake through the existing client-create command and completes its Operations Agent run.';

revoke all
  on table public.operations_agent_client_intake_drafts
  from public, anon, authenticated;

grant select
  on table public.operations_agent_client_intake_drafts
  to authenticated;

revoke all
  on function public.agent_record_guided_client_intake_result(
    uuid,
    uuid,
    text,
    text,
    jsonb,
    text[],
    jsonb,
    text[],
    text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    uuid,
    uuid
  )
  from public, anon, authenticated;

revoke all
  on function public.agent_fail_guided_client_intake_run(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    uuid,
    uuid
  )
  from public, anon, authenticated;

revoke all
  on function public.command_complete_guided_client_intake(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    jsonb,
    date,
    uuid,
    uuid
  )
  from public, anon;

grant execute
  on function public.agent_record_guided_client_intake_result(
    uuid,
    uuid,
    text,
    text,
    jsonb,
    text[],
    jsonb,
    text[],
    text,
    text,
    text,
    integer,
    integer,
    integer,
    numeric,
    numeric,
    uuid,
    uuid
  )
  to service_role;

grant execute
  on function public.agent_fail_guided_client_intake_run(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    uuid,
    uuid
  )
  to service_role;

grant execute
  on function public.command_complete_guided_client_intake(
    uuid,
    uuid,
    uuid,
    timestamptz,
    timestamptz,
    jsonb,
    date,
    uuid,
    uuid
  )
  to authenticated;

commit;
