import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkflowTask,
} from "@/lib/client-workflow-types";
import { getLocalDateKey } from "@/lib/date-key";
import {
  mapRiskSignalReconciliationResult,
  type RiskSignalReconciliationResult,
} from "@/lib/supabase/risk-signals";
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
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

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
      "Sign in again before changing this work item.",
      requestId,
      { cause: error },
    );
  }

  if (code === "P0002") {
    return new WorkspaceApiError(
      "not_found",
      "The work item or client record is no longer available.",
      requestId,
      { cause: error },
    );
  }

  if (code === "PT409") {
    return new WorkspaceApiError(
      "conflict",
      "This work item changed elsewhere. Refresh before trying again.",
      requestId,
      { cause: error },
    );
  }

  if (code === "22023" || code === "23514") {
    return new WorkspaceApiError(
      "invalid_request",
      operationError.message || "Check the work item details and try again.",
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
