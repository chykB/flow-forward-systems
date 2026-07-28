"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  createOperationRequestId,
  type WorkspaceApplicationApi,
} from "@/lib/application/workspace-api";
import type {
  OperationsAgentReliabilityStatus,
  OperationsAgentRun,
} from "@/lib/operations-agent-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type OperationsAgentReliabilityPanelProps = {
  workspaceApi: WorkspaceApplicationApi;
  workspaceId: string;
};

const guidedCapabilities = new Set([
  "guided_client_intake",
  "guided_workspace_setup",
]);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function isRecoverableRun(run: OperationsAgentRun) {
  return (
    run.state === "running" &&
    guidedCapabilities.has(run.capability) &&
    (!run.leaseExpiresAt ||
      Date.parse(run.leaseExpiresAt) <= Date.now())
  );
}

function getAllowanceCopy(status: OperationsAgentReliabilityStatus) {
  switch (status.allowanceLevel) {
    case "paused":
      return {
        title: "Operations Agent paused",
        detail:
          "Agent-assisted work is paused. Your manual workspace tools remain available.",
        tone: "border-[#D9DED8] bg-[#F6F8F6] text-[#174F42]",
      };
    case "limit_reached":
      return {
        title: "Monthly limit reached",
        detail:
          "No new agent work will start this month. Continue with the manual workspace tools.",
        tone: "border-[#E2B8B5] bg-[#FFF2F1] text-[#9B1C1C]",
      };
    case "near_limit":
      return {
        title: "Close to the monthly limit",
        detail:
          "At least 90% of this month's allowance has been used. Manual tools remain available.",
        tone: "border-[#E8C98B] bg-[#FFF8E8] text-[#7A4B00]",
      };
    case "approaching":
      return {
        title: "Allowance is running low",
        detail:
          "At least 70% of this month's allowance has been used.",
        tone: "border-[#E8C98B] bg-[#FFF8E8] text-[#7A4B00]",
      };
    default:
      return {
        title: "Allowance available",
        detail: `${formatCurrency(
          status.monthlyRemainingUsd,
        )} remains for this month.`,
        tone: "border-[#BBD6C7] bg-[#F0F7F3] text-[#174F42]",
      };
  }
}

export function OperationsAgentReliabilityPanel({
  workspaceApi,
  workspaceId,
}: OperationsAgentReliabilityPanelProps) {
  const [status, setStatus] =
    useState<OperationsAgentReliabilityStatus | null>(null);
  const [runs, setRuns] = useState<OperationsAgentRun[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [monthlyLimit, setMonthlyLimit] = useState("5.00");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recoveringRunId, setRecoveringRunId] = useState("");

  const loadStatus = useCallback(async () => {
    const [nextStatus, nextRuns] = await Promise.all([
      workspaceApi.operationsAgent.getReliabilityStatus(),
      workspaceApi.operationsAgent.listRuns(),
    ]);

    setStatus(nextStatus);
    setRuns(nextRuns);
    setEnabled(nextStatus.enabled);
    setMonthlyLimit(nextStatus.monthlyCostLimitUsd.toFixed(2));
  }, [workspaceApi]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        await loadStatus();
      } catch (error) {
        console.error(
          "Operations Agent reliability load failed",
          error,
        );
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Usage and reliability could not be loaded.",
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
  }, [loadStatus]);

  const recoverableRuns = useMemo(
    () => runs.filter(isRecoverableRun),
    [runs],
  );

  async function saveControls() {
    const limit = Number(monthlyLimit);

    if (!Number.isFinite(limit) || limit < 0.1 || limit > 1000) {
      setMessage("Choose a monthly limit between $0.10 and $1,000.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const result =
        await workspaceApi.operationsAgent.updateControls({
          commandId: createOperationRequestId(),
          enabled,
          monthlyCostLimitUsd: limit,
        });

      setStatus(result.status);
      setEnabled(result.status.enabled);
      setMonthlyLimit(
        result.status.monthlyCostLimitUsd.toFixed(2),
      );
      setMessage("Operations Agent controls saved.");
    } catch (error) {
      console.error("Operations Agent controls update failed", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Operations Agent controls could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function continueRecoveredRun(run: OperationsAgentRun) {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your session is no longer valid. Sign in again.",
      );
    }

    const route =
      run.capability === "guided_workspace_setup"
        ? "/api/operations-agent/guided-workspace-setup"
        : "/api/operations-agent/guided-client-intake";
    const response = await fetch(route, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId,
        runId: run.id,
        expectedUpdatedAt: run.updatedAt,
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      referenceId?: string;
    };

    if (!response.ok) {
      throw new Error(
        body.error
          ? `${body.error}${
              body.referenceId
                ? ` Reference: ${body.referenceId}.`
                : ""
            }`
          : "The interrupted agent task could not continue.",
      );
    }
  }

  async function recoverRun(run: OperationsAgentRun) {
    setRecoveringRunId(run.id);
    setMessage("");

    try {
      const result =
        await workspaceApi.operationsAgent.recoverRun({
          commandId: createOperationRequestId(),
          runId: run.id,
          expectedUpdatedAt: run.updatedAt,
        });

      if (result.run.state !== "queued") {
        await loadStatus();
        setMessage(
          result.run.outcomeSummary ||
            "This task cannot continue. Use the manual workflow.",
        );
        return;
      }

      await continueRecoveredRun(result.run);
      await loadStatus();
      setMessage("The interrupted agent task continued.");
    } catch (error) {
      console.error("Operations Agent recovery failed", error);

      try {
        await loadStatus();
      } catch (refreshError) {
        console.error(
          "Operations Agent recovery refresh failed",
          refreshError,
        );
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "The interrupted task could not continue. Use the manual workflow.",
      );
    } finally {
      setRecoveringRunId("");
    }
  }

  function openManualView(view: "client-records" | "action-queue") {
    const nextHash = `#${view}`;

    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }

    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  if (isLoading) {
    return (
      <div
        aria-live="polite"
        className="flex min-h-40 items-center gap-3 text-[#53615D]"
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin"
        />
        Loading usage and reliability
      </div>
    );
  }

  if (!status) {
    return (
      <div
        className="border-y border-[#E2B8B5] bg-[#FFF2F1] px-4 py-5 text-[#9B1C1C]"
        role="alert"
      >
        {message || "Usage and reliability could not be loaded."}
      </div>
    );
  }

  const allowance = getAllowanceCopy(status);
  const progress = Math.min(100, Math.max(0, status.usagePercent));

  return (
    <section aria-labelledby="agent-reliability-heading">
      <div className="border-b border-[#D9DED8] pb-6">
        <div className="flex items-start gap-3">
          <Gauge
            aria-hidden="true"
            className="mt-1 size-6 text-[#2B7A61]"
          />
          <div>
            <h2
              className="text-2xl font-bold"
              id="agent-reliability-heading"
            >
              Usage and reliability
            </h2>
            <p className="mt-2 max-w-3xl text-[#53615D]">
              Set a monthly hard limit, pause agent-assisted work, and
              recover an interrupted guided task.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`mt-6 border px-4 py-4 ${allowance.tone}`}
        role={
          status.allowanceLevel === "available"
            ? "status"
            : "alert"
        }
      >
        <div className="flex items-start gap-3">
          {status.allowanceLevel === "available" ? (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
          ) : (
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
          )}
          <div>
            <p className="font-bold">{allowance.title}</p>
            <p className="mt-1">{allowance.detail}</p>
          </div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#53615D]">
              Used this month
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(status.monthlyChargeableCostUsd)}
              <span className="ml-2 text-base font-normal text-[#53615D]">
                of {formatCurrency(status.monthlyCostLimitUsd)}
              </span>
            </p>
          </div>
          <p className="font-bold text-[#174F42]">
            {progress.toFixed(progress % 1 === 0 ? 0 : 1)}%
          </p>
        </div>
        <div
          aria-label={`${progress.toFixed(1)}% of monthly Operations Agent allowance used`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-3 h-3 overflow-hidden rounded-sm bg-[#E4E9E6]"
          role="progressbar"
        >
          <div
            className={`h-full ${
              progress >= status.criticalAtPercent
                ? "bg-[#B42318]"
                : progress >= status.warningAtPercent
                  ? "bg-[#B26A00]"
                  : "bg-[#2B7A61]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-0 border-y border-[#D9DED8] md:grid-cols-3">
        <div className="py-5 md:border-r md:border-[#D9DED8] md:pr-6">
          <p className="text-sm font-bold text-[#53615D]">
            Active tasks
          </p>
          <p className="mt-1 text-2xl font-bold">
            {status.activeRunCount}
          </p>
        </div>
        <div className="border-t border-[#D9DED8] py-5 md:border-r md:border-t-0 md:px-6">
          <p className="text-sm font-bold text-[#53615D]">
            Need recovery
          </p>
          <p className="mt-1 text-2xl font-bold">
            {status.staleRunCount}
          </p>
        </div>
        <div className="border-t border-[#D9DED8] py-5 md:border-t-0 md:pl-6">
          <p className="text-sm font-bold text-[#53615D]">
            Unsuccessful this month
          </p>
          <p className="mt-1 text-2xl font-bold">
            {status.failedRunCount}
          </p>
        </div>
      </div>

      {recoverableRuns.length > 0 ? (
        <div className="mt-8 border-y border-[#E8C98B] bg-[#FFF8E8] py-5">
          <h3 className="text-xl font-bold text-[#7A4B00]">
            Interrupted task
          </h3>
          {recoverableRuns.map((run) => (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-4"
              key={run.id}
            >
              <div>
                <p className="font-bold">{run.objective}</p>
                <p className="mt-1 text-[#53615D]">
                  Continue within the original time and retry limits.
                </p>
              </div>
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  Boolean(recoveringRunId) ||
                  !status.enabled ||
                  status.allowanceLevel === "limit_reached"
                }
                onClick={() => void recoverRun(run)}
                type="button"
              >
                {recoveringRunId === run.id ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-5 animate-spin"
                  />
                ) : (
                  <RotateCcw aria-hidden="true" className="size-5" />
                )}
                Continue task
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 border-b border-[#D9DED8] pb-8">
        <h3 className="text-xl font-bold">Controls</h3>
        <label className="mt-5 flex max-w-xl items-start gap-3">
          <input
            checked={enabled}
            className="mt-1 size-5 accent-[#174F42]"
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-bold">
              Agent-assisted work available
            </span>
            <span className="mt-1 block text-[#53615D]">
              Turn this off to stop new agent tasks and protected
              execution. Manual workspace tools stay available.
            </span>
          </span>
        </label>

        <label className="mt-6 block max-w-sm font-bold">
          Monthly hard limit
          <span className="mt-2 flex items-center rounded-md border border-[#C9D1CC] bg-white focus-within:border-[#2B7A61] focus-within:ring-2 focus-within:ring-[#2B7A61]/25">
            <span className="pl-4 text-[#53615D]">$</span>
            <input
              className="min-h-12 w-full bg-transparent px-2 py-2 outline-none"
              inputMode="decimal"
              max="1000"
              min="0.10"
              onChange={(event) => setMonthlyLimit(event.target.value)}
              step="0.10"
              type="number"
              value={monthlyLimit}
            />
          </span>
        </label>

        <button
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-4 py-2 font-bold text-white hover:bg-[#123F35] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          onClick={() => void saveControls()}
          type="button"
        >
          {isSaving ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin"
            />
          ) : (
            <Save aria-hidden="true" className="size-5" />
          )}
          Save controls
        </button>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold">Manual fallback</h3>
        <p className="mt-2 text-[#53615D]">
          Continue directly whenever agent-assisted work is paused,
          unavailable, or out of allowance.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
            onClick={() => openManualView("client-records")}
            type="button"
          >
            Client records
            <ArrowRight aria-hidden="true" className="size-5" />
          </button>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
            onClick={() => openManualView("action-queue")}
            type="button"
          >
            Action queue
            <ArrowRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {message ? (
        <p
          aria-live="polite"
          className="mt-6 border-y border-[#D9DED8] bg-[#F6F8F6] px-4 py-3 text-[#174F42]"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
