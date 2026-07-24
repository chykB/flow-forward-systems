# Internal Application API Boundary

Status: Active technical contract

Implemented slices: Work items, client records, follow-up completion, Work Item handoff context, proposals, engagement-owned Proposal recommendations, proposal-linked Invoice billing, invoices, engagement ownership, engagement-scoped risk review, sequential Work Item controls, Work Item dependency editing, and the provider-neutral Operations Agent runtime foundation

Public API status: None of the interfaces or database functions in this document are a versioned customer API.

## Purpose

The application needs one trusted boundary between user experiences and persistence. The browser UI, future assistant tools, scheduled jobs, and later external integrations must not each invent their own write sequence.

The boundary has three jobs:

1. authenticate and authorize the workspace actor;
2. validate a typed operation and execute consequential changes atomically;
3. return stable application data and a diagnostic request identifier.

The manual and rules-based product remains fully operational without an AI provider. Future assistants must call approved application commands through a protected tool layer; they must not receive unrestricted database access.

## Layers

### Application contracts

`src/lib/application/workspace-api.ts` defines UI-facing query and command types. Callers depend on this module instead of importing record, work-item, handoff-note, proposal, or invoice mutation adapters directly.

`WorkspaceApplicationApi` currently exposes:

- `engagements.list()`
- `engagements.create(command)`
- `engagements.update(command)`

- `followUps.list()`
- `followUps.complete(command)`

- `clientRecords.list()`
- `clientRecords.create(command)`
- `clientRecords.update(command)`

- `handoffNotes.list()`
- `handoffNotes.create(command)`

- `proposals.list()`
- `proposals.create(command)`
- `proposals.update(command)`
- `proposals.applyRecommendation(command)`

- `invoices.list()`
- `invoices.create(command)`
- `invoices.update(command)`
- `invoices.applyRecommendation(command)`

- `riskSignals.list()`
- `riskSignals.review(command)`
- `riskSignals.dismiss(command)`

- `operationsAgent.listRuns()`
- `operationsAgent.listSteps(runId)`
- `operationsAgent.startRun(command)`
- `operationsAgent.cancelRun(command)`

- `workItems.list()`
- `workItems.listDependencies()`
- `workItems.create(command)`
- `workItems.updateStatus(command)`
- `workItems.replaceDependencies(command)`

Each command returns the saved entity. Commands that can change deterministic workflow conditions also return the authoritative risk-reconciliation result from the same transaction.

### Persistence adapters

`src/lib/supabase/*` maps database rows and performs narrow Supabase calls. These modules are implementation details. They do not define product authorization or multi-step workflow behavior.

For client records, engagements, work items, handoff notes, proposals, and invoices, direct browser insert, update, and delete privileges are revoked. Reads remain protected by workspace RLS. New child writes carry an explicit engagement identifier. Legacy unscoped create, update, status, and recommendation functions are no longer executable by authenticated callers; engagement-scoped commands verify workspace, client, engagement, active state, idempotency replay context, and the current compatibility rollout guard before performing the operation.

### Atomic database commands

The implemented migrations expose authenticated `security definer` command functions for:

- engagement create/update;
- engagement-scoped follow-up completion;
- client-record create/update;
- Work Item-linked handoff-context creation;
- engagement-scoped Proposal create/update/recommendation;
- engagement-scoped Invoice create/update/recommendation;
- engagement-scoped Work Item create/status/dependency update.

The current function names are:

- `command_create_client_engagement`
- `command_update_client_engagement`

- `command_complete_engagement_follow_up`

- `command_create_client_workflow_record`
- `command_update_client_workflow_record`

- `command_create_work_item_handoff_context`

- `command_create_engagement_proposal_record`
- `command_update_engagement_proposal_record`
- `command_apply_engagement_proposal_workflow_recommendation`

- `command_create_engagement_invoice_record`
- `command_update_engagement_invoice_record`
- `command_apply_engagement_invoice_workflow_recommendation`

- `command_update_engagement_risk_signal_review`

- `command_start_operations_agent_run`
- `command_cancel_operations_agent_run`

- `command_create_engagement_workflow_task`
- `command_update_engagement_workflow_task_status`
- `command_replace_engagement_workflow_task_dependencies`

Each function explicitly verifies that `auth.uid()` owns the workspace, validates its input, and performs the write with its durable Activity entry before committing. Child operations verify that the engagement belongs to the supplied client and workspace. Commands that can change deterministic workflow conditions also reconcile risk signals and Workflow Health. Creating context for a Handoff Work Item does not change risk or health.

Proposal and Invoice create/update/recommendation operations and Work Item create/status operations are available for every Active engagement. Each operation carries explicit engagement context into deterministic reconciliation, so one job cannot change another job's workflow state, risk, or health.

These database functions are internal implementation details. Granting `authenticated` execution does not make them a supported external API.

The Operations Agent runtime also defines service-only functions for durable
worker claims, bounded state transitions, and atomic usage accounting:

- `agent_claim_operations_agent_run`
- `agent_transition_operations_agent_run`
- `agent_record_operations_agent_usage`

Authenticated browser callers cannot execute these service functions or write
runtime tables directly.

## Command Rules

### Authorization

- A signed-in actor is required.
- The actor must own the supplied workspace.
- The referenced client record, engagement, work item, handoff note, Proposal, or Invoice must belong to that workspace.
- Authorization is checked inside each privileged function because `security definer` functions do not rely on table RLS for their own statements.
- Operations Agent start and cancel commands require the workspace owner. A
  server worker must use the service role to claim or advance a run.

### Operations Agent runtime

- The first capability is `guided_client_intake`.
- Every browser-started run uses `suggest` mode. Approval-required and
  delegated modes are not enabled by the start command.
- One active run is allowed per workspace during the foundation rollout.
- Runs persist objective, initiating user, trigger, context, plan, state,
  bounded limits, failure details, and outcome.
- Steps and lifecycle events provide durable resume and audit history without
  exposing unrestricted workspace data to a model.
- Per-call usage records attribute provider, model, tokens, tool fees, retries,
  cost, and usable outcome to a workspace and run.
- Provider failures without a usable result have zero chargeable cost.
- Per-run model, tool, retry, duration, and cost ceilings are enforced at the
  database boundary. A workspace capability policy provides a kill switch,
  concurrency ceiling, and monthly cost ceiling.
- Runtime tables are read-only to authenticated callers. The service role can
  write runtime internals but does not receive permission to bypass existing
  business commands for consequential workspace changes.
- No model-provider integration or autonomous workflow write is introduced by
  this foundation migration.

### Validation

Validation runs at both application and database boundaries. Database constraints remain the final safeguard.

Engagement creation validates:

- the exact writable field set and parent Client Record;
- title, lifecycle stage, priority, estimated value, next action, follow-up date, owner, and summary statuses;
- an Active initial state and a protected 100-point initial Workflow Health;
- non-primary ownership so the compatibility engagement remains unique.

Engagement updates accept only a whitelisted partial payload. IDs, workspace ownership, client ownership, primary status, engagement state, Workflow Health, and timestamps are protected. Primary-engagement updates continue to mirror the compatibility Client Record fields until the guided engagement UI replaces that read model.

Follow-up completion validates the outcome, outcome note, owner, optimistic engagement version, and either a current-or-future next date or an explicit no-further-follow-up choice. It records an immutable completion event, updates the engagement schedule, mirrors primary compatibility fields, and reconciles risks in one transaction. The normal completion path for a generated overdue-follow-up risk is this command changing the source schedule; dismissal remains an explicit waiver for a signal that should not apply.

Client-record creation validates:

- required profile, workflow, ownership, and follow-up fields;
- email and date formats;
- lifecycle, status, priority, relationship-concern, and client-type values;
- nonnegative estimated value;
- the exact writable field set, excluding IDs, timestamps, and Workflow Health.

Client-record updates accept only a whitelisted partial payload. `workflowHealthScore`, IDs, timestamps, workspace ownership, and other protected fields cannot be supplied through the ordinary update command.

Work-item creation validates:

- request, workspace, and client identifiers;
- title and owner length;
- due date;
- work-item type;
- status;
- criticality;
- explicit engagement ownership and applicable phase;
- risk evaluation date.

The work-item status command additionally validates the expected current status and rejects no-op status changes.

Handoff-context creation validates the exact writable field set, client identifier, title, context, and receiving owner. IDs, timestamps, workspace ownership, and other protected fields cannot be supplied.

The command additionally verifies that the referenced Work Item belongs to the selected active engagement, is a Handoff item, and is currently active. It records the client, engagement, and Work Item identifiers on the context. Existing unlinked handoff notes remain readable as job history, but they do not satisfy a new Work Item's readiness requirement.

Proposal creation and update validate:

- the exact writable field set, excluding IDs, timestamps, workspace ownership, and recommendation markers;
- title, amount, currency, status, date, and decision-note requirements;
- the referenced Client Record and workspace relationship;
- an Active engagement that belongs to the referenced Client Record and workspace;
- the final merged Proposal state for partial updates.

Proposal recommendation application accepts only the workflow fields produced by the deterministic recommendation engine. Relationship concern cannot be changed by a Proposal recommendation. The command verifies the expected Proposal status and engagement version, updates the selected Active engagement, and reconciles only that engagement. A recommendation can advance lifecycle stage but cannot move the job backward. Client type and returning-client status remain relationship-level fields and are accepted only for the primary engagement. Primary engagement fields are mirrored to the compatibility Client Record; secondary engagement recommendations leave the primary job and Client Record summary unchanged.

Invoice creation and update validate:

- the exact writable field set, excluding IDs, timestamps, workspace ownership, dispute lifecycle timestamps, and recommendation markers;
- invoice number, amount, currency, description, status, payment link, and date requirements;
- optional accepted-Proposal ownership within the same job, with full-value, deposit, milestone, remaining-balance, or custom billing;
- proposal title and value snapshots so later Proposal edits cannot rewrite the Invoice's original billing context;
- serialized remaining-balance calculation that excludes voided and not-needed Invoices and prevents the proposal value from being invoiced twice;
- immutable billed value and currency for proposal-linked Invoices; corrections require voiding the Invoice and issuing a replacement;
- date-derived payment tracking: `Due soon` is valid from the due date through seven days before it, while `Overdue` is valid only after the due date; commands preserve the contractual due date and reject mismatched status/date combinations;
- dispute reason and resolution outcome requirements;
- the referenced Client Record and workspace relationship;
- an Active engagement that belongs to the referenced Client Record and workspace;
- the final merged Invoice state for partial updates.

Invoice recommendation application accepts only payment status, priority, next action, and next follow-up date. Relationship concern and lifecycle stage cannot be changed by an Invoice recommendation. The command verifies the expected Invoice status and selected engagement version, updates the selected Active engagement, and reconciles only that engagement. Automatic lifecycle progression remains forward-only. Primary engagement fields are mirrored to the compatibility Client Record; secondary engagement recommendations leave the primary job and Client Record summary unchanged.

Risk review accepts only two human decisions. Marking an Open signal as Reviewed acknowledges it while leaving the issue active and Workflow Health unchanged. Dismissing an Open or Reviewed signal requires a reason, closes that signal, recalculates only the selected engagement, and mirrors health to the compatibility Client Record only for the primary engagement. Generated signals cannot be manually marked Resolved; the source-specific workflow command must remove the underlying condition.

### Optimistic concurrency

Work-item status updates include `expectedStatus`. Client-record, engagement, follow-up completion, Proposal, Invoice, and risk-review updates include `expectedUpdatedAt`. The database refreshes those concurrency tokens with wall-clock time on every update, including multiple updates within one transaction. Proposal and Invoice recommendation application include the expected child-record status and selected engagement version. If another command changes an entity first, the command returns a conflict instead of overwriting newer data.

### Idempotency

Every consequential command carries a UUID `commandId`. Callers that retry the same logical command must reuse that ID.

`workspace_command_requests` stores a private request hash and completed response. A replay with the same ID and payload returns the original response without creating another business record or Activity entry. Reusing an ID with different input is rejected.

The idempotency ledger has RLS enabled and no direct `anon` or `authenticated` table privileges. Only the internal command functions use it.

### Activity and workflow health

Creating a client record writes exactly one `Record created` Activity entry. Updating it writes exactly one `Workflow status updated` entry using the user-facing note supplied by the typed UI operation. The action type, actor, workspace, record, and timestamp are command-owned.

Creating an additional engagement writes exactly one `Engagement created` entry. Updating it writes exactly one `Engagement updated` entry. Both entries carry the engagement identifier.

Completing a follow-up writes one immutable `engagement_follow_ups` row and one `Follow-up completed` Activity entry. It updates or clears the next schedule and runs engagement reconciliation in the same transaction. Replaying the command does not duplicate the outcome or Activity entry.

Creating active work writes exactly one `Work item added` Activity entry. Creating future work as `Planned` writes exactly one `Work item planned` entry. Activating it writes exactly one `Work item activated` entry. Planned work does not create risk or reduce Workflow Health.

Creating handoff context writes exactly one `Handoff context added` Activity entry in the same transaction. It does not recalculate Workflow Health because recording delegation context does not itself create or resolve a workflow issue.

Creating or updating a Proposal writes exactly one user-facing Proposal Activity entry and reconciles Proposal risks in the same transaction. Applying a Proposal recommendation writes exactly one `Proposal next step applied` entry when the recommendation is newly applied. An idempotent replay creates no duplicate Proposal, recommendation, risk, health, or Activity effects.

Creating or updating an Invoice writes exactly one user-facing Invoice Activity entry and reconciles payment risks in the same transaction. A proposal-linked Invoice records its billing basis and immutable Proposal title/value snapshots in that entry and row; ad-hoc Invoices remain supported. Dispute transitions record whether a dispute was opened or resolved while database triggers own its timestamps and resolution rules. Applying an Invoice recommendation writes exactly one `Invoice payment step applied` entry when the recommendation is newly applied. An idempotent replay creates no duplicate Invoice, dispute, recommendation, risk, health, or Activity effects.

Risk reconciliation is engagement-scoped and deterministic. Each engagement owns its signals and score; only the primary engagement mirrors its score to the compatibility Client Record summary. An unresolved prerequisite suppresses duplicate downstream Work Item risk, while the root issue remains actionable. Reconciliation may write `Workflow risk review updated` for the affected engagement when active issues or Workflow Health change.

Risk review writes one `Risk marked reviewed` or `Risk dismissed` Activity entry for the selected engagement. Review keeps the signal in the active health calculation. Dismissal removes it from that calculation without pretending the source condition was completed. An idempotent replay creates no duplicate status, health, or Activity effects.

### Sequential Work Item rules

Work Item phase and status are separate. A future-phase item must be `Planned`. It can become `Not started` or `In progress` only after the engagement reaches that phase, or it can be closed as `Not needed`. Active work cannot be moved backward to `Planned`.

When this rule is installed, existing nonterminal Work Items assigned to a future phase are moved to `Planned` once. Each conversion writes a `Work item planned` Activity entry; completed and not-needed history is left unchanged.

The current phase order is Lead, Proposal, Onboarding, Delivery, Approval, Payment, and Handoff. Dependencies explain execution order within or across those phases. When an unresolved prerequisite already blocks downstream work, reconciliation reports the prerequisite rather than charging Workflow Health for both rows.

The Work Items UI presents that order as a queue. Items are sorted by phase and then creation time, with the first ready item shown as Current work and later items shown as Up next or Waiting. New nonterminal work automatically depends on the latest unfinished item in the same engagement and same or an earlier phase. Engagements that had no manually configured dependencies are backfilled into the same sequence when this rule is installed.

Manual dependency editing is an advanced operation under Manage work order. Clearing an item's prerequisite set allows it to run in parallel. Existing manually configured engagement graphs are not overwritten by the automatic backfill.

A Work Item with an unresolved prerequisite cannot move to In progress or Complete. It may remain Planned, Not started, Waiting, or Blocked, or be closed as Not needed. Work Item creation is serialized per engagement so concurrent commands cannot choose an inconsistent predecessor.

Replacing a Work Item prerequisite set is one atomic command. Prerequisites must belong to the same engagement and be in the same or an earlier phase. Self-references, duplicate identifiers, dependency cycles, future-phase prerequisites, and stale task versions are rejected. A changed set writes one `Work item dependencies updated` Activity entry and reconciles only the selected engagement; an unchanged set and an idempotent replay create no duplicate Activity effect.

### Automatic engagement stage progression

Engagement lifecycle stage is forward-only when it is derived from durable business milestones. Sending a Proposal advances an earlier engagement to Proposal sent, and accepting one advances it to Won client. Active Onboarding, Delivery, Approval, and Payment Work Items advance the engagement to the matching operational stage. Completing the current phase can also advance the engagement when the next Planned Work Item is ready and has no unresolved prerequisite.

An issued Invoice advances the engagement to Payment follow-up only after Onboarding, Delivery, and Approval work is complete or not needed. This prevents a deposit or early Invoice from hiding unfinished delivery. An engagement advances to Completed and closes only when it has completion evidence, every Work Item is Complete or Not needed, and every Invoice has a final Paid, Not needed, or Voided decision. A completed Work Item without a billing decision does not silently close the engagement.

Automatic reconciliation never moves a stage backward and never marks an engagement Lost or inactive. Rejected or expired Proposals remain explicit human decisions. Manual lead qualification and exceptional corrections continue through the engagement update command.

Each automatic transition writes one `Workflow stage advanced` Activity entry. The primary engagement mirrors its derived stage to the compatibility Client Record; additional engagements remain isolated. Existing Active engagements are reconciled once when the rule is installed, and only forward changes are applied.

### Errors and diagnostics

The application maps database failures to stable categories:

- `authentication_required`
- `invalid_request`
- `not_found`
- `conflict`
- `invalid_response`
- `operation_failed`

User-facing errors include the command or query request ID. Console diagnostics include the same ID and the underlying Supabase error. Secrets and service-role credentials are never returned or logged.

## Current Operation Inventory

| Area | Reads | Ordinary writes | Privileged or atomic writes | Current boundary status |
| --- | --- | --- | --- | --- |
| Workspace | owned workspace lookup | create workspace | none | Persistence adapter; retain RLS |
| Engagements | workspace engagements | none directly | create/update + automatic milestone progression + Activity | Implemented; forward-only stage derivation and primary compatibility bridge active |
| Follow-ups | workspace completion history | none directly | complete + schedule update + reconciliation + Activity | Implemented for all Active engagements |
| Client records | workspace records | none directly | create/update + reconciliation + Activity | Implemented in second slice |
| Work items | workspace work items and dependencies | none directly | engagement-scoped create/status/dependency update + reconciliation + Activity | Sequential queue default; parallel override, Planned, stage, dependency, and cycle guards implemented |
| Handoff context | workspace notes linked to Work Items | none directly | Work Item-linked create + Activity | New context requires an active Handoff Work Item; unlinked legacy notes remain readable |
| Proposals | workspace/client proposals | none directly | engagement-scoped create/update/recommendation + reconciliation + Activity | Create, update, and recommendation application implemented for all Active engagements |
| Invoices | workspace/client invoices | none directly | engagement-scoped create/update/recommendation + optional accepted-Proposal billing + reconciliation + Activity | Implemented for all Active engagements |
| Risk signals | workspace risk history | none directly | engagement-scoped review/dismiss + isolated health + Activity | Implemented; source-driven resolution remains separate |
| Activity | workspace history | direct inserts from legacy flows | command-owned audit writes | Client-record, work-item, handoff-context, Proposal, Invoice, and risk-review audit implemented; other flows pending |

## Assistant Eligibility

The engagement, follow-up, client-record, work-item, handoff-context, Proposal, Invoice, and risk-review commands are structurally suitable for a future protected assistant tool, but they are not exposed to an assistant yet. Assistant enablement also requires:

- explicit per-tool policy and plan entitlements;
- user confirmation for consequential changes;
- scoped workspace and client context;
- rate and spend controls;
- prompt-injection-resistant argument construction;
- tool invocation audit linked to the command request ID.

The assistant should use the same application command contract as the manual UI so that both paths produce the same validation, health updates, and Activity history.

## Next Slices

1. Move remaining legacy Activity writes behind command-owned audit effects.
2. Add a protected server tool layer only after the manual command surface is complete and tested.
