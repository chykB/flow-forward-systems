--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Ubuntu 17.10-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: apply_invoice_workflow_recommendation(uuid, uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_invoice_workflow_recommendation(p_workspace_id uuid, p_invoice_id uuid, p_client_workflow_record_id uuid, p_expected_invoice_status text, p_effective_invoice_status text, p_updates jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_invoice public.invoice_records%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_applied_at timestamptz := now();
  v_invalid_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb
  then
    raise exception 'Client workflow updates are required.'
      using errcode = '22023';
  end if;

  if p_effective_invoice_status is null
    or p_effective_invoice_status not in (
      'Not needed',
      'Draft needed',
      'Sent',
      'Due soon',
      'Overdue',
      'Paid',
      'Disputed',
      'Voided'
    )
  then
    raise exception 'Unsupported effective invoice status.'
      using errcode = '22023';
  end if;

  select supplied.key
  into v_invalid_key
  from jsonb_object_keys(p_updates) as supplied(key)
  where supplied.key not in (
    'paymentStatus',
    'priority',
    'riskLevel',
    'nextAction',
    'nextFollowUpAt'
  )
  limit 1;

  if v_invalid_key is not null then
    raise exception 'Unsupported workflow update field: %.',
      v_invalid_key
      using errcode = '22023';
  end if;

  select *
  into v_invoice
  from public.invoice_records
  where id = p_invoice_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Invoice not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_invoice.client_workflow_record_id
    <> p_client_workflow_record_id
  then
    raise exception
      'The invoice is not linked to this client record.'
      using errcode = '23503';
  end if;

  if v_invoice.status is distinct from
    p_expected_invoice_status
  then
    raise exception
      'The invoice status changed. Refresh and try again.'
      using errcode = '40001';
  end if;

  select *
  into v_client
  from public.client_workflow_records
  where id = p_client_workflow_record_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_invoice.workflow_action_applied_status
    = p_effective_invoice_status
  then
    return jsonb_build_object(
      'clientRecord', to_jsonb(v_client),
      'invoice', to_jsonb(v_invoice),
      'alreadyApplied', true
    );
  end if;

  if p_effective_invoice_status <> v_invoice.status
    and not (
      (
        v_invoice.status = 'Sent'
        and p_effective_invoice_status in (
          'Due soon',
          'Overdue'
        )
      )
      or (
        v_invoice.status = 'Due soon'
        and p_effective_invoice_status = 'Overdue'
      )
    )
  then
    raise exception 'Unsupported invoice status transition.'
      using errcode = '22023';
  end if;

  update public.client_workflow_records
  set
    payment_status = coalesce(
      p_updates ->> 'paymentStatus',
      payment_status
    ),
    priority = coalesce(
      p_updates ->> 'priority',
      priority
    ),
    risk_level = coalesce(
      p_updates ->> 'riskLevel',
      risk_level
    ),
    next_action = coalesce(
      p_updates ->> 'nextAction',
      next_action
    ),
    next_follow_up_at = coalesce(
      nullif(
        p_updates ->> 'nextFollowUpAt',
        ''
      )::date,
      next_follow_up_at
    ),
    updated_at = v_applied_at
  where id = p_client_workflow_record_id
    and workspace_id = p_workspace_id
  returning * into v_client;

  if p_effective_invoice_status <> v_invoice.status then
    update public.invoice_records
    set
      status = p_effective_invoice_status,
      updated_at = v_applied_at
    where id = p_invoice_id
      and workspace_id = p_workspace_id;
  end if;

  update public.invoice_records
  set
    workflow_action_applied_status =
      p_effective_invoice_status,
    workflow_action_applied_at = v_applied_at,
    updated_at = v_applied_at
  where id = p_invoice_id
    and workspace_id = p_workspace_id
  returning * into v_invoice;

  return jsonb_build_object(
    'clientRecord', to_jsonb(v_client),
    'invoice', to_jsonb(v_invoice),
    'alreadyApplied', false
  );
end;
$$;


--
-- Name: apply_proposal_workflow_recommendation(uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_proposal_workflow_recommendation(p_workspace_id uuid, p_proposal_id uuid, p_client_workflow_record_id uuid, p_expected_proposal_status text, p_updates jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_proposal public.proposal_records%rowtype;
  v_client public.client_workflow_records%rowtype;
  v_applied_at timestamptz := now();
  v_invalid_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'object'
    or p_updates = '{}'::jsonb then
    raise exception 'Client workflow updates are required.'
      using errcode = '22023';
  end if;

  select supplied.key
  into v_invalid_key
  from jsonb_object_keys(p_updates) as supplied(key)
  where supplied.key not in (
    'lifecycleStage',
    'clientType',
    'returningClientStatus',
    'nextAction',
    'nextFollowUpAt',
    'onboardingStatus',
    'priority',
    'riskLevel',
    'estimatedValue'
  )
  limit 1;

  if v_invalid_key is not null then
    raise exception 'Unsupported workflow update field: %.', v_invalid_key
      using errcode = '22023';
  end if;

  select *
  into v_proposal
  from public.proposal_records
  where id = p_proposal_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Proposal not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_proposal.client_workflow_record_id
    <> p_client_workflow_record_id then
    raise exception 'The proposal is not linked to this client record.'
      using errcode = '23503';
  end if;

  if v_proposal.status <> p_expected_proposal_status then
    raise exception 'The proposal status changed. Refresh and try again.'
      using errcode = '40001';
  end if;

  select *
  into v_client
  from public.client_workflow_records
  where id = p_client_workflow_record_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Client record not found or unavailable.'
      using errcode = 'P0002';
  end if;

  if v_proposal.workflow_action_applied_status
    = v_proposal.status then
    return jsonb_build_object(
      'clientRecord', to_jsonb(v_client),
      'proposal', to_jsonb(v_proposal),
      'alreadyApplied', true
    );
  end if;

  update public.client_workflow_records
  set
    lifecycle_stage = case
      when p_updates ? 'lifecycleStage'
        then p_updates ->> 'lifecycleStage'
      else lifecycle_stage
    end,
    client_type = case
      when p_updates ? 'clientType'
        then p_updates ->> 'clientType'
      else client_type
    end,
    returning_client_status = case
      when p_updates ? 'returningClientStatus'
        then p_updates ->> 'returningClientStatus'
      else returning_client_status
    end,
    next_action = case
      when p_updates ? 'nextAction'
        then p_updates ->> 'nextAction'
      else next_action
    end,
    next_follow_up_at = case
      when p_updates ? 'nextFollowUpAt'
        then (p_updates ->> 'nextFollowUpAt')::date
      else next_follow_up_at
    end,
    onboarding_status = case
      when p_updates ? 'onboardingStatus'
        then p_updates ->> 'onboardingStatus'
      else onboarding_status
    end,
    priority = case
      when p_updates ? 'priority'
        then p_updates ->> 'priority'
      else priority
    end,
    risk_level = case
      when p_updates ? 'riskLevel'
        then p_updates ->> 'riskLevel'
      else risk_level
    end,
    estimated_value = case
      when p_updates ? 'estimatedValue'
        then (p_updates ->> 'estimatedValue')::numeric
      else estimated_value
    end,
    updated_at = v_applied_at
  where id = p_client_workflow_record_id
    and workspace_id = p_workspace_id
  returning * into v_client;

  update public.proposal_records
  set
    workflow_action_applied_status = status,
    workflow_action_applied_at = v_applied_at,
    updated_at = v_applied_at
  where id = p_proposal_id
    and workspace_id = p_workspace_id
  returning * into v_proposal;

  return jsonb_build_object(
    'clientRecord', to_jsonb(v_client),
    'proposal', to_jsonb(v_proposal),
    'alreadyApplied', false
  );
end;
$$;


--
-- Name: handle_new_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, null)
  on conflict (id) do nothing;

  return new;
end;
$$;


--
-- Name: keep_single_invoice_workflow_action_marker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keep_single_invoice_workflow_action_marker() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.workflow_action_applied_status is not null
    and (
      old.workflow_action_applied_status
        is distinct from new.workflow_action_applied_status
      or old.workspace_id is distinct from new.workspace_id
      or old.client_workflow_record_id
        is distinct from new.client_workflow_record_id
    )
  then
    update public.invoice_records
    set
      workflow_action_applied_status = null,
      workflow_action_applied_at = null
    where workspace_id = new.workspace_id
      and client_workflow_record_id =
        new.client_workflow_record_id
      and id <> new.id
      and workflow_action_applied_status is not null;
  end if;

  return new;
end;
$$;


--
-- Name: manage_invoice_dispute_lifecycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_invoice_dispute_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Disputed' then
      new.disputed_at = coalesce(new.disputed_at, now());
      new.dispute_resolved_at = null;
      new.dispute_resolution_outcome = null;
      new.dispute_resolution_note = null;
    end if;

    return new;
  end if;

  if new.status = 'Disputed'
    and old.status is distinct from 'Disputed'
  then
    new.disputed_at = now();
    new.dispute_resolved_at = null;
    new.dispute_resolution_outcome = null;
    new.dispute_resolution_note = null;
  elsif old.status = 'Disputed'
    and new.status <> 'Disputed'
  then
    if new.dispute_resolution_outcome is null then
      raise exception 'Choose how the invoice dispute was resolved.'
        using errcode = '22023';
    end if;

    if new.dispute_resolution_note is null
      or length(btrim(new.dispute_resolution_note)) < 5
    then
      raise exception 'Add a dispute resolution note.'
        using errcode = '22023';
    end if;

    if new.dispute_resolution_outcome = 'Payment received'
      and (new.status <> 'Paid' or new.paid_at is null)
    then
      raise exception
        'Payment received requires Paid status and a payment date.'
        using errcode = '22023';
    end if;

    if new.dispute_resolution_outcome = 'Payment still due'
      and new.status not in ('Sent', 'Due soon', 'Overdue')
    then
      raise exception
        'Payment still due requires Sent, Due soon, or Overdue status.'
        using errcode = '22023';
    end if;

    if new.dispute_resolution_outcome =
      'Invoice voided or replaced'
      and new.status <> 'Voided'
    then
      raise exception
        'A voided or replaced invoice requires Voided status.'
        using errcode = '22023';
    end if;

    new.dispute_resolved_at =
      coalesce(new.dispute_resolved_at, now());
  end if;

  return new;
end;
$$;


--
-- Name: reset_invoice_workflow_action_marker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_invoice_workflow_action_marker() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.status is distinct from old.status then
    new.workflow_action_applied_status := null;
    new.workflow_action_applied_at := null;
  end if;

  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action_type text NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_workflow_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_workflow_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    business_name text NOT NULL,
    source text NOT NULL,
    interest text NOT NULL,
    message text NOT NULL,
    lifecycle_stage text NOT NULL,
    priority text NOT NULL,
    risk_level text NOT NULL,
    next_action text NOT NULL,
    next_follow_up_at date NOT NULL,
    assigned_to text NOT NULL,
    onboarding_status text NOT NULL,
    delivery_status text NOT NULL,
    approval_status text NOT NULL,
    payment_status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_type text DEFAULT 'Lead'::text NOT NULL,
    returning_client_status text DEFAULT 'Not returning'::text NOT NULL,
    last_project_date date,
    estimated_value numeric(12,2) DEFAULT 0 NOT NULL,
    workflow_health_score integer DEFAULT 75 NOT NULL,
    CONSTRAINT client_workflow_records_approval_status_check CHECK ((approval_status = ANY (ARRAY['Not started'::text, 'In progress'::text, 'Waiting'::text, 'Blocked'::text, 'Complete'::text, 'Not needed'::text]))),
    CONSTRAINT client_workflow_records_client_type_check CHECK ((client_type = ANY (ARRAY['Lead'::text, 'New client'::text, 'Active client'::text, 'Returning client'::text, 'Past client'::text]))),
    CONSTRAINT client_workflow_records_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['Not started'::text, 'In progress'::text, 'Waiting'::text, 'Blocked'::text, 'Complete'::text, 'Not needed'::text]))),
    CONSTRAINT client_workflow_records_lifecycle_stage_check CHECK ((lifecycle_stage = ANY (ARRAY['New lead'::text, 'Qualified lead'::text, 'Follow-up needed'::text, 'Discovery or call booked'::text, 'Proposal sent'::text, 'Won client'::text, 'Onboarding'::text, 'In delivery'::text, 'Waiting for approval'::text, 'Payment follow-up'::text, 'At risk'::text, 'Completed'::text, 'Lost or inactive'::text]))),
    CONSTRAINT client_workflow_records_lifetime_value_check CHECK ((estimated_value >= (0)::numeric)),
    CONSTRAINT client_workflow_records_onboarding_status_check CHECK ((onboarding_status = ANY (ARRAY['Not started'::text, 'In progress'::text, 'Waiting'::text, 'Blocked'::text, 'Complete'::text, 'Not needed'::text]))),
    CONSTRAINT client_workflow_records_payment_status_check CHECK ((payment_status = ANY (ARRAY['Not started'::text, 'In progress'::text, 'Waiting'::text, 'Blocked'::text, 'Complete'::text, 'Not needed'::text]))),
    CONSTRAINT client_workflow_records_priority_check CHECK ((priority = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text]))),
    CONSTRAINT client_workflow_records_returning_client_status_check CHECK ((returning_client_status = ANY (ARRAY['Not returning'::text, 'Potential reactivation'::text, 'Repeat project opportunity'::text, 'Reactivated'::text, 'Dormant'::text]))),
    CONSTRAINT client_workflow_records_risk_level_check CHECK ((risk_level = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text]))),
    CONSTRAINT client_workflow_records_workflow_health_score_check CHECK (((workflow_health_score >= 0) AND (workflow_health_score <= 100)))
);


--
-- Name: handoff_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handoff_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    title text NOT NULL,
    note text NOT NULL,
    owner text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    invoice_number text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    description text,
    status text DEFAULT 'Not needed'::text NOT NULL,
    payment_link text,
    sent_at date,
    due_date date,
    paid_at date,
    dispute_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workflow_action_applied_status text,
    workflow_action_applied_at timestamp with time zone,
    disputed_at timestamp with time zone,
    dispute_resolved_at timestamp with time zone,
    dispute_resolution_outcome text,
    dispute_resolution_note text,
    CONSTRAINT invoice_records_amount_nonnegative_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT invoice_records_date_order_check CHECK ((((sent_at IS NULL) OR (due_date IS NULL) OR (due_date >= sent_at)) AND ((sent_at IS NULL) OR (paid_at IS NULL) OR (paid_at >= sent_at)))),
    CONSTRAINT invoice_records_dispute_reason_check CHECK (((status <> 'Disputed'::text) OR ((dispute_reason IS NOT NULL) AND (length(btrim(dispute_reason)) >= 5)))),
    CONSTRAINT invoice_records_dispute_resolution_details_check CHECK ((((dispute_resolution_outcome IS NULL) AND (dispute_resolution_note IS NULL) AND (dispute_resolved_at IS NULL)) OR ((dispute_resolution_outcome IS NOT NULL) AND (dispute_resolution_note IS NOT NULL) AND (length(btrim(dispute_resolution_note)) >= 5) AND (dispute_resolved_at IS NOT NULL) AND (disputed_at IS NOT NULL)))),
    CONSTRAINT invoice_records_dispute_resolution_outcome_check CHECK (((dispute_resolution_outcome IS NULL) OR (dispute_resolution_outcome = ANY (ARRAY['Payment received'::text, 'Payment still due'::text, 'Invoice voided or replaced'::text])))),
    CONSTRAINT invoice_records_dispute_resolution_timeline_check CHECK (((dispute_resolved_at IS NULL) OR (disputed_at IS NULL) OR (dispute_resolved_at >= disputed_at))),
    CONSTRAINT invoice_records_issued_fields_check CHECK (((status <> ALL (ARRAY['Sent'::text, 'Due soon'::text, 'Overdue'::text, 'Paid'::text, 'Disputed'::text])) OR ((invoice_number IS NOT NULL) AND (length(btrim(invoice_number)) > 0) AND (amount > (0)::numeric)))),
    CONSTRAINT invoice_records_open_dispute_check CHECK (((status <> 'Disputed'::text) OR ((disputed_at IS NOT NULL) AND (dispute_resolution_outcome IS NULL) AND (dispute_resolution_note IS NULL) AND (dispute_resolved_at IS NULL)))),
    CONSTRAINT invoice_records_paid_date_check CHECK (((status <> 'Paid'::text) OR (paid_at IS NOT NULL))),
    CONSTRAINT invoice_records_payment_schedule_check CHECK (((status <> ALL (ARRAY['Sent'::text, 'Due soon'::text, 'Overdue'::text, 'Disputed'::text])) OR ((sent_at IS NOT NULL) AND (due_date IS NOT NULL)))),
    CONSTRAINT invoice_records_status_check CHECK ((status = ANY (ARRAY['Not needed'::text, 'Draft needed'::text, 'Sent'::text, 'Due soon'::text, 'Overdue'::text, 'Paid'::text, 'Disputed'::text, 'Voided'::text]))),
    CONSTRAINT invoice_records_workflow_action_applied_status_check CHECK (((workflow_action_applied_status IS NULL) OR (workflow_action_applied_status = ANY (ARRAY['Not needed'::text, 'Draft needed'::text, 'Sent'::text, 'Due soon'::text, 'Overdue'::text, 'Paid'::text, 'Disputed'::text, 'Voided'::text]))))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposal_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    title text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'Not needed'::text NOT NULL,
    sent_at date,
    expires_at date,
    accepted_at date,
    rejected_at date,
    revision_requested_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workflow_action_applied_status text,
    workflow_action_applied_at timestamp with time zone,
    CONSTRAINT proposal_records_status_check CHECK ((status = ANY (ARRAY['Not needed'::text, 'Draft needed'::text, 'Sent'::text, 'Revision requested'::text, 'Accepted'::text, 'Rejected'::text, 'Expired'::text]))),
    CONSTRAINT proposal_records_workflow_action_status_check CHECK (((workflow_action_applied_status IS NULL) OR (workflow_action_applied_status = ANY (ARRAY['Not needed'::text, 'Draft needed'::text, 'Sent'::text, 'Revision requested'::text, 'Accepted'::text, 'Rejected'::text, 'Expired'::text]))))
);


--
-- Name: risk_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    risk_type text NOT NULL,
    severity text DEFAULT 'Medium'::text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT risk_signals_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text]))),
    CONSTRAINT risk_signals_status_check CHECK ((status = ANY (ARRAY['Open'::text, 'Reviewed'::text, 'Resolved'::text, 'Dismissed'::text])))
);


--
-- Name: workflow_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_workflow_record_id uuid NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    owner text NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    criticality text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workflow_tasks_criticality_check CHECK ((criticality = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text]))),
    CONSTRAINT workflow_tasks_status_check CHECK ((status = ANY (ARRAY['Not started'::text, 'In progress'::text, 'Waiting'::text, 'Blocked'::text, 'Complete'::text, 'Not needed'::text]))),
    CONSTRAINT workflow_tasks_type_check CHECK ((type = ANY (ARRAY['Follow-up'::text, 'Onboarding'::text, 'Delivery'::text, 'Approval'::text, 'Payment'::text, 'Handoff'::text])))
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: client_workflow_records client_workflow_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_workflow_records
    ADD CONSTRAINT client_workflow_records_pkey PRIMARY KEY (id);


--
-- Name: client_workflow_records client_workflow_records_workspace_id_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_workflow_records
    ADD CONSTRAINT client_workflow_records_workspace_id_id_unique UNIQUE (workspace_id, id);


--
-- Name: handoff_notes handoff_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_notes
    ADD CONSTRAINT handoff_notes_pkey PRIMARY KEY (id);


--
-- Name: invoice_records invoice_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_records
    ADD CONSTRAINT invoice_records_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposal_records proposal_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_records
    ADD CONSTRAINT proposal_records_pkey PRIMARY KEY (id);


--
-- Name: risk_signals risk_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_pkey PRIMARY KEY (id);


--
-- Name: workflow_tasks workflow_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_one_per_owner; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_one_per_owner UNIQUE (owner_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_workspace_record_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_workspace_record_created_idx ON public.activity_logs USING btree (workspace_id, client_workflow_record_id, created_at DESC);


--
-- Name: client_workflow_records_workspace_followup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_workflow_records_workspace_followup_idx ON public.client_workflow_records USING btree (workspace_id, next_follow_up_at);


--
-- Name: client_workflow_records_workspace_risk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_workflow_records_workspace_risk_idx ON public.client_workflow_records USING btree (workspace_id, risk_level);


--
-- Name: client_workflow_records_workspace_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_workflow_records_workspace_stage_idx ON public.client_workflow_records USING btree (workspace_id, lifecycle_stage);


--
-- Name: handoff_notes_workspace_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handoff_notes_workspace_record_idx ON public.handoff_notes USING btree (workspace_id, client_workflow_record_id);


--
-- Name: invoice_records_one_current_workflow_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_records_one_current_workflow_action_idx ON public.invoice_records USING btree (workspace_id, client_workflow_record_id) WHERE (workflow_action_applied_status IS NOT NULL);


--
-- Name: invoice_records_workspace_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_records_workspace_record_idx ON public.invoice_records USING btree (workspace_id, client_workflow_record_id);


--
-- Name: proposal_records_workspace_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proposal_records_workspace_record_idx ON public.proposal_records USING btree (workspace_id, client_workflow_record_id);


--
-- Name: risk_signals_workspace_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risk_signals_workspace_record_idx ON public.risk_signals USING btree (workspace_id, client_workflow_record_id);


--
-- Name: workflow_tasks_workspace_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_tasks_workspace_due_date_idx ON public.workflow_tasks USING btree (workspace_id, due_date);


--
-- Name: workflow_tasks_workspace_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_tasks_workspace_record_idx ON public.workflow_tasks USING btree (workspace_id, client_workflow_record_id);


--
-- Name: workflow_tasks_workspace_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_tasks_workspace_status_idx ON public.workflow_tasks USING btree (workspace_id, status);


--
-- Name: workspaces_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspaces_owner_id_idx ON public.workspaces USING btree (owner_id);


--
-- Name: invoice_records keep_single_invoice_workflow_action_marker; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER keep_single_invoice_workflow_action_marker BEFORE UPDATE OF workflow_action_applied_status, workspace_id, client_workflow_record_id ON public.invoice_records FOR EACH ROW EXECUTE FUNCTION public.keep_single_invoice_workflow_action_marker();


--
-- Name: invoice_records manage_invoice_dispute_lifecycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER manage_invoice_dispute_lifecycle BEFORE INSERT OR UPDATE OF status, disputed_at, dispute_resolved_at, dispute_resolution_outcome, dispute_resolution_note ON public.invoice_records FOR EACH ROW EXECUTE FUNCTION public.manage_invoice_dispute_lifecycle();


--
-- Name: invoice_records reset_invoice_workflow_action_marker_on_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reset_invoice_workflow_action_marker_on_status_change BEFORE UPDATE OF status ON public.invoice_records FOR EACH ROW EXECUTE FUNCTION public.reset_invoice_workflow_action_marker();


--
-- Name: client_workflow_records set_client_workflow_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_client_workflow_records_updated_at BEFORE UPDATE ON public.client_workflow_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoice_records set_invoice_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoice_records_updated_at BEFORE UPDATE ON public.invoice_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: proposal_records set_proposal_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_proposal_records_updated_at BEFORE UPDATE ON public.proposal_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workflow_tasks set_workflow_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_workflow_tasks_updated_at BEFORE UPDATE ON public.workflow_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workspaces set_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_record_workspace_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_record_workspace_fk FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: client_workflow_records client_workflow_records_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_workflow_records
    ADD CONSTRAINT client_workflow_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: handoff_notes handoff_notes_record_workspace_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_notes
    ADD CONSTRAINT handoff_notes_record_workspace_fk FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: handoff_notes handoff_notes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_notes
    ADD CONSTRAINT handoff_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: invoice_records invoice_records_workspace_id_client_workflow_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_records
    ADD CONSTRAINT invoice_records_workspace_id_client_workflow_record_id_fkey FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: invoice_records invoice_records_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_records
    ADD CONSTRAINT invoice_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: proposal_records proposal_records_workspace_id_client_workflow_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_records
    ADD CONSTRAINT proposal_records_workspace_id_client_workflow_record_id_fkey FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: proposal_records proposal_records_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_records
    ADD CONSTRAINT proposal_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: risk_signals risk_signals_workspace_id_client_workflow_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_workspace_id_client_workflow_record_id_fkey FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: risk_signals risk_signals_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workflow_tasks workflow_tasks_record_workspace_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_record_workspace_fk FOREIGN KEY (workspace_id, client_workflow_record_id) REFERENCES public.client_workflow_records(workspace_id, id) ON DELETE CASCADE;


--
-- Name: workflow_tasks workflow_tasks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_tasks
    ADD CONSTRAINT workflow_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: handoff_notes Users can delete handoff notes in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete handoff notes in owned workspaces" ON public.handoff_notes FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = handoff_notes.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workspaces Users can delete owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete owned workspaces" ON public.workspaces FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: client_workflow_records Users can delete records in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete records in owned workspaces" ON public.client_workflow_records FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = client_workflow_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workflow_tasks Users can delete tasks in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tasks in owned workspaces" ON public.workflow_tasks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workflow_tasks.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: activity_logs Users can insert activity logs in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert activity logs in owned workspaces" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (((actor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = activity_logs.workspace_id) AND (workspaces.owner_id = auth.uid()))))));


--
-- Name: handoff_notes Users can insert handoff notes in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert handoff notes in owned workspaces" ON public.handoff_notes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = handoff_notes.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workspaces Users can insert owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert owned workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: client_workflow_records Users can insert records in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert records in owned workspaces" ON public.client_workflow_records FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = client_workflow_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workflow_tasks Users can insert tasks in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tasks in owned workspaces" ON public.workflow_tasks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workflow_tasks.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: activity_logs Users can read activity logs in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read activity logs in owned workspaces" ON public.activity_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = activity_logs.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: handoff_notes Users can read handoff notes in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read handoff notes in owned workspaces" ON public.handoff_notes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = handoff_notes.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workspaces Users can read owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read owned workspaces" ON public.workspaces FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: client_workflow_records Users can read records in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read records in owned workspaces" ON public.client_workflow_records FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = client_workflow_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workflow_tasks Users can read tasks in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read tasks in owned workspaces" ON public.workflow_tasks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workflow_tasks.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: profiles Users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: handoff_notes Users can update handoff notes in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update handoff notes in owned workspaces" ON public.handoff_notes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = handoff_notes.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = handoff_notes.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workspaces Users can update owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update owned workspaces" ON public.workspaces FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: client_workflow_records Users can update records in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update records in owned workspaces" ON public.client_workflow_records FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = client_workflow_records.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = client_workflow_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: workflow_tasks Users can update tasks in owned workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tasks in owned workspaces" ON public.workflow_tasks FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workflow_tasks.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workflow_tasks.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: client_workflow_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_workflow_records ENABLE ROW LEVEL SECURITY;

--
-- Name: handoff_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handoff_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_records invoice records owned workspace delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invoice records owned workspace delete" ON public.invoice_records FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = invoice_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: invoice_records invoice records owned workspace insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invoice records owned workspace insert" ON public.invoice_records FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = invoice_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: invoice_records invoice records owned workspace select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invoice records owned workspace select" ON public.invoice_records FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = invoice_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: invoice_records invoice records owned workspace update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invoice records owned workspace update" ON public.invoice_records FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = invoice_records.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = invoice_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: invoice_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_records ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_records proposal records owned workspace delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "proposal records owned workspace delete" ON public.proposal_records FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = proposal_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: proposal_records proposal records owned workspace insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "proposal records owned workspace insert" ON public.proposal_records FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = proposal_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: proposal_records proposal records owned workspace select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "proposal records owned workspace select" ON public.proposal_records FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = proposal_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: proposal_records proposal records owned workspace update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "proposal records owned workspace update" ON public.proposal_records FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = proposal_records.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = proposal_records.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: proposal_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposal_records ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_signals risk signals owned workspace delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "risk signals owned workspace delete" ON public.risk_signals FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = risk_signals.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: risk_signals risk signals owned workspace insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "risk signals owned workspace insert" ON public.risk_signals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = risk_signals.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: risk_signals risk signals owned workspace select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "risk signals owned workspace select" ON public.risk_signals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = risk_signals.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: risk_signals risk signals owned workspace update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "risk signals owned workspace update" ON public.risk_signals FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = risk_signals.workspace_id) AND (workspaces.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = risk_signals.workspace_id) AND (workspaces.owner_id = auth.uid())))));


--
-- Name: risk_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION apply_invoice_workflow_recommendation(p_workspace_id uuid, p_invoice_id uuid, p_client_workflow_record_id uuid, p_expected_invoice_status text, p_effective_invoice_status text, p_updates jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_invoice_workflow_recommendation(p_workspace_id uuid, p_invoice_id uuid, p_client_workflow_record_id uuid, p_expected_invoice_status text, p_effective_invoice_status text, p_updates jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_invoice_workflow_recommendation(p_workspace_id uuid, p_invoice_id uuid, p_client_workflow_record_id uuid, p_expected_invoice_status text, p_effective_invoice_status text, p_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.apply_invoice_workflow_recommendation(p_workspace_id uuid, p_invoice_id uuid, p_client_workflow_record_id uuid, p_expected_invoice_status text, p_effective_invoice_status text, p_updates jsonb) TO service_role;


--
-- Name: FUNCTION apply_proposal_workflow_recommendation(p_workspace_id uuid, p_proposal_id uuid, p_client_workflow_record_id uuid, p_expected_proposal_status text, p_updates jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_proposal_workflow_recommendation(p_workspace_id uuid, p_proposal_id uuid, p_client_workflow_record_id uuid, p_expected_proposal_status text, p_updates jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_proposal_workflow_recommendation(p_workspace_id uuid, p_proposal_id uuid, p_client_workflow_record_id uuid, p_expected_proposal_status text, p_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.apply_proposal_workflow_recommendation(p_workspace_id uuid, p_proposal_id uuid, p_client_workflow_record_id uuid, p_expected_proposal_status text, p_updates jsonb) TO service_role;


--
-- Name: FUNCTION handle_new_user_profile(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user_profile() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user_profile() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user_profile() TO service_role;


--
-- Name: FUNCTION keep_single_invoice_workflow_action_marker(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.keep_single_invoice_workflow_action_marker() TO anon;
GRANT ALL ON FUNCTION public.keep_single_invoice_workflow_action_marker() TO authenticated;
GRANT ALL ON FUNCTION public.keep_single_invoice_workflow_action_marker() TO service_role;


--
-- Name: FUNCTION manage_invoice_dispute_lifecycle(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.manage_invoice_dispute_lifecycle() TO anon;
GRANT ALL ON FUNCTION public.manage_invoice_dispute_lifecycle() TO authenticated;
GRANT ALL ON FUNCTION public.manage_invoice_dispute_lifecycle() TO service_role;


--
-- Name: FUNCTION reset_invoice_workflow_action_marker(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reset_invoice_workflow_action_marker() TO anon;
GRANT ALL ON FUNCTION public.reset_invoice_workflow_action_marker() TO authenticated;
GRANT ALL ON FUNCTION public.reset_invoice_workflow_action_marker() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE client_workflow_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_workflow_records TO anon;
GRANT ALL ON TABLE public.client_workflow_records TO authenticated;
GRANT ALL ON TABLE public.client_workflow_records TO service_role;


--
-- Name: TABLE handoff_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.handoff_notes TO anon;
GRANT ALL ON TABLE public.handoff_notes TO authenticated;
GRANT ALL ON TABLE public.handoff_notes TO service_role;


--
-- Name: TABLE invoice_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoice_records TO anon;
GRANT ALL ON TABLE public.invoice_records TO authenticated;
GRANT ALL ON TABLE public.invoice_records TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE proposal_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proposal_records TO anon;
GRANT ALL ON TABLE public.proposal_records TO authenticated;
GRANT ALL ON TABLE public.proposal_records TO service_role;


--
-- Name: TABLE risk_signals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.risk_signals TO anon;
GRANT ALL ON TABLE public.risk_signals TO authenticated;
GRANT ALL ON TABLE public.risk_signals TO service_role;


--
-- Name: TABLE workflow_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workflow_tasks TO anon;
GRANT ALL ON TABLE public.workflow_tasks TO authenticated;
GRANT ALL ON TABLE public.workflow_tasks TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;



--
-- Restore the application-owned profile trigger on Supabase Auth.
--

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

--
-- PostgreSQL database dump complete
--
