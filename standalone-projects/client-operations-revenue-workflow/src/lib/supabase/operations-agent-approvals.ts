import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperationsAgentApproval,
  OperationsAgentApprovalDecision,
  OperationsAgentApprovalExecutionState,
  OperationsAgentApprovalReviewField,
} from "@/lib/operations-agent-types";

export type OperationsAgentApprovalRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  step_id: string;
  requested_for: string;
  action_title: string;
  action_summary: string;
  review_fields: unknown;
  decision: OperationsAgentApprovalDecision;
  execution_state: OperationsAgentApprovalExecutionState;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  executed_by: string | null;
  executed_at: string | null;
  execution_outcome: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function mapReviewFields(value: unknown): OperationsAgentApprovalReviewField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((field) => {
    if (
      typeof field !== "object" ||
      field === null ||
      !("label" in field) ||
      !("value" in field) ||
      typeof field.label !== "string" ||
      typeof field.value !== "string"
    ) {
      return [];
    }

    return [{
      label: field.label,
      value: field.value,
    }];
  });
}

export function mapOperationsAgentApprovalRow(
  row: OperationsAgentApprovalRow,
): OperationsAgentApproval {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    stepId: row.step_id,
    requestedFor: row.requested_for,
    actionTitle: row.action_title,
    actionSummary: row.action_summary,
    reviewFields: mapReviewFields(row.review_fields),
    decision: row.decision,
    executionState: row.execution_state,
    decidedBy: row.decided_by ?? "",
    decidedAt: row.decided_at ?? "",
    decisionNote: row.decision_note ?? "",
    executedBy: row.executed_by ?? "",
    executedAt: row.executed_at ?? "",
    executionOutcome: row.execution_outcome ?? "",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceOperationsAgentApprovals(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<OperationsAgentApproval[]> {
  const { data, error } = await supabase.rpc(
    "query_operations_agent_approvals",
    {
      p_workspace_id: workspaceId,
    },
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as OperationsAgentApprovalRow[]).map(
    mapOperationsAgentApprovalRow,
  );
}
