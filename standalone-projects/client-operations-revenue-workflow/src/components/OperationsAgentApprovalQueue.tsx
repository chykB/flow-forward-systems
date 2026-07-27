"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  createOperationRequestId,
  type WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";
import type {
  OperationsAgentApproval,
  OperationsAgentApprovalDecision,
} from "@/lib/operations-agent-types";

type OperationsAgentApprovalQueueProps = {
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

const decisionLabels: Record<
  OperationsAgentApprovalDecision,
  string
> = {
  pending: "Needs your decision",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

function formatDateTime(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OperationsAgentApprovalQueue({
  workspaceApi,
  workspaceId,
}: OperationsAgentApprovalQueueProps) {
  const [approvals, setApprovals] = useState<
    OperationsAgentApproval[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyApprovalId, setBusyApprovalId] = useState("");
  const [rejectingApprovalId, setRejectingApprovalId] =
    useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadApprovals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      setApprovals(
        await workspaceApi.operationsAgent.listApprovals(),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Agent approvals could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const nextApprovals =
          await workspaceApi.operationsAgent.listApprovals();

        if (isMounted) {
          setApprovals(nextApprovals);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Agent approvals could not be loaded.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [workspaceApi, workspaceId]);

  const pendingApprovals = useMemo(
    () =>
      approvals.filter(
        (approval) => approval.decision === "pending",
      ),
    [approvals],
  );
  const decidedApprovals = useMemo(
    () =>
      approvals.filter(
        (approval) => approval.decision !== "pending",
      ),
    [approvals],
  );

  async function approve(approval: OperationsAgentApproval) {
    setBusyApprovalId(approval.id);
    setMessage("");
    setErrorMessage("");

    try {
      await workspaceApi.operationsAgent.approve({
        commandId: createOperationRequestId(),
        approvalId: approval.id,
        expectedUpdatedAt: approval.updatedAt,
      });
      setMessage(
        "Approved. The Operations Agent can continue from this review.",
      );
      await loadApprovals();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The proposed action could not be approved.",
      );
    } finally {
      setBusyApprovalId("");
    }
  }

  async function reject(approval: OperationsAgentApproval) {
    const note = rejectionNote.trim();
    if (note.length < 3) {
      setErrorMessage(
        "Add a short reason before rejecting this action.",
      );
      return;
    }

    setBusyApprovalId(approval.id);
    setMessage("");
    setErrorMessage("");

    try {
      await workspaceApi.operationsAgent.reject({
        commandId: createOperationRequestId(),
        approvalId: approval.id,
        expectedUpdatedAt: approval.updatedAt,
        decisionNote: note,
      });
      setRejectingApprovalId("");
      setRejectionNote("");
      setMessage("Rejected. No workflow change was applied.");
      await loadApprovals();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The proposed action could not be rejected.",
      );
    } finally {
      setBusyApprovalId("");
    }
  }

  return (
    <section aria-labelledby="agent-approvals-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            id="agent-approvals-heading"
          >
            Approvals
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-[#5F6862]">
            Review the complete proposed change before the
            Operations Agent can continue.
          </p>
        </div>
        <div className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#174F42]">
          <ShieldCheck aria-hidden="true" className="size-5" />
          {pendingApprovals.length} waiting
        </div>
      </div>

      <div aria-live="polite" className="mt-5">
        {message ? (
          <p className="border-l-4 border-[#2F8468] bg-[#EDF3EF] px-4 py-3 font-bold text-[#174F42]">
            {message}
          </p>
        ) : null}
        {errorMessage ? (
          <p
            className="border-l-4 border-[#B42318] bg-[#FFF1F0] px-4 py-3 font-bold text-[#B42318]"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-8 inline-flex items-center gap-2 text-[#5F6862]">
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin"
          />
          Loading approvals
        </p>
      ) : pendingApprovals.length === 0 ? (
        <div className="mt-8 border-y border-[#D9DED8] py-8">
          <p className="inline-flex items-center gap-2 text-lg font-bold text-[#174F42]">
            <Check aria-hidden="true" className="size-5" />
            No approvals need your attention
          </p>
          <p className="mt-2 text-[#5F6862]">
            Any action that needs your decision will appear here
            before the Operations Agent can continue.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {pendingApprovals.map((approval) => {
            const isBusy = busyApprovalId === approval.id;
            const isRejecting =
              rejectingApprovalId === approval.id;

            return (
              <article
                className="rounded-md border border-[#C9D2CC] bg-white p-5"
                key={approval.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8A5700]">
                      Decision required
                    </p>
                    <h3 className="mt-2 text-xl font-bold">
                      {approval.actionTitle}
                    </h3>
                  </div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-[#5F6862]">
                    <Clock3 aria-hidden="true" className="size-4" />
                    Decide by {formatDateTime(approval.expiresAt)}
                  </p>
                </div>

                <p className="mt-4 max-w-3xl leading-7 text-[#5F6862]">
                  {approval.actionSummary}
                </p>

                <dl className="mt-5 grid gap-3 border-y border-[#D9DED8] py-4 sm:grid-cols-2">
                  {approval.reviewFields.map((field) => (
                    <div key={`${field.label}:${field.value}`}>
                      <dt className="text-sm font-bold text-[#5F6862]">
                        {field.label}
                      </dt>
                      <dd className="mt-1 font-bold">{field.value}</dd>
                    </div>
                  ))}
                </dl>

                {isRejecting ? (
                  <div className="mt-5 max-w-2xl">
                    <label
                      className="block font-bold"
                      htmlFor={`rejection-note-${approval.id}`}
                    >
                      Reason for rejecting
                    </label>
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-md border border-[#AAB6AF] bg-white px-4 py-3"
                      id={`rejection-note-${approval.id}`}
                      maxLength={500}
                      onChange={(event) =>
                        setRejectionNote(event.target.value)
                      }
                      value={rejectionNote}
                    />
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-4 py-2 font-bold text-white hover:bg-[#0E3C32] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void approve(approval)}
                    type="button"
                  >
                    {isBusy ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-5 animate-spin"
                      />
                    ) : (
                      <Check aria-hidden="true" className="size-5" />
                    )}
                    Approve
                  </button>
                  {isRejecting ? (
                    <>
                      <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#B42318] px-4 py-2 font-bold text-[#B42318] hover:bg-[#FFF1F0] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void reject(approval)}
                        type="button"
                      >
                        <X aria-hidden="true" className="size-5" />
                        Confirm rejection
                      </button>
                      <button
                        className="min-h-11 px-3 py-2 font-bold text-[#174F42]"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingApprovalId("");
                          setRejectionNote("");
                        }}
                        type="button"
                      >
                        Keep reviewing
                      </button>
                    </>
                  ) : (
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
                      onClick={() => {
                        setRejectingApprovalId(approval.id);
                        setRejectionNote("");
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-5" />
                      Reject
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {decidedApprovals.length > 0 ? (
        <div className="mt-10 border-t border-[#D9DED8] pt-7">
          <h3 className="text-xl font-bold">Recent decisions</h3>
          <div className="mt-4 divide-y divide-[#D9DED8] border-y border-[#D9DED8]">
            {decidedApprovals.slice(0, 10).map((approval) => (
              <div
                className="flex flex-wrap items-start justify-between gap-4 py-4"
                key={approval.id}
              >
                <div>
                  <p className="font-bold">{approval.actionTitle}</p>
                  <p className="mt-1 text-sm text-[#5F6862]">
                    {approval.decidedAt
                      ? formatDateTime(approval.decidedAt)
                      : formatDateTime(approval.updatedAt)}
                  </p>
                  {approval.decisionNote ? (
                    <p className="mt-2 text-[#5F6862]">
                      {approval.decisionNote}
                    </p>
                  ) : null}
                </div>
                <p
                  className={`inline-flex items-center gap-2 font-bold ${
                    approval.decision === "approved"
                      ? "text-[#174F42]"
                      : "text-[#8A5700]"
                  }`}
                >
                  {approval.decision === "approved" ? (
                    <Check aria-hidden="true" className="size-5" />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="size-5"
                    />
                  )}
                  {decisionLabels[approval.decision]}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
