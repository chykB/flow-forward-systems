import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
  EngagementFollowUp,
  FollowUpOutcome,
  HandoffNote,
  InvoiceRecord,
  ProposalRecord,
  RiskSignal,
  WorkItemPhase,
  WorkflowTask,
  WorkflowTaskDependency,
} from "@/lib/client-workflow-types";
import { getLocalDateKey } from "@/lib/date-key";
import {
  getEffectiveInvoiceStatus,
  type InvoiceWorkflowUpdates,
} from "@/lib/invoice-workflow";
import type {
  ProposalWorkflowUpdates,
} from "@/lib/proposal-workflow";
import {
  getWorkspaceRiskSignals,
  mapRiskSignalRow,
  mapRiskSignalReconciliationResult,
  type RiskSignalRow,
  type RiskSignalReconciliationResult,
} from "@/lib/supabase/risk-signals";
import {
  getPrimaryClientEngagement,
  getWorkspaceClientEngagements,
  mapClientEngagementRow,
  type ClientEngagementRow,
} from "@/lib/supabase/client-engagements";
import {
  getClientWorkflowRecords,
  mapClientWorkflowRecordRow,
  type ClientWorkflowRecordRow,
} from "@/lib/supabase/client-workflow-records";
import {
  getWorkspaceEngagementFollowUps,
  mapEngagementFollowUpRow,
  type EngagementFollowUpRow,
} from "@/lib/supabase/engagement-follow-ups";
import {
  getWorkspaceHandoffNotes,
  mapHandoffNoteRow,
  type HandoffNoteRow,
} from "@/lib/supabase/handoff-notes";
import {
  getWorkspaceInvoiceRecords,
  mapInvoiceRow,
  type InvoiceRecordRow,
} from "@/lib/supabase/invoice-records";
import {
  getWorkspaceProposalRecords,
  mapProposalRow,
  type ProposalRecordRow,
} from "@/lib/supabase/proposal-records";
import {
  getWorkspaceWorkflowTasks,
  mapWorkflowTaskRow,
  type WorkflowTaskRow,
} from "@/lib/supabase/workflow-tasks";
import {
  getWorkspaceWorkflowTaskDependencies,
  mapWorkflowTaskDependencyRow,
  type WorkflowTaskDependencyRow,
} from "@/lib/supabase/workflow-task-dependencies";

export type NewWorkflowTask = Omit<
  WorkflowTask,
  | "id"
  | "clientEngagementId"
  | "createdAt"
  | "updatedAt"
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

export type NewHandoffNote = Omit<
  HandoffNote,
  "id" | "clientEngagementId" | "createdAt"
>;

export type NewProposalRecord = Omit<
  ProposalRecord,
  | "id"
  | "clientEngagementId"
  | "createdAt"
  | "updatedAt"
  | "workflowActionAppliedStatus"
  | "workflowActionAppliedAt"
>;

export type ProposalRecordUpdates = Partial<
  Omit<
    ProposalRecord,
    | "id"
    | "clientWorkflowRecordId"
    | "clientEngagementId"
    | "createdAt"
    | "updatedAt"
    | "workflowActionAppliedStatus"
    | "workflowActionAppliedAt"
  >
>;

export type NewInvoiceRecord = Omit<
  InvoiceRecord,
  | "id"
  | "clientEngagementId"
  | "createdAt"
  | "updatedAt"
  | "workflowActionAppliedStatus"
  | "workflowActionAppliedAt"
  | "disputedAt"
  | "disputeResolvedAt"
  | "disputeResolutionOutcome"
  | "disputeResolutionNote"
>;

export type InvoiceRecordUpdates = Partial<
  Omit<
    InvoiceRecord,
    | "id"
    | "clientWorkflowRecordId"
    | "clientEngagementId"
    | "createdAt"
    | "updatedAt"
    | "workflowActionAppliedStatus"
    | "workflowActionAppliedAt"
    | "disputedAt"
    | "disputeResolvedAt"
  >
>;

export type NewClientEngagement = Omit<
  ClientEngagement,
  | "id"
  | "engagementStatus"
  | "workflowHealthScore"
  | "isPrimary"
  | "createdAt"
  | "updatedAt"
>;

export type ClientEngagementUpdates = Partial<
  Omit<
    NewClientEngagement,
    "clientWorkflowRecordId"
  >
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

export type WorkItemDependenciesCommandResult =
  WorkItemCommandResult & {
    changed: boolean;
    dependencies: WorkflowTaskDependency[];
  };

export type ClientRecordCommandResult = {
  requestId: string;
  clientRecord: ClientWorkflowRecord;
  clientEngagement: ClientEngagement;
  reconciliation: RiskSignalReconciliationResult;
};

export type ClientEngagementCommandResult = {
  requestId: string;
  clientEngagement: ClientEngagement;
};

export type CompleteFollowUpInput = {
  outcome: FollowUpOutcome;
  note: string;
  nextAction: string;
  nextFollowUpAt: string | null;
  assignedTo: string;
};

export type FollowUpCommandResult = {
  requestId: string;
  followUp: EngagementFollowUp;
  clientRecord: ClientWorkflowRecord;
  clientEngagement: ClientEngagement;
  reconciliation: RiskSignalReconciliationResult;
};

export type HandoffNoteCommandResult = {
  requestId: string;
  handoffNote: HandoffNote;
};

export type ProposalCommandResult = {
  requestId: string;
  proposal: ProposalRecord;
  reconciliation: RiskSignalReconciliationResult;
};

export type ProposalRecommendationCommandResult =
  ProposalCommandResult & {
    clientRecord: ClientWorkflowRecord;
    alreadyApplied: boolean;
  };

export type InvoiceCommandResult = {
  requestId: string;
  invoice: InvoiceRecord;
  reconciliation: RiskSignalReconciliationResult;
};

export type InvoiceRecommendationCommandResult =
  InvoiceCommandResult & {
    clientRecord: ClientWorkflowRecord;
    alreadyApplied: boolean;
  };

export type RiskSignalStatusUpdate =
  | {
      status: "Reviewed";
      resolutionNote?: never;
    }
  | {
      status: "Dismissed";
      resolutionNote: string;
    };

export type RiskSignalCommandResult = {
  requestId: string;
  riskSignal: RiskSignal;
  reconciliation: RiskSignalReconciliationResult;
};

export type CreateHandoffNoteCommand = {
  commandId: string;
  clientEngagementId: string;
  note: NewHandoffNote;
};

export type CreateProposalCommand = {
  commandId: string;
  clientEngagementId: string;
  proposal: NewProposalRecord;
  evaluationDate?: Date;
};

export type UpdateProposalCommand = {
  commandId: string;
  clientEngagementId: string;
  proposalId: string;
  expectedUpdatedAt: string;
  updates: ProposalRecordUpdates;
  evaluationDate?: Date;
};

export type ApplyProposalRecommendationCommand = {
  commandId: string;
  clientEngagementId: string;
  proposalId: string;
  clientWorkflowRecordId: string;
  expectedStatus: ProposalRecord["status"];
  updates: ProposalWorkflowUpdates;
  evaluationDate?: Date;
};

export type CreateInvoiceCommand = {
  commandId: string;
  clientEngagementId: string;
  invoice: NewInvoiceRecord;
  evaluationDate?: Date;
};

export type UpdateInvoiceCommand = {
  commandId: string;
  clientEngagementId: string;
  invoiceId: string;
  expectedUpdatedAt: string;
  updates: InvoiceRecordUpdates;
  evaluationDate?: Date;
};

export type ApplyInvoiceRecommendationCommand = {
  commandId: string;
  clientEngagementId: string;
  invoiceId: string;
  clientWorkflowRecordId: string;
  expectedStatus: InvoiceRecord["status"];
  effectiveStatus: InvoiceRecord["status"];
  updates: InvoiceWorkflowUpdates;
  evaluationDate?: Date;
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
  clientEngagementId: string;
  task: NewWorkflowTask;
  evaluationDate?: Date;
};

export type UpdateWorkItemStatusCommand = {
  commandId: string;
  clientEngagementId: string;
  workItemId: string;
  expectedStatus: WorkflowTask["status"];
  update: WorkflowTaskStatusUpdate;
  evaluationDate?: Date;
};

export type ReplaceWorkItemDependenciesCommand = {
  commandId: string;
  clientEngagementId: string;
  workItemId: string;
  expectedUpdatedAt: string;
  prerequisiteIds: string[];
  evaluationDate?: Date;
};

export type CreateClientEngagementCommand = {
  commandId: string;
  engagement: NewClientEngagement;
};

export type UpdateClientEngagementCommand = {
  commandId: string;
  clientEngagementId: string;
  expectedUpdatedAt: string;
  updates: ClientEngagementUpdates;
  activityNote: string;
};

export type CompleteFollowUpCommand = {
  commandId: string;
  clientEngagementId: string;
  expectedUpdatedAt: string;
  completion: CompleteFollowUpInput;
  evaluationDate?: Date;
};

export type ReviewRiskSignalCommand = {
  commandId: string;
  clientEngagementId: string;
  riskSignalId: string;
  expectedUpdatedAt: string;
  evaluationDate?: Date;
};

export type DismissRiskSignalCommand =
  ReviewRiskSignalCommand & {
    resolutionNote: string;
  };

export type WorkspaceApplicationApi = {
  engagements: {
    list: () => Promise<ClientEngagement[]>;
    create: (
      command: CreateClientEngagementCommand,
    ) => Promise<ClientEngagementCommandResult>;
    update: (
      command: UpdateClientEngagementCommand,
    ) => Promise<ClientEngagementCommandResult>;
  };
  followUps: {
    list: () => Promise<EngagementFollowUp[]>;
    complete: (
      command: CompleteFollowUpCommand,
    ) => Promise<FollowUpCommandResult>;
  };
  clientRecords: {
    list: () => Promise<ClientWorkflowRecord[]>;
    create: (
      command: CreateClientRecordCommand,
    ) => Promise<ClientRecordCommandResult>;
    update: (
      command: UpdateClientRecordCommand,
    ) => Promise<ClientRecordCommandResult>;
  };
  handoffNotes: {
    list: () => Promise<HandoffNote[]>;
    create: (
      command: CreateHandoffNoteCommand,
    ) => Promise<HandoffNoteCommandResult>;
  };
  proposals: {
    list: () => Promise<ProposalRecord[]>;
    create: (
      command: CreateProposalCommand,
    ) => Promise<ProposalCommandResult>;
    update: (
      command: UpdateProposalCommand,
    ) => Promise<ProposalCommandResult>;
    applyRecommendation: (
      command: ApplyProposalRecommendationCommand,
    ) => Promise<ProposalRecommendationCommandResult>;
  };
  invoices: {
    list: () => Promise<InvoiceRecord[]>;
    create: (
      command: CreateInvoiceCommand,
    ) => Promise<InvoiceCommandResult>;
    update: (
      command: UpdateInvoiceCommand,
    ) => Promise<InvoiceCommandResult>;
    applyRecommendation: (
      command: ApplyInvoiceRecommendationCommand,
    ) => Promise<InvoiceRecommendationCommandResult>;
  };
  riskSignals: {
    list: () => Promise<RiskSignal[]>;
    review: (
      command: ReviewRiskSignalCommand,
    ) => Promise<RiskSignalCommandResult>;
    dismiss: (
      command: DismissRiskSignalCommand,
    ) => Promise<RiskSignalCommandResult>;
  };
  workItems: {
    list: () => Promise<WorkflowTask[]>;
    listDependencies: () => Promise<WorkflowTaskDependency[]>;
    create: (
      command: CreateWorkItemCommand,
    ) => Promise<WorkItemCommandResult>;
    updateStatus: (
      command: UpdateWorkItemStatusCommand,
    ) => Promise<WorkItemCommandResult>;
    replaceDependencies: (
      command: ReplaceWorkItemDependenciesCommand,
    ) => Promise<WorkItemDependenciesCommandResult>;
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

type WorkItemDependenciesCommandRpcResult =
  WorkItemCommandRpcResult & {
    changed: boolean;
    dependencies: WorkflowTaskDependencyRow[];
  };

type ClientRecordCommandRpcResult = {
  requestId: string;
  clientRecord: ClientWorkflowRecordRow;
  reconciliation: unknown;
};

type ClientEngagementCommandRpcResult = {
  requestId: string;
  clientEngagement: ClientEngagementRow;
};

type FollowUpCommandRpcResult = {
  requestId: string;
  followUp: EngagementFollowUpRow;
  clientRecord: ClientWorkflowRecordRow;
  clientEngagement: ClientEngagementRow;
  reconciliation: unknown;
};

type HandoffNoteCommandRpcResult = {
  requestId: string;
  handoffNote: HandoffNoteRow;
};

type ProposalCommandRpcResult = {
  requestId: string;
  proposal: ProposalRecordRow;
  reconciliation: unknown;
};

type ProposalRecommendationCommandRpcResult =
  ProposalCommandRpcResult & {
    clientRecord: ClientWorkflowRecordRow;
    alreadyApplied: boolean;
  };

type InvoiceCommandRpcResult = {
  requestId: string;
  invoice: InvoiceRecordRow;
  reconciliation: unknown;
};

type InvoiceRecommendationCommandRpcResult =
  InvoiceCommandRpcResult & {
    clientRecord: ClientWorkflowRecordRow;
    alreadyApplied: boolean;
  };

type RiskSignalCommandRpcResult = {
  requestId: string;
  riskSignal: RiskSignalRow;
  reconciliation: unknown;
};

const engagementWorkflowStatuses = new Set<
  WorkflowTask["status"]
>([
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Complete",
  "Not needed",
]);
const workItemStatuses = new Set<WorkflowTask["status"]>([
  "Planned",
  ...engagementWorkflowStatuses,
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
const workItemPhases = new Set<WorkItemPhase>([
  "Lead",
  "Proposal",
  "Onboarding",
  "Delivery",
  "Approval",
  "Payment",
  "Handoff",
]);
const proposalStatuses = new Set<ProposalRecord["status"]>([
  "Not needed",
  "Draft needed",
  "Sent",
  "Revision requested",
  "Accepted",
  "Rejected",
  "Expired",
]);
const invoiceStatuses = new Set<InvoiceRecord["status"]>([
  "Not needed",
  "Draft needed",
  "Sent",
  "Due soon",
  "Overdue",
  "Paid",
  "Disputed",
  "Voided",
]);
const invoiceDisputeResolutionOutcomes = new Set<
  Exclude<InvoiceRecord["disputeResolutionOutcome"], "">
>([
  "Payment received",
  "Payment still due",
  "Invoice voided or replaced",
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
const followUpOutcomes = new Set<FollowUpOutcome>([
  "Replied",
  "No response",
  "Meeting booked",
  "Decision received",
  "Not proceeding",
  "Other",
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
const engagementFields = new Set<
  keyof NewClientEngagement
>([
  "clientWorkflowRecordId",
  "title",
  "lifecycleStage",
  "priority",
  "estimatedValue",
  "nextAction",
  "nextFollowUpAt",
  "assignedTo",
  "onboardingStatus",
  "deliveryStatus",
  "approvalStatus",
  "paymentStatus",
]);
const mutableEngagementFields = new Set<
  keyof ClientEngagementUpdates
>([
  "title",
  "lifecycleStage",
  "priority",
  "estimatedValue",
  "nextAction",
  "nextFollowUpAt",
  "assignedTo",
  "onboardingStatus",
  "deliveryStatus",
  "approvalStatus",
  "paymentStatus",
]);
const handoffNoteFields = new Set<keyof NewHandoffNote>([
  "clientWorkflowRecordId",
  "title",
  "note",
  "owner",
]);
const proposalFields = new Set<keyof NewProposalRecord>([
  "clientWorkflowRecordId",
  "title",
  "amount",
  "currency",
  "status",
  "sentAt",
  "expiresAt",
  "acceptedAt",
  "rejectedAt",
  "revisionRequestedAt",
  "notes",
]);
const mutableProposalFields = new Set<
  keyof ProposalRecordUpdates
>([
  "title",
  "amount",
  "currency",
  "status",
  "sentAt",
  "expiresAt",
  "acceptedAt",
  "rejectedAt",
  "revisionRequestedAt",
  "notes",
]);
const proposalWorkflowFields = new Set<
  keyof ProposalWorkflowUpdates
>([
  "lifecycleStage",
  "clientType",
  "returningClientStatus",
  "nextAction",
  "nextFollowUpAt",
  "onboardingStatus",
  "priority",
  "estimatedValue",
]);
const invoiceFields = new Set<keyof NewInvoiceRecord>([
  "clientWorkflowRecordId",
  "invoiceNumber",
  "amount",
  "currency",
  "description",
  "status",
  "paymentLink",
  "sentAt",
  "dueDate",
  "paidAt",
  "disputeReason",
]);
const mutableInvoiceFields = new Set<keyof InvoiceRecordUpdates>([
  "invoiceNumber",
  "amount",
  "currency",
  "description",
  "status",
  "paymentLink",
  "sentAt",
  "dueDate",
  "paidAt",
  "disputeReason",
  "disputeResolutionOutcome",
  "disputeResolutionNote",
]);
const invoiceWorkflowFields = new Set<keyof InvoiceWorkflowUpdates>([
  "paymentStatus",
  "priority",
  "nextAction",
  "nextFollowUpAt",
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
      "The requested workspace record is no longer available.",
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

function mapWorkItemDependenciesCommandResult(
  data: unknown,
  expectedRequestId: string,
): WorkItemDependenciesCommandResult {
  const result =
    data as WorkItemDependenciesCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.workItem ||
    !Array.isArray(result.dependencies) ||
    !result.reconciliation ||
    typeof result.changed !== "boolean"
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The prerequisite operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    workItem: mapWorkflowTaskRow(result.workItem),
    dependencies: result.dependencies.map(
      mapWorkflowTaskDependencyRow,
    ),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
    changed: result.changed,
  };
}

function mapClientRecordCommandResult(
  data: unknown,
  expectedRequestId: string,
  clientEngagement: ClientEngagement,
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
    clientEngagement,
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapClientEngagementCommandResult(
  data: unknown,
  expectedRequestId: string,
): ClientEngagementCommandResult {
  const result =
    data as ClientEngagementCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.clientEngagement
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The engagement operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    clientEngagement: mapClientEngagementRow(
      result.clientEngagement,
    ),
  };
}

function mapFollowUpCommandResult(
  data: unknown,
  expectedRequestId: string,
): FollowUpCommandResult {
  const result = data as FollowUpCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.followUp ||
    !result.clientRecord ||
    !result.clientEngagement ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The follow-up operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    followUp: mapEngagementFollowUpRow(result.followUp),
    clientRecord: mapClientWorkflowRecordRow(
      result.clientRecord,
    ),
    clientEngagement: mapClientEngagementRow(
      result.clientEngagement,
    ),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapHandoffNoteCommandResult(
  data: unknown,
  expectedRequestId: string,
): HandoffNoteCommandResult {
  const result = data as HandoffNoteCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.handoffNote
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The handoff note operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    handoffNote: mapHandoffNoteRow(result.handoffNote),
  };
}

function mapProposalCommandResult(
  data: unknown,
  expectedRequestId: string,
): ProposalCommandResult {
  const result = data as ProposalCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.proposal ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The proposal operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    proposal: mapProposalRow(result.proposal),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapProposalRecommendationCommandResult(
  data: unknown,
  expectedRequestId: string,
): ProposalRecommendationCommandResult {
  const result =
    data as ProposalRecommendationCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.proposal ||
    !result.clientRecord ||
    typeof result.alreadyApplied !== "boolean" ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The proposal recommendation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    proposal: mapProposalRow(result.proposal),
    clientRecord: mapClientWorkflowRecordRow(
      result.clientRecord,
    ),
    alreadyApplied: result.alreadyApplied,
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapInvoiceCommandResult(
  data: unknown,
  expectedRequestId: string,
): InvoiceCommandResult {
  const result = data as InvoiceCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.invoice ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The invoice operation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    invoice: mapInvoiceRow(result.invoice),
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapInvoiceRecommendationCommandResult(
  data: unknown,
  expectedRequestId: string,
): InvoiceRecommendationCommandResult {
  const result =
    data as InvoiceRecommendationCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.invoice ||
    !result.clientRecord ||
    typeof result.alreadyApplied !== "boolean" ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The invoice recommendation returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    invoice: mapInvoiceRow(result.invoice),
    clientRecord: mapClientWorkflowRecordRow(
      result.clientRecord,
    ),
    alreadyApplied: result.alreadyApplied,
    reconciliation: mapRiskSignalReconciliationResult(
      result.reconciliation,
    ),
  };
}

function mapRiskSignalCommandResult(
  data: unknown,
  expectedRequestId: string,
): RiskSignalCommandResult {
  const result = data as RiskSignalCommandRpcResult | null;

  if (
    !result?.requestId ||
    result.requestId !== expectedRequestId ||
    !result.riskSignal ||
    !result.reconciliation
  ) {
    throw new WorkspaceApiError(
      "invalid_response",
      "The risk review returned an invalid response.",
      expectedRequestId,
    );
  }

  return {
    requestId: result.requestId,
    riskSignal: mapRiskSignalRow(result.riskSignal),
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

function assertMaximumText(
  value: string,
  maximumLength: number,
  message: string,
  requestId: string,
) {
  if (value.trim().length > maximumLength) {
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
    !engagementWorkflowStatuses.has(record.onboardingStatus) ||
    !engagementWorkflowStatuses.has(record.deliveryStatus) ||
    !engagementWorkflowStatuses.has(record.approvalStatus) ||
    !engagementWorkflowStatuses.has(record.paymentStatus)
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

function normalizeEngagementValues<
  T extends NewClientEngagement | ClientEngagementUpdates,
>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as T;
}

function normalizeFollowUpCompletion(
  completion: CompleteFollowUpInput,
) {
  return {
    ...completion,
    note: completion.note.trim(),
    nextAction: completion.nextAction.trim(),
    assignedTo: completion.assignedTo.trim(),
  } satisfies CompleteFollowUpInput;
}

function validateEngagementValues(
  values: NewClientEngagement | ClientEngagementUpdates,
  requestId: string,
) {
  if (values.title !== undefined) {
    if (typeof values.title !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The engagement title must be text.",
        requestId,
      );
    }
    assertMinimumText(
      values.title,
      2,
      "Enter an engagement title.",
      requestId,
    );
  }

  if (
    values.lifecycleStage !== undefined &&
    !lifecycleStages.has(values.lifecycleStage)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid engagement stage.",
      requestId,
    );
  }

  if (
    values.priority !== undefined &&
    !priorities.has(values.priority)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid engagement priority.",
      requestId,
    );
  }

  if (
    values.estimatedValue !== undefined &&
    (!Number.isFinite(values.estimatedValue) ||
      values.estimatedValue < 0)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid engagement value.",
      requestId,
    );
  }

  if (values.nextAction !== undefined) {
    if (typeof values.nextAction !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The next action must be text.",
        requestId,
      );
    }
    assertMinimumText(
      values.nextAction,
      3,
      "Enter the engagement next action.",
      requestId,
    );
  }

  if (
    values.nextFollowUpAt !== undefined &&
    !dateKeyPattern.test(values.nextFollowUpAt)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid engagement follow-up date.",
      requestId,
    );
  }

  if (values.assignedTo !== undefined) {
    if (typeof values.assignedTo !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The engagement owner must be text.",
        requestId,
      );
    }
    assertMinimumText(
      values.assignedTo,
      2,
      "Enter the engagement owner.",
      requestId,
    );
  }

  const statuses = [
    values.onboardingStatus,
    values.deliveryStatus,
    values.approvalStatus,
    values.paymentStatus,
  ].filter(
    (status): status is WorkflowTask["status"] =>
      status !== undefined,
  );

  if (
    statuses.some(
      (status) => !engagementWorkflowStatuses.has(status),
    )
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose valid engagement workflow statuses.",
      requestId,
    );
  }
}

function validateCreateEngagementCommand(
  workspaceId: string,
  command: CreateClientEngagementCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );

  const suppliedFields = Object.keys(
    command.engagement,
  ) as Array<keyof NewClientEngagement>;

  if (
    suppliedFields.length !== engagementFields.size ||
    suppliedFields.some((field) => !engagementFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Engagement details are incomplete or contain a protected field.",
      command.commandId,
    );
  }

  assertUuid(
    command.engagement.clientWorkflowRecordId,
    "The client record identifier",
    command.commandId,
  );
  validateEngagementValues(
    command.engagement,
    command.commandId,
  );
}

function validateUpdateEngagementCommand(
  workspaceId: string,
  command: UpdateClientEngagementCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected engagement version is invalid.",
      command.commandId,
    );
  }

  const fields = Object.keys(command.updates) as Array<
    keyof ClientEngagementUpdates
  >;

  if (
    fields.length === 0 ||
    fields.some((field) => !mutableEngagementFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Engagement changes are empty or contain a protected field.",
      command.commandId,
    );
  }

  assertMinimumText(
    command.activityNote,
    5,
    "Describe the engagement change.",
    command.commandId,
  );
  validateEngagementValues(command.updates, command.commandId);
}

function validateCompleteFollowUpCommand(
  workspaceId: string,
  command: CompleteFollowUpCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected engagement version is invalid.",
      command.commandId,
    );
  }

  const { completion } = command;

  if (!followUpOutcomes.has(completion.outcome)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid follow-up outcome.",
      command.commandId,
    );
  }

  assertMinimumText(
    completion.note,
    5,
    "Add a short note about the follow-up outcome.",
    command.commandId,
  );
  assertMaximumText(
    completion.note,
    2000,
    "Keep the follow-up note under 2,000 characters.",
    command.commandId,
  );
  assertMinimumText(
    completion.nextAction,
    3,
    "Enter the next action.",
    command.commandId,
  );
  assertMaximumText(
    completion.nextAction,
    1000,
    "Keep the next action under 1,000 characters.",
    command.commandId,
  );
  assertMinimumText(
    completion.assignedTo,
    2,
    "Enter the follow-up owner.",
    command.commandId,
  );

  if (
    completion.nextFollowUpAt !== null &&
    !dateKeyPattern.test(completion.nextFollowUpAt)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid next follow-up date.",
      command.commandId,
    );
  }
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
    command.clientEngagementId,
    "The engagement identifier",
    commandId,
  );
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

  if (!workItemPhases.has(task.phase)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid work item phase.",
      commandId,
    );
  }

  if (!workItemStatuses.has(task.status)) {
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

function validateCreateHandoffNoteCommand(
  workspaceId: string,
  command: CreateHandoffNoteCommand,
) {
  const { commandId, note } = command;

  assertRequestId(commandId);
  assertUuid(workspaceId, "The workspace identifier", commandId);
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    commandId,
  );

  if (!note || typeof note !== "object" || Array.isArray(note)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Handoff note details are required.",
      commandId,
    );
  }

  const suppliedFields = Object.keys(note) as Array<
    keyof NewHandoffNote
  >;

  if (
    suppliedFields.length !== handoffNoteFields.size ||
    suppliedFields.some(
      (field) => !handoffNoteFields.has(field),
    )
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Handoff note details are incomplete or contain a protected field.",
      commandId,
    );
  }

  if (
    typeof note.clientWorkflowRecordId !== "string" ||
    typeof note.title !== "string" ||
    typeof note.note !== "string" ||
    typeof note.owner !== "string"
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Handoff note fields must use text values.",
      commandId,
    );
  }

  assertUuid(
    note.clientWorkflowRecordId,
    "The client record identifier",
    commandId,
  );

  assertMinimumText(
    note.title,
    3,
    "Enter a short note title.",
    commandId,
  );
  assertMaximumText(
    note.title,
    200,
    "Keep the note title under 200 characters.",
    commandId,
  );
  assertMinimumText(
    note.note,
    10,
    "Add the handoff context.",
    commandId,
  );
  assertMaximumText(
    note.note,
    5000,
    "Keep the handoff context under 5,000 characters.",
    commandId,
  );
  assertMinimumText(
    note.owner,
    2,
    "Enter who owns this note.",
    commandId,
  );
  assertMaximumText(
    note.owner,
    200,
    "Keep the owner under 200 characters.",
    commandId,
  );
}

function assertProposalDate(
  value: string,
  label: string,
  requestId: string,
) {
  if (value && !dateKeyPattern.test(value)) {
    throw new WorkspaceApiError(
      "invalid_request",
      `${label} is invalid.`,
      requestId,
    );
  }
}

function validateProposalValues(
  proposal: NewProposalRecord,
  requestId: string,
) {
  if (
    typeof proposal.clientWorkflowRecordId !== "string" ||
    typeof proposal.title !== "string" ||
    typeof proposal.amount !== "number" ||
    typeof proposal.currency !== "string" ||
    typeof proposal.status !== "string" ||
    typeof proposal.sentAt !== "string" ||
    typeof proposal.expiresAt !== "string" ||
    typeof proposal.acceptedAt !== "string" ||
    typeof proposal.rejectedAt !== "string" ||
    typeof proposal.revisionRequestedAt !== "string" ||
    typeof proposal.notes !== "string"
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal fields use an invalid value type.",
      requestId,
    );
  }

  assertUuid(
    proposal.clientWorkflowRecordId,
    "The client record identifier",
    requestId,
  );
  assertMinimumText(
    proposal.title,
    2,
    "Enter a proposal or quote title.",
    requestId,
  );
  assertMaximumText(
    proposal.title,
    160,
    "Keep the proposal title under 160 characters.",
    requestId,
  );

  if (
    !Number.isFinite(proposal.amount) ||
    proposal.amount < 0 ||
    proposal.amount >= 10_000_000_000
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid proposal amount.",
      requestId,
    );
  }

  if (!/^[A-Za-z]{3}$/.test(proposal.currency.trim())) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Use a three-letter currency code.",
      requestId,
    );
  }

  if (!proposalStatuses.has(proposal.status)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid proposal status.",
      requestId,
    );
  }

  assertProposalDate(proposal.sentAt, "The sent date", requestId);
  assertProposalDate(
    proposal.expiresAt,
    "The expiry date",
    requestId,
  );
  assertProposalDate(
    proposal.acceptedAt,
    "The acceptance date",
    requestId,
  );
  assertProposalDate(
    proposal.rejectedAt,
    "The rejection date",
    requestId,
  );
  assertProposalDate(
    proposal.revisionRequestedAt,
    "The revision request date",
    requestId,
  );

  if (
    (proposal.status === "Sent" ||
      proposal.status === "Accepted") &&
    proposal.amount <= 0
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter the proposed amount.",
      requestId,
    );
  }

  const requiredDate =
    proposal.status === "Sent"
      ? proposal.sentAt
      : proposal.status === "Revision requested"
        ? proposal.revisionRequestedAt
        : proposal.status === "Accepted"
          ? proposal.acceptedAt
          : proposal.status === "Rejected"
            ? proposal.rejectedAt
            : proposal.status === "Expired"
              ? proposal.expiresAt
              : "valid";

  if (!requiredDate) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter the date required for this proposal status.",
      requestId,
    );
  }

  if (
    (proposal.status === "Revision requested" ||
      proposal.status === "Rejected") &&
    proposal.notes.trim().length < 5
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Add a short note explaining this decision.",
      requestId,
    );
  }

  assertMaximumText(
    proposal.notes,
    1000,
    "Keep proposal notes under 1,000 characters.",
    requestId,
  );
}

function normalizeProposalValues<
  T extends NewProposalRecord | ProposalRecordUpdates,
>(
  values: T,
) {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      typeof value === "string"
        ? field === "currency"
          ? value.trim().toUpperCase()
          : value.trim()
        : value,
    ]),
  ) as T;
}

function validateCreateProposalCommand(
  workspaceId: string,
  command: CreateProposalCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !command.proposal ||
    typeof command.proposal !== "object" ||
    Array.isArray(command.proposal)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal details are required.",
      command.commandId,
    );
  }

  const suppliedFields = Object.keys(
    command.proposal,
  ) as Array<keyof NewProposalRecord>;

  if (
    suppliedFields.length !== proposalFields.size ||
    suppliedFields.some((field) => !proposalFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal details are incomplete or contain a protected field.",
      command.commandId,
    );
  }

  validateProposalValues(command.proposal, command.commandId);
}

function validateUpdateProposalCommand(
  workspaceId: string,
  command: UpdateProposalCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.proposalId,
    "The proposal identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected proposal version is invalid.",
      command.commandId,
    );
  }

  if (
    !command.updates ||
    typeof command.updates !== "object" ||
    Array.isArray(command.updates)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal changes are required.",
      command.commandId,
    );
  }

  const fields = Object.keys(command.updates) as Array<
    keyof ProposalRecordUpdates
  >;

  if (
    fields.length === 0 ||
    fields.some((field) => !mutableProposalFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal changes are empty or contain a protected field.",
      command.commandId,
    );
  }

  if (command.updates.title !== undefined) {
    if (typeof command.updates.title !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The proposal title must be text.",
        command.commandId,
      );
    }
    assertMinimumText(
      command.updates.title,
      2,
      "Enter a proposal or quote title.",
      command.commandId,
    );
    assertMaximumText(
      command.updates.title,
      160,
      "Keep the proposal title under 160 characters.",
      command.commandId,
    );
  }

  if (
    command.updates.amount !== undefined &&
    (typeof command.updates.amount !== "number" ||
      !Number.isFinite(command.updates.amount) ||
      command.updates.amount < 0 ||
      command.updates.amount >= 10_000_000_000)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid proposal amount.",
      command.commandId,
    );
  }

  if (
    command.updates.currency !== undefined &&
    (typeof command.updates.currency !== "string" ||
      !/^[A-Za-z]{3}$/.test(command.updates.currency.trim()))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Use a three-letter currency code.",
      command.commandId,
    );
  }

  if (
    command.updates.status !== undefined &&
    (typeof command.updates.status !== "string" ||
      !proposalStatuses.has(command.updates.status))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid proposal status.",
      command.commandId,
    );
  }

  const dateUpdates: Array<
    [keyof ProposalRecordUpdates, string]
  > = [
    ["sentAt", "The sent date"],
    ["expiresAt", "The expiry date"],
    ["acceptedAt", "The acceptance date"],
    ["rejectedAt", "The rejection date"],
    ["revisionRequestedAt", "The revision request date"],
  ];

  for (const [field, label] of dateUpdates) {
    const value = command.updates[field];

    if (value !== undefined) {
      if (typeof value !== "string") {
        throw new WorkspaceApiError(
          "invalid_request",
          `${label} must be text.`,
          command.commandId,
        );
      }
      assertProposalDate(value, label, command.commandId);
    }
  }

  if (command.updates.notes !== undefined) {
    if (typeof command.updates.notes !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "Proposal notes must be text.",
        command.commandId,
      );
    }
    assertMaximumText(
      command.updates.notes,
      1000,
      "Keep proposal notes under 1,000 characters.",
      command.commandId,
    );
  }
}

function validateProposalWorkflowUpdates(
  command: ApplyProposalRecommendationCommand,
) {
  const { commandId, updates } = command;

  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal workflow changes are required.",
      commandId,
    );
  }

  const fields = Object.keys(updates) as Array<
    keyof ProposalWorkflowUpdates
  >;

  if (
    fields.length === 0 ||
    fields.some((field) => !proposalWorkflowFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Proposal workflow changes contain an unsupported field.",
      commandId,
    );
  }

  if (
    updates.lifecycleStage !== undefined &&
    (typeof updates.lifecycleStage !== "string" ||
      !lifecycleStages.has(updates.lifecycleStage))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid workflow stage.",
      commandId,
    );
  }

  if (
    updates.clientType !== undefined &&
    (typeof updates.clientType !== "string" ||
      !clientTypes.has(updates.clientType))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid client type.",
      commandId,
    );
  }

  if (
    updates.returningClientStatus !== undefined &&
    (typeof updates.returningClientStatus !== "string" ||
      !returningClientStatuses.has(updates.returningClientStatus))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid returning-client status.",
      commandId,
    );
  }

  if (updates.nextAction !== undefined) {
    if (typeof updates.nextAction !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The recommended next action must be text.",
        commandId,
      );
    }
    assertMinimumText(
      updates.nextAction,
      5,
      "Enter the recommended next action.",
      commandId,
    );
  }

  if (
    updates.nextFollowUpAt !== undefined &&
    (typeof updates.nextFollowUpAt !== "string" ||
      !dateKeyPattern.test(updates.nextFollowUpAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid follow-up date.",
      commandId,
    );
  }

  if (
    updates.onboardingStatus !== undefined &&
    (typeof updates.onboardingStatus !== "string" ||
      !engagementWorkflowStatuses.has(
        updates.onboardingStatus,
      ))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid onboarding status.",
      commandId,
    );
  }

  if (
    updates.priority !== undefined &&
    (typeof updates.priority !== "string" ||
      !priorities.has(updates.priority))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid priority.",
      commandId,
    );
  }

  if (
    updates.estimatedValue !== undefined &&
    (typeof updates.estimatedValue !== "number" ||
      !Number.isFinite(updates.estimatedValue) ||
      updates.estimatedValue < 0)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid estimated value.",
      commandId,
    );
  }
}

function normalizeProposalWorkflowUpdates(
  updates: ProposalWorkflowUpdates,
) {
  return Object.fromEntries(
    Object.entries(updates).map(([field, value]) => [
      field,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as ProposalWorkflowUpdates;
}

function validateApplyProposalRecommendationCommand(
  workspaceId: string,
  command: ApplyProposalRecommendationCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.proposalId,
    "The proposal identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );
  assertUuid(
    command.clientWorkflowRecordId,
    "The client record identifier",
    command.commandId,
  );

  if (!proposalStatuses.has(command.expectedStatus)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid expected proposal status.",
      command.commandId,
    );
  }

  validateProposalWorkflowUpdates(command);
}

function assertInvoiceDate(
  value: string,
  label: string,
  requestId: string,
) {
  if (value && !dateKeyPattern.test(value)) {
    throw new WorkspaceApiError(
      "invalid_request",
      `${label} is invalid.`,
      requestId,
    );
  }
}

function assertInvoicePaymentLink(
  value: string,
  requestId: string,
) {
  if (!value) {
    return;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return;
    }
  } catch {
    // The shared error below keeps validation messages consistent.
  }

  throw new WorkspaceApiError(
    "invalid_request",
    "Enter a valid payment link beginning with http or https.",
    requestId,
  );
}

function validateInvoiceState(
  invoice: NewInvoiceRecord,
  requestId: string,
) {
  if (
    typeof invoice.clientWorkflowRecordId !== "string" ||
    typeof invoice.invoiceNumber !== "string" ||
    typeof invoice.amount !== "number" ||
    typeof invoice.currency !== "string" ||
    typeof invoice.description !== "string" ||
    typeof invoice.status !== "string" ||
    typeof invoice.paymentLink !== "string" ||
    typeof invoice.sentAt !== "string" ||
    typeof invoice.dueDate !== "string" ||
    typeof invoice.paidAt !== "string" ||
    typeof invoice.disputeReason !== "string"
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice fields use an invalid value type.",
      requestId,
    );
  }

  assertUuid(
    invoice.clientWorkflowRecordId,
    "The client record identifier",
    requestId,
  );

  if (!invoiceStatuses.has(invoice.status)) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid invoice status.",
      requestId,
    );
  }

  const invoiceIssued = ![
    "Not needed",
    "Draft needed",
    "Voided",
  ].includes(invoice.status);
  const invoiceNeeded = invoice.status !== "Not needed";

  if (invoiceIssued && invoice.invoiceNumber.trim().length < 2) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter the invoice number before issuing it.",
      requestId,
    );
  }
  assertMaximumText(
    invoice.invoiceNumber,
    80,
    "Keep the invoice number under 80 characters.",
    requestId,
  );

  if (
    !Number.isFinite(invoice.amount) ||
    invoice.amount < 0 ||
    invoice.amount >= 10_000_000_000 ||
    (invoiceIssued && invoice.amount <= 0)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      invoiceIssued
        ? "Enter an amount greater than zero before issuing the invoice."
        : "Enter a valid invoice amount.",
      requestId,
    );
  }

  if (
    invoiceNeeded &&
    !/^[A-Za-z]{3}$/.test(invoice.currency.trim())
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Use a three-letter currency code.",
      requestId,
    );
  }

  assertMinimumText(
    invoice.description,
    5,
    invoiceNeeded
      ? "Add a short invoice description."
      : "Explain why an invoice is not needed.",
    requestId,
  );
  assertMaximumText(
    invoice.description,
    500,
    "Keep the invoice description under 500 characters.",
    requestId,
  );
  assertInvoicePaymentLink(invoice.paymentLink.trim(), requestId);

  assertInvoiceDate(invoice.sentAt, "The sent date", requestId);
  assertInvoiceDate(invoice.dueDate, "The due date", requestId);
  assertInvoiceDate(invoice.paidAt, "The payment date", requestId);

  if (invoice.sentAt && invoice.dueDate && invoice.dueDate < invoice.sentAt) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The due date cannot be before the sent date.",
      requestId,
    );
  }
  if (invoice.sentAt && invoice.paidAt && invoice.paidAt < invoice.sentAt) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The payment date cannot be before the sent date.",
      requestId,
    );
  }

  if (
    ["Sent", "Due soon", "Overdue", "Disputed"].includes(
      invoice.status,
    ) &&
    (!invoice.sentAt || !invoice.dueDate)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter both the sent date and due date.",
      requestId,
    );
  }

  if (invoice.status === "Paid" && !invoice.paidAt) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter the date payment was received.",
      requestId,
    );
  }

  if (invoice.status === "Disputed") {
    assertMinimumText(
      invoice.disputeReason,
      5,
      "Add a short explanation of the payment dispute.",
      requestId,
    );
  }

  if (
    invoice.status !==
    getEffectiveInvoiceStatus(invoice, new Date())
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Payment due soon and invoice overdue are determined by the due date.",
      requestId,
    );
  }
  assertMaximumText(
    invoice.disputeReason,
    1000,
    "Keep the dispute reason under 1,000 characters.",
    requestId,
  );
}

function normalizeInvoiceValues<
  T extends NewInvoiceRecord | InvoiceRecordUpdates,
>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      typeof value === "string"
        ? field === "currency"
          ? value.trim().toUpperCase()
          : value.trim()
        : value,
    ]),
  ) as T;
}

function validateCreateInvoiceCommand(
  workspaceId: string,
  command: CreateInvoiceCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !command.invoice ||
    typeof command.invoice !== "object" ||
    Array.isArray(command.invoice)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice details are required.",
      command.commandId,
    );
  }

  const suppliedFields = Object.keys(command.invoice) as Array<
    keyof NewInvoiceRecord
  >;

  if (
    suppliedFields.length !== invoiceFields.size ||
    suppliedFields.some((field) => !invoiceFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice details are incomplete or contain a protected field.",
      command.commandId,
    );
  }

  validateInvoiceState(command.invoice, command.commandId);
}

function validateUpdateInvoiceCommand(
  workspaceId: string,
  command: UpdateInvoiceCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(workspaceId, "The workspace identifier", command.commandId);
  assertUuid(command.invoiceId, "The invoice identifier", command.commandId);
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected invoice version is invalid.",
      command.commandId,
    );
  }

  if (
    !command.updates ||
    typeof command.updates !== "object" ||
    Array.isArray(command.updates)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice changes are required.",
      command.commandId,
    );
  }

  const fields = Object.keys(command.updates) as Array<
    keyof InvoiceRecordUpdates
  >;

  if (
    fields.length === 0 ||
    fields.some((field) => !mutableInvoiceFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice changes are empty or contain a protected field.",
      command.commandId,
    );
  }

  if (
    command.updates.status !== undefined &&
    (typeof command.updates.status !== "string" ||
      !invoiceStatuses.has(command.updates.status))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid invoice status.",
      command.commandId,
    );
  }

  if (
    command.updates.amount !== undefined &&
    (typeof command.updates.amount !== "number" ||
      !Number.isFinite(command.updates.amount) ||
      command.updates.amount < 0 ||
      command.updates.amount >= 10_000_000_000)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Enter a valid invoice amount.",
      command.commandId,
    );
  }

  const textLimits: Array<[
    keyof InvoiceRecordUpdates,
    number,
    string,
  ]> = [
    ["invoiceNumber", 80, "Keep the invoice number under 80 characters."],
    ["description", 500, "Keep the invoice description under 500 characters."],
    ["disputeReason", 1000, "Keep the dispute reason under 1,000 characters."],
    ["disputeResolutionNote", 1000, "Keep the dispute resolution note under 1,000 characters."],
  ];

  for (const [field, maximum, message] of textLimits) {
    const value = command.updates[field];

    if (value !== undefined) {
      if (typeof value !== "string") {
        throw new WorkspaceApiError(
          "invalid_request",
          "Invoice text fields must use text values.",
          command.commandId,
        );
      }
      assertMaximumText(value, maximum, message, command.commandId);
    }
  }

  if (
    command.updates.currency !== undefined &&
    (typeof command.updates.currency !== "string" ||
      !/^[A-Za-z]{3}$/.test(command.updates.currency.trim()))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Use a three-letter currency code.",
      command.commandId,
    );
  }

  if (command.updates.paymentLink !== undefined) {
    if (typeof command.updates.paymentLink !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The payment link must be text.",
        command.commandId,
      );
    }
    assertInvoicePaymentLink(
      command.updates.paymentLink.trim(),
      command.commandId,
    );
  }

  for (const [field, label] of [
    ["sentAt", "The sent date"],
    ["dueDate", "The due date"],
    ["paidAt", "The payment date"],
  ] as const) {
    const value = command.updates[field];

    if (value !== undefined) {
      if (typeof value !== "string") {
        throw new WorkspaceApiError(
          "invalid_request",
          `${label} must be text.`,
          command.commandId,
        );
      }
      assertInvoiceDate(value, label, command.commandId);
    }
  }

  if (
    command.updates.status !== undefined &&
    command.updates.dueDate !== undefined &&
    command.updates.status !==
      getEffectiveInvoiceStatus(
        {
          dueDate: command.updates.dueDate,
          status: command.updates.status,
        },
        new Date(),
      )
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Payment due soon and invoice overdue are determined by the due date.",
      command.commandId,
    );
  }

  if (
    command.updates.disputeResolutionOutcome !== undefined &&
    command.updates.disputeResolutionOutcome !== "" &&
    !invoiceDisputeResolutionOutcomes.has(
      command.updates.disputeResolutionOutcome,
    )
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid dispute resolution outcome.",
      command.commandId,
    );
  }
}

function validateInvoiceWorkflowUpdates(
  command: ApplyInvoiceRecommendationCommand,
) {
  const fields = Object.keys(command.updates ?? {}) as Array<
    keyof InvoiceWorkflowUpdates
  >;

  if (
    fields.length === 0 ||
    fields.some((field) => !invoiceWorkflowFields.has(field))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Invoice workflow changes are empty or contain an unsupported field.",
      command.commandId,
    );
  }

  if (
    command.updates.paymentStatus !== undefined &&
    (typeof command.updates.paymentStatus !== "string" ||
      !engagementWorkflowStatuses.has(command.updates.paymentStatus))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid payment status.",
      command.commandId,
    );
  }
  if (
    command.updates.priority !== undefined &&
    (typeof command.updates.priority !== "string" ||
      !priorities.has(command.updates.priority))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid priority.",
      command.commandId,
    );
  }
  if (command.updates.nextAction !== undefined) {
    if (typeof command.updates.nextAction !== "string") {
      throw new WorkspaceApiError(
        "invalid_request",
        "The recommended next action must be text.",
        command.commandId,
      );
    }
    assertMinimumText(
      command.updates.nextAction,
      5,
      "Enter the recommended next action.",
      command.commandId,
    );
  }
  if (
    command.updates.nextFollowUpAt !== undefined &&
    (typeof command.updates.nextFollowUpAt !== "string" ||
      !dateKeyPattern.test(command.updates.nextFollowUpAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose a valid follow-up date.",
      command.commandId,
    );
  }
}

function validateApplyInvoiceRecommendationCommand(
  workspaceId: string,
  command: ApplyInvoiceRecommendationCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(workspaceId, "The workspace identifier", command.commandId);
  assertUuid(command.invoiceId, "The invoice identifier", command.commandId);
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );
  assertUuid(
    command.clientWorkflowRecordId,
    "The client record identifier",
    command.commandId,
  );

  if (
    !invoiceStatuses.has(command.expectedStatus) ||
    !invoiceStatuses.has(command.effectiveStatus)
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Choose valid invoice workflow statuses.",
      command.commandId,
    );
  }

  validateInvoiceWorkflowUpdates(command);
}

function normalizeInvoiceWorkflowUpdates(
  updates: InvoiceWorkflowUpdates,
) {
  return Object.fromEntries(
    Object.entries(updates).map(([field, value]) => [
      field,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as InvoiceWorkflowUpdates;
}

function validateRiskSignalCommand(
  workspaceId: string,
  command: ReviewRiskSignalCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );
  assertUuid(
    command.riskSignalId,
    "The risk signal identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The expected risk version is invalid.",
      command.commandId,
    );
  }
}

function validateDismissRiskSignalCommand(
  workspaceId: string,
  command: DismissRiskSignalCommand,
) {
  validateRiskSignalCommand(workspaceId, command);

  if (typeof command.resolutionNote !== "string") {
    throw new WorkspaceApiError(
      "invalid_request",
      "The dismissal reason must be text.",
      command.commandId,
    );
  }

  assertMinimumText(
    command.resolutionNote,
    5,
    "Add a short reason for dismissing this issue.",
    command.commandId,
  );
  assertMaximumText(
    command.resolutionNote,
    1000,
    "Keep the dismissal reason under 1,000 characters.",
    command.commandId,
  );
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
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );

  if (
    !workItemStatuses.has(command.expectedStatus) ||
    !workItemStatuses.has(command.update.status)
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

function validateReplaceDependenciesCommand(
  workspaceId: string,
  command: ReplaceWorkItemDependenciesCommand,
) {
  assertRequestId(command.commandId);
  assertUuid(
    workspaceId,
    "The workspace identifier",
    command.commandId,
  );
  assertUuid(
    command.clientEngagementId,
    "The engagement identifier",
    command.commandId,
  );
  assertUuid(
    command.workItemId,
    "The work item identifier",
    command.commandId,
  );

  if (
    !timestampPattern.test(command.expectedUpdatedAt) ||
    Number.isNaN(Date.parse(command.expectedUpdatedAt))
  ) {
    throw new WorkspaceApiError(
      "invalid_request",
      "The work item version is invalid. Refresh and try again.",
      command.commandId,
    );
  }

  if (command.prerequisiteIds.length > 50) {
    throw new WorkspaceApiError(
      "invalid_request",
      "A work item cannot have more than 50 prerequisites.",
      command.commandId,
    );
  }

  const uniqueIds = new Set(command.prerequisiteIds);

  if (uniqueIds.size !== command.prerequisiteIds.length) {
    throw new WorkspaceApiError(
      "invalid_request",
      "Each prerequisite can be selected only once.",
      command.commandId,
    );
  }

  for (const prerequisiteId of command.prerequisiteIds) {
    assertUuid(
      prerequisiteId,
      "A prerequisite identifier",
      command.commandId,
    );

    if (prerequisiteId === command.workItemId) {
      throw new WorkspaceApiError(
        "invalid_request",
        "A work item cannot depend on itself.",
        command.commandId,
      );
    }
  }
}

export function createWorkspaceApplicationApi(
  supabase: SupabaseClient,
  workspaceId: string,
): WorkspaceApplicationApi {
  return {
    engagements: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceClientEngagements(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API engagement query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Engagements could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateEngagementCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_create_client_engagement",
            {
              p_workspace_id: workspaceId,
              p_engagement: normalizeEngagementValues(
                command.engagement,
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapClientEngagementCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API engagement create failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The engagement could not be saved.",
          );
        }
      },

      async update(command) {
        validateUpdateEngagementCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_update_client_engagement",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_expected_updated_at:
                command.expectedUpdatedAt,
              p_updates: normalizeEngagementValues(
                command.updates,
              ),
              p_activity_note: command.activityNote.trim(),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapClientEngagementCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API engagement update failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The engagement could not be updated.",
          );
        }
      },
    },
    followUps: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceEngagementFollowUps(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API follow-up query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Completed follow-ups could not be loaded.",
          );
        }
      },

      async complete(command) {
        validateCompleteFollowUpCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_complete_engagement_follow_up",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_expected_updated_at:
                command.expectedUpdatedAt,
              p_completion: normalizeFollowUpCompletion(
                command.completion,
              ),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapFollowUpCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API follow-up completion failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The follow-up could not be completed.",
          );
        }
      },
    },
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

          const rpcResult =
            data as ClientRecordCommandRpcResult | null;
          const clientWorkflowRecordId =
            rpcResult?.clientRecord?.id;

          if (!clientWorkflowRecordId) {
            throw new WorkspaceApiError(
              "invalid_response",
              "The client record operation returned an invalid response.",
              commandId,
            );
          }

          const clientEngagement =
            await getPrimaryClientEngagement(
              supabase,
              workspaceId,
              clientWorkflowRecordId,
            );

          return mapClientRecordCommandResult(
            data,
            commandId,
            clientEngagement,
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

          const clientEngagement =
            await getPrimaryClientEngagement(
              supabase,
              workspaceId,
              command.clientRecordId,
            );

          return mapClientRecordCommandResult(
            data,
            command.commandId,
            clientEngagement,
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
    handoffNotes: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceHandoffNotes(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API handoff note query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Handoff notes could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateHandoffNoteCommand(
          workspaceId,
          command,
        );

        const { commandId, note } = command;

        try {
          const { data, error } = await supabase.rpc(
            "command_create_engagement_handoff_note",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_note: {
                clientWorkflowRecordId:
                  note.clientWorkflowRecordId,
                title: note.title.trim(),
                note: note.note.trim(),
                owner: note.owner.trim(),
              },
              p_idempotency_key: commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapHandoffNoteCommandResult(
            data,
            commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API handoff note create failed",
            { requestId: commandId, error },
          );
          throw mapOperationError(
            error,
            commandId,
            "The handoff note could not be saved.",
          );
        }
      },
    },
    proposals: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceProposalRecords(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API proposal query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Proposals and quotes could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateProposalCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_create_engagement_proposal_record",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_proposal: normalizeProposalValues(
                command.proposal,
              ),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapProposalCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API proposal create failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The proposal could not be saved.",
          );
        }
      },

      async update(command) {
        validateUpdateProposalCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_update_engagement_proposal_record",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_proposal_id: command.proposalId,
              p_expected_updated_at: command.expectedUpdatedAt,
              p_updates: normalizeProposalValues(command.updates),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapProposalCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API proposal update failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The proposal could not be updated.",
          );
        }
      },

      async applyRecommendation(command) {
        validateApplyProposalRecommendationCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_apply_engagement_proposal_workflow_recommendation",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_proposal_id: command.proposalId,
              p_client_workflow_record_id:
                command.clientWorkflowRecordId,
              p_expected_proposal_status:
                command.expectedStatus,
              p_updates: normalizeProposalWorkflowUpdates(
                command.updates,
              ),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapProposalRecommendationCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API proposal recommendation failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The recommended proposal step could not be applied.",
          );
        }
      },
    },
    invoices: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceInvoiceRecords(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API invoice query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Invoices could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateInvoiceCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_create_engagement_invoice_record",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_invoice: normalizeInvoiceValues(command.invoice),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapInvoiceCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API invoice create failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The invoice could not be saved.",
          );
        }
      },

      async update(command) {
        validateUpdateInvoiceCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_update_engagement_invoice_record",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_invoice_id: command.invoiceId,
              p_expected_updated_at: command.expectedUpdatedAt,
              p_updates: normalizeInvoiceValues(command.updates),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapInvoiceCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API invoice update failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The invoice could not be updated.",
          );
        }
      },

      async applyRecommendation(command) {
        validateApplyInvoiceRecommendationCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_apply_engagement_invoice_workflow_recommendation",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_invoice_id: command.invoiceId,
              p_client_workflow_record_id:
                command.clientWorkflowRecordId,
              p_expected_invoice_status: command.expectedStatus,
              p_effective_invoice_status: command.effectiveStatus,
              p_updates: normalizeInvoiceWorkflowUpdates(
                command.updates,
              ),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapInvoiceRecommendationCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API invoice recommendation failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The recommended invoice step could not be applied.",
          );
        }
      },
    },
    riskSignals: {
      async list() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceRiskSignals(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API risk signal query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Workflow risks could not be loaded.",
          );
        }
      },

      async review(command) {
        validateRiskSignalCommand(workspaceId, command);

        try {
          const { data, error } = await supabase.rpc(
            "command_update_engagement_risk_signal_review",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_risk_signal_id: command.riskSignalId,
              p_expected_updated_at: command.expectedUpdatedAt,
              p_action: "review",
              p_resolution_note: null,
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapRiskSignalCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API risk review failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The risk could not be marked as reviewed.",
          );
        }
      },

      async dismiss(command) {
        validateDismissRiskSignalCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_update_engagement_risk_signal_review",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_risk_signal_id: command.riskSignalId,
              p_expected_updated_at: command.expectedUpdatedAt,
              p_action: "dismiss",
              p_resolution_note:
                command.resolutionNote.trim(),
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapRiskSignalCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API risk dismissal failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The risk could not be dismissed.",
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

      async listDependencies() {
        const requestId = createOperationRequestId();

        try {
          assertUuid(
            workspaceId,
            "The workspace identifier",
            requestId,
          );
          return await getWorkspaceWorkflowTaskDependencies(
            supabase,
            workspaceId,
          );
        } catch (error) {
          console.error(
            "Workspace API Work Item dependencies query failed",
            { requestId, error },
          );
          throw mapOperationError(
            error,
            requestId,
            "Work Item prerequisites could not be loaded.",
          );
        }
      },

      async create(command) {
        validateCreateCommand(workspaceId, command);

        const { commandId, task } = command;

        try {
          const { data, error } = await supabase.rpc(
            "command_create_engagement_workflow_task",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_client_workflow_record_id:
                task.clientWorkflowRecordId,
              p_title: task.title.trim(),
              p_type: task.type,
              p_owner: task.owner.trim(),
              p_due_date: task.dueDate,
              p_status: task.status,
              p_criticality: task.criticality,
              p_phase: task.phase,
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
            "command_update_engagement_workflow_task_status",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
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

      async replaceDependencies(command) {
        validateReplaceDependenciesCommand(
          workspaceId,
          command,
        );

        try {
          const { data, error } = await supabase.rpc(
            "command_replace_engagement_workflow_task_dependencies",
            {
              p_workspace_id: workspaceId,
              p_client_engagement_id:
                command.clientEngagementId,
              p_workflow_task_id: command.workItemId,
              p_expected_updated_at: command.expectedUpdatedAt,
              p_depends_on_workflow_task_ids:
                command.prerequisiteIds,
              p_evaluation_date: getLocalDateKey(
                command.evaluationDate ?? new Date(),
              ),
              p_idempotency_key: command.commandId,
            },
          );

          if (error) {
            throw error;
          }

          return mapWorkItemDependenciesCommandResult(
            data,
            command.commandId,
          );
        } catch (error) {
          console.error(
            "Workspace API Work Item prerequisites command failed",
            { requestId: command.commandId, error },
          );
          throw mapOperationError(
            error,
            command.commandId,
            "The Work Item prerequisites could not be saved.",
          );
        }
      },
    },
  };
}
