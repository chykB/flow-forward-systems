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
  | "At risk"
  | "Completed"
  | "Lost or inactive";

export type PriorityLevel = "High" | "Medium" | "Low";

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
  | "Disputed";

export type RiskSignalSeverity = "Low" | "Medium" | "High" | "Critical";

export type RiskSignalStatus = "Open" | "Reviewed" | "Resolved" | "Dismissed";

export type WorkflowStatus =
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

export type ProposalRecord = {
  id: string;
  clientWorkflowRecordId: string;
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
  createdAt: string;
  updatedAt: string;
};

export type RiskSignal = {
  id: string;
  clientWorkflowRecordId: string;
  riskType: string;
  severity: RiskSignalSeverity;
  reason: string;
  status: RiskSignalStatus;
  createdAt: string;
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
  title: string;
  type: TaskType;
  owner: string;
  dueDate: string;
  status: WorkflowStatus;
  criticality: TaskCriticality;
  createdAt: string;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  clientWorkflowRecordId: string;
  actionType: string;
  note: string;
  createdAt: string;
};

export type HandoffNote = {
  id: string;
  clientWorkflowRecordId: string;
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