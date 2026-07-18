"use client";

import { useMemo } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import type {
  ClientWorkflowRecord,
  LifecycleStage,
  RiskSignal,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import { getLifecycleStageLabel } from "@/lib/client-workflow-display";
import { formatDateTime } from "@/lib/format-date";
import { isActiveRiskSignal } from "@/lib/risk-signal-display";

const stageOrder: LifecycleStage[] = [
  "New lead",
  "Qualified lead",
  "Follow-up needed",
  "Discovery or call booked",
  "Proposal sent",
  "Won client",
  "Onboarding",
  "In delivery",
  "Waiting for approval",
  "Payment follow-up",
  "Completed",
  "Lost or inactive",
];

function getStageRank(stage: LifecycleStage) {
  return stageOrder.indexOf(stage);
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
  onOpenStage: (stage: LifecycleStage) => void;
  records: ClientWorkflowRecord[];
  riskSignals: RiskSignal[];
  tasks: WorkflowTask[];
};

export function WorkspaceSnapshot({
  errorMessage,
  isLoading,
  onOpenRecord,
  onOpenStage,
  records,
  riskSignals,
  tasks,
}: WorkspaceSnapshotProps) {
  const activeSignals = useMemo(
    () => riskSignals.filter(isActiveRiskSignal),
    [riskSignals],
  );

  const snapshot = useMemo(() => {
    const signalsByRecordId = new Map<string, RiskSignal[]>();
    const recordsByStage = new Map<
      LifecycleStage,
      ClientWorkflowRecord[]
    >();
    const blockedClientIds = new Set<string>();
    const waitingDecisionClientIds = new Set<string>();

    activeSignals.forEach((signal) => {
      const recordSignals =
        signalsByRecordId.get(signal.clientWorkflowRecordId) ?? [];

      recordSignals.push(signal);
      signalsByRecordId.set(
        signal.clientWorkflowRecordId,
        recordSignals,
      );
    });

    records.forEach((record) => {
      const stageRecords =
        recordsByStage.get(record.lifecycleStage) ?? [];

      stageRecords.push(record);
      recordsByStage.set(record.lifecycleStage, stageRecords);

      if (
        record.onboardingStatus === "Blocked" ||
        record.deliveryStatus === "Blocked" ||
        record.approvalStatus === "Blocked" ||
        record.paymentStatus === "Blocked"
      ) {
        blockedClientIds.add(record.id);
      }

      if (
        record.lifecycleStage === "Waiting for approval" ||
        record.approvalStatus === "Waiting"
      ) {
        waitingDecisionClientIds.add(record.id);
      }
    });

    tasks.forEach((task) => {
      if (task.status === "Blocked") {
        blockedClientIds.add(task.clientWorkflowRecordId);
      }

      if (task.type === "Approval" && task.status === "Waiting") {
        waitingDecisionClientIds.add(
          task.clientWorkflowRecordId,
        );
      }
    });

    const stages = Array.from(recordsByStage.entries())
      .map(([stage, stageRecords]) => {
        const orderedRecords = [...stageRecords].sort(
          (first, second) => first.name.localeCompare(second.name),
        );
        const affectedRecords = orderedRecords
          .filter(
            (record) =>
              (signalsByRecordId.get(record.id)?.length ?? 0) > 0,
          )
          .sort((first, second) => {
            const issueDifference =
              (signalsByRecordId.get(second.id)?.length ?? 0) -
              (signalsByRecordId.get(first.id)?.length ?? 0);

            return issueDifference || first.name.localeCompare(second.name);
          });
        const stageSignals = orderedRecords.flatMap(
          (record) => signalsByRecordId.get(record.id) ?? [],
        );

        return {
          activeIssueCount: stageSignals.length,
          affectedRecords,
          blockedClientCount: orderedRecords.filter((record) =>
            blockedClientIds.has(record.id),
          ).length,
          hasCriticalIssue: stageSignals.some(
            (signal) => signal.severity === "Critical",
          ),
          records: orderedRecords,
          stage,
          waitingDecisionCount: orderedRecords.filter((record) =>
            waitingDecisionClientIds.has(record.id),
          ).length,
        };
      })
      .sort(
        (first, second) =>
          getStageRank(first.stage) - getStageRank(second.stage),
      );

    const updateCandidates = [
      ...records.map((record) => record.updatedAt),
      ...riskSignals.map((signal) => signal.updatedAt),
      ...tasks.map((task) => task.updatedAt),
    ].filter(Boolean);
    const latestUpdateAt = updateCandidates.sort((first, second) =>
      second.localeCompare(first),
    )[0];

    return {
      affectedClientCount: new Set(
        activeSignals.map(
          (signal) => signal.clientWorkflowRecordId,
        ),
      ).size,
      blockedClientCount: blockedClientIds.size,
      latestUpdateAt,
      maxStageClientCount: Math.max(
        1,
        ...stages.map((stage) => stage.records.length),
      ),
      stages,
      stagesWithFriction: stages.filter(
        (stage) => stage.activeIssueCount > 0,
      ).length,
      waitingDecisionClientCount: waitingDecisionClientIds.size,
    };
  }, [activeSignals, records, riskSignals, tasks]);

  return (
    <section aria-labelledby="workflow-snapshot-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
            Review current stage load, open issues, blockers,
            and decisions waiting across client workflows.
          </p>
        </div>

        {!isLoading && snapshot.latestUpdateAt ? (
          <p className="inline-flex shrink-0 items-center gap-2 text-sm text-[#5F6862]">
            <Clock3 aria-hidden="true" className="size-4" />
            Updated {formatDateTime(snapshot.latestUpdateAt)}
          </p>
        ) : null}
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
          <div className="mt-7 grid grid-cols-2 gap-5 border-y border-[#D9DED8] py-5 lg:grid-cols-5">
            <SnapshotMetric
              label="Clients in workflow"
              value={records.length}
            />
            <SnapshotMetric
              label="Open issues"
              value={activeSignals.length}
            />
            <SnapshotMetric
              label="Affected clients"
              value={snapshot.affectedClientCount}
            />
            <SnapshotMetric
              label="Blocked clients"
              value={snapshot.blockedClientCount}
            />
            <SnapshotMetric
              label="Waiting decisions"
              value={snapshot.waitingDecisionClientCount}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-xl font-bold text-[#17201C]">
              Current stage load
            </h3>
            <p className="text-sm font-semibold text-[#5F6862]">
              {snapshot.stagesWithFriction} of {snapshot.stages.length}
              {" "}occupied stages have open issues
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-[#D9DED8] bg-white">
            {snapshot.stages.map((stage) => {
              const displayedRecords =
                stage.affectedRecords.length > 0
                  ? stage.affectedRecords
                  : stage.records;
              const displayLabel =
                stage.affectedRecords.length > 0
                  ? "Affected clients"
                  : "Clients in stage";
              const barWidth = Math.max(
                10,
                Math.round(
                  (stage.records.length /
                    snapshot.maxStageClientCount) *
                    100,
                ),
              );
              const barClasses = stage.hasCriticalIssue
                ? "bg-red-500"
                : stage.activeIssueCount > 0
                  ? "bg-amber-500"
                  : "bg-[#2D7F64]";

              return (
                <article
                  className="border-t border-[#D9DED8] px-5 py-5 first:border-t-0"
                  key={stage.stage}
                >
                  <div className="grid gap-5 xl:grid-cols-[minmax(13rem,1fr)_minmax(15rem,1fr)_minmax(16rem,1.2fr)] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="break-words font-bold text-[#17201C]">
                          {getLifecycleStageLabel(stage.stage)}
                        </h4>
                        <span className="shrink-0 text-sm font-bold text-[#5F6862]">
                          {stage.records.length}
                          {stage.records.length === 1
                            ? " client"
                            : " clients"}
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="mt-3 h-2 overflow-hidden rounded-full bg-[#E4E9E5]"
                      >
                        <div
                          className={`h-full rounded-full ${barClasses}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>

                    <dl className="grid grid-cols-3 gap-3">
                      <div className="min-w-0">
                        <dt className="text-xs font-bold text-[#5F6862]">
                          Open issues
                        </dt>
                        <dd className="mt-1 text-lg font-bold text-[#17201C]">
                          {stage.activeIssueCount}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-bold text-[#5F6862]">
                          Blocked
                        </dt>
                        <dd className="mt-1 text-lg font-bold text-[#17201C]">
                          {stage.blockedClientCount}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-bold text-[#5F6862]">
                          Waiting
                        </dt>
                        <dd className="mt-1 text-lg font-bold text-[#17201C]">
                          {stage.waitingDecisionCount}
                        </dd>
                      </div>
                    </dl>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#5F6862]">
                          {displayLabel}
                        </p>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-[#174F42] hover:bg-[#EDF3EF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42]"
                          onClick={() => onOpenStage(stage.stage)}
                          type="button"
                        >
                          View stage
                          <ArrowRight
                            aria-hidden="true"
                            className="size-4"
                          />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {displayedRecords.slice(0, 4).map((record) => (
                          <button
                            className="rounded-md border border-[#B9C8C2] px-2.5 py-1.5 text-sm font-bold text-[#174F42] hover:bg-[#EDF3EF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42]"
                            key={record.id}
                            onClick={() => onOpenRecord(record.id)}
                            type="button"
                          >
                            {record.name}
                          </button>
                        ))}
                        {displayedRecords.length > 4 ? (
                          <span className="px-1 py-1.5 text-sm font-bold text-[#5F6862]">
                            +{displayedRecords.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
