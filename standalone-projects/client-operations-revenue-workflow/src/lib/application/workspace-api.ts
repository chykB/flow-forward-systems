import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientWorkflowRecord,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import { getLocalDateKey } from "@/lib/date-key";
import {
  mapRiskSignalReconciliationResult,
  type RiskSignalReconciliationResult,
} from "@/lib/supabase/risk-signals";
import {
  getClientWorkflowRecords,
  mapClientWorkflowRecordRow,
  type ClientWorkflowRecordRow,
} from "@/lib/supabase/client-workflow-records";
import {
  getWorkspaceWorkflowTasks,
  mapWorkflowTaskRow,
  type WorkflowTaskRow,
} from "@/lib/supabase/workflow-tasks";

export type NewWorkflowTask = Omit<
  WorkflowTask,
  "id" | "createdAt" | "updatedAt"
>;

export type WorkflowTaskStatusUpdate = {
  status: WorkflowTask["status"];
};

export type NewClientWorkflowRecord = Omit<
  ClientWorkflowRecord,
  "id" | "createdAt" | "updatedAt" | "workflowHealthScore"
>;

export type ClientWorkflowRecordUpdates = Partial<
  NewClientWorkflowRecord
>;

export type WorkspaceApiErrorCode =
  | "authentication_required"
  | "conflict"
  | "invalid_request"
  | "invalid_response"
  | "not_found"
  | "operation_failed";

export class WorkspaceApiError extends Error {
  readonly code: WorkspaceApiErrorCode;
  readonly requestId: string;

  constructor(
    code: WorkspaceApiErrorCode,
    message: string,
    requestId: string,
    options?: ErrorOptions,
  ) {
    super(`${message} Reference: ${requestId}.`, options);
    this.name = "WorkspaceApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

export type WorkItemCommandResult = {
  requestId: string;
  workItem: WorkflowTask;
  reconciliation: RiskSignalReconciliationResult;
};

export type ClientRecordCommandResult = {
  requestId: string;
  clientRecord: ClientWorkflowRecord;
  reconciliation: RiskSignalReconciliationResult;
};

export type CreateClientRecordCommand = {
  commandId: string;
  record: NewClientWorkflowRecord;
  evaluationDate?: Date;
};

export type UpdateClientRecordCommand = {
  commandId: string;
  clientRecordId: string;
  expectedUpdatedAt: string;
  updates: ClientWorkflowRecordUpdates;
  activityNote: string;
  evaluationDate?: Date;
};

export type CreateWorkItemCommand = {
  commandId: string;
  task: NewWorkflowTask;
  evaluationDate?: Date;
};

export type UpdateWorkItemStatusCommand = {
  commandId: string;
  workItemId: string;
  expectedStatus: WorkflowTask["status"];
  update: WorkflowTaskStatusUpdate;
  evaluationDate?: Date;
};

export type WorkspaceApplicationApi = {
  clientRecords: {
    list: () => Promise<ClientWorkflowRecord[]>;
    create: (
      command: CreateClientRecordCommand,
    ) => Promise<ClientRecordCommandResult>;
    update: (
      command: UpdateClientRecordCommand,
    ) => Promise<ClientRecordCommandResult>;
  };
  workItems: {
    list: () => Promise<WorkflowTask[]>;
    create: (
      command: CreateWorkItemCommand,
    ) => Promise<WorkItemCommandResult>;
    updateStatus: (
      command: UpdateWorkItemStatusCommand,
    ) => Promise<WorkItemCommandResult>;
  };
};

type SupabaseOperationError = {
  code?: string;
  message?: string;
};

type WorkItemCommandRpcResult = {
  requestId: string;
  workItem: WorkflowTaskRow;
  reconciliation: unknown;
};

type ClientRecordCommandRpcResult = {
  requestId: string;
  clientRecord: ClientWorkflowRecordRow;
  reconciliation: unknown;
};

const workflowStatuses = new Set<WorkflowTask["status"]>([
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Complete",
  "Not needed",
]);
const workflowTaskTypes = new Set<WorkflowTask["type"]>([
  "Follow-up",
  "Onboarding",
  "Delivery",
  "Approval",
  "Payment",
  "Handoff",
]);
const taskCriticalities = new Set<
  WorkflowTask["criticality"]
>([
  "Critical",
  "High",
  "Medium",
  "Low",
]);
const lifecycleStages = new Set<
  ClientWorkflowRecord["lifecycleStage"]
>([
  "New lead",
  "Qualified lead",
  "Follow-up needed",
  "Discovery or call booked",
  "Proposal sent",
  "Won client",
  "Onboarding",
  "In delivery",
  "Waiting for approval",
  "Payment follow-up",
  "Completed",
  "Lost or inactive",
]);
const priorities = new Set<ClientWorkflowRecord["priority"]>([
  "High",
  "Medium",
  "Low",
]);
const relationshipConcerns = new Set<
  ClientWorkflowRecord["riskLevel"]
>(["High", "Medium", "Low"]);
const clientTypes = new Set<ClientWorkflowRecord["clientType"]>([
  "Lead",
  "New client",
  "Active client",
  "Returning client",
  "Past client",
]);
const returningClientStatuses = new Set<
  ClientWorkflowRecord["returningClientStatus"]
>([
  "Not returning",
  "Potential reactivation",
  "Repeat project opportunity",
  "Reactivated",
  "Dormant",
]);
const mutableClientRecordFields = new Set<
  keyof NewClientWorkflowRecord
>([
  "name",
  "email",
  "phone",
  "businessName",
  "source",
  "interest",
  "message",
  "lifecycleStage",
  "priority",
  "riskLevel",
  "nextAction",
  "nextFollowUpAt",
  "assignedTo",
  "onboardingStatus",
  "deliveryStatus",
  "approvalStatus",
  "paymentStatus",
  "clientType",
  "returningClientStatus",
  "lastProjectDate",
  "estimatedValue",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createOperationRequestId() {
  return globalThis.crypto.randomUUID();
}

function assertUuid(value: string, label: string, requestId: string) {
  if (!uuidPattern.test(value)) {
    throw new WorkspaceApiError(
      "invalid_request",
      `${label} is invalid.`,
      requestId,
    );
  }
}

function assertRequestId(value: string) {
  if (!uuidPattern.test(value)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The request identifier is invalid.",
      createOperationRequestId(),
    );
  }
}

function mapOperationError(
  error: unknown,
  requestId: string,
  fallbackMessage: string,
) {
  if (error instanceof WorkspaceApiError) {
    return error;
  }

  const operationError = error as SupabaseOperationError;
  const code = operationError?.code;

  if (code === "42501") {
    return new WorkspaceApiError(
      "authentication_required",
      "Sign in again before changing this workspace.",
      requestId,
      { cause: error },
    );
  }

  if (code === "P0002") {
    return new WorkspaceApiError(
      "not_found",
      "The requested client record or work item is no longer available.",
      requestId,
      { cause: error },
    );
  }

  if (code === "PT409") {
    return new WorkspaceApiError(
      "conflict",
      "This item changed elsewhere. Refresh before trying again.",
      requestId,
      { cause: error },
    );
  }

  if (
    code === "22007" ||
    code === "22008" ||
    code === "22023" ||
    code === "22P02" ||
    code === "23514"
  ) {
    return new WorkspaceApiError(
      "invalid_request",
      operationError.message || "Check the details and try again.",
      requestId,
      { cause: error },
    );
  }

  return new WorkspaceApiError(
    "operation_failed",
    fallbackMessage,
    requestId,
    { cause: error },
  );
}

function mapCommandResult(
  data: unknown,
  expectedRequestId: string,
): WorkItemCommandResult {
  const result = data as WorkItemCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.workItem ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The work item operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    workItem: mapWorkflowTaskRow(result.workItem),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapClientRecordCommandResult(
  data: unknown,
  expectedRequestId: string,
): ClientRecordCommandResult {
  const result = data as ClientRecordCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.clientRecord ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The client record operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    clientRecord: mapClientWorkflowRecordRow(
      result.clientRecord,
    ),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function assertMinimumText(
  value: string,
  minimumLength: number,
  message: string,
  requestId: string,
) {
  if (value.trim().length < minimumLength) {
    throw new WorkspaceApiError(
      "invalid_request",
      message,
      requestId,
    );
  }
}

function validateClientRecordValues(
  record: NewClientWorkflowRecord,
  requestId: string,
) {
  assertMinimumText(
    record.name,
    2,
    "Enter the lead or client name.",
    requestId,
  );
  assertMinimumText(
    record.businessName,
    2,
    "Enter the business name.",
    requestId,
  );
  assertMinimumText(
    record.source,
    2,
    "Enter where this lead or client came from.",
    requestId,
  );
  assertMinimumText(
    record.interest,
    2,
    "Enter what they are interested in.",
    requestId,
  );
  assertMinimumText(
    record.message,
    10,
    "Add a short context note.",
    requestId,
  );
  assertMinimumText(
    record.nextAction,
    5,
    "Enter the next action.",
    requestId,
  );
  assertMinimumText(
    record.assignedTo,
    2,
    "Enter the owner.",
    requestId,
  );

  if (record.email.trim() && !emailPattern.test(record.email.trim())) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid email address.",
      requestId,
    );
  }

  if (!dateKeyPattern.test(record.nextFollowUpAt)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid follow-up date.",
      requestId,
    );
  }

  if (
    record.lastProjectDate &&
    !dateKeyPattern.test(record.lastProjectDate)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid last project date.",
      requestId,
    );
  }

  if (!lifecycleStages.has(record.lifecycleStage)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid workflow stage.",
      requestId,
    );
  }

  if (!priorities.has(record.priority)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid priority.",
      requestId,
    );
  }

  if (!relationshipConcerns.has(record.riskLevel)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid relationship concern.",
      requestId,
    );
  }

  if (!clientTypes.has(record.clientType)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid lead or client status.",
      requestId,
    );
  }

  if (!returningClientStatuses.has(record.returningClientStatus)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid returning client status.",
      requestId,
    );
  }

  if (
    !workflowStatuses.has(record.onboardingStatus) ||
    !workflowStatuses.has(record.deliveryStatus) ||
    !workflowStatuses.has(record.approvalStatus) ||
    !workflowStatuses.has(record.paymentStatus)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose valid workflow statuses.",
      requestId,
    );
  }

  if (
    !Number.isFinite(record.estimatedValue) ||
    record.estimatedValue < 0
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid estimated value.",
      requestId,
    );
  }
}

function validateClientRecordUpdates(
  command: UpdateClientRecordCommand,
) {
  const {
    activityNote,
    clientRecordId,
    commandId,
    expectedUpdatedAt,
    updates,
  } = command;

  assertRequestId(commandId);
  assertUuid(
    clientRecordId,
    "The client record identifier",
    commandId,
  );

  if (
    !timestampPattern.test(expectedUpdatedAt) ||
    Number.isNaN(Date.parse(expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected record version is invalid.",
      commandId,
    );
  }

  const updateFields = Object.keys(updates) as Array<
    keyof NewClientWorkflowRecord
  >;

  if (updateFields.length === 0) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose at least one client record change.",
      commandId,
    );
  }

  if (
    updateFields.some(
      (field) => !mutableClientRecordFields.has(field),
    )
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The client record change contains a protected field.",
      commandId,
    );
  }

  const candidate = {
    name: updates.name ?? "Valid name",
    email: updates.email ?? "",
    phone: updates.phone ?? "",
    businessName: updates.businessName ?? "Valid business",
    source: updates.source ?? "Valid source",
    interest: updates.interest ?? "Valid interest",
    message: updates.message ?? "Valid context note",
    lifecycleStage: updates.lifecycleStage ?? "New lead",
    priority: updates.priority ?? "Medium",
    riskLevel: updates.riskLevel ?? "Low",
    nextAction: updates.nextAction ?? "Valid next action",
    nextFollowUpAt: updates.nextFollowUpAt ?? "2000-01-01",
    assignedTo: updates.assignedTo ?? "Owner",
    onboardingStatus: updates.onboardingStatus ?? "Not started",
    deliveryStatus: updates.deliveryStatus ?? "Not started",
    approvalStatus: updates.approvalStatus ?? "Not needed",
    paymentStatus: updates.paymentStatus ?? "Not needed",
    clientType: updates.clientType ?? "Lead",
    returningClientStatus:
      updates.returningClientStatus ?? "Not returning",
    lastProjectDate: updates.lastProjectDate ?? "",
    estimatedValue: updates.estimatedValue ?? 0,
  } satisfies NewClientWorkflowRecord;

  validateClientRecordValues(candidate, commandId);

  if (
    activityNote.trim().length < 5 ||
    activityNote.trim().length > 1000
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Describe the client record change in normal language.",
      commandId,
    );
  }
}

function normalizeClientRecordUpdates(
  updates: ClientWorkflowRecordUpdates,
) {
  return Object.fromEntries(
    Object.entries(updates).map(([field, value]) => [
      field,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as ClientWorkflowRecordUpdates;
}

function validateCreateClientRecordCommand(
  workspaceId: string,
  command: CreateClientRecordCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  validateClientRecordValues(
    command.record,
    command.commandId,
  );
}

function validateUpdateClientRecordCommand(
  workspaceId: string,
  command: UpdateClientRecordCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  validateClientRecordUpdates(command);
}

function validateCreateCommand(
  workspaceId: string,
  command: CreateWorkItemCommand,
) {
  const { commandId, task } = command;

  assertRequestId(commandId);
  assertUuid(workspaceId, "The workspace identifier", commandId);
  assertUuid(
    task.clientWorkflowRecordId,
    "The client record identifier",
    commandId,
  );

  if (task.title.trim().length < 3) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a work item title.",
      commandId,
    );
  }

  if (task.owner.trim().length < 2) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter who owns this work item.",
      commandId,
    );
  }

  if (!task.dueDate) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a due date.",
      commandId,
    );
  }

  if (!dateKeyPattern.test(task.dueDate)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid due date.",
      commandId,
    );
  }

  if (!workflowTaskTypes.has(task.type)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid work item type.",
      commandId,
    );
  }

  if (!workflowStatuses.has(task.status)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid work item status.",
      commandId,
    );
  }

  if (!taskCriticalities.has(task.criticality)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid work item criticality.",
      commandId,
    );
  }
}

function validateStatusCommand(
  workspaceId: string,
  command: UpdateWorkItemStatusCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.workItemId,
    "The work item identifier",
    command.commandId,
  );

  if (
    !workflowStatuses.has(command.expectedStatus) ||
    !workflowStatuses.has(command.update.status)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid work item status.",
      command.commandId,
    );
  }

  if (command.expectedStatus === command.update.status) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a different work item status.",
      command.commandId,
    );
  }
}

export function createWorkspaceApplicationApi(
  supabase: SupabaseClient,
  workspaceId: string,
): WorkspaceApplicationApi {
  return {
    clientRecords: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getClientWorkflowRecords(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API client record query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Client records could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateClientRecordCommand(
          workspaceId,
          command,
        );

        const { commandId, record } = command;

        try {
          const { data, error } = await supabase.rpc(
            "command_create_client_workflow_record",
            {
              p_workspace_id: workspaceId,
              p_record: normalizeClientRecordUpdates(record),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapClientRecordCommandResult(
            data,
            commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API client record create failed",
            { requestId: commandId, error },
          );
          throw mapOperationError(
            error,
            commandId,
            "The client record could not be saved.",
          );
        }
      },

      async update(command) {
        validateUpdateClientRecordCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_update_client_workflow_record",
            {
              p_workspace_id: workspaceId,
              p_client_workflow_record_id:
                command.clientRecordId,
              p_expected_updated_at:
                command.expectedUpdatedAt,
              p_updates: normalizeClientRecordUpdates(
                command.updates,
              ),
              p_activity_note: command.activityNote.trim(),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapClientRecordCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API client record update failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The client record could not be updated.",
          );
        }
      },
    },
    workItems: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceWorkflowTasks(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API work item query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Work items could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateCommand(workspaceId, command);

        const { commandId, task } = command;

        try {
          const { data, error } = await supabase.rpc(
            "command_create_workflow_task",
            {
              p_workspace_id: workspaceId,
              p_client_workflow_record_id:
                task.clientWorkflowRecordId,
              p_title: task.title.trim(),
              p_type: task.type,
              p_owner: task.owner.trim(),
              p_due_date: task.dueDate,
              p_status: task.status,
              p_criticality: task.criticality,
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapCommandResult(data, commandId);
        } catch (error) {
          console.error(
            "Workspace API work item create failed",
            { requestId: commandId, error },
          );
          throw mapOperationError(
            error,
            commandId,
            "The work item could not be saved.",
          );
        }
      },

      async updateStatus(command) {
        validateStatusCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_update_workflow_task_status",
            {
              p_workspace_id: workspaceId,
              p_workflow_task_id: command.workItemId,
              p_expected_status: command.expectedStatus,
              p_status: command.update.status,
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapCommandResult(data, command.commandId);
        } catch (error) {
          console.error(
            "Workspace API work item status command failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The work item status could not be saved.",
          );
        }
      },
    },
  };
}
