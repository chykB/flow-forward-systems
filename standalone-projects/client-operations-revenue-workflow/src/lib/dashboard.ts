import type { ClientWorkflowRecord, WorkflowTask } from "./client-workflow-types";

const today = "2026-07-01";

function isBeforeToday(date: string) {
  return date < today;
}

function isTodayOrSoon(date: string) {
  return date >= today && date <= "2026-07-04";
}

export function getOverdueFollowUps(records: ClientWorkflowRecord[]) {
  return records.filter(
    (record) =>
      record.nextFollowUpAt &&
      isBeforeToday(record.nextFollowUpAt) &&
      record.lifecycleStage !== "Completed" &&
      record.lifecycleStage !== "Lost or inactive",
  );
}

export function getFollowUpsDueSoon(records: ClientWorkflowRecord[]) {
  return records.filter(
    (record) =>
      record.nextFollowUpAt &&
      isTodayOrSoon(record.nextFollowUpAt) &&
      record.lifecycleStage !== "Completed" &&
      record.lifecycleStage !== "Lost or inactive",
  );
}

export function getWaitingApprovals(records: ClientWorkflowRecord[]) {
  return records.filter((record) => record.approvalStatus === "Waiting");
}

export function getPaymentFollowUps(records: ClientWorkflowRecord[]) {
  return records.filter(
    (record) =>
      record.paymentStatus === "Waiting" ||
      record.paymentStatus === "Blocked" ||
      record.lifecycleStage === "Payment follow-up",
  );
}

export function getAtRiskClients(records: ClientWorkflowRecord[]) {
  return records.filter(
    (record) => record.riskLevel === "High" || record.lifecycleStage === "At risk",
  );
}

export function getBlockedDeliveryTasks(tasks: WorkflowTask[]) {
  return tasks.filter(
    (task) => task.type === "Delivery" && task.status === "Blocked",
  );
}