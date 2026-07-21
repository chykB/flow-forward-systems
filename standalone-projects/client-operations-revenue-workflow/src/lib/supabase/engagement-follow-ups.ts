import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EngagementFollowUp,
  FollowUpOutcome,
} from "@/lib/client-workflow-types";

export type EngagementFollowUpRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
  actor_id: string;
  outcome: FollowUpOutcome;
  note: string;
  completed_at: string;
  next_action: string;
  next_follow_up_at: string | null;
  assigned_to: string;
  created_at: string;
};

export function mapEngagementFollowUpRow(
  row: EngagementFollowUpRow,
): EngagementFollowUp {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
    outcome: row.outcome,
    note: row.note,
    completedAt: row.completed_at,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at ?? "",
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
  };
}

export async function getWorkspaceEngagementFollowUps(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("engagement_follow_ups")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as EngagementFollowUpRow[]).map(
    mapEngagementFollowUpRow,
  );
}
