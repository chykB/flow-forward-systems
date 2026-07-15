"use client";

import { useState } from "react";
import type {
  ClientWorkflowRecord,
  RiskSignal,
} from "@/lib/client-workflow-types";
import { formatDateTime } from "@/lib/format-date";
import type {
  RiskSignalStatusUpdate,
} from "@/lib/supabase/risk-signals";

type Props = {
  errorMessage: string;
  isLoading: boolean;
  isSaving: boolean;
  onUpdateStatus: (
    riskSignalId: string,
    update: RiskSignalStatusUpdate,
  ) => Promise<void>;
  record: ClientWorkflowRecord;
  riskSignals: RiskSignal[];
};

type ClosingStatus = "Resolved" | "Dismissed";

const riskTypeLabels: Record<RiskSignal["riskType"], string> = {
  overdue_follow_up: "Overdue follow-up",
  proposal_expired: "Expired proposal",
  invoice_overdue: "Invoice overdue",
  invoice_disputed: "Payment dispute",
};

const statusLabels: Record<RiskSignal["status"], string> = {
  Open: "Needs review",
  Reviewed: "Reviewed",
  Resolved: "Resolved",
  Dismissed: "Dismissed",
};

const activeStatuses = new Set<RiskSignal["status"]>([
  "Open",
  "Reviewed",
]);

function getHealthLabel(score: number) {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Needs attention";
  if (score >= 50) return "At risk";
  return "Critical";
}

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

export function RiskSignalPanel({
  errorMessage,
  isLoading,
  isSaving,
  onUpdateStatus,
  record,
  riskSignals,
}: Props) {
  const [closingSignalId, setClosingSignalId] =
    useState<string | null>(null);
  const [closingStatus, setClosingStatus] =
    useState<ClosingStatus | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const activeSignalCount = riskSignals.filter((signal) =>
    activeStatuses.has(signal.status),
  ).length;

  function beginClosing(
    signalId: string,
    status: ClosingStatus,
  ) {
    setClosingSignalId(signalId);
    setClosingStatus(status);
    setResolutionNote("");
    setFormMessage("");
  }

  function cancelClosing() {
    setClosingSignalId(null);
    setClosingStatus(null);
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
      cancelClosing();
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
          Review active issues and complete the next step needed
          to keep this client workflow moving.
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
            {getHealthLabel(record.workflowHealthScore)}
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-[#5F6862]">
            Active issues
          </p>
          <p className="mt-1 font-bold text-[#17201C]">
            {activeSignalCount}
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
      ) : riskSignals.length === 0 ? (
        <p className="mt-5 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
          No workflow risks need attention.
        </p>
      ) : (
        <div className="mt-5">
          {riskSignals.map((signal) => {
            const isActive = activeStatuses.has(signal.status);
            const isClosing = closingSignalId === signal.id;

            return (
              <article
                className="border-t border-[#D9DED8] py-5 first:border-t-0 first:pt-0"
                key={signal.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-bold text-[#17201C]">
                      {riskTypeLabels[signal.riskType]}
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
                      {statusLabels[signal.status]}
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

                {isActive ? (
                  <div className="mt-4 flex flex-wrap gap-2">
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
                      className="rounded-md bg-[#174F42] px-4 py-2 font-bold text-white disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() =>
                        beginClosing(signal.id, "Resolved")
                      }
                      type="button"
                    >
                      Resolve risk
                    </button>
                    <button
                      className="rounded-md border border-[#8A3B12] px-4 py-2 font-bold text-[#8A3B12] disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() =>
                        beginClosing(signal.id, "Dismissed")
                      }
                      type="button"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-[#5F6862]">
                    <p>
                      <span className="font-bold">Closure note:</span>{" "}
                      {signal.resolutionNote}
                    </p>
                    <p className="mt-1">
                      Closed {formatDateTime(signal.resolvedAt)}
                    </p>
                  </div>
                )}

                {isClosing && closingStatus ? (
                  <form
                    className="mt-4 grid gap-3 border-t border-[#D9DED8] pt-4"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (resolutionNote.trim().length < 5) {
                        setFormMessage(
                          "Add a short note explaining how this risk was closed.",
                        );
                        return;
                      }

                      void submitUpdate(signal.id, {
                        status: closingStatus,
                        resolutionNote,
                      });
                    }}
                  >
                    <label
                      className="grid gap-2 font-bold"
                      htmlFor={`risk-resolution-${signal.id}`}
                    >
                      {closingStatus === "Resolved"
                        ? "Resolution note"
                        : "Dismissal reason"}
                      <textarea
                        className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3"
                        id={`risk-resolution-${signal.id}`}
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
                          : closingStatus === "Resolved"
                            ? "Confirm resolution"
                            : "Confirm dismissal"}
                      </button>
                      <button
                        className="rounded-md border border-[#D9DED8] px-4 py-2 font-bold text-[#17201C]"
                        disabled={isSaving}
                        onClick={cancelClosing}
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
    </div>
  );
}