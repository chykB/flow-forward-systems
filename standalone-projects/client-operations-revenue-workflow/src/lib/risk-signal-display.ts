import type {
  RiskSignal,
  RiskSignalSeverity,
  RiskSignalStatus,
  RiskSignalType,
} from "@/lib/client-workflow-types";

const riskTypeLabels: Record<RiskSignalType, string> = {
  overdue_follow_up: "Overdue follow-up",
  proposal_expired: "Expired proposal",
  invoice_overdue: "Invoice overdue",
  invoice_disputed: "Payment dispute",
  delivery_blocked: "Delivery blocker",
  approval_delayed: "Approval delay",
};

const riskStatusLabels: Record<RiskSignalStatus, string> = {
  Open: "Needs review",
  Reviewed: "Reviewed",
  Resolved: "Resolved",
  Dismissed: "Dismissed",
};

const activeStatuses = new Set<RiskSignalStatus>([
  "Open",
  "Reviewed",
]);

const severityRank: Record<RiskSignalSeverity, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

export function getRiskSignalTypeLabel(
  riskType: RiskSignalType,
) {
  return riskTypeLabels[riskType];
}

export function getRiskSignalStatusLabel(
  status: RiskSignalStatus,
) {
  return riskStatusLabels[status];
}

export function isActiveRiskSignal(
  signal: Pick<RiskSignal, "status">,
) {
  return activeStatuses.has(signal.status);
}

export function getRiskSignalSeverityRank(
  severity: RiskSignalSeverity,
) {
  return severityRank[severity];
}

export function getWorkflowHealthLabel(score: number) {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Needs attention";
  if (score >= 50) return "At risk";
  return "Critical";
}