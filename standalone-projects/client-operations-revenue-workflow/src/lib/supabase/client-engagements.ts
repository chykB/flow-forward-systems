import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientEngagement,
  EngagementStatus,
  LifecycleStage,
  PriorityLevel,
  WorkflowStatus,
} from "@/lib/client-workflow-types";

export type ClientEngagementRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  title: string;
  engagement_status: EngagementStatus;
  lifecycle_stage: LifecycleStage;
  priority: PriorityLevel;
  estimated_value: number | string;
  workflow_health_score: number;
  next_action: string;
  next_follow_up_at: string | null;
  assigned_to: string;
  onboarding_status: WorkflowStatus;
  delivery_status: WorkflowStatus;
  approval_status: WorkflowStatus;
  payment_status: WorkflowStatus;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export function mapClientEngagementRow(
  row: ClientEngagementRow,
): ClientEngagement {
  return {
    id: row.id,
    clientWorkflowRecordId:
      row.client_workflow_record_id,
    title: row.title,
    engagementStatus: row.engagement_status,
    lifecycleStage: row.lifecycle_stage,
    priority: row.priority,
    estimatedValue: Number(row.estimated_value),
    workflowHealthScore: row.workflow_health_score,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at ?? "",
    assignedTo: row.assigned_to,
    onboardingStatus: row.onboarding_status,
    deliveryStatus: row.delivery_status,
    approvalStatus: row.approval_status,
    paymentStatus: row.payment_status,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceClientEngagements(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("client_engagements")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ClientEngagementRow[]).map(
    mapClientEngagementRow,
  );
}

export async function getPrimaryClientEngagement(
  supabase: SupabaseClient,
  workspaceId: string,
  clientWorkflowRecordId: string,
) {
  const { data, error } = await supabase
    .from("client_engagements")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq(
      "client_workflow_record_id",
      clientWorkflowRecordId,
    )
    .eq("is_primary", true)
    .single();

  if (error) {
    throw error;
  }

  return mapClientEngagementRow(
    data as ClientEngagementRow,
  );
}
