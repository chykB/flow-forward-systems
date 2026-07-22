"use client";

import { useState } from "react";
import type {
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import { formatDateTime } from "@/lib/format-date";
import type {
  RiskSignalStatusUpdate,
} from "@/lib/application/workspace-api";
import {
  getRiskSignalStatusLabel,
  getRiskSignalTypeLabel,
  getWorkflowHealthLabel,
  isActiveRiskSignal,
} from "@/lib/risk-signal-display";

type Props = {
  errorMessage: string;
  isLoading: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  onOpenSource: (signal: RiskSignal) => void;
  onUpdateStatus: (
    riskSignalId: string,
    update: RiskSignalStatusUpdate,
  ) => Promise<void>;
  record: ClientWorkflowRecord;
  riskSignals: RiskSignal[];
};

function getSeverityClasses(severity: RiskSignal["severity"]) {
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

function getSourceActionLabel(signal: RiskSignal) {
  if (signal.riskType === "overdue_follow_up") {
    return "Complete follow-up";
  }

  if (signal.sourceType === "proposal") {
    return "Review proposal";
  }

  if (signal.sourceType === "invoice") {
    return "Review invoice";
  }

  return "Open work item";
}

export function RiskSignalPanel({
  errorMessage,
  isLoading,
  isReadOnly,
  isSaving,
  onOpenSource,
  onUpdateStatus,
  record,
  riskSignals,
}: Props) {
  const [dismissingSignalId, setDismissingSignalId] =
    useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const activeSignals = riskSignals.filter(isActiveRiskSignal);
  const closedSignals = riskSignals.filter(
    (signal) => !isActiveRiskSignal(signal),
  );

  function cancelDismissal() {
    setDismissingSignalId(null);
    setResolutionNote("");
    setFormMessage("");
  }

  async function submitUpdate(
    riskSignalId: string,
    update: RiskSignalStatusUpdate,
  ) {
    setFormMessage("");

    try {
      await onUpdateStatus(riskSignalId, update);
      cancelDismissal();
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The risk review could not be saved.",
      );
    }
  }

  return (
    <div>
      <div>
        <h3 className="text-xl font-bold text-[#17201C]">
          Workflow Health
        </h3>
        <p className="mt-2 leading-7 text-[#5F6862]">
          {isReadOnly
            ? "Review the health history recorded for this job."
            : "Open the source of each issue and complete the work that clears it. Generated issues close automatically when the underlying condition changes."}
        </p>
      </div>

      <div className="mt-5 grid gap-4 border-y border-[#D9DED8] py-4 sm:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-[#5F6862]">
            Health score
          </p>
          <p className="mt-1 text-2xl font-bold text-[#17201C]">
            {record.workflowHealthScore}/100
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-[#5F6862]">
            Current health
          </p>
          <p className="mt-1 font-bold text-[#17201C]">
            {getWorkflowHealthLabel(record.workflowHealthScore)}
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-[#5F6862]">
            Active issues
          </p>
          <p className="mt-1 font-bold text-[#17201C]">
            {activeSignals.length}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-[#5F6862]">
          Reviewing workflow health...
        </p>
      ) : activeSignals.length === 0 ? (
        <p className="mt-5 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
          No active workflow issues need attention.
        </p>
      ) : (
        <div className="mt-5">
          {activeSignals.map((signal) => {
            const isDismissing =
              dismissingSignalId === signal.id;

            return (
              <article
                className="border-t border-[#D9DED8] py-5 first:border-t-0 first:pt-0"
                key={signal.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-bold text-[#17201C]">
                      {getRiskSignalTypeLabel(signal.riskType)}
                    </h4>
                    <p className="mt-2 leading-7 text-[#5F6862]">
                      {signal.reason}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
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
                    {isReadOnly
                      ? "Recorded next step"
                      : "Recommended next step"}
                  </p>
                  <p className="mt-1 leading-7 text-[#5F6862]">
                    {signal.recommendedAction}
                  </p>
                </div>

                {!isReadOnly ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-[#174F42] px-4 py-2 font-bold text-white disabled:opacity-60"
                    disabled={isSaving}
                    onClick={() => onOpenSource(signal)}
                    type="button"
                  >
                    {getSourceActionLabel(signal)}
                  </button>
                  <button
                    className="rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] disabled:opacity-60"
                    disabled={
                      isSaving || signal.status === "Reviewed"
                    }
                    onClick={() =>
                      void submitUpdate(signal.id, {
                        status: "Reviewed",
                      })
                    }
                    type="button"
                  >
                    Mark as reviewed
                  </button>
                  <button
                    className="rounded-md border border-[#8A3B12] px-4 py-2 font-bold text-[#8A3B12] disabled:opacity-60"
                    disabled={isSaving}
                    onClick={() => {
                      setDismissingSignalId(signal.id);
                      setResolutionNote("");
                      setFormMessage("");
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                  </div>
                ) : null}

                {!isReadOnly && isDismissing ? (
                  <form
                    className="mt-4 grid gap-3 border-t border-[#D9DED8] pt-4"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (resolutionNote.trim().length < 5) {
                        setFormMessage(
                          "Add a short reason for dismissing this issue.",
                        );
                        return;
                      }

                      void submitUpdate(signal.id, {
                        status: "Dismissed",
                        resolutionNote,
                      });
                    }}
                  >
                    <label
                      className="grid gap-2 font-bold"
                      htmlFor={`risk-dismissal-${signal.id}`}
                    >
                      Dismissal reason
                      <textarea
                        className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3"
                        id={`risk-dismissal-${signal.id}`}
                        onChange={(event) => {
                          setResolutionNote(event.target.value);
                          setFormMessage("");
                        }}
                        value={resolutionNote}
                      />
                    </label>

                    {formMessage ? (
                      <p className="text-sm font-semibold text-red-700">
                        {formMessage}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-[#174F42] px-4 py-2 font-bold text-white disabled:opacity-60"
                        disabled={isSaving}
                        type="submit"
                      >
                        {isSaving
                          ? "Saving..."
                          : "Confirm dismissal"}
                      </button>
                      <button
                        className="rounded-md border border-[#D9DED8] px-4 py-2 font-bold text-[#17201C]"
                        disabled={isSaving}
                        onClick={cancelDismissal}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {closedSignals.length > 0 ? (
        <details className="mt-6 border-t border-[#D9DED8] pt-5">
          <summary className="cursor-pointer font-bold text-[#174F42]">
            Closed issue history ({closedSignals.length})
          </summary>
          <div className="mt-4 grid gap-3">
            {closedSignals.map((signal) => (
              <article
                className="rounded-md border border-[#D9DED8] p-4"
                key={signal.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold">
                    {getRiskSignalTypeLabel(signal.riskType)}
                  </p>
                  <span className="rounded-md bg-[#EDF3EF] px-3 py-2 text-sm font-bold text-[#174F42]">
                    {getRiskSignalStatusLabel(signal.status)}
                  </span>
                </div>
                <p className="mt-2 leading-7 text-[#5F6862]">
                  {signal.reason}
                </p>
                <p className="mt-2 text-sm text-[#5F6862]">
                  <span className="font-bold">Closure note:</span>{" "}
                  {signal.resolutionNote || "No note recorded."}
                </p>
                <p className="mt-1 text-sm text-[#5F6862]">
                  Closed {formatDateTime(signal.resolvedAt)}
                </p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
