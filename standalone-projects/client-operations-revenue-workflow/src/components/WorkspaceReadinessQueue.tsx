"use client";

import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useMemo } from "react";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
} from "@/lib/client-workflow-types";
import type {
  WorkflowReadinessItem,
} from "@/lib/workflow-readiness";

type WorkspaceReadinessQueueProps = {
  engagements: ClientEngagement[];
  errorMessage: string;
  isLoading: boolean;
  items: WorkflowReadinessItem[];
  onOpenItem: (item: WorkflowReadinessItem) => void;
  records: ClientWorkflowRecord[];
};

type ReadinessGroup = {
  engagement: ClientEngagement;
  items: WorkflowReadinessItem[];
  record: ClientWorkflowRecord;
};

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
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

export function WorkspaceReadinessQueue({
  engagements,
  errorMessage,
  isLoading,
  items,
  onOpenItem,
  records,
}: WorkspaceReadinessQueueProps) {
  const groups = useMemo(() => {
    const engagementById = new Map(
      engagements.map((engagement) => [
        engagement.id,
        engagement,
      ]),
    );
    const recordById = new Map(
      records.map((record) => [record.id, record]),
    );
    const groupByEngagementId = new Map<
      string,
      ReadinessGroup
    >();

    items.forEach((item) => {
      const existingGroup = groupByEngagementId.get(
        item.clientEngagementId,
      );

      if (existingGroup) {
        existingGroup.items.push(item);
        return;
      }

      const engagement = engagementById.get(
        item.clientEngagementId,
      );
      const record = recordById.get(
        item.clientWorkflowRecordId,
      );

      if (!engagement || !record) {
        return;
      }

      groupByEngagementId.set(item.clientEngagementId, {
        engagement,
        items: [item],
        record,
      });
    });

    return Array.from(groupByEngagementId.values());
  }, [engagements, items, records]);
  const affectedClientCount = new Set(
    items.map((item) => item.clientWorkflowRecordId),
  ).size;

  return (
    <section
      className="mt-10 border-t border-[#D9DED8] pt-8"
      id="workflow-readiness"
    >
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          Workflow Readiness
        </p>
        <h2 className="mt-3 text-2xl font-bold text-[#17201C]">
          Complete the context needed to keep work moving
        </h2>
        <p className="mt-3 leading-7 text-[#5F6862]">
          Clarify active work and prepare handoffs before they
          depend on memory.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-[#5F6862]">
          Reviewing workflow readiness...
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 border-y border-[#D9DED8] py-5 sm:grid-cols-3">
            <SummaryMetric
              label="Readiness items"
              value={items.length}
            />
            <SummaryMetric
              label="Jobs to prepare"
              value={groups.length}
            />
            <SummaryMetric
              label="Affected clients"
              value={affectedClientCount}
            />
          </div>

          {groups.length === 0 ? (
            <p className="mt-5 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
              Active jobs have clear next actions and recorded
              context for active handoffs.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {groups.map(({ engagement, items: groupItems, record }) => (
                <article
                  className="rounded-lg border border-[#D9DED8] bg-white p-5"
                  key={engagement.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-[#17201C]">
                        {record.name}
                      </h3>
                      {record.businessName ? (
                        <p className="mt-1 text-sm text-[#5F6862]">
                          {record.businessName}
                        </p>
                      ) : null}
                      <p className="mt-2 font-bold text-[#174F42]">
                        {engagement.title}
                        {engagement.isPrimary
                          ? " | Primary job"
                          : ""}
                      </p>
                    </div>

                    <span className="w-fit shrink-0 rounded-md bg-[#E8F1EC] px-3 py-2 text-sm font-bold text-[#174F42]">
                      {groupItems.length}{" "}
                      {groupItems.length === 1
                        ? "readiness item"
                        : "readiness items"}
                    </span>
                  </div>

                  <div className="mt-5 divide-y divide-[#D9DED8] border-y border-[#D9DED8]">
                    {groupItems.map((item) => (
                      <section className="py-5" key={item.id}>
                        <div className="flex items-start gap-3">
                          <ClipboardCheck
                            aria-hidden="true"
                            className="mt-1 size-5 shrink-0 text-[#2E7D5B]"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-[#17201C]">
                              {item.title}
                            </h4>
                            <p className="mt-2 leading-7 text-[#5F6862]">
                              {item.reason}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-[#17201C]">
                              {item.recommendedAction}
                            </p>
                          </div>
                        </div>

                        <button
                          className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#174F42] px-4 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
                          onClick={() => onOpenItem(item)}
                          type="button"
                        >
                          {item.actionLabel}
                          <ArrowRight
                            aria-hidden="true"
                            className="size-4"
                          />
                        </button>
                      </section>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
