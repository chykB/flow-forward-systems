import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRecord } from "@/lib/client-workflow-types";
import type { InvoiceWorkflowUpdates } from "@/lib/invoice-workflow";
import {
  mapClientWorkflowRecordRow,
  type ClientWorkflowRecordRow,
} from "@/lib/supabase/client-workflow-records";

type InvoiceRecordRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  client_engagement_id: string;
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

export type NewInvoiceRecord = Omit<
  InvoiceRecord,
  | "id"
  | "clientEngagementId"
  | "createdAt"
  | "updatedAt"
  | "workflowActionAppliedStatus"
  | "workflowActionAppliedAt"
  | "disputedAt"
  | "disputeResolvedAt"
  | "disputeResolutionOutcome"
  | "disputeResolutionNote"
>;

export type InvoiceRecordUpdates = Partial<
  Omit<
    InvoiceRecord,
    | "id"
    | "clientWorkflowRecordId"
    | "clientEngagementId"
    | "createdAt"
    | "updatedAt"
    | "workflowActionAppliedStatus"
    | "workflowActionAppliedAt"
    | "disputedAt"
    | "disputeResolvedAt"
  >
>;

function mapInvoiceRow(row: InvoiceRecordRow): InvoiceRecord {
  return {
    id: row.id,
    clientWorkflowRecordId: row.client_workflow_record_id,
    clientEngagementId: row.client_engagement_id,
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

export async function createInvoiceRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  clientEngagementId: string,
  invoice: NewInvoiceRecord,
) {
  const { data, error } = await supabase
    .from("invoice_records")
    .insert({
      workspace_id: workspaceId,
      client_workflow_record_id: invoice.clientWorkflowRecordId,
      client_engagement_id: clientEngagementId,
      invoice_number: invoice.invoiceNumber || null,
      amount: invoice.amount,
      currency: invoice.currency,
      description: invoice.description || null,
      status: invoice.status,
      payment_link: invoice.paymentLink || null,
      sent_at: invoice.sentAt || null,
      due_date: invoice.dueDate || null,
      paid_at: invoice.paidAt || null,
      dispute_reason: invoice.disputeReason || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase invoice insert failed", error);
    throw new Error(error.message);
  }

  return mapInvoiceRow(data as InvoiceRecordRow);
}

function buildInvoiceUpdatePayload(
  updates: InvoiceRecordUpdates,
) {
  const payload: Record<string, string | number | null> = {};

  if (updates.invoiceNumber !== undefined) {
    payload.invoice_number = updates.invoiceNumber;
  }

  if (updates.amount !== undefined) {
    payload.amount = updates.amount;
  }

  if (updates.currency !== undefined) {
    payload.currency = updates.currency;
  }

  if (updates.description !== undefined) {
    payload.description = updates.description || null;
  }

  if (updates.status !== undefined) {
    payload.status = updates.status;
  }

  if (updates.paymentLink !== undefined) {
    payload.payment_link = updates.paymentLink || null;
  }

  if (updates.sentAt !== undefined) {
    payload.sent_at = updates.sentAt || null;
  }

  if (updates.dueDate !== undefined) {
    payload.due_date = updates.dueDate || null;
  }

  if (updates.paidAt !== undefined) {
    payload.paid_at = updates.paidAt || null;
  }

  if (updates.disputeReason !== undefined) {
    payload.dispute_reason = updates.disputeReason || null;
  }

    if (updates.disputeResolutionOutcome !== undefined) {
    payload.dispute_resolution_outcome =
      updates.disputeResolutionOutcome || null;
  }

  if (updates.disputeResolutionNote !== undefined) {
    payload.dispute_resolution_note =
      updates.disputeResolutionNote || null;
  }

  return payload;
}

export async function updateInvoiceRecord(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string,
  updates: InvoiceRecordUpdates,
) {
  const payload = buildInvoiceUpdatePayload(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error("No invoice changes were provided.");
  }

  const { data, error } = await supabase
    .from("invoice_records")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (error) {
    console.error("Supabase invoice update failed", error);
    throw new Error(error.message);
  }

  return mapInvoiceRow(data as InvoiceRecordRow);
}
type InvoiceWorkflowRpcResult = {
  clientRecord: ClientWorkflowRecordRow;
  invoice: InvoiceRecordRow;
  alreadyApplied: boolean;
};

export async function applyInvoiceWorkflowRecommendationTransaction(
  supabase: SupabaseClient,
  workspaceId: string,
  invoice: InvoiceRecord,
  effectiveStatus: InvoiceRecord["status"],
  updates: InvoiceWorkflowUpdates,
) {
  const { data, error } = await supabase.rpc(
    "apply_invoice_workflow_recommendation",
    {
      p_workspace_id: workspaceId,
      p_invoice_id: invoice.id,
      p_client_workflow_record_id:
        invoice.clientWorkflowRecordId,
      p_expected_invoice_status: invoice.status,
      p_effective_invoice_status: effectiveStatus,
      p_updates: updates,
    },
  );

  if (error) {
    console.error(
      "Supabase invoice workflow transaction failed",
      error,
    );
    throw new Error(error.message);
  }

  const result = data as InvoiceWorkflowRpcResult | null;

  if (!result?.clientRecord || !result.invoice) {
    throw new Error(
      "The invoice workflow update returned an invalid response.",
    );
  }

  return {
    clientRecord: mapClientWorkflowRecordRow(
      result.clientRecord,
    ),
    invoice: mapInvoiceRow(result.invoice),
    alreadyApplied: result.alreadyApplied,
  };
}
