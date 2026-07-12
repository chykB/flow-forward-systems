import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalRecord } from "@/lib/client-workflow-types";

type ProposalRecordRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
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
  created_at: string;
  updated_at: string;
};

export type NewProposalRecord = Omit<
  ProposalRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type ProposalRecordUpdates = Partial<
  Omit<
    ProposalRecord,
    "id" | "clientWorkflowRecordId" | "createdAt" | "updatedAt"
  >
>;

function mapProposalRow(row: ProposalRecordRow): ProposalRecord {
  return {
    id: row.id,
    clientWorkflowRecordId: row.client_workflow_record_id,
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

export async function createProposalRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  proposal: NewProposalRecord,
) {
  const { data, error } = await supabase
    .from("proposal_records")
    .insert({
      workspace_id: workspaceId,
      client_workflow_record_id: proposal.clientWorkflowRecordId,
      title: proposal.title,
      amount: proposal.amount,
      currency: proposal.currency,
      status: proposal.status,
      sent_at: proposal.sentAt || null,
      expires_at: proposal.expiresAt || null,
      accepted_at: proposal.acceptedAt || null,
      rejected_at: proposal.rejectedAt || null,
      revision_requested_at: proposal.revisionRequestedAt || null,
      notes: proposal.notes,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase proposal insert failed", error);
    throw new Error(error.message);
  }

  return mapProposalRow(data as ProposalRecordRow);
}

function buildProposalUpdatePayload(updates: ProposalRecordUpdates) {
  const payload: Record<string, string | number | null> = {};

  if (updates.title !== undefined) {
    payload.title = updates.title;
  }

  if (updates.amount !== undefined) {
    payload.amount = updates.amount;
  }

  if (updates.currency !== undefined) {
    payload.currency = updates.currency;
  }

  if (updates.status !== undefined) {
    payload.status = updates.status;
  }

  if (updates.sentAt !== undefined) {
    payload.sent_at = updates.sentAt || null;
  }

  if (updates.expiresAt !== undefined) {
    payload.expires_at = updates.expiresAt || null;
  }

  if (updates.acceptedAt !== undefined) {
    payload.accepted_at = updates.acceptedAt || null;
  }

  if (updates.rejectedAt !== undefined) {
    payload.rejected_at = updates.rejectedAt || null;
  }

  if (updates.revisionRequestedAt !== undefined) {
    payload.revision_requested_at =
      updates.revisionRequestedAt || null;
  }

  if (updates.notes !== undefined) {
    payload.notes = updates.notes;
  }

  return payload;
}

export async function updateProposalRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  proposalId: string,
  updates: ProposalRecordUpdates,
) {
  const payload = buildProposalUpdatePayload(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error("No proposal changes were provided.");
  }

  const { data, error } = await supabase
    .from("proposal_records")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .eq("id", proposalId)
    .select("*")
    .single();

  if (error) {
    console.error("Supabase proposal update failed", error);
    throw new Error(error.message);
  }

  return mapProposalRow(data as ProposalRecordRow);
}