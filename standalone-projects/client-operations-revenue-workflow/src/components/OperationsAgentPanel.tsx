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
  ClientType,
  LifecycleStage,
  PriorityLevel,
  ReturningClientStatus,
  RiskLevel,
} from "@/lib/client-workflow-types";
import type {
  GuidedClientIntakeDraft,
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

function getAllowedValue<Value extends string>(
  value: string | null,
  allowedValues: readonly Value[],
  fallback: Value,
) {
  return value &&
    (allowedValues as readonly string[]).includes(value)
    ? (value as Value)
    : fallback;
}

function getInitialRecord(
  draft: GuidedClientIntakeDraft,
): Partial<NewClientWorkflowRecord> {
  const values = draft.values;
  const clientType = getAllowedValue<ClientType>(
    values.clientType,
    [
      "Lead",
      "New client",
      "Active client",
      "Returning client",
      "Past client",
    ],
    "Lead",
  );
  const returningClientStatus = getAllowedValue<ReturningClientStatus>(
    values.returningClientStatus,
    [
      "Not returning",
      "Potential reactivation",
      "Repeat project opportunity",
      "Reactivated",
      "Dormant",
    ],
    (clientType === "Returning client"
      ? "Reactivated"
      : clientType === "Past client"
        ? "Dormant"
        : "Not returning"),
  );

  return {
    name: values.name ?? "",
    email: values.email ?? "",
    businessName: values.businessName ?? "",
    source: values.source ?? "",
    interest: values.interest ?? "",
    clientType,
    returningClientStatus,
    lifecycleStage: getAllowedValue<LifecycleStage>(
      values.lifecycleStage,
      [
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
      ],
      "New lead",
    ),
    priority: getAllowedValue<PriorityLevel>(
      values.priority,
      ["High", "Medium", "Low"],
      "Medium",
    ),
    riskLevel: getAllowedValue<RiskLevel>(
      values.riskLevel,
      ["High", "Medium", "Low"],
      "Low",
    ),
    nextAction: values.nextAction ?? "",
    nextFollowUpAt: values.nextFollowUpAt ?? "",
    assignedTo: values.assignedTo ?? "",
    message: values.message ?? "",
  };
}

function formatRunState(state: OperationsAgentRun["state"]) {
  return state.replaceAll("_", " ");
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
              : "Operations Agent history could not be loaded.",
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
          : "The Operations Agent run could not be cancelled.",
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
          Suggest mode
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
              {isCancelling ? "Cancelling..." : "Cancel run"}
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
          Loading Operations Agent history...
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
                Client intake is {formatRunState(activeRun.state)}
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
            <h3 className="text-xl font-bold">Review required</h3>
            <p className="mt-2 leading-7 text-[#5F6862]">
              {reviewDraft.values.summary}
            </p>

            {reviewDraft.missingFields.length > 0 ? (
              <div className="mt-5">
                <p className="flex items-center gap-2 font-bold text-[#7A4B00]">
                  <CircleAlert
                    aria-hidden="true"
                    className="size-5"
                  />
                  Missing details
                </p>
                <p className="mt-2 text-[#5F6862]">
                  {reviewDraft.missingFields
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
                <p className="font-bold">Questions to resolve</p>
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
              Blank fields remain blank. Any selected starting
              defaults must also be reviewed before saving.
            </p>
          </div>

          <div className="mt-6">
            <ClientRecordForm
              description="Review every field. Saving creates the client record and completes this agent run."
              eyebrow="Agent Draft"
              initialRecord={getInitialRecord(reviewDraft)}
              key={reviewDraft.id}
              onAddRecord={saveReviewedDraft}
              submitLabel="Save Reviewed Client"
              title="Review client details"
            />
          </div>
        </section>
      ) : null}

      {runs.length > 0 ? (
        <section className="border-t border-[#D9DED8] py-8">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-xl font-bold">Recent runs</h3>
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
                <p className="text-sm font-bold capitalize text-[#174F42]">
                  {formatRunState(run.state)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
