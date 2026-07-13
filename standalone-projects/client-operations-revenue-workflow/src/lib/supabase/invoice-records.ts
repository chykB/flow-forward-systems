import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRecord } from "@/lib/client-workflow-types";

type InvoiceRecordRow = {
  id: string;
  workspace_id: string;
  client_workflow_record_id: string;
  invoice_number: string;
  amount: number | string;
  currency: string;
  description: string | null;
  status: InvoiceRecord["status"];
  payment_link: string | null;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type NewInvoiceRecord = Omit<
  InvoiceRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type InvoiceRecordUpdates = Partial<
  Omit<
    InvoiceRecord,
    "id" | "clientWorkflowRecordId" | "createdAt" | "updatedAt"
  >
>;

function mapInvoiceRow(row: InvoiceRecordRow): InvoiceRecord {
  return {
    id: row.id,
    clientWorkflowRecordId: row.client_workflow_record_id,
    invoiceNumber: row.invoice_number,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    description: row.description ?? "",
    status: row.status,
    paymentLink: row.payment_link ?? "",
    sentAt: row.sent_at ?? "",
    dueDate: row.due_date ?? "",
    paidAt: row.paid_at ?? "",
    disputeReason: row.dispute_reason ?? "",
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
  invoice: NewInvoiceRecord,
) {
  const { data, error } = await supabase
    .from("invoice_records")
    .insert({
      workspace_id: workspaceId,
      client_workflow_record_id: invoice.clientWorkflowRecordId,
      invoice_number: invoice.invoiceNumber,
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