# Internal Application API Boundary

Status: Active technical contract

Implemented slices: Work items and client records

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

`src/lib/application/workspace-api.ts` defines UI-facing query and command types. Callers depend on this module instead of importing record or work-item mutation adapters directly.

`WorkspaceApplicationApi` currently exposes:

- `clientRecords.list()`
- `clientRecords.create(command)`
- `clientRecords.update(command)`

- `workItems.list()`
- `workItems.create(command)`
- `workItems.updateStatus(command)`

Each command returns the saved entity and the authoritative workflow-risk reconciliation result from the same transaction.

### Persistence adapters

`src/lib/supabase/*` maps database rows and performs narrow Supabase calls. These modules are implementation details. They do not define product authorization or multi-step workflow behavior.

For client records and work items, direct browser insert, update, and delete privileges are revoked. Reads remain protected by existing workspace RLS. Internal recommendation functions continue to perform their scoped record updates as privileged database transactions.

### Atomic database commands

The implemented migrations add four authenticated `security definer` functions:

- `command_create_client_workflow_record`
- `command_update_client_workflow_record`

- `command_create_workflow_task`
- `command_update_workflow_task_status`

Each function explicitly verifies that `auth.uid()` owns the workspace, validates its input, locks the affected record when updating, performs the change, reconciles risk signals and Workflow Health, and writes the durable Activity entry before committing.

These database functions are internal implementation details. Granting `authenticated` execution does not make them a supported external API.

## Command Rules

### Authorization

- A signed-in actor is required.
- The actor must own the supplied workspace.
- The client record or work item must belong to that workspace.
- Authorization is checked inside each privileged function because `security definer` functions do not rely on table RLS for their own statements.

### Validation

Validation runs at both application and database boundaries. Database constraints remain the final safeguard.

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
- risk evaluation date.

The work-item status command additionally validates the expected current status and rejects no-op status changes.

### Optimistic concurrency

Work-item status updates include `expectedStatus`. Client-record updates include `expectedUpdatedAt`. The database refreshes the Client Record token with wall-clock time on every update, including multiple updates within one transaction. If another command changes the entity first, the command returns a conflict instead of overwriting newer data.

### Idempotency

Every consequential command carries a UUID `commandId`. Callers that retry the same logical command must reuse that ID.

`workspace_command_requests` stores a private request hash and completed response. A replay with the same ID and payload returns the original response without creating another work item or Activity entry. Reusing an ID with different input is rejected.

The idempotency ledger has RLS enabled and no direct `anon` or `authenticated` table privileges. Only the internal command functions use it.

### Activity and workflow health

Creating a client record writes exactly one `Record created` Activity entry. Updating it writes exactly one `Workflow status updated` entry using the user-facing note supplied by the typed UI operation. The action type, actor, workspace, record, and timestamp are command-owned.

Creating a work item writes exactly one `Work item added` Activity entry. Updating a status writes exactly one `Work item status updated` entry.

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
| Client records | workspace records | none directly | create/update + reconciliation + Activity | Implemented in second slice |
| Work items | workspace work items | none directly | create/status update + reconciliation + Activity | Implemented in first slice |
| Handoff notes | workspace notes | create note + Activity | none yet | Pending application command |
| Proposals | workspace/client proposals | create/update + reconciliation + Activity | apply recommendation transaction | Existing RPC retained; application facade pending |
| Invoices | workspace/client invoices | create/update + reconciliation + Activity | apply recommendation transaction | Existing RPC retained; application facade pending |
| Risk signals | workspace risk history | review status | reconciliation | Existing guarded RPC retained; application facade pending |
| Activity | workspace history | direct inserts from legacy flows | command-owned audit writes | Client-record and work-item audit implemented; other flows pending |

## Assistant Eligibility

The client-record and work-item commands are structurally suitable for a future protected assistant tool, but they are not exposed to an assistant yet. Assistant enablement also requires:

- explicit per-tool policy and plan entitlements;
- user confirmation for consequential changes;
- scoped workspace and client context;
- rate and spend controls;
- prompt-injection-resistant argument construction;
- tool invocation audit linked to the command request ID.

The assistant should use the same application command contract as the manual UI so that both paths produce the same validation, health updates, and Activity history.

## Next Slices

1. Move proposal and invoice create/update flows behind the application facade; retain their existing atomic recommendation RPCs.
2. Move handoff-note creation and audit into one command.
3. Move risk review status changes behind a command that performs reconciliation in the same transaction.
4. Add a protected server tool layer only after the manual command surface is complete and tested.
