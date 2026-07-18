"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type {
  ActivityLog,
  ClientWorkflowRecord,
} from "@/lib/client-workflow-types";
import { formatDateTime } from "@/lib/format-date";

type WorkspaceActivityProps = {
  activityLogs: ActivityLog[];
  errorMessage: string;
  isLoading: boolean;
  onOpenRecord: (recordId: string) => void;
  records: ClientWorkflowRecord[];
};

export function WorkspaceActivity({
  activityLogs,
  errorMessage,
  isLoading,
  onOpenRecord,
  records,
}: WorkspaceActivityProps) {
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records],
  );
  const orderedLogs = useMemo(
    () =>
      [...activityLogs].sort((first, second) =>
        second.createdAt.localeCompare(first.createdAt),
      ),
    [activityLogs],
  );

  return (
    <section aria-labelledby="workspace-activity-title">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
          Workspace Activity
        </p>
        <h2
          className="mt-3 text-3xl font-bold"
          id="workspace-activity-title"
        >
          Review durable workflow changes
        </h2>
        <p className="mt-3 leading-7 text-[#5F6862]">
          See what changed across client workflows and open the
          related record when more context is needed.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-[#5F6862]">
          Loading workspace activity...
        </p>
      ) : orderedLogs.length === 0 ? (
        <p className="mt-6 rounded-md bg-white p-5 text-[#5F6862]">
          No workspace activity has been recorded yet.
        </p>
      ) : (
        <div className="mt-7 overflow-hidden rounded-lg border border-[#D9DED8] bg-white">
          {orderedLogs.map((log) => {
            const record = recordsById.get(
              log.clientWorkflowRecordId,
            );

            return (
              <article
                className="flex flex-col gap-4 border-t border-[#D9DED8] p-5 first:border-t-0 sm:flex-row sm:items-start sm:justify-between"
                key={log.id}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#5F6862]">
                    {record?.name ?? "Unavailable client"} |{" "}
                    {formatDateTime(log.createdAt)}
                  </p>
                  <h3 className="mt-1 font-bold text-[#17201C]">
                    {log.actionType}
                  </h3>
                  <p className="mt-2 leading-7 text-[#5F6862]">
                    {log.note}
                  </p>
                </div>

                {record ? (
                  <button
                    className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#174F42] px-3 py-2 text-sm font-bold text-[#174F42] hover:bg-[#EDF3EF]"
                    onClick={() => onOpenRecord(record.id)}
                    type="button"
                  >
                    Open record
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
