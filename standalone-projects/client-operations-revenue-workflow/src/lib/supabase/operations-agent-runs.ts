import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperationsAgentCapability,
  OperationsAgentRun,
  OperationsAgentRunMode,
  OperationsAgentRunState,
  OperationsAgentStep,
  OperationsAgentStepKind,
  OperationsAgentTrigger,
} from "@/lib/operations-agent-types";

export type OperationsAgentRunRow = {
  id: string;
  workspace_id: string;
  initiated_by: string;
  capability: OperationsAgentCapability;
  mode: OperationsAgentRunMode;
  trigger_type: OperationsAgentTrigger;
  objective: string;
  context: Record<string, unknown>;
  plan: unknown[];
  state: OperationsAgentRunState;
  current_step_index: number;
  model_calls: number;
  tool_calls: number;
  retry_count: number;
  estimated_cost_usd: number | string;
  chargeable_cost_usd: number | string;
  max_model_calls: number;
  max_tool_calls: number;
  max_retries: number;
  max_duration_seconds: number;
  max_cost_usd: number | string;
  worker_id: string | null;
  lease_expires_at: string | null;
  execution_deadline_at: string | null;
  approval_expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  outcome_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationsAgentStepRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  step_key: string;
  step_index: number;
  kind: OperationsAgentStepKind;
  title: string;
  state: OperationsAgentRunState;
  attempt_count: number;
  max_attempts: number;
  tool_name: string | null;
  input_summary: string | null;
  output_summary: string | null;
  details: Record<string, unknown>;
  idempotency_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

function textOrEmpty(value: string | null) {
  return value ?? "";
}

export function mapOperationsAgentRunRow(
  row: OperationsAgentRunRow,
): OperationsAgentRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    initiatedBy: row.initiated_by,
    capability: row.capability,
    mode: row.mode,
    triggerType: row.trigger_type,
    objective: row.objective,
    context: row.context ?? {},
    plan: Array.isArray(row.plan) ? row.plan : [],
    state: row.state,
    currentStepIndex: row.current_step_index,
    modelCalls: row.model_calls,
    toolCalls: row.tool_calls,
    retryCount: row.retry_count,
    estimatedCostUsd: Number(row.estimated_cost_usd),
    chargeableCostUsd: Number(row.chargeable_cost_usd),
    maxModelCalls: row.max_model_calls,
    maxToolCalls: row.max_tool_calls,
    maxRetries: row.max_retries,
    maxDurationSeconds: row.max_duration_seconds,
    maxCostUsd: Number(row.max_cost_usd),
    workerId: textOrEmpty(row.worker_id),
    leaseExpiresAt: textOrEmpty(row.lease_expires_at),
    executionDeadlineAt: textOrEmpty(
      row.execution_deadline_at,
    ),
    approvalExpiresAt: textOrEmpty(row.approval_expires_at),
    startedAt: textOrEmpty(row.started_at),
    completedAt: textOrEmpty(row.completed_at),
    cancelledAt: textOrEmpty(row.cancelled_at),
    failedAt: textOrEmpty(row.failed_at),
    failureCode: textOrEmpty(row.failure_code),
    failureMessage: textOrEmpty(row.failure_message),
    outcomeSummary: textOrEmpty(row.outcome_summary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOperationsAgentStepRow(
  row: OperationsAgentStepRow,
): OperationsAgentStep {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    stepKey: row.step_key,
    stepIndex: row.step_index,
    kind: row.kind,
    title: row.title,
    state: row.state,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    toolName: textOrEmpty(row.tool_name),
    inputSummary: textOrEmpty(row.input_summary),
    outputSummary: textOrEmpty(row.output_summary),
    details: row.details ?? {},
    idempotencyKey: textOrEmpty(row.idempotency_key),
    startedAt: textOrEmpty(row.started_at),
    completedAt: textOrEmpty(row.completed_at),
    failureCode: textOrEmpty(row.failure_code),
    failureMessage: textOrEmpty(row.failure_message),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceOperationsAgentRuns(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("operations_agent_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Operations Agent runs load failed", error);
    throw new Error(error.message);
  }

  return (data as OperationsAgentRunRow[]).map(
    mapOperationsAgentRunRow,
  );
}

export async function getOperationsAgentRunSteps(
  supabase: SupabaseClient,
  workspaceId: string,
  runId: string,
) {
  const { data, error } = await supabase
    .from("operations_agent_steps")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("run_id", runId)
    .order("step_index", { ascending: true });

  if (error) {
    console.error("Supabase Operations Agent steps load failed", error);
    throw new Error(error.message);
  }

  return (data as OperationsAgentStepRow[]).map(
    mapOperationsAgentStepRow,
  );
}
