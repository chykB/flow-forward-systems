export type LifecycleStage =
  | "New lead"
  | "Qualified lead"
  | "Follow-up needed"
  | "Discovery or call booked"
  | "Proposal sent"
  | "Won client"
  | "Onboarding"
  | "In delivery"
  | "Waiting for approval"
  | "Payment follow-up"
  | "Completed"
  | "Lost or inactive";

export type PriorityLevel = "High" | "Medium" | "Low";

export type EngagementStatus =
  | "Active"
  | "Completed"
  | "Cancelled";

export type FollowUpOutcome =
  | "Replied"
  | "No response"
  | "Meeting booked"
  | "Decision received"
  | "Not proceeding"
  | "Other";

export type RiskLevel = "High" | "Medium" | "Low";
export type ClientType =
  | "Lead"
  | "New client"
  | "Active client"
  | "Returning client"
  | "Past client";

export type ReturningClientStatus =
  | "Not returning"
  | "Potential reactivation"
  | "Repeat project opportunity"
  | "Reactivated"
  | "Dormant";

export type ProposalStatus =
  | "Not needed"
  | "Draft needed"
  | "Sent"
  | "Revision requested"
  | "Accepted"
  | "Rejected"
  | "Expired";

export type InvoiceStatus =
  | "Not needed"
  | "Draft needed"
  | "Sent"
  | "Due soon"
  | "Overdue"
  | "Paid"
  | "Disputed"
  | "Voided";

export type InvoiceDisputeResolutionOutcome =
  | "Payment received"
  | "Payment still due"
  | "Invoice voided or replaced";

export type RiskSignalSeverity = "Low" | "Medium" | "High" | "Critical";

export type RiskSignalStatus = "Open" | "Reviewed" | "Resolved" | "Dismissed";
export type RiskSignalSourceType =
  | "client_record"
  | "proposal"
  | "invoice"
  | "workflow_task";

export type RiskSignalType =
  | "overdue_follow_up"
  | "proposal_expired"
  | "invoice_overdue"
  | "invoice_disputed"
  | "delivery_blocked"
  | "delivery_delayed"
  | "approval_delayed"
  | "handoff_delayed"
  | "onboarding_delayed"
  | "payment_blocked"
  | "follow_up_blocked";

export type WorkflowStatus =
  | "Planned"
  | "Not started"
  | "In progress"
  | "Waiting"
  | "Blocked"
  | "Complete"
  | "Not needed";

export type TaskType =
  | "Follow-up"
  | "Onboarding"
  | "Delivery"
  | "Approval"
  | "Payment"
  | "Handoff";

export type TaskCriticality = "Critical" | "High" | "Medium" | "Low";

export type WorkItemPhase =
  | "Lead"
  | "Proposal"
  | "Onboarding"
  | "Delivery"
  | "Approval"
  | "Payment"
  | "Handoff";

export type ClientEngagement = {
  id: string;
  clientWorkflowRecordId: string;
  title: string;
  engagementStatus: EngagementStatus;
  lifecycleStage: LifecycleStage;
  priority: PriorityLevel;
  estimatedValue: number;
  workflowHealthScore: number;
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
  onboardingStatus: WorkflowStatus;
  deliveryStatus: WorkflowStatus;
  approvalStatus: WorkflowStatus;
  paymentStatus: WorkflowStatus;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EngagementFollowUp = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  outcome: FollowUpOutcome;
  note: string;
  completedAt: string;
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
  createdAt: string;
};

export type ProposalRecord = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  title: string;
  amount: number;
  currency: string;
  status: ProposalStatus;
  sentAt: string;
  expiresAt: string;
  acceptedAt: string;
  rejectedAt: string;
  revisionRequestedAt: string;
  notes: string;
  workflowActionAppliedStatus: ProposalStatus | "";
  workflowActionAppliedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceRecord = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  status: InvoiceStatus;
  paymentLink: string;
  sentAt: string;
  dueDate: string;
  paidAt: string;
  disputeReason: string;
  disputedAt: string;
  disputeResolvedAt: string;
  disputeResolutionOutcome:
    | InvoiceDisputeResolutionOutcome
    | "";
  disputeResolutionNote: string;
  workflowActionAppliedStatus: InvoiceStatus | "";
  workflowActionAppliedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskSignal = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  signalKey: string;
  sourceType: RiskSignalSourceType;
  sourceRecordId: string;
  riskType: RiskSignalType;
  severity: RiskSignalSeverity;
  reason: string;
  recommendedAction: string;
  status: RiskSignalStatus;
  lastDetectedAt: string;
  resolvedAt: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientWorkflowRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  source: string;
  interest: string;
  message: string;
  lifecycleStage: LifecycleStage;
  clientType: ClientType;
  returningClientStatus: ReturningClientStatus;
  lastProjectDate: string;
  estimatedValue: number;
  workflowHealthScore: number;
  priority: PriorityLevel;
  riskLevel: RiskLevel;
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
  onboardingStatus: WorkflowStatus;
  deliveryStatus: WorkflowStatus;
  approvalStatus: WorkflowStatus;
  paymentStatus: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTask = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  title: string;
  type: TaskType;
  owner: string;
  dueDate: string;
  status: WorkflowStatus;
  criticality: TaskCriticality;
  phase: WorkItemPhase;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTaskDependency = {
  clientEngagementId: string;
  workflowTaskId: string;
  dependsOnWorkflowTaskId: string;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  actionType: string;
  note: string;
  createdAt: string;
};

export type HandoffNote = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  title: string;
  note: string;
  owner: string;
  createdAt: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  lifecycleStage: LifecycleStage;
  useCase: string;
  tone: string;
  body: string;
};
