import type {
  ClientWorkflowRecord,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import {
  getFutureLocalDateKey,
  getLocalDateKey,
} from "@/lib/date-key";

const FOLLOW_UP_WINDOW_DAYS = 3;

function recordCanRequireFollowUp(
  record: ClientWorkflowRecord,
) {
  return (
    record.lifecycleStage !== "Completed" &&
    record.lifecycleStage !== "Lost or inactive"
  );
}

export function getOverdueFollowUps(
  records: ClientWorkflowRecord[],
  currentDate = new Date(),
) {
  const today = getLocalDateKey(currentDate);

  return records.filter(
    (record) =>
      Boolean(record.nextFollowUpAt) &&
      record.nextFollowUpAt < today &&
      recordCanRequireFollowUp(record),
  );
}

export function getFollowUpsDueSoon(
  records: ClientWorkflowRecord[],
  currentDate = new Date(),
) {
  const today = getLocalDateKey(currentDate);
  const windowEnd = getFutureLocalDateKey(
    currentDate,
    FOLLOW_UP_WINDOW_DAYS,
  );

  return records.filter(
    (record) =>
      Boolean(record.nextFollowUpAt) &&
      record.nextFollowUpAt >= today &&
      record.nextFollowUpAt <= windowEnd &&
      recordCanRequireFollowUp(record),
  );
}

export function getWaitingApprovals(
  records: ClientWorkflowRecord[],
) {
  return records.filter(
    (record) => record.approvalStatus === "Waiting",
  );
}

export function getPaymentFollowUps(
  records: ClientWorkflowRecord[],
) {
  return records.filter(
    (record) =>
      record.paymentStatus === "Waiting" ||
      record.paymentStatus === "Blocked" ||
      record.lifecycleStage === "Payment follow-up",
  );
}

export function getAtRiskClients(
  records: ClientWorkflowRecord[],
) {
  return records.filter(
    (record) =>
      record.riskLevel === "High" ||
      record.lifecycleStage === "At risk",
  );
}

export function getBlockedDeliveryTasks(
  tasks: WorkflowTask[],
) {
  return tasks.filter(
    (task) =>
      task.type === "Delivery" &&
      task.status === "Blocked",
  );
}