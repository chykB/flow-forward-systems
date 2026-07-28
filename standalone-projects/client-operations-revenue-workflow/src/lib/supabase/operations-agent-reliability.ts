import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperationsAgentAllowanceLevel,
  OperationsAgentReliabilityStatus,
} from "@/lib/operations-agent-types";

export type OperationsAgentReliabilityRow = {
  workspace_id: string;
  enabled: boolean;
  monthly_cost_limit_usd: number | string;
  monthly_estimated_cost_usd: number | string;
  monthly_chargeable_cost_usd: number | string;
  monthly_remaining_usd: number | string;
  usage_percent: number | string;
  allowance_level: OperationsAgentAllowanceLevel;
  warning_at_percent: number;
  critical_at_percent: number;
  active_run_count: number | string;
  stale_run_count: number | string;
  failed_run_count: number | string;
  month_started_at: string;
  updated_at: string;
};

export function mapOperationsAgentReliabilityRow(
  row: OperationsAgentReliabilityRow,
): OperationsAgentReliabilityStatus {
  return {
    workspaceId: row.workspace_id,
    enabled: row.enabled,
    monthlyCostLimitUsd: Number(row.monthly_cost_limit_usd),
    monthlyEstimatedCostUsd: Number(row.monthly_estimated_cost_usd),
    monthlyChargeableCostUsd: Number(row.monthly_chargeable_cost_usd),
    monthlyRemainingUsd: Number(row.monthly_remaining_usd),
    usagePercent: Number(row.usage_percent),
    allowanceLevel: row.allowance_level,
    warningAtPercent: row.warning_at_percent,
    criticalAtPercent: row.critical_at_percent,
    activeRunCount: Number(row.active_run_count),
    staleRunCount: Number(row.stale_run_count),
    failedRunCount: Number(row.failed_run_count),
    monthStartedAt: row.month_started_at,
    updatedAt: row.updated_at,
  };
}

export async function getOperationsAgentReliabilityStatus(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<OperationsAgentReliabilityStatus> {
  const { data, error } = await supabase.rpc(
    "query_operations_agent_reliability",
    {
      p_workspace_id: workspaceId,
    },
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as OperationsAgentReliabilityRow[];

  if (rows.length !== 1) {
    throw new Error(
      "The Operations Agent reliability status is unavailable.",
    );
  }

  return mapOperationsAgentReliabilityRow(rows[0]);
}
