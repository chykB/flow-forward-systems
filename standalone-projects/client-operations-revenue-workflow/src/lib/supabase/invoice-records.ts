import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRecord } from "@/lib/client-workflow-types";

export type InvoiceRecordRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
  proposal_record_id: string | null;
  proposal_title_snapshot: string;
  proposal_amount_snapshot: number | string | null;
  billing_basis: InvoiceRecord["billingBasis"];
  billing_percentage: number | string | null;
  invoice_number: string | null;
  amount: number | string;
  currency: string;
  description: string | null;
  status: InvoiceRecord["status"];
  payment_link: string | null;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  dispute_reason: string | null;
  disputed_at: string | null;
  dispute_resolved_at: string | null;
  dispute_resolution_outcome:
    | InvoiceRecord["disputeResolutionOutcome"]
    | null;
  dispute_resolution_note: string | null;
  workflow_action_applied_status:
    | InvoiceRecord["status"]
    | null;
  workflow_action_applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapInvoiceRow(
  row: InvoiceRecordRow,
): InvoiceRecord {
  return {
    id: row.id,
    clientWorkflowRecordId: row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
    proposalRecordId: row.proposal_record_id ?? "",
    proposalTitleSnapshot: row.proposal_title_snapshot ?? "",
    proposalAmountSnapshot:
      row.proposal_amount_snapshot === null
        ? null
        : Number(row.proposal_amount_snapshot),
    billingBasis: row.billing_basis,
    billingPercentage:
      row.billing_percentage === null
        ? null
        : Number(row.billing_percentage),
    invoiceNumber: row.invoice_number ?? "",
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    description: row.description ?? "",
    status: row.status,
    paymentLink: row.payment_link ?? "",
    sentAt: row.sent_at ?? "",
    dueDate: row.due_date ?? "",
    paidAt: row.paid_at ?? "",
    disputeReason: row.dispute_reason ?? "",
    disputedAt: row.disputed_at ?? "",
    disputeResolvedAt: row.dispute_resolved_at ?? "",
    disputeResolutionOutcome:
      row.dispute_resolution_outcome ?? "",
    disputeResolutionNote:
      row.dispute_resolution_note ?? "",
    workflowActionAppliedStatus:
      row.workflow_action_applied_status ?? "",
    workflowActionAppliedAt:
      row.workflow_action_applied_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceInvoiceRecords(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("invoice_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase invoice records load failed", error);
    throw new Error(error.message);
  }

  return (data as InvoiceRecordRow[]).map(mapInvoiceRow);
}

export async function getClientInvoiceRecords(
  supabase: SupabaseClient,
  workspaceId: string,
  clientWorkflowRecordId: string,
) {
  const { data, error } = await supabase
    .from("invoice_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("client_workflow_record_id", clientWorkflowRecordId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase client invoices load failed", error);
    throw new Error(error.message);
  }

  return (data as InvoiceRecordRow[]).map(mapInvoiceRow);
}
