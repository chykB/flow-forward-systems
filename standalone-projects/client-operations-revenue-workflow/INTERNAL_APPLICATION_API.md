# Internal Application API Boundary

Status: Active technical contract

Implemented slices: Work items, client records, handoff notes, proposals, and engagement ownership

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

`src/lib/application/workspace-api.ts` defines UI-facing query and command types. Callers depend on this module instead of importing record, work-item, handoff-note, or proposal mutation adapters directly.

`WorkspaceApplicationApi` currently exposes:

- `engagements.list()`
- `engagements.create(command)`
- `engagements.update(command)`

- `clientRecords.list()`
- `clientRecords.create(command)`
- `clientRecords.update(command)`

- `handoffNotes.list()`
- `handoffNotes.create(command)`

- `proposals.list()`
- `proposals.create(command)`
- `proposals.update(command)`
- `proposals.applyRecommendation(command)`

- `workItems.list()`
- `workItems.create(command)`
- `workItems.updateStatus(command)`

Each command returns the saved entity. Commands that can change deterministic workflow conditions also return the authoritative risk-reconciliation result from the same transaction.

### Persistence adapters

`src/lib/supabase/*` maps database rows and performs narrow Supabase calls. These modules are implementation details. They do not define product authorization or multi-step workflow behavior.

For client records, engagements, work items, handoff notes, and proposals, direct browser insert, update, and delete privileges are revoked. Reads remain protected by workspace RLS. New child writes carry an explicit engagement identifier. Legacy unscoped create and status functions are no longer executable by authenticated callers; engagement-scoped wrappers verify workspace, client, engagement, active state, idempotency replay context, and the current compatibility rollout guard before invoking the existing atomic operation.

### Atomic database commands

The implemented migrations expose authenticated `security definer` command functions for:

- engagement create/update;
- client-record create/update;
- engagement-scoped handoff-note creation;
- engagement-scoped Proposal create/update/recommendation;
- engagement-scoped Work Item create/status update.

The current function names are:

- `command_create_client_engagement`
- `command_update_client_engagement`

- `command_create_client_workflow_record`
- `command_update_client_workflow_record`

- `command_create_engagement_handoff_note`

- `command_create_engagement_proposal_record`
- `command_update_engagement_proposal_record`
- `command_apply_engagement_proposal_workflow_recommendation`

- `command_create_engagement_workflow_task`
- `command_update_engagement_workflow_task_status`

Each function explicitly verifies that `auth.uid()` owns the workspace, validates its input, and performs the write with its durable Activity entry before committing. Child operations verify that the engagement belongs to the supplied client and workspace. Commands that can change deterministic workflow conditions also reconcile risk signals and Workflow Health. Creating a context-only handoff note does not change risk or health.

During the compatibility rollout, monitored Proposal and Work Item mutations are restricted to the primary engagement. This prevents the client-scoped risk reconciler from combining unrelated jobs before engagement-scoped reconciliation is installed. Additional engagements can already be created, updated, read, and receive handoff context. Their monitored child operations become available in the stage-aware reconciliation slice.

These database functions are internal implementation details. Granting `authenticated` execution does not make them a supported external API.

## Command Rules

### Authorization

- A signed-in actor is required.
- The actor must own the supplied workspace.
- The referenced client record, work item, handoff note, or Proposal must belong to that workspace.
- Authorization is checked inside each privileged function because `security definer` functions do not rely on table RLS for their own statements.

### Validation

Validation runs at both application and database boundaries. Database constraints remain the final safeguard.

Engagement creation validates:

- the exact writable field set and parent Client Record;
- title, lifecycle stage, priority, estimated value, next action, follow-up date, owner, and summary statuses;
- an Active initial state and a protected 100-point initial Workflow Health;
- non-primary ownership so the compatibility engagement remains unique.

Engagement updates accept only a whitelisted partial payload. IDs, workspace ownership, client ownership, primary status, engagement state, Workflow Health, and timestamps are protected. Primary-engagement updates continue to mirror the compatibility Client Record fields until the guided engagement UI replaces that read model.

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

Handoff-note creation validates the exact writable field set, client identifier, title, context, and owner. IDs, timestamps, workspace ownership, and other protected fields cannot be supplied.

The command additionally verifies engagement ownership and records both client and engagement identifiers on the note and Activity entry.

Proposal creation and update validate:

- the exact writable field set, excluding IDs, timestamps, workspace ownership, and recommendation markers;
- title, amount, currency, status, date, and decision-note requirements;
- the referenced Client Record and workspace relationship;
- the referenced primary compatibility engagement during this rollout slice;
- the final merged Proposal state for partial updates.

Proposal recommendation application accepts only the workflow fields produced by the deterministic recommendation engine. Relationship concern cannot be changed by a Proposal recommendation. The command verifies the expected Proposal status before applying the recommendation.

### Optimistic concurrency

Work-item status updates include `expectedStatus`. Client-record, engagement, and Proposal updates include `expectedUpdatedAt`. The database refreshes those concurrency tokens with wall-clock time on every update, including multiple updates within one transaction. Proposal recommendation application includes `expectedStatus`. If another command changes an entity first, the command returns a conflict instead of overwriting newer data.

### Idempotency

Every consequential command carries a UUID `commandId`. Callers that retry the same logical command must reuse that ID.

`workspace_command_requests` stores a private request hash and completed response. A replay with the same ID and payload returns the original response without creating another business record or Activity entry. Reusing an ID with different input is rejected.

The idempotency ledger has RLS enabled and no direct `anon` or `authenticated` table privileges. Only the internal command functions use it.

### Activity and workflow health

Creating a client record writes exactly one `Record created` Activity entry. Updating it writes exactly one `Workflow status updated` entry using the user-facing note supplied by the typed UI operation. The action type, actor, workspace, record, and timestamp are command-owned.

Creating an additional engagement writes exactly one `Engagement created` entry. Updating it writes exactly one `Engagement updated` entry. Both entries carry the engagement identifier.

Creating a work item writes exactly one `Work item added` Activity entry. Updating a status writes exactly one `Work item status updated` entry.

Creating a handoff note writes exactly one `Handoff note added` Activity entry in the same transaction. It does not recalculate Workflow Health because recording delegation context does not itself create or resolve a workflow issue.

Creating or updating a Proposal writes exactly one user-facing Proposal Activity entry and reconciles Proposal risks in the same transaction. Applying a Proposal recommendation writes exactly one `Proposal next step applied` entry when the recommendation is newly applied. An idempotent replay creates no duplicate Proposal, recommendation, risk, health, or Activity effects.

Risk reconciliation remains deterministic and may also write `Workflow risk review updated` when active issues or Workflow Health change. The task, risk state, score, and Activity records commit or roll back together.

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
| Engagements | workspace engagements | none directly | create/update + Activity | Implemented; primary compatibility bridge active |
| Client records | workspace records | none directly | create/update + reconciliation + Activity | Implemented in second slice |
| Work items | workspace work items | none directly | engagement-scoped create/status update + reconciliation + Activity | Primary engagement enabled; additional engagement monitoring pending |
| Handoff notes | workspace notes | none directly | engagement-scoped create + Activity | Implemented for all Active engagements |
| Proposals | workspace/client proposals | none directly | engagement-scoped create/update/recommendation + reconciliation + Activity | Primary engagement enabled; additional engagement monitoring pending |
| Invoices | workspace/client invoices | engagement-owned create/update + reconciliation + Activity | apply recommendation transaction | Explicit primary engagement stored; command facade pending |
| Risk signals | workspace risk history | review status | reconciliation | Existing guarded RPC retained; application facade pending |
| Activity | workspace history | direct inserts from legacy flows | command-owned audit writes | Client-record, work-item, handoff-note, and Proposal audit implemented; other flows pending |

## Assistant Eligibility

The engagement, client-record, work-item, handoff-note, and Proposal commands are structurally suitable for a future protected assistant tool, but they are not exposed to an assistant yet. Assistant enablement also requires:

- explicit per-tool policy and plan entitlements;
- user confirmation for consequential changes;
- scoped workspace and client context;
- rate and spend controls;
- prompt-injection-resistant argument construction;
- tool invocation audit linked to the command request ID.

The assistant should use the same application command contract as the manual UI so that both paths produce the same validation, health updates, and Activity history.

## Next Slices

1. Add engagement selection and creation to Client Records while keeping the primary compatibility engagement as the default.
2. Add Planned Work Items and explicit early activation.
3. Replace client-scoped risk reconciliation with engagement- and dependency-aware reconciliation, then remove the primary-only monitored-write guard.
4. Move Invoice create/update/recommendation flows behind the application facade.
5. Move risk review status changes behind an engagement-scoped command.
6. Add a protected server tool layer only after the manual command surface is complete and tested.
