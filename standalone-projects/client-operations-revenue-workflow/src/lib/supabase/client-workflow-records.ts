import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientWorkflowRecord } from "@/lib/client-workflow-types";

type ClientWorkflowRecordRow = {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  source: string | null;
  interest: string | null;
  message: string | null;
  lifecycle_stage: ClientWorkflowRecord["lifecycleStage"];
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
};

function mapRecordRow(row: ClientWorkflowRecordRow): ClientWorkflowRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    businessName: row.business_name ?? "",
    source: row.source ?? "",
    interest: row.interest ?? "",
    message: row.message ?? "",
    lifecycleStage: row.lifecycle_stage,
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

  return (data as ClientWorkflowRecordRow[]).map(mapRecordRow);
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
    })
    .select("*")
    .single();

    if (error) {
        console.error("Supabase record insert failed", error);
        throw new Error(error.message);
    }

  return mapRecordRow(data as ClientWorkflowRecordRow);
}