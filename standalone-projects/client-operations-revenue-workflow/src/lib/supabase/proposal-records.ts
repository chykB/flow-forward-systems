import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalRecord } from "@/lib/client-workflow-types";

export type ProposalRecordRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
  title: string;
  amount: number | string;
  currency: string;
  status: ProposalRecord["status"];
  sent_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  revision_requested_at: string | null;
  notes: string;
  workflow_action_applied_status: ProposalRecord["status"] | null;
  workflow_action_applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapProposalRow(
  row: ProposalRecordRow,
): ProposalRecord {
  return {
    id: row.id,
    clientWorkflowRecordId: row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
    title: row.title,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    status: row.status,
    sentAt: row.sent_at ?? "",
    expiresAt: row.expires_at ?? "",
    acceptedAt: row.accepted_at ?? "",
    rejectedAt: row.rejected_at ?? "",
    revisionRequestedAt: row.revision_requested_at ?? "",
    notes: row.notes ?? "",
    workflowActionAppliedStatus:
      row.workflow_action_applied_status ?? "",
    workflowActionAppliedAt:
      row.workflow_action_applied_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceProposalRecords(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("proposal_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase proposal records load failed", error);
    throw new Error(error.message);
  }

  return (data as ProposalRecordRow[]).map(mapProposalRow);
}

export async function getClientProposalRecords(
  supabase: SupabaseClient,
  workspaceId: string,
  clientWorkflowRecordId: string,
) {
  const { data, error } = await supabase
    .from("proposal_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("client_workflow_record_id", clientWorkflowRecordId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase client proposals load failed", error);
    throw new Error(error.message);
  }

  return (data as ProposalRecordRow[]).map(mapProposalRow);
}
