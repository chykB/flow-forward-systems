"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { ClientRecordForm } from "@/components/ClientRecordForm";
import {
  createOperationRequestId,
  type GuidedClientIntakeCommandResult,
  type NewClientWorkflowRecord,
  type WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";
import type {
  GuidedClientIntakeDraft,
  GuidedClientIntakeField,
  OperationsAgentRun,
} from "@/lib/operations-agent-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type OperationsAgentPanelProps = {
  onClientCreated: (
    result: GuidedClientIntakeCommandResult,
  ) => void | Promise<void>;
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

const activeRunStates = new Set([
  "queued",
  "running",
  "waiting_for_approval",
]);

const userSelectedFields: GuidedClientIntakeField[] = [
  "clientType",
  "lifecycleStage",
  "priority",
  "riskLevel",
];

const fieldLabels: Record<string, string> = {
  name: "Name",
  email: "Email",
  businessName: "Business name",
  source: "Source",
  interest: "Interest",
  clientType: "Lead or client status",
  returningClientStatus: "Returning client status",
  lifecycleStage: "Workflow stage",
  priority: "Priority",
  riskLevel: "Relationship concern",
  nextAction: "Next action",
  nextFollowUpAt: "Follow-up date",
  assignedTo: "Owner",
  message: "Context note",
};

function getReviewMissingFields(draft: GuidedClientIntakeDraft) {
  const missingFields = new Set<GuidedClientIntakeField>([
    ...draft.missingFields,
    ...userSelectedFields,
  ]);

  // This field becomes required only after the reviewer chooses a returning
  // or past client status.
  missingFields.delete("returningClientStatus");

  return [...missingFields];
}

function getInitialRecord(
  draft: GuidedClientIntakeDraft,
): Partial<NewClientWorkflowRecord> {
  const values = draft.values;
  const uncertainFields = new Set(
    draft.uncertainFields.map((uncertainty) => uncertainty.field),
  );
  const reviewedValue = (
    field: GuidedClientIntakeField,
    value: string | null,
  ) => (uncertainFields.has(field) ? null : value);

  return {
    name: reviewedValue("name", values.name) ?? "",
    email: reviewedValue("email", values.email) ?? "",
    businessName:
      reviewedValue("businessName", values.businessName) ?? "",
    source: reviewedValue("source", values.source) ?? "",
    interest: reviewedValue("interest", values.interest) ?? "",
    clientType: undefined,
    returningClientStatus: undefined,
    lifecycleStage: undefined,
    priority: undefined,
    riskLevel: undefined,
    nextAction:
      reviewedValue("nextAction", values.nextAction) ?? "",
    nextFollowUpAt:
      reviewedValue("nextFollowUpAt", values.nextFollowUpAt) ?? "",
    assignedTo:
      reviewedValue("assignedTo", values.assignedTo) ?? "",
    message: reviewedValue("message", values.message) ?? "",
  };
}

const runStateLabels: Record<OperationsAgentRun["state"], string> = {
  queued: "Waiting to prepare",
  running: "Preparing draft",
  waiting_for_approval: "Ready to review",
  completed: "Client saved",
  failed: "Draft not prepared",
  cancelled: "Draft discarded",
  expired: "Draft expired",
  partially_completed: "Needs attention",
};

function getActiveRunHeading(state: OperationsAgentRun["state"]) {
  if (state === "queued") {
    return "Waiting to prepare the client draft";
  }

  if (state === "running") {
    return "Preparing the client draft";
  }

  return "The client draft is ready to review";
}

export function OperationsAgentPanel({
  onClientCreated,
  workspaceApi,
  workspaceId,
}: OperationsAgentPanelProps) {
  const [objective, setObjective] = useState("");
  const [runs, setRuns] = useState<OperationsAgentRun[]>([]);
  const [drafts, setDrafts] = useState<GuidedClientIntakeDraft[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [message, setMessage] = useState("");

  const loadAgentState = useCallback(async () => {
    const [nextRuns, nextDrafts] = await Promise.all([
      workspaceApi.operationsAgent.listRuns(),
      workspaceApi.operationsAgent.listClientIntakeDrafts(),
    ]);

    setRuns(nextRuns);
    setDrafts(nextDrafts);
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      try {
        const [nextRuns, nextDrafts] = await Promise.all([
          workspaceApi.operationsAgent.listRuns(),
          workspaceApi.operationsAgent.listClientIntakeDrafts(),
        ]);

        if (isMounted) {
          setRuns(nextRuns);
          setDrafts(nextDrafts);
          setMessage("");
        }
      } catch (error) {
        console.error("Operations Agent view load failed", error);

        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Recent agent activity could not be loaded.",
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
  }, [workspaceApi]);

  const activeRun = useMemo(
    () => runs.find((run) => activeRunStates.has(run.state)),
    [runs],
  );
  const reviewDraft = useMemo(
    () =>
      drafts.find(
        (draft) =>
          draft.state === "waiting_for_review" &&
          draft.runId === activeRun?.id,
      ),
    [activeRun?.id, drafts],
  );

  async function startIntake() {
    const normalizedObjective = objective.trim();

    if (normalizedObjective.length < 10) {
      setMessage("Add the client details you received.");
      return;
    }

    setIsStarting(true);
    setMessage("");
    let startedRun: OperationsAgentRun | null = null;

    try {
      const startResult =
        await workspaceApi.operationsAgent.startRun({
          commandId: createOperationRequestId(),
          capability: "guided_client_intake",
          objective: normalizedObjective,
          context: {
            source: "operations_agent_view",
          },
          limits: {
            modelCalls: 1,
            toolCalls: 0,
            retries: 1,
            durationSeconds: 120,
            costUsd: 0.1,
          },
        });
      startedRun = startResult.run;
      setRuns((currentRuns) => [
        startedRun as OperationsAgentRun,
        ...currentRuns,
      ]);

      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session is no longer valid. Sign in again.",
        );
      }

      const response = await fetch(
        "/api/operations-agent/guided-client-intake",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId,
            runId: startedRun.id,
            expectedUpdatedAt: startedRun.updatedAt,
          }),
        },
      );
      const responseBody = (await response.json()) as {
        error?: string;
        referenceId?: string;
      };

      if (!response.ok) {
        throw new Error(
          responseBody.error
            ? `${responseBody.error}${
                responseBody.referenceId
                  ? ` Reference: ${responseBody.referenceId}.`
                  : ""
              }`
            : "The Operations Agent could not prepare the draft.",
        );
      }

      await loadAgentState();
      setObjective("");
    } catch (error) {
      console.error("Guided client intake start failed", error);

      try {
        await loadAgentState();
      } catch (refreshError) {
        console.error(
          "Operations Agent state refresh failed",
          refreshError,
        );
      }

      if (startedRun?.state === "queued") {
        try {
          await workspaceApi.operationsAgent.cancelRun({
            commandId: createOperationRequestId(),
            runId: startedRun.id,
            expectedUpdatedAt: startedRun.updatedAt,
          });
          await loadAgentState();
        } catch {
          // The server may already have recorded a terminal failure.
        }
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "The Operations Agent could not prepare the draft.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function cancelRun() {
    if (!activeRun) {
      return;
    }

    setIsCancelling(true);
    setMessage("");

    try {
      await workspaceApi.operationsAgent.cancelRun({
        commandId: createOperationRequestId(),
        runId: activeRun.id,
        expectedUpdatedAt: activeRun.updatedAt,
      });
      await loadAgentState();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : reviewDraft
            ? "The client draft could not be discarded."
            : "Client draft preparation could not be cancelled.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function saveReviewedDraft(
    approvedRecord: NewClientWorkflowRecord,
  ) {
    if (!activeRun || !reviewDraft) {
      throw new Error(
        "This client intake draft is no longer available. Refresh and try again.",
      );
    }

    const result =
      await workspaceApi.operationsAgent.completeClientIntake({
        commandId: createOperationRequestId(),
        clientCreateCommandId: createOperationRequestId(),
        runId: activeRun.id,
        draftId: reviewDraft.id,
        expectedRunUpdatedAt: activeRun.updatedAt,
        expectedDraftUpdatedAt: reviewDraft.updatedAt,
        approvedRecord,
      });

    await onClientCreated(result);
    await loadAgentState();
    return result;
  }

  return (
    <div id="operations-agent">
      <section className="border-b border-[#D9DED8] pb-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
          Operations Agent
        </p>
        <h2 className="mt-3 text-3xl font-bold">
          Prepare a client intake
        </h2>
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-[#174F42]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          Nothing is saved without your review
        </div>

        <label
          className="mt-7 block font-bold"
          htmlFor="operations-agent-client-intake"
        >
          Client details
        </label>
        <textarea
          className="mt-2 min-h-40 w-full rounded-md border border-[#D9DED8] bg-white px-4 py-3 leading-7 outline-none focus:border-[#174F42]"
          disabled={Boolean(activeRun) || isStarting}
          id="operations-agent-client-intake"
          maxLength={2000}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Paste the inquiry or describe the lead, the work requested, the owner, and the next follow-up."
          value={objective}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(activeRun) || isStarting}
            onClick={startIntake}
            type="button"
          >
            {isStarting ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <Sparkles aria-hidden="true" className="size-5" />
            )}
            {isStarting ? "Preparing..." : "Prepare client draft"}
          </button>

          {activeRun ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCancelling || isStarting}
              onClick={cancelRun}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
              {isCancelling
                ? reviewDraft
                  ? "Discarding..."
                  : "Cancelling..."
                : reviewDraft
                  ? "Discard draft"
                  : "Cancel preparation"}
            </button>
          ) : null}
        </div>

        {message ? (
          <p
            className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700"
            role="alert"
          >
            {message}
          </p>
        ) : null}
      </section>

      {isLoading ? (
        <p className="py-8 text-[#5F6862]" role="status">
          Loading recent agent activity...
        </p>
      ) : null}

      {activeRun && !reviewDraft ? (
        <section
          className="border-b border-[#D9DED8] py-8"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <LoaderCircle
              aria-hidden="true"
              className="mt-1 size-5 animate-spin text-[#174F42]"
            />
            <div>
              <h3 className="text-xl font-bold">
                {getActiveRunHeading(activeRun.state)}
              </h3>
              <p className="mt-2 leading-7 text-[#5F6862]">
                {activeRun.objective}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {activeRun && reviewDraft ? (
        <section className="py-8">
          <div className="border-y border-[#D9DED8] py-5">
            <h3 className="text-xl font-bold">Review the draft</h3>
            <p className="mt-2 leading-7 text-[#5F6862]">
              {reviewDraft.values.summary}
            </p>

            {getReviewMissingFields(reviewDraft).length > 0 ? (
              <div className="mt-5">
                <p className="flex items-center gap-2 font-bold text-[#7A4B00]">
                  <CircleAlert
                    aria-hidden="true"
                    className="size-5"
                  />
                  Missing details
                </p>
                <p className="mt-2 text-[#5F6862]">
                  {getReviewMissingFields(reviewDraft)
                    .map((field) => fieldLabels[field] ?? field)
                    .join(", ")}
                </p>
              </div>
            ) : null}

            {reviewDraft.uncertainFields.length > 0 ? (
              <div className="mt-5">
                <p className="font-bold text-[#7A4B00]">
                  Check these details
                </p>
                <ul className="mt-2 grid gap-2 text-[#5F6862]">
                  {reviewDraft.uncertainFields.map(
                    (uncertainty) => (
                      <li key={uncertainty.field}>
                        <strong className="text-[#17201C]">
                          {fieldLabels[uncertainty.field] ??
                            uncertainty.field}
                          :
                        </strong>{" "}
                        {uncertainty.reason}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {reviewDraft.clarificationQuestions.length > 0 ? (
              <div className="mt-5">
                <p className="font-bold">Questions before saving</p>
                <ul className="mt-2 grid gap-2 text-[#5F6862]">
                  {reviewDraft.clarificationQuestions.map(
                    (question) => (
                      <li key={question}>{question}</li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            <p className="mt-5 text-sm leading-6 text-[#5F6862]">
              Information that needs your confirmation stays blank.
              Complete every required field before saving.
            </p>
          </div>

          <div className="mt-6">
            <ClientRecordForm
              description="Check the details and complete every blank required field. Saving creates the client record."
              eyebrow="Prepared Draft"
              initialRecord={getInitialRecord(reviewDraft)}
              key={reviewDraft.id}
              onAddRecord={saveReviewedDraft}
              requireExplicitSelections
              submitLabel="Save Client Record"
              title="Review client details"
            />
          </div>
        </section>
      ) : null}

      {runs.length > 0 ? (
        <section className="border-t border-[#D9DED8] py-8">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-xl font-bold">
              Recent agent activity
            </h3>
            <p className="text-sm text-[#5F6862]">
              {runs.length}
            </p>
          </div>
          <div className="mt-4 divide-y divide-[#D9DED8] border-y border-[#D9DED8]">
            {runs.slice(0, 8).map((run) => (
              <div
                className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={run.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold" title={run.objective}>
                    {run.objective}
                  </p>
                  <p className="mt-1 text-sm text-[#5F6862]">
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm font-bold text-[#174F42]">
                  {runStateLabels[run.state]}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
