"use client";

import { useMemo } from "react";
import type {
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import { isActiveRiskSignal } from "@/lib/risk-signal-display";

const stageOrder = [
  "New lead",
  "Qualified lead",
  "Discovery or call booked",
  "Proposal sent",
  "Won client",
  "Onboarding",
  "In delivery",
  "Awaiting approval",
  "Payment follow-up",
  "Completed",
  "Lost or inactive",
  "At risk",
];

function getStageRank(stage: string) {
  const rank = stageOrder.indexOf(stage);
  return rank === -1 ? stageOrder.length : rank;
}

function SnapshotMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-[#5F6862]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#17201C]">
        {value}
      </p>
    </div>
  );
}

type WorkspaceSnapshotProps = {
  errorMessage: string;
  isLoading: boolean;
  onOpenRecord: (recordId: string) => void;
  records: ClientWorkflowRecord[];
  riskSignals: RiskSignal[];
};

export function WorkspaceSnapshot({
  errorMessage,
  isLoading,
  onOpenRecord,
  records,
  riskSignals,
}: WorkspaceSnapshotProps) {
  const activeSignals = useMemo(
    () => riskSignals.filter(isActiveRiskSignal),
    [riskSignals],
  );

  const snapshot = useMemo(() => {
    const issueCountByRecordId = new Map<string, number>();
    const recordsByStage = new Map<
      string,
      ClientWorkflowRecord[]
    >();

    activeSignals.forEach((signal) => {
      issueCountByRecordId.set(
        signal.clientWorkflowRecordId,
        (issueCountByRecordId.get(
          signal.clientWorkflowRecordId,
        ) ?? 0) + 1,
      );
    });

    records.forEach((record) => {
      const stageRecords =
        recordsByStage.get(record.lifecycleStage) ?? [];
      stageRecords.push(record);
      recordsByStage.set(record.lifecycleStage, stageRecords);
    });

    const stages = Array.from(recordsByStage.entries())
      .map(([stage, stageRecords]) => {
        const affectedRecords = stageRecords.filter(
          (record) =>
            (issueCountByRecordId.get(record.id) ?? 0) > 0,
        );
        const activeIssueCount = affectedRecords.reduce(
          (sum, record) =>
            sum + (issueCountByRecordId.get(record.id) ?? 0),
          0,
        );

        return {
          activeIssueCount,
          affectedRecords,
          records: stageRecords,
          stage,
        };
      })
      .sort(
        (first, second) =>
          getStageRank(first.stage) -
            getStageRank(second.stage) ||
          first.stage.localeCompare(second.stage),
      );

    return {
      affectedClientCount: new Set(
        activeSignals.map(
          (signal) => signal.clientWorkflowRecordId,
        ),
      ).size,
      stages,
      stagesWithFriction: stages.filter(
        (stage) => stage.activeIssueCount > 0,
      ).length,
    };
  }, [activeSignals, records]);

  return (
    <section aria-labelledby="workflow-snapshot-title">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
          Workflow Snapshot
        </p>
        <h2
          className="mt-3 text-3xl font-bold"
          id="workflow-snapshot-title"
        >
          See where client work is concentrated
        </h2>
        <p className="mt-3 leading-7 text-[#5F6862]">
          Review the current client distribution and active
          friction at each workflow stage.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-[#5F6862]">
          Loading workflow snapshot...
        </p>
      ) : records.length === 0 ? (
        <p className="mt-6 rounded-md bg-white p-5 text-[#5F6862]">
          No client workflows are available yet.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-5 border-y border-[#D9DED8] py-5 sm:grid-cols-2 lg:grid-cols-4">
            <SnapshotMetric
              label="Clients in workflow"
              value={records.length}
            />
            <SnapshotMetric
              label="Active issues"
              value={activeSignals.length}
            />
            <SnapshotMetric
              label="Affected clients"
              value={snapshot.affectedClientCount}
            />
            <SnapshotMetric
              label="Stages with friction"
              value={snapshot.stagesWithFriction}
            />
          </div>

          <div className="mt-7 overflow-hidden rounded-lg border border-[#D9DED8] bg-white">
            <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_minmax(0,1.3fr)] gap-4 bg-[#EDF3EF] px-5 py-3 text-sm font-bold text-[#5F6862] md:grid">
              <span>Workflow stage</span>
              <span>Clients</span>
              <span>Issues</span>
              <span>Affected clients</span>
            </div>

            {snapshot.stages.map((stage) => (
              <div
                className="grid gap-4 border-t border-[#D9DED8] px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_7rem_7rem_minmax(0,1.3fr)] md:items-center"
                key={stage.stage}
              >
                <div>
                  <p className="text-xs font-bold uppercase text-[#5F6862] md:hidden">
                    Workflow stage
                  </p>
                  <p className="font-bold text-[#17201C]">
                    {stage.stage}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5F6862] md:hidden">
                    Clients
                  </p>
                  <p className="font-bold">{stage.records.length}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5F6862] md:hidden">
                    Issues
                  </p>
                  <p className="font-bold">{stage.activeIssueCount}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5F6862] md:hidden">
                    Affected clients
                  </p>
                  {stage.affectedRecords.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-2 md:mt-0">
                      {stage.affectedRecords
                        .slice(0, 3)
                        .map((record) => (
                          <button
                            className="rounded-md border border-[#B9C8C2] px-2 py-1 text-sm font-bold text-[#174F42] hover:bg-[#EDF3EF]"
                            key={record.id}
                            onClick={() => onOpenRecord(record.id)}
                            type="button"
                          >
                            {record.name}
                          </button>
                        ))}
                      {stage.affectedRecords.length > 3 ? (
                        <span className="px-1 py-1 text-sm font-bold text-[#5F6862]">
                          +{stage.affectedRecords.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[#5F6862] md:mt-0">
                      No active friction
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
