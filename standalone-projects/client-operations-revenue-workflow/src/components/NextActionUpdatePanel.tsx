"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
} from "@/lib/client-workflow-types";
import {
  createOperationRequestId,
  type OperationsAgentApprovalCommandResult,
  type WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";
import { getLocalDateKey } from "@/lib/date-key";

type NextActionUpdatePanelProps = {
  onPrepared: (
    result: OperationsAgentApprovalCommandResult,
  ) => void;
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

export function NextActionUpdatePanel({
  onPrepared,
  workspaceApi,
  workspaceId,
}: NextActionUpdatePanelProps) {
  const [engagements, setEngagements] = useState<
    ClientEngagement[]
  >([]);
  const [clientRecords, setClientRecords] = useState<
    ClientWorkflowRecord[]
  >([]);
  const [selectedEngagementId, setSelectedEngagementId] =
    useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadJobs() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [nextEngagements, nextClientRecords] =
          await Promise.all([
            workspaceApi.engagements.list(),
            workspaceApi.clientRecords.list(),
          ]);

        if (isMounted) {
          setEngagements(
            nextEngagements.filter(
              (engagement) =>
                engagement.engagementStatus === "Active",
            ),
          );
          setClientRecords(nextClientRecords);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Active jobs could not be loaded.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadJobs();

    return () => {
      isMounted = false;
    };
  }, [workspaceApi, workspaceId]);

  const clientNameById = useMemo(
    () =>
      new Map(
        clientRecords.map((clientRecord) => [
          clientRecord.id,
          clientRecord.name,
        ]),
      ),
    [clientRecords],
  );

  const selectedEngagement = engagements.find(
    (engagement) => engagement.id === selectedEngagementId,
  );

  function selectEngagement(engagementId: string) {
    const engagement = engagements.find(
      (candidate) => candidate.id === engagementId,
    );

    setSelectedEngagementId(engagementId);
    setNextAction(engagement?.nextAction ?? "");
    setNextFollowUpAt(engagement?.nextFollowUpAt ?? "");
    setAssignedTo(engagement?.assignedTo ?? "");
    setMessage("");
    setErrorMessage("");
  }

  async function prepareForApproval() {
    if (!selectedEngagement) {
      setErrorMessage("Choose the job you want to update.");
      return;
    }

    if (nextAction.trim().length < 3) {
      setErrorMessage("Enter the next action for this job.");
      return;
    }

    if (!nextFollowUpAt) {
      setErrorMessage("Choose the follow-up date.");
      return;
    }

    if (assignedTo.trim().length < 2) {
      setErrorMessage("Enter who owns this next action.");
      return;
    }

    setIsPreparing(true);
    setMessage("");
    setErrorMessage("");

    try {
      const result =
        await workspaceApi.operationsAgent.prepareNextActionUpdate({
          commandId: createOperationRequestId(),
          proposal: {
            clientEngagementId: selectedEngagement.id,
            expectedUpdatedAt: selectedEngagement.updatedAt,
            nextAction: nextAction.trim(),
            nextFollowUpAt,
            assignedTo: assignedTo.trim(),
          },
        });

      setMessage(
        "Prepared for approval. No job details have changed yet.",
      );
      onPrepared(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The next-action change could not be prepared.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <section aria-labelledby="next-action-tool-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            id="next-action-tool-heading"
          >
            Prepare a next-action change
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-[#5F6862]">
            Choose one active job and prepare its next action for
            approval.
          </p>
        </div>
        <p className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#174F42]">
          <ShieldCheck aria-hidden="true" className="size-5" />
          Approval required
        </p>
      </div>

      <p className="mt-5 inline-flex items-center gap-2 font-bold text-[#174F42]">
        <Check aria-hidden="true" className="size-5" />
        Nothing changes until you approve and apply it
      </p>

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
          Loading active jobs
        </p>
      ) : engagements.length === 0 ? (
        <div className="mt-8 border-y border-[#D9DED8] py-8">
          <p className="font-bold">No active jobs are available</p>
          <p className="mt-2 text-[#5F6862]">
            Create or reopen a job before preparing a next-action
            change.
          </p>
        </div>
      ) : (
        <div className="mt-8 max-w-4xl border-y border-[#D9DED8] py-7">
          <div>
            <label
              className="block font-bold"
              htmlFor="agent-next-action-job"
            >
              Job
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-md border border-[#AAB6AF] bg-white px-4 py-3"
              id="agent-next-action-job"
              onChange={(event) =>
                selectEngagement(event.target.value)
              }
              value={selectedEngagementId}
            >
              <option value="">Choose an active job</option>
              {engagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {clientNameById.get(
                    engagement.clientWorkflowRecordId,
                  ) ?? "Client"}{" "}
                  - {engagement.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            <label
              className="block font-bold"
              htmlFor="agent-next-action"
            >
              Next action
            </label>
            <input
              className="mt-2 min-h-12 w-full rounded-md border border-[#AAB6AF] bg-white px-4 py-3"
              disabled={!selectedEngagement}
              id="agent-next-action"
              maxLength={500}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Example: Send the revised proposal"
              type="text"
              value={nextAction}
            />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="block font-bold"
                htmlFor="agent-next-follow-up"
              >
                Follow-up date
              </label>
              <input
                className="mt-2 min-h-12 w-full rounded-md border border-[#AAB6AF] bg-white px-4 py-3"
                disabled={!selectedEngagement}
                id="agent-next-follow-up"
                min={getLocalDateKey(new Date())}
                onChange={(event) =>
                  setNextFollowUpAt(event.target.value)
                }
                type="date"
                value={nextFollowUpAt}
              />
            </div>
            <div>
              <label
                className="block font-bold"
                htmlFor="agent-next-action-owner"
              >
                Assigned to
              </label>
              <input
                className="mt-2 min-h-12 w-full rounded-md border border-[#AAB6AF] bg-white px-4 py-3"
                disabled={!selectedEngagement}
                id="agent-next-action-owner"
                maxLength={160}
                onChange={(event) =>
                  setAssignedTo(event.target.value)
                }
                placeholder="Example: Founder or project lead"
                type="text"
                value={assignedTo}
              />
            </div>
          </div>

          <button
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#0E3C32] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedEngagement || isPreparing}
            onClick={() => void prepareForApproval()}
            type="button"
          >
            {isPreparing ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <CalendarClock
                aria-hidden="true"
                className="size-5"
              />
            )}
            Prepare for approval
            <ArrowRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}
    </section>
  );
}
