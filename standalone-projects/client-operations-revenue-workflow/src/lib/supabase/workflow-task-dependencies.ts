import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowTaskDependency } from "@/lib/client-workflow-types";

export type WorkflowTaskDependencyRow = {
  workspace_id: string;
  client_engagement_id: string;
  workflow_task_id: string;
  depends_on_workflow_task_id: string;
  created_by: string;
  created_at: string;
};

export function mapWorkflowTaskDependencyRow(
  row: WorkflowTaskDependencyRow,
): WorkflowTaskDependency {
  return {
    clientEngagementId: row.client_engagement_id,
    workflowTaskId: row.workflow_task_id,
    dependsOnWorkflowTaskId: row.depends_on_workflow_task_id,
    createdAt: row.created_at,
  };
}

export async function getWorkspaceWorkflowTaskDependencies(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workflow_task_dependencies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "Supabase Work Item dependencies load failed",
      error,
    );
    throw new Error(error.message);
  }

  return (data as WorkflowTaskDependencyRow[]).map(
    mapWorkflowTaskDependencyRow,
  );
}
