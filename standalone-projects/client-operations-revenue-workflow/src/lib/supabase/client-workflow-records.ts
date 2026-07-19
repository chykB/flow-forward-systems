import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientWorkflowRecord,
  LifecycleStage,
} from "@/lib/client-workflow-types";

type StoredLifecycleStage = LifecycleStage | "At risk";

export type ClientWorkflowRecordRow = {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  source: string | null;
  interest: string | null;
  message: string | null;
  lifecycle_stage: StoredLifecycleStage;
  next_action: string;
  next_follow_up_at: string | null;
  assigned_to: string | null;
  priority: ClientWorkflowRecord["priority"];
  risk_level: ClientWorkflowRecord["riskLevel"];
  onboarding_status: ClientWorkflowRecord["onboardingStatus"];
  delivery_status: ClientWorkflowRecord["deliveryStatus"];
  approval_status: ClientWorkflowRecord["approvalStatus"];
  payment_status: ClientWorkflowRecord["paymentStatus"];
  created_at: string;
  updated_at: string;
  client_type: ClientWorkflowRecord["clientType"];
  returning_client_status: ClientWorkflowRecord["returningClientStatus"];
  last_project_date: string | null;
  estimated_value: number;
  workflow_health_score: number;
};

function isActiveWorkflowStatus(
  status: ClientWorkflowRecord["onboardingStatus"],
) {
  return (
    status === "In progress" ||
    status === "Waiting" ||
    status === "Blocked"
  );
}

function inferLegacyLifecycleStage(
  row: ClientWorkflowRecordRow,
): LifecycleStage {
  if (isActiveWorkflowStatus(row.payment_status)) {
    return "Payment follow-up";
  }

  if (isActiveWorkflowStatus(row.approval_status)) {
    return "Waiting for approval";
  }

  if (isActiveWorkflowStatus(row.delivery_status)) {
    return "In delivery";
  }

  if (isActiveWorkflowStatus(row.onboarding_status)) {
    return "Onboarding";
  }

  const workflowStatuses = [
    row.onboarding_status,
    row.delivery_status,
    row.approval_status,
    row.payment_status,
  ];
  const hasCompletedWork = workflowStatuses.includes("Complete");
  const hasOnlyResolvedWork = workflowStatuses.every(
    (status) => status === "Complete" || status === "Not needed",
  );

  if (hasCompletedWork && hasOnlyResolvedWork) {
    return "Completed";
  }

  if (row.client_type === "Past client") {
    return "Lost or inactive";
  }

  if (row.client_type === "Lead") {
    return "Follow-up needed";
  }

  return "Won client";
}

function normalizeLifecycleStage(
  row: ClientWorkflowRecordRow,
): LifecycleStage {
  return row.lifecycle_stage === "At risk"
    ? inferLegacyLifecycleStage(row)
    : row.lifecycle_stage;
}

export function mapClientWorkflowRecordRow(
  row: ClientWorkflowRecordRow,
): ClientWorkflowRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    businessName: row.business_name ?? "",
    source: row.source ?? "",
    interest: row.interest ?? "",
    message: row.message ?? "",
    lifecycleStage: normalizeLifecycleStage(row),
    priority: row.priority,
    riskLevel: row.risk_level,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at ?? "",
    assignedTo: row.assigned_to ?? "",
    onboardingStatus: row.onboarding_status,
    deliveryStatus: row.delivery_status,
    approvalStatus: row.approval_status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientType: row.client_type,
    returningClientStatus: row.returning_client_status,
    lastProjectDate: row.last_project_date ?? "",
    estimatedValue: Number(row.estimated_value ?? 0),
    workflowHealthScore: row.workflow_health_score ?? 75,

  };
}

export async function getClientWorkflowRecords(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("client_workflow_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ClientWorkflowRecordRow[]).map(mapClientWorkflowRecordRow);
}
