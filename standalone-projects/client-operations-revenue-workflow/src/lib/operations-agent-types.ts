export type OperationsAgentRunState =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "partially_completed";

export type OperationsAgentRunMode =
  | "suggest"
  | "approval_required"
  | "delegated";

export type OperationsAgentTrigger =
  | "user"
  | "durable_event"
  | "scheduled";

export type OperationsAgentCapability =
  | "guided_client_intake";

export type OperationsAgentStepKind =
  | "model"
  | "tool"
  | "approval"
  | "system";

export type OperationsAgentRun = {
  id: string;
  workspaceId: string;
  initiatedBy: string;
  capability: OperationsAgentCapability;
  mode: OperationsAgentRunMode;
  triggerType: OperationsAgentTrigger;
  objective: string;
  context: Record<string, unknown>;
  plan: unknown[];
  state: OperationsAgentRunState;
  currentStepIndex: number;
  modelCalls: number;
  toolCalls: number;
  retryCount: number;
  estimatedCostUsd: number;
  chargeableCostUsd: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxRetries: number;
  maxDurationSeconds: number;
  maxCostUsd: number;
  workerId: string;
  leaseExpiresAt: string;
  executionDeadlineAt: string;
  approvalExpiresAt: string;
  startedAt: string;
  completedAt: string;
  cancelledAt: string;
  failedAt: string;
  failureCode: string;
  failureMessage: string;
  outcomeSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type OperationsAgentStep = {
  id: string;
  workspaceId: string;
  runId: string;
  stepKey: string;
  stepIndex: number;
  kind: OperationsAgentStepKind;
  title: string;
  state: OperationsAgentRunState;
  attemptCount: number;
  maxAttempts: number;
  toolName: string;
  inputSummary: string;
  outputSummary: string;
  details: Record<string, unknown>;
  idempotencyKey: string;
  startedAt: string;
  completedAt: string;
  failureCode: string;
  failureMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type OperationsAgentRunLimits = {
  modelCalls: number;
  toolCalls: number;
  retries: number;
  durationSeconds: number;
  costUsd: number;
};

export type GuidedClientIntakeField =
  | "name"
  | "email"
  | "businessName"
  | "source"
  | "interest"
  | "clientType"
  | "returningClientStatus"
  | "lifecycleStage"
  | "priority"
  | "riskLevel"
  | "nextAction"
  | "nextFollowUpAt"
  | "assignedTo"
  | "message";

export type GuidedClientIntakeDraftValues = Record<
  GuidedClientIntakeField,
  string | null
> & {
  summary: string;
};

export type GuidedClientIntakeUncertainty = {
  field: GuidedClientIntakeField;
  reason: string;
};

export type GuidedClientIntakeDraftState =
  | "waiting_for_review"
  | "saved"
  | "cancelled";

export type GuidedClientIntakeDraft = {
  id: string;
  workspaceId: string;
  runId: string;
  initiatedBy: string;
  values: GuidedClientIntakeDraftValues;
  missingFields: GuidedClientIntakeField[];
  uncertainFields: GuidedClientIntakeUncertainty[];
  clarificationQuestions: string[];
  state: GuidedClientIntakeDraftState;
  provider: string;
  model: string;
  providerResponseId: string;
  approvedRecord: Record<string, unknown>;
  savedClientWorkflowRecordId: string;
  createdAt: string;
  updatedAt: string;
};
