"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format-date";
import type {
  ClientWorkflowRecord,
  InvoiceRecord,
} from "@/lib/client-workflow-types";
import {
  getInvoiceWorkflowRecommendation,
  type InvoiceWorkflowRecommendation as RecommendationData,
} from "@/lib/invoice-workflow";

type Props = {
  invoice: InvoiceRecord;
  record: ClientWorkflowRecord;
  isApplying: boolean;
  onApply: (
    invoice: InvoiceRecord,
    recommendation: RecommendationData,
  ) => Promise<void>;
};

const changeFields = [
  ["paymentStatus", "Payment workflow"],
  ["priority", "Priority"],
  ["riskLevel", "Risk level"],
  ["nextAction", "Next action"],
  ["nextFollowUpAt", "Next follow-up date"],
] as const;

function buildChangeSummary(
  recommendation: RecommendationData,
  record: ClientWorkflowRecord,
) {
  return changeFields.flatMap(([field, label]) => {
    const recommendedValue = recommendation.updates[field];
    const currentValue = record[field];

    return recommendedValue !== undefined &&
      recommendedValue !== currentValue
      ? [`${label}: ${recommendedValue}`]
      : [];
  });
}



export function InvoiceWorkflowRecommendation({
  invoice,
  record,
  isApplying,
  onApply,
}: Props) {
  const [message, setMessage] = useState("");
  const recommendation = getInvoiceWorkflowRecommendation(
    invoice,
    record,
  );
  const changes = buildChangeSummary(recommendation, record);
  const wasAppliedForCurrentStatus =
    invoice.workflowActionAppliedStatus ===
    recommendation.effectiveStatus;

    if (wasAppliedForCurrentStatus) {
        return (
            <div className="mt-4 rounded-md bg-[#EDF3EF] p-4">
            <p className="font-bold text-[#174F42]">
                Recommended payment step applied
            </p>
            <p className="mt-2 leading-7 text-[#5F6862]">
                This invoice condition has already been reviewed and
                applied to the client workflow.
            </p>
            {invoice.workflowActionAppliedAt ? (
                <p className="mt-2 text-sm text-[#5F6862]">
                Applied{" "}
                {formatDateTime(
                    invoice.workflowActionAppliedAt,
                )}
                </p>
            ) : null}
            </div>
        );
    }

    if (changes.length === 0) {
        return (
            <div className="mt-4 rounded-md bg-[#EDF3EF] p-4">
            <p className="font-bold text-[#174F42]">
                Payment workflow already matches
            </p>
            <p className="mt-2 leading-7 text-[#5F6862]">
                The client record already reflects this recommended
                payment step, so no update is required.
            </p>
            </div>
        );
    }

  async function applyRecommendation() {
    setMessage("");

    try {
      await onApply(invoice, recommendation);
      setMessage("Recommended payment step applied.");
    } catch {
      setMessage(
        "The recommended payment step could not be applied.",
      );
    }
  }

  return (
    <div className="mt-4 rounded-md bg-[#EDF3EF] p-4">
      <p className="text-sm font-bold uppercase text-[#5F6862]">
        Recommended payment step
      </p>
      <h6 className="mt-2 text-lg font-bold text-[#17201C]">
        {recommendation.title}
      </h6>
      <p className="mt-2 leading-7 text-[#5F6862]">
        {recommendation.reason}
      </p>

      <div className="mt-4">
        <p className="font-bold text-[#17201C]">
          This will update
        </p>
        <ul className="mt-2 grid gap-2 text-sm text-[#5F6862]">
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </div>

      {message ? (
        <p className="mt-4 rounded-md bg-white p-3 font-semibold text-[#5F6862]">
          {message}
        </p>
      ) : null}

      <button
        className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isApplying}
        type="button"
        onClick={() => void applyRecommendation()}
      >
        {isApplying
          ? "Applying..."
          : "Apply Recommended Payment Step"}
      </button>
    </div>
  );
}