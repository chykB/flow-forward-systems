import type {
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import {
  getRiskSignalSeverityRank,
  isActiveRiskSignal,
} from "@/lib/risk-signal-display";

export type WorkspaceRiskQueueItem = {
  record: ClientWorkflowRecord;
  signal: RiskSignal;
};

export type WorkspaceRiskQueueGroup = {
  record: ClientWorkflowRecord;
  signals: RiskSignal[];
};

export type WorkspaceHealthSummary = {
  activeRiskCount: number;
  affectedClientCount: number;
  averageHealthScore: number | null;
  criticalRiskCount: number;
};

function getReviewPriority(
  status: RiskSignal["status"],
) {
  return status === "Open" ? 1 : 0;
}

export function buildWorkspaceRiskQueue(
  records: ClientWorkflowRecord[],
  riskSignals: RiskSignal[],
) {
  const recordsById = new Map(
    records.map((record) => [record.id, record]),
  );

  return riskSignals
    .filter(isActiveRiskSignal)
    .flatMap((signal): WorkspaceRiskQueueItem[] => {
      const record = recordsById.get(
        signal.clientWorkflowRecordId,
      );

      return record ? [{ record, signal }] : [];
    })
    .sort((first, second) => {
      const severityDifference =
        getRiskSignalSeverityRank(
          second.signal.severity,
        ) -
        getRiskSignalSeverityRank(
          first.signal.severity,
        );

      if (severityDifference !== 0) {
        return severityDifference;
      }

      const healthDifference =
        first.record.workflowHealthScore -
        second.record.workflowHealthScore;

      if (healthDifference !== 0) {
        return healthDifference;
      }

      const reviewDifference =
        getReviewPriority(second.signal.status) -
        getReviewPriority(first.signal.status);

      if (reviewDifference !== 0) {
        return reviewDifference;
      }

      const ageDifference =
        first.signal.lastDetectedAt.localeCompare(
          second.signal.lastDetectedAt,
        );

      return (
        ageDifference ||
        first.record.name.localeCompare(second.record.name) ||
        first.signal.id.localeCompare(second.signal.id)
      );
    });
}

export function buildWorkspaceRiskQueueGroups(
  records: ClientWorkflowRecord[],
  riskSignals: RiskSignal[],
) {
  const groupsByRecordId = new Map<
    string,
    WorkspaceRiskQueueGroup
  >();

  buildWorkspaceRiskQueue(records, riskSignals).forEach(
    ({ record, signal }) => {
      const existingGroup = groupsByRecordId.get(record.id);

      if (existingGroup) {
        existingGroup.signals.push(signal);
        return;
      }

      groupsByRecordId.set(record.id, {
        record,
        signals: [signal],
      });
    },
  );

  return [...groupsByRecordId.values()];
}

export function getWorkspaceHealthSummary(
  records: ClientWorkflowRecord[],
  riskSignals: RiskSignal[],
): WorkspaceHealthSummary {
  const activeSignals = riskSignals.filter(
    isActiveRiskSignal,
  );
  const affectedClientIds = new Set(
    activeSignals.map(
      (signal) => signal.clientWorkflowRecordId,
    ),
  );
  const totalHealthScore = records.reduce(
    (sum, record) =>
      sum + record.workflowHealthScore,
    0,
  );

  return {
    activeRiskCount: activeSignals.length,
    affectedClientCount: affectedClientIds.size,
    averageHealthScore:
      records.length > 0
        ? Math.round(totalHealthScore / records.length)
        : null,
    criticalRiskCount: activeSignals.filter(
      (signal) => signal.severity === "Critical",
    ).length,
  };
}
