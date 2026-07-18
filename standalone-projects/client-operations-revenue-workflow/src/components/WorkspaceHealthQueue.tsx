"use client";

import { useMemo } from "react";
import type {
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import { formatDateTime } from "@/lib/format-date";
import {
  getRiskSignalStatusLabel,
  getRiskSignalTypeLabel,
  getWorkflowHealthLabel,
} from "@/lib/risk-signal-display";
import {
  buildWorkspaceRiskQueueGroups,
  getWorkspaceHealthSummary,
} from "@/lib/workflow-health-dashboard";

type WorkspaceHealthQueueProps = {
  errorMessage: string;
  isLoading: boolean;
  onReviewRecord: (recordId: string) => void;
  records: ClientWorkflowRecord[];
  riskSignals: RiskSignal[];
};

function getSeverityClasses(
  severity: RiskSignal["severity"],
) {
  if (severity === "Critical") {
    return "bg-red-100 text-red-800";
  }

  if (severity === "High") {
    return "bg-amber-100 text-amber-900";
  }

  if (severity === "Medium") {
    return "bg-yellow-100 text-yellow-900";
  }

  return "bg-[#EDF3EF] text-[#174F42]";
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-[#5F6862]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[#17201C]">
        {value}
      </p>
    </div>
  );
}

function RiskIssue({ signal }: { signal: RiskSignal }) {
  return (
    <section className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h5 className="font-bold text-[#17201C]">
            {getRiskSignalTypeLabel(signal.riskType)}
          </h5>
          <p className="mt-2 leading-7 text-[#5F6862]">
            {signal.reason}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${getSeverityClasses(
              signal.severity,
            )}`}
          >
            {signal.severity}
          </span>
          <span className="rounded-md bg-[#EDF3EF] px-3 py-2 text-sm font-bold text-[#174F42]">
            {getRiskSignalStatusLabel(signal.status)}
          </span>
        </div>
      </div>

      <div className="mt-4 border-l-4 border-[#174F42] pl-4">
        <p className="text-sm font-bold text-[#17201C]">
          Recommended next step
        </p>
        <p className="mt-1 leading-7 text-[#5F6862]">
          {signal.recommendedAction}
        </p>
      </div>

      <p className="mt-3 text-sm text-[#5F6862]">
        Last detected {formatDateTime(signal.lastDetectedAt)}
      </p>
    </section>
  );
}

export function WorkspaceHealthQueue({
  errorMessage,
  isLoading,
  onReviewRecord,
  records,
  riskSignals,
}: WorkspaceHealthQueueProps) {
  const queueGroups = useMemo(
    () => buildWorkspaceRiskQueueGroups(records, riskSignals),
    [records, riskSignals],
  );
  const summary = useMemo(
    () => getWorkspaceHealthSummary(records, riskSignals),
    [records, riskSignals],
  );

  return (
    <section>
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          Workspace Workflow Health
        </p>
        <h2 className="mt-3 text-2xl font-bold text-[#17201C]">
          Fix the highest-impact workflow issues first
        </h2>
        <p className="mt-3 leading-7 text-[#5F6862]">
          Review open workflow issues in priority order, then open
          the affected workflow to complete the recommended step.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-[#5F6862]">
          Reviewing workspace health...
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 border-y border-[#D9DED8] py-5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric
              label="Average health"
              value={
                summary.averageHealthScore === null
                  ? "Not available"
                  : `${summary.averageHealthScore}/100`
              }
            />
            <SummaryMetric
              label="Open issues"
              value={summary.activeRiskCount}
            />
            <SummaryMetric
              label="Affected clients"
              value={summary.affectedClientCount}
            />
            <SummaryMetric
              label="Critical issues"
              value={summary.criticalRiskCount}
            />
          </div>

          <div className="mt-7">
            <div>
              <h3 className="text-xl font-bold text-[#17201C]">
                Clients needing action
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5F6862]">
                Clients with the most severe open issues appear
                first. Each client&apos;s issues are ordered by
                severity.
              </p>
            </div>

            {queueGroups.length === 0 ? (
              <p className="mt-4 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                No open workflow issues need attention.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {queueGroups.map(({ record, signals }) => (
                  <article
                    className="rounded-lg border border-[#D9DED8] bg-white p-5"
                    key={record.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h4 className="text-lg font-bold text-[#17201C]">
                          {record.name}
                        </h4>
                        {record.businessName ? (
                          <p className="mt-1 text-sm text-[#5F6862]">
                            {record.businessName}
                          </p>
                        ) : null}
                      </div>

                      <span className="w-fit shrink-0 rounded-md bg-[#EDF3EF] px-3 py-2 text-sm font-bold text-[#174F42]">
                        {signals.length} open{" "}
                        {signals.length === 1 ? "issue" : "issues"}
                      </span>
                    </div>

                    <div className="mt-5 divide-y divide-[#D9DED8] border-y border-[#D9DED8]">
                      {signals.map((signal) => (
                        <RiskIssue
                          key={signal.id}
                          signal={signal}
                        />
                      ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="text-sm text-[#5F6862]">
                        <p>Workflow health</p>
                        <p className="mt-1 font-bold text-[#17201C]">
                          {record.workflowHealthScore}/100 |{" "}
                          {getWorkflowHealthLabel(
                            record.workflowHealthScore,
                          )}
                        </p>
                      </div>

                      <button
                        className="rounded-md bg-[#174F42] px-4 py-3 font-bold text-white hover:bg-[#1F6F5B]"
                        onClick={() =>
                          onReviewRecord(record.id)
                        }
                        type="button"
                      >
                        Review workflow
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
