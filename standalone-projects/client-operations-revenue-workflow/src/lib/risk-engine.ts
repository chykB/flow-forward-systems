import {
  getDisputedInvoices,
  getOverdueInvoices,
} from "@/lib/invoice-dashboard";
import { getLocalDateKey } from "@/lib/date-key";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
  InvoiceRecord,
  ProposalRecord,
  RiskSignal,
  WorkflowTask,
} from "@/lib/client-workflow-types";

export type RiskSignalCandidate = Pick<
  RiskSignal,
  | "clientWorkflowRecordId"
  | "clientEngagementId"
  | "signalKey"
  | "sourceType"
  | "sourceRecordId"
  | "riskType"
  | "severity"
  | "reason"
  | "recommendedAction"
>;

type RiskEngineInput = {
  record: ClientWorkflowRecord;
  engagement: ClientEngagement;
  proposals: ProposalRecord[];
  invoices: InvoiceRecord[];
  tasks: WorkflowTask[];
  currentDate?: Date;
};

const severityRank: Record<RiskSignal["severity"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

const healthPenalty: Record<RiskSignal["severity"], number> = {
  Low: 5,
  Medium: 10,
  High: 20,
  Critical: 35,
};

function getFollowUpCandidate(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  currentDate: Date,
): RiskSignalCandidate[] {
  if (
    engagement.nextFollowUpAt >= getLocalDateKey(currentDate) ||
    engagement.engagementStatus !== "Active" ||
    engagement.lifecycleStage === "Completed" ||
    engagement.lifecycleStage === "Lost or inactive"
  ) {
    return [];
  }

  return [
    {
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `client_engagement:${engagement.id}:overdue_follow_up`,
      sourceType: "client_record",
      sourceRecordId: record.id,
      riskType: "overdue_follow_up",
      severity: "Medium",
      reason:
        `The scheduled client follow-up was due on ` +
        `${engagement.nextFollowUpAt}.`,
      recommendedAction:
        `Complete the overdue follow-up for ${record.name} ` +
        "and set a new follow-up date.",
    },
  ];
}

function getProposalCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  proposals: ProposalRecord[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const today = getLocalDateKey(currentDate);

  return proposals
    .filter(
      (proposal) =>
        proposal.clientWorkflowRecordId === record.id &&
        proposal.clientEngagementId === engagement.id &&
        (
          proposal.status === "Expired" ||
          (
            proposal.status === "Sent" &&
            Boolean(proposal.expiresAt) &&
            proposal.expiresAt < today
          )
        ),
    )
    .map((proposal) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey: `proposal:${proposal.id}:expired`,
      sourceType: "proposal" as const,
      sourceRecordId: proposal.id,
      riskType: "proposal_expired" as const,
      severity: "Medium" as const,
      reason:
        proposal.expiresAt
          ? `Proposal "${proposal.title}" expired on ${proposal.expiresAt}.`
          : `Proposal "${proposal.title}" is marked as expired.`,
      recommendedAction:
        `Review "${proposal.title}" and either renew, revise, ` +
        "or close the proposal.",
    }));
}

function getInvoiceCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  invoices: InvoiceRecord[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const clientInvoices = invoices.filter(
    (invoice) =>
      invoice.clientWorkflowRecordId === record.id &&
      invoice.clientEngagementId === engagement.id,
  );
  const disputedInvoices = getDisputedInvoices(clientInvoices);
  const disputedIds = new Set(
    disputedInvoices.map((invoice) => invoice.id),
  );
  const overdueInvoices = getOverdueInvoices(
    clientInvoices,
    currentDate,
  ).filter((invoice) => !disputedIds.has(invoice.id));

  const disputeCandidates = disputedInvoices.map((invoice) => {
    const reference =
      invoice.invoiceNumber || "this invoice";

    return {
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey: `invoice:${invoice.id}:disputed`,
      sourceType: "invoice" as const,
      sourceRecordId: invoice.id,
      riskType: "invoice_disputed" as const,
      severity: "Critical" as const,
      reason: `Payment for ${reference} is disputed.`,
      recommendedAction:
        `Review the dispute for ${reference} and record an ` +
        "explicit resolution before sending reminders.",
    };
  });

  const overdueCandidates = overdueInvoices.map((invoice) => {
    const reference =
      invoice.invoiceNumber || "this invoice";

    return {
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey: `invoice:${invoice.id}:overdue`,
      sourceType: "invoice" as const,
      sourceRecordId: invoice.id,
      riskType: "invoice_overdue" as const,
      severity: "High" as const,
      reason: invoice.dueDate
        ? `${reference} was due on ${invoice.dueDate}.`
        : `${reference} is marked as overdue.`,
      recommendedAction:
        `Review ${reference} and send a human-approved ` +
        "payment reminder.",
    };
  });

  return [...disputeCandidates, ...overdueCandidates];
}

function getBlockedDeliveryCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
): RiskSignalCandidate[] {
  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Delivery" &&
        task.status === "Blocked",
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:delivery_blocked`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "delivery_blocked" as const,
      severity: task.criticality,
      reason:
        `Delivery work item "${task.title}" is blocked.`,
      recommendedAction:
        `Resolve the blocker for "${task.title}" with ` +
        `${task.owner}, then update the work item status.`,
    }));
}

function getOverdueDeliveryCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const today = getLocalDateKey(currentDate);

  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Delivery" &&
        task.dueDate < today &&
        (
          task.status === "Not started" ||
          task.status === "In progress" ||
          task.status === "Waiting"
        ),
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:delivery_delayed`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "delivery_delayed" as const,
      severity: task.criticality,
      reason:
        `Delivery work item "${task.title}" was due on ${task.dueDate}.`,
      recommendedAction:
        `Follow up on "${task.title}" with ${task.owner}, then update the delivery work item status.`,
    }));
}

function getDelayedApprovalCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const today = getLocalDateKey(currentDate);

  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Approval" &&
        (
          task.status === "Blocked" ||
          (
            task.dueDate < today &&
            (
              task.status === "Not started" ||
              task.status === "In progress" ||
              task.status === "Waiting"
            )
          )
        ),
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:approval_delayed`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "approval_delayed" as const,
      severity: task.criticality,
      reason:
        task.status === "Blocked"
          ? `Approval work item "${task.title}" is blocked.`
          : `Approval work item "${task.title}" was due on ${task.dueDate}.`,
      recommendedAction:
        task.status === "Blocked"
          ? `Resolve the approval blocker for "${task.title}" with ${task.owner}, then update the work item status.`
          : `Follow up on "${task.title}" with ${task.owner}, then update the approval work item status.`,
    }));
}

function getDelayedHandoffCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const today = getLocalDateKey(currentDate);

  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Handoff" &&
        (
          task.status === "Blocked" ||
          (
            task.dueDate < today &&
            (
              task.status === "Not started" ||
              task.status === "In progress" ||
              task.status === "Waiting"
            )
          )
        ),
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:handoff_delayed`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "handoff_delayed" as const,
      severity: task.criticality,
      reason:
        task.status === "Blocked"
          ? `Handoff work item "${task.title}" is blocked.`
          : `Handoff work item "${task.title}" was due on ${task.dueDate}.`,
      recommendedAction:
        task.status === "Blocked"
          ? `Resolve the handoff blocker for "${task.title}" with ${task.owner}, then update the work item status.`
          : `Follow up on "${task.title}" with ${task.owner}, then update the handoff work item status.`,
    }));
}

function getDelayedOnboardingCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
  currentDate: Date,
): RiskSignalCandidate[] {
  const today = getLocalDateKey(currentDate);

  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Onboarding" &&
        (
          task.status === "Blocked" ||
          (
            task.dueDate < today &&
            (
              task.status === "Not started" ||
              task.status === "In progress" ||
              task.status === "Waiting"
            )
          )
        ),
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:onboarding_delayed`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "onboarding_delayed" as const,
      severity: task.criticality,
      reason:
        task.status === "Blocked"
          ? `Onboarding work item "${task.title}" is blocked.`
          : `Onboarding work item "${task.title}" was due on ${task.dueDate}.`,
      recommendedAction:
        task.status === "Blocked"
          ? `Resolve the onboarding blocker for "${task.title}" with ${task.owner}, then update the work item status.`
          : `Follow up on "${task.title}" with ${task.owner}, then update the onboarding work item status.`,
    }));
}

function getBlockedPaymentCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
): RiskSignalCandidate[] {
  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Payment" &&
        task.status === "Blocked",
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:payment_blocked`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "payment_blocked" as const,
      severity: task.criticality,
      reason:
        `Payment work item "${task.title}" is blocked.`,
      recommendedAction:
        `Resolve the payment blocker for "${task.title}" with ${task.owner}, then update the work item status.`,
    }));
}

function getBlockedFollowUpTaskCandidates(
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  tasks: WorkflowTask[],
): RiskSignalCandidate[] {
  return tasks
    .filter(
      (task) =>
        task.clientWorkflowRecordId === record.id &&
        task.clientEngagementId === engagement.id &&
        task.type === "Follow-up" &&
        task.status === "Blocked",
    )
    .map((task) => ({
      clientWorkflowRecordId: record.id,
      clientEngagementId: engagement.id,
      signalKey:
        `workflow_task:${task.id}:follow_up_blocked`,
      sourceType: "workflow_task" as const,
      sourceRecordId: task.id,
      riskType: "follow_up_blocked" as const,
      severity: task.criticality,
      reason:
        `Follow-up work item "${task.title}" is blocked.`,
      recommendedAction:
        `Resolve the follow-up blocker for "${task.title}" with ${task.owner}, then update the work item status.`,
    }));
}

export function getRiskSignalCandidates({
  record,
  engagement,
  proposals,
  invoices,
  tasks,
  currentDate = new Date(),
}: RiskEngineInput) {
  const candidates = [
    ...getFollowUpCandidate(
      record,
      engagement,
      currentDate,
    ),
    ...getProposalCandidates(
      record,
      engagement,
      proposals,
      currentDate,
    ),
    ...getInvoiceCandidates(
      record,
      engagement,
      invoices,
      currentDate,
    ),
    ...getBlockedDeliveryCandidates(
      record,
      engagement,
      tasks,
    ),
    ...getOverdueDeliveryCandidates(
      record,
      engagement,
      tasks,
      currentDate,
    ),
    ...getDelayedApprovalCandidates(
      record,
      engagement,
      tasks,
      currentDate,
    ),
    ...getDelayedHandoffCandidates(
      record,
      engagement,
      tasks,
      currentDate,
    ),
    ...getDelayedOnboardingCandidates(
      record,
      engagement,
      tasks,
      currentDate,
    ),
    ...getBlockedPaymentCandidates(
      record,
      engagement,
      tasks,
    ),
    ...getBlockedFollowUpTaskCandidates(
      record,
      engagement,
      tasks,
    ),
  ];

  return candidates.sort((first, second) => {
    const severityDifference =
      severityRank[second.severity] -
      severityRank[first.severity];

    return (
      severityDifference ||
      first.signalKey.localeCompare(second.signalKey)
    );
  });
}

export function calculateWorkflowHealthScore(
  signals: Array<Pick<RiskSignal, "severity">>,
) {
  const totalPenalty = signals.reduce(
    (sum, signal) => sum + healthPenalty[signal.severity],
    0,
  );

  return Math.max(0, Math.min(100, 100 - totalPenalty));
}
