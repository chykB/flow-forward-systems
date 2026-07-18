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

export async function createClientWorkflowRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  record: ClientWorkflowRecord,
) {
  const { data, error } = await supabase
    .from("client_workflow_records")
    .insert({
      workspace_id: workspaceId,
      name: record.name,
      email: record.email || null,
      phone: record.phone || null,
      business_name: record.businessName || null,
      source: record.source || null,
      interest: record.interest || null,
      message: record.message || null,
      lifecycle_stage: record.lifecycleStage,
      priority: record.priority,
      risk_level: record.riskLevel,
      next_action: record.nextAction,
      next_follow_up_at: record.nextFollowUpAt || null,
      assigned_to: record.assignedTo || null,
      onboarding_status: record.onboardingStatus,
      delivery_status: record.deliveryStatus,
      approval_status: record.approvalStatus,
      payment_status: record.paymentStatus,
      client_type: record.clientType,
      returning_client_status: record.returningClientStatus,
      last_project_date: record.lastProjectDate || null,
      estimated_value: record.estimatedValue,
      workflow_health_score: record.workflowHealthScore,
    })
    .select("*")
    .single();

    if (error) {
        console.error("Supabase record insert failed", error);
        throw new Error(error.message);
    }

  return mapClientWorkflowRecordRow(
    data as ClientWorkflowRecordRow,
  );
}

function buildRecordUpdatePayload(updates: Partial<ClientWorkflowRecord>) {
  const payload: Record<string, string | number | null> = {};

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  if (updates.email !== undefined) {
    payload.email = updates.email || null;
  }

  if (updates.phone !== undefined) {
    payload.phone = updates.phone || null;
  }

  if (updates.businessName !== undefined) {
    payload.business_name = updates.businessName || null;
  }

  if (updates.source !== undefined) {
    payload.source = updates.source || null;
  }

  if (updates.interest !== undefined) {
    payload.interest = updates.interest || null;
  }

  if (updates.message !== undefined) {
    payload.message = updates.message || null;
  }

  if (updates.lifecycleStage !== undefined) {
    payload.lifecycle_stage = updates.lifecycleStage;
  }

  if (updates.priority !== undefined) {
    payload.priority = updates.priority;
  }

  if (updates.riskLevel !== undefined) {
    payload.risk_level = updates.riskLevel;
  }

  if (updates.nextAction !== undefined) {
    payload.next_action = updates.nextAction;
  }

  if (updates.nextFollowUpAt !== undefined) {
    payload.next_follow_up_at = updates.nextFollowUpAt || null;
  }

  if (updates.assignedTo !== undefined) {
    payload.assigned_to = updates.assignedTo || null;
  }

  if (updates.onboardingStatus !== undefined) {
    payload.onboarding_status = updates.onboardingStatus;
  }

  if (updates.deliveryStatus !== undefined) {
    payload.delivery_status = updates.deliveryStatus;
  }

  if (updates.approvalStatus !== undefined) {
    payload.approval_status = updates.approvalStatus;
  }

  if (updates.paymentStatus !== undefined) {
    payload.payment_status = updates.paymentStatus;
  }

  if (updates.clientType !== undefined) {
    payload.client_type = updates.clientType;
  }

  if (updates.returningClientStatus !== undefined) {
    payload.returning_client_status = updates.returningClientStatus;
  }

  if (updates.lastProjectDate !== undefined) {
    payload.last_project_date = updates.lastProjectDate || null;
  }

  if (updates.estimatedValue !== undefined) {
    payload.estimated_value = updates.estimatedValue;
  }

  if (updates.workflowHealthScore !== undefined) {
    payload.workflow_health_score = updates.workflowHealthScore;
  }

  return payload;
}

export async function updateClientWorkflowRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  recordId: string,
  updates: Partial<ClientWorkflowRecord>,
) {
  const payload = buildRecordUpdatePayload(updates);

  const { data, error } = await supabase
    .from("client_workflow_records")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .eq("id", recordId)
    .select("*")
    .single();

  if (error) {
    console.error("Supabase record update failed", error);
    throw new Error(error.message);
  }

  return mapClientWorkflowRecordRow(
    data as ClientWorkflowRecordRow,
  );
}
