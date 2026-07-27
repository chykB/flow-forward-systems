"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { WorkspaceSetupForm } from "@/components/WorkspaceSetupForm";
import {
  createOperationRequestId,
  type WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";
import type {
  GuidedWorkspaceSetupDraft,
  GuidedWorkspaceSetupDraftValues,
  GuidedWorkspaceSetupField,
  OperationsAgentRun,
  ReviewedWorkspaceSetup,
  WorkspaceOperatingProfile,
} from "@/lib/operations-agent-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type GuidedWorkspaceSetupPanelProps = {
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

const activeRunStates = new Set([
  "queued",
  "running",
  "waiting_for_approval",
]);

const fieldLabels: Record<GuidedWorkspaceSetupField, string> = {
  businessType: "Business type",
  workflowStages: "Workflow stages",
  commonOwners: "Common owners",
  workingDays: "Working days",
  dailyBriefingEnabled: "Daily workspace briefing",
  immediateFailureAlertsEnabled: "Agent failure alerts",
  opportunityAlertsEnabled: "Opportunity reminders",
};

const runStateLabels: Record<OperationsAgentRun["state"], string> = {
  queued: "Waiting to prepare",
  running: "Preparing draft",
  waiting_for_approval: "Ready to review",
  completed: "Workspace setup saved",
  failed: "Draft not prepared",
  cancelled: "Draft discarded",
  expired: "Draft expired",
  partially_completed: "Needs attention",
};

function getInitialValues(
  draft: GuidedWorkspaceSetupDraft,
): GuidedWorkspaceSetupDraftValues {
  const unavailableFields = new Set<GuidedWorkspaceSetupField>([
    ...draft.missingFields,
    ...draft.uncertainFields.map(
      (uncertainty) => uncertainty.field,
    ),
  ]);
  const values = draft.values;

  return {
    businessType: unavailableFields.has("businessType")
      ? null
      : values.businessType,
    workflowStages: unavailableFields.has("workflowStages")
      ? []
      : values.workflowStages,
    commonOwners: unavailableFields.has("commonOwners")
      ? []
      : values.commonOwners,
    workingDays: unavailableFields.has("workingDays")
      ? []
      : values.workingDays,
    dailyBriefingEnabled: unavailableFields.has(
      "dailyBriefingEnabled",
    )
      ? null
      : values.dailyBriefingEnabled,
    immediateFailureAlertsEnabled: unavailableFields.has(
      "immediateFailureAlertsEnabled",
    )
      ? null
      : values.immediateFailureAlertsEnabled,
    opportunityAlertsEnabled: unavailableFields.has(
      "opportunityAlertsEnabled",
    )
      ? null
      : values.opportunityAlertsEnabled,
    summary: values.summary,
  };
}

function ProfileSummary({
  profile,
}: {
  profile: WorkspaceOperatingProfile;
}) {
  const enabledNotifications = [
    profile.dailyBriefingEnabled ? "Daily briefing" : null,
    profile.immediateFailureAlertsEnabled
      ? "Agent failure alerts"
      : null,
    profile.opportunityAlertsEnabled
      ? "Opportunity reminders"
      : null,
  ].filter(Boolean);

  return (
    <section className="border-b border-[#D9DED8] pb-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
            Current setup
          </p>
          <h3 className="mt-2 text-xl font-bold">
            {profile.businessType}
          </h3>
        </div>
        <p className="inline-flex items-center gap-2 font-bold text-[#174F42]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          Saved
        </p>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-bold">Workflow stages</dt>
          <dd className="mt-1 leading-7 text-[#5F6862]">
            {profile.workflowStages.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="font-bold">Common owners</dt>
          <dd className="mt-1 leading-7 text-[#5F6862]">
            {profile.commonOwners.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="font-bold">Working days</dt>
          <dd className="mt-1 leading-7 text-[#5F6862]">
            {profile.workingDays.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="font-bold">Notifications</dt>
          <dd className="mt-1 leading-7 text-[#5F6862]">
            {enabledNotifications.length > 0
              ? enabledNotifications.join(", ")
              : "None enabled"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function GuidedWorkspaceSetupPanel({
  workspaceApi,
  workspaceId,
}: GuidedWorkspaceSetupPanelProps) {
  const [objective, setObjective] = useState("");
  const [runs, setRuns] = useState<OperationsAgentRun[]>([]);
  const [drafts, setDrafts] = useState<GuidedWorkspaceSetupDraft[]>(
    [],
  );
  const [profile, setProfile] =
    useState<WorkspaceOperatingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [message, setMessage] = useState("");

  const loadAgentState = useCallback(async () => {
    const [nextRuns, nextDrafts, nextProfile] = await Promise.all([
      workspaceApi.operationsAgent.listRuns(),
      workspaceApi.operationsAgent.listWorkspaceSetupDrafts(),
      workspaceApi.operationsAgent.getWorkspaceProfile(),
    ]);

    setRuns(
      nextRuns.filter(
        (run) => run.capability === "guided_workspace_setup",
      ),
    );
    setDrafts(nextDrafts);
    setProfile(nextProfile);
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      try {
        const [nextRuns, nextDrafts, nextProfile] =
          await Promise.all([
            workspaceApi.operationsAgent.listRuns(),
            workspaceApi.operationsAgent.listWorkspaceSetupDrafts(),
            workspaceApi.operationsAgent.getWorkspaceProfile(),
          ]);

        if (isMounted) {
          setRuns(
            nextRuns.filter(
              (run) =>
                run.capability === "guided_workspace_setup",
            ),
          );
          setDrafts(nextDrafts);
          setProfile(nextProfile);
          setMessage("");
        }
      } catch (error) {
        console.error("Guided workspace setup load failed", error);

        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Workspace setup could not be loaded.",
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

  async function startSetup() {
    const normalizedObjective = objective.trim();

    if (normalizedObjective.length < 10) {
      setMessage("Describe how your workspace should operate.");
      return;
    }

    setIsStarting(true);
    setMessage("");
    let startedRun: OperationsAgentRun | null = null;

    try {
      const startResult =
        await workspaceApi.operationsAgent.startRun({
          commandId: createOperationRequestId(),
          capability: "guided_workspace_setup",
          objective: normalizedObjective,
          context: {
            source: "operations_agent_workspace_setup",
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
        "/api/operations-agent/guided-workspace-setup",
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
            : "The workspace setup draft could not be prepared.",
        );
      }

      await loadAgentState();
      setObjective("");
    } catch (error) {
      console.error("Guided workspace setup start failed", error);

      try {
        await loadAgentState();
      } catch (refreshError) {
        console.error(
          "Workspace setup state refresh failed",
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
          : "The workspace setup draft could not be prepared.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function cancelPreparation() {
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
            ? "The workspace setup draft could not be discarded."
            : "Workspace setup preparation could not be cancelled.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function saveSetup(
    approvedConfiguration: ReviewedWorkspaceSetup,
  ) {
    if (!activeRun || !reviewDraft) {
      throw new Error(
        "This workspace setup draft is no longer available. Refresh and try again.",
      );
    }

    const result =
      await workspaceApi.operationsAgent.completeWorkspaceSetup({
        commandId: createOperationRequestId(),
        runId: activeRun.id,
        draftId: reviewDraft.id,
        expectedRunUpdatedAt: activeRun.updatedAt,
        expectedDraftUpdatedAt: reviewDraft.updatedAt,
        approvedConfiguration,
      });

    setProfile(result.profile);
    await loadAgentState();
    return result;
  }

  return (
    <div id="operations-agent-workspace-setup">
      {profile && !reviewDraft ? (
        <ProfileSummary profile={profile} />
      ) : null}

      <section className="border-b border-[#D9DED8] py-8 first:pt-0">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
          Operations Agent
        </p>
        <h2 className="mt-3 text-3xl font-bold">
          {profile
            ? "Update workspace setup"
            : "Prepare workspace setup"}
        </h2>
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-[#174F42]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          Nothing changes without your review
        </div>

        <label
          className="mt-7 block font-bold"
          htmlFor="operations-agent-workspace-setup-details"
        >
          How your team works
        </label>
        <textarea
          className="mt-2 min-h-40 w-full rounded-md border border-[#D9DED8] bg-white px-4 py-3 leading-7 outline-none focus:border-[#174F42]"
          disabled={Boolean(activeRun) || isStarting}
          id="operations-agent-workspace-setup-details"
          maxLength={2000}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Describe your business, the stages you use, common owner roles, working days, and which updates you want to receive."
          value={objective}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(activeRun) || isStarting}
            onClick={startSetup}
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
            {isStarting ? "Preparing..." : "Prepare setup draft"}
          </button>

          {activeRun ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCancelling || isStarting}
              onClick={cancelPreparation}
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
          Loading workspace setup...
        </p>
      ) : null}

      {activeRun && !reviewDraft ? (
        <section
          aria-live="polite"
          className="border-b border-[#D9DED8] py-8"
        >
          <div className="flex items-start gap-3">
            <LoaderCircle
              aria-hidden="true"
              className="mt-1 size-5 animate-spin text-[#174F42]"
            />
            <div>
              <h3 className="text-xl font-bold">
                {activeRun.state === "queued"
                  ? "Waiting to prepare the setup"
                  : "Preparing the setup draft"}
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
                    .map((field) => fieldLabels[field])
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
                          {fieldLabels[uncertainty.field]}:
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
              Review every section before saving.
            </p>
          </div>

          <div className="mt-6">
            <WorkspaceSetupForm
              initialValues={getInitialValues(reviewDraft)}
              key={reviewDraft.id}
              onSave={saveSetup}
            />
          </div>
        </section>
      ) : null}

      {runs.length > 0 ? (
        <section className="border-t border-[#D9DED8] py-8">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-xl font-bold">
              Recent workspace setup activity
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
