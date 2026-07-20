import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowTask } from "@/lib/client-workflow-types";

export type WorkflowTaskRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
  title: string;
  type: WorkflowTask["type"];
  owner: string;
  due_date: string;
  status: WorkflowTask["status"];
  criticality: WorkflowTask["criticality"];
  phase: WorkflowTask["phase"];
  created_at: string;
  updated_at: string;
};

export function mapWorkflowTaskRow(
  row: WorkflowTaskRow,
): WorkflowTask {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
    title: row.title,
    type: row.type,
    owner: row.owner,
    dueDate: row.due_date,
    status: row.status,
    criticality: row.criticality,
    phase: row.phase,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceWorkflowTasks(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workflow_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error(
      "Supabase work items load failed",
      error,
    );
    throw new Error(error.message);
  }

  return (data as WorkflowTaskRow[]).map(
    mapWorkflowTaskRow,
  );
}
