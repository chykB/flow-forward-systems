import type {
  ClientWorkflowRecord,
  RiskSignal,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import {
  getFutureLocalDateKey,
  getLocalDateKey,
} from "@/lib/date-key";
import { isActiveRiskSignal } from "@/lib/risk-signal-display";

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

export function getClientsWithActiveWorkflowRisk(
  records: ClientWorkflowRecord[],
  riskSignals: RiskSignal[],
) {
  const affectedClientIds = new Set(
    riskSignals
      .filter(isActiveRiskSignal)
      .map(
        (signal) => signal.clientWorkflowRecordId,
      ),
  );

  return records.filter((record) =>
    affectedClientIds.has(record.id),
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
