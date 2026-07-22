"use client";

import { useState } from "react";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoiceStatusEditor } from "@/components/InvoiceStatusEditor";
import { InvoiceWorkflowRecommendation } from "@/components/InvoiceWorkflowRecommendation";
import { formatDateTime } from "@/lib/format-date";
import {
  getEffectiveInvoiceStatus,
  getPrimaryInvoiceWorkflowTarget,
  type InvoiceWorkflowRecommendation as RecommendationData,
} from "@/lib/invoice-workflow";
import type {
  ClientWorkflowRecord,
  InvoiceRecord,
} from "@/lib/client-workflow-types";
import type {
  InvoiceRecordUpdates,
  NewInvoiceRecord,
} from "@/lib/application/workspace-api";
import {
  getInvoiceStatusLabel,
} from "@/lib/invoice-options";

type InvoicePanelProps = {
  clientWorkflowRecordId: string;
  errorMessage: string;
  invoices: InvoiceRecord[];
  isLoading: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  record: ClientWorkflowRecord;
  isApplyingRecommendation: boolean;
  showWorkflowRecommendations: boolean;
  onApplyRecommendation: (
    invoice: InvoiceRecord,
    recommendation: RecommendationData,
  ) => Promise<void>;
  onCreate: (invoice: NewInvoiceRecord) => Promise<void>;
  onUpdate: (
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) => Promise<void>;
};

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  if (!value) {
    return "Not provided";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    ),
  );
}

function InvoiceHistoryItem({
  invoice,
  isApplyingRecommendation,
  isPrimaryRecommendation,
  isReadOnly,
  isSaving,
  onApplyRecommendation,
  onUpdate,
  record,
}: {
  invoice: InvoiceRecord;
  isApplyingRecommendation: boolean;
  isPrimaryRecommendation: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  onApplyRecommendation: (
    invoice: InvoiceRecord,
    recommendation: RecommendationData,
  ) => Promise<void>;
  onUpdate: (
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) => Promise<void>;
  record: ClientWorkflowRecord;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const effectiveStatus = getEffectiveInvoiceStatus(
    invoice,
    new Date(),
  );
  const needsAttention =
    effectiveStatus === "Overdue" ||
    effectiveStatus === "Disputed";

  return (
    <article className="border-t border-[#D9DED8] py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="font-bold text-[#17201C]">
            {invoice.status === "Not needed"
              ? "Invoice not needed"
              : invoice.invoiceNumber}
          </h5>
          <p className="mt-1 text-sm text-[#5F6862]">
            {invoice.description}
          </p>
        </div>

        <span
          className={`self-start rounded-md px-3 py-2 text-sm font-bold ${
            needsAttention
              ? "bg-red-50 text-red-700"
              : "bg-[#EDF3EF] text-[#174F42]"
          }`}
        >
          {getInvoiceStatusLabel(effectiveStatus)}
        </span>
      </div>

      {invoice.status !== "Not needed" ? (
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="font-bold">Amount:</span>{" "}
            {formatAmount(invoice.amount, invoice.currency)}
          </p>
          <p>
            <span className="font-bold">Sent:</span>{" "}
            {formatDate(invoice.sentAt)}
          </p>
          <p>
            <span className="font-bold">Due:</span>{" "}
            {formatDate(invoice.dueDate)}
          </p>
          <p>
            <span className="font-bold">Paid:</span>{" "}
            {formatDate(invoice.paidAt)}
          </p>
        </div>
      ) : null}

      {invoice.status === "Disputed" && invoice.disputeReason ? (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <p className="font-bold text-red-700">
            Dispute requires review
          </p>
          <p className="mt-2 leading-7 text-[#5F6862]">
            {invoice.disputeReason}
          </p>
        </div>
      ) : null}

      {invoice.disputeResolvedAt ? (
        <div className="mt-4 rounded-md bg-[#EDF3EF] p-4">
          <p className="font-bold text-[#174F42]">
            Payment dispute resolved
          </p>

          <div className="mt-3 grid gap-2 text-sm text-[#5F6862]">
            <p>
              <span className="font-bold text-[#17201C]">
                Original dispute:
              </span>{" "}
              {invoice.disputeReason || "Not provided"}
            </p>
            <p>
              <span className="font-bold text-[#17201C]">
                Resolution:
              </span>{" "}
              {invoice.disputeResolutionOutcome}
            </p>
            <p>
              <span className="font-bold text-[#17201C]">
                Resolution note:
              </span>{" "}
              {invoice.disputeResolutionNote}
            </p>
            <p>
              <span className="font-bold text-[#17201C]">
                Resolved:
              </span>{" "}
              {formatDateTime(invoice.disputeResolvedAt)}
            </p>
          </div>
        </div>
      ) : null}

      {invoice.paymentLink ? (
        <a
          className="mt-4 inline-block font-bold text-[#174F42] underline"
          href={invoice.paymentLink}
          rel="noreferrer"
          target="_blank"
        >
          Open payment link
        </a>
      ) : null}
      {!isReadOnly && isPrimaryRecommendation ? (
        <InvoiceWorkflowRecommendation
          invoice={invoice}
          isApplying={isApplyingRecommendation}
          onApply={onApplyRecommendation}
          record={record}
        />
      ) : null}

      {!isReadOnly ? (
        <div className="mt-4">
          <button
            className="rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
            type="button"
            onClick={() => setIsEditing((current) => !current)}
          >
            {isEditing
              ? invoice.status === "Disputed"
                ? "Close Resolution"
                : "Close Invoice Update"
              : invoice.status === "Disputed"
                ? "Resolve Dispute"
                : "Update Invoice"}
          </button>

          {isEditing ? (
            <InvoiceStatusEditor
              invoice={invoice}
              isSaving={isSaving || isApplyingRecommendation}
              onUpdate={onUpdate}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function InvoicePanel({
  clientWorkflowRecordId,
  errorMessage,
  invoices,
  isLoading,
  isReadOnly,
  isSaving,
  onCreate,
  onUpdate,
  isApplyingRecommendation,
  showWorkflowRecommendations,
  onApplyRecommendation,
  record,
}: InvoicePanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const primaryInvoice =
    getPrimaryInvoiceWorkflowTarget(invoices);
  async function createInvoice(invoice: NewInvoiceRecord) {
    await onCreate(invoice);
    setIsFormOpen(false);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-xl font-bold text-[#17201C]">
            Invoices And Payments
          </h4>
          <p className="mt-2 leading-7 text-[#5F6862]">
            Track invoice values, due dates, payment links,
            payment status, and disputes.
          </p>
        </div>

        {!isReadOnly ? (
          <button
            className="shrink-0 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
            type="button"
            onClick={() => setIsFormOpen((current) => !current)}
          >
            {isFormOpen ? "Close Form" : "Add Invoice"}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {!isReadOnly && isFormOpen ? (
        <div className="mt-5">
          <InvoiceForm
            clientWorkflowRecordId={clientWorkflowRecordId}
            isSubmitting={isSaving}
            onCreate={createInvoice}
          />
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-5 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
          Loading invoices and payment status...
        </p>
      ) : invoices.length === 0 ? (
        <p className="mt-5 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
          No invoices have been added for this job yet.
        </p>
      ) : (
        <div className="mt-6">
          {invoices.map((invoice) => (
            <InvoiceHistoryItem
              invoice={invoice}
              isApplyingRecommendation={isApplyingRecommendation}
              isPrimaryRecommendation={
                showWorkflowRecommendations &&
                primaryInvoice?.id === invoice.id
              }
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              key={invoice.id}
              onApplyRecommendation={onApplyRecommendation}
              onUpdate={onUpdate}
              record={record}
            />
          ))}
        </div>
      )}
    </div>
  );
}
