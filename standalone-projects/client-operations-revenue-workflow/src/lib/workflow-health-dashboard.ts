import type {
  ClientEngagement,
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import {
  getRiskSignalSeverityRank,
  isActiveRiskSignal,
} from "@/lib/risk-signal-display";

export type WorkspaceRiskQueueItem = {
  engagement: ClientEngagement;
  record: ClientWorkflowRecord;
  signal: RiskSignal;
};

export type WorkspaceRiskQueueGroup = {
  engagement: ClientEngagement;
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
  engagements: ClientEngagement[],
  riskSignals: RiskSignal[],
) {
  const recordsById = new Map(
    records.map((record) => [record.id, record]),
  );
  const engagementsById = new Map(
    engagements.map((engagement) => [engagement.id, engagement]),
  );

  return riskSignals
    .filter(isActiveRiskSignal)
    .flatMap((signal): WorkspaceRiskQueueItem[] => {
      const record = recordsById.get(
        signal.clientWorkflowRecordId,
      );
      const engagement = engagementsById.get(
        signal.clientEngagementId,
      );

      return record && engagement
        ? [{ engagement, record, signal }]
        : [];
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
        first.engagement.workflowHealthScore -
        second.engagement.workflowHealthScore;

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
        first.engagement.title.localeCompare(
          second.engagement.title,
        ) ||
        first.signal.id.localeCompare(second.signal.id)
      );
    });
}

export function buildWorkspaceRiskQueueGroups(
  records: ClientWorkflowRecord[],
  engagements: ClientEngagement[],
  riskSignals: RiskSignal[],
) {
  const groupsByEngagementId = new Map<
    string,
    WorkspaceRiskQueueGroup
  >();

  buildWorkspaceRiskQueue(
    records,
    engagements,
    riskSignals,
  ).forEach(
    ({ engagement, record, signal }) => {
      const existingGroup = groupsByEngagementId.get(
        engagement.id,
      );

      if (existingGroup) {
        existingGroup.signals.push(signal);
        return;
      }

      groupsByEngagementId.set(engagement.id, {
        engagement,
        record,
        signals: [signal],
      });
    },
  );

  return [...groupsByEngagementId.values()];
}

export function getWorkspaceHealthSummary(
  engagements: ClientEngagement[],
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
  const activeEngagements = engagements.filter(
    (engagement) => engagement.engagementStatus === "Active",
  );
  const totalHealthScore = activeEngagements.reduce(
    (sum, engagement) =>
      sum + engagement.workflowHealthScore,
    0,
  );

  return {
    activeRiskCount: activeSignals.length,
    affectedClientCount: affectedClientIds.size,
    averageHealthScore:
      activeEngagements.length > 0
        ? Math.round(
            totalHealthScore / activeEngagements.length,
          )
        : null,
    criticalRiskCount: activeSignals.filter(
      (signal) => signal.severity === "Critical",
    ).length,
  };
}
