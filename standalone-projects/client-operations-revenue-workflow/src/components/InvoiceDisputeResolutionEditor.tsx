"use client";

import { useState, type SubmitEvent } from "react";
import type {
  InvoiceDisputeResolutionOutcome,
  InvoiceRecord,
  InvoiceStatus,
} from "@/lib/client-workflow-types";
import {
  getInvoiceStatusLabel,
  invoiceDisputeResolutionOutcomeOptions,
} from "@/lib/invoice-options";
import type {
  InvoiceRecordUpdates,
} from "@/lib/supabase/invoice-records";

type Props = {
  invoice: InvoiceRecord;
  isSaving: boolean;
  onUpdate: (
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) => Promise<void>;
};

function getDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function getOutstandingStatus(dueDate: string): InvoiceStatus {
  const today = getDateInputValue();
  const dueSoonDate = new Date();
  dueSoonDate.setDate(dueSoonDate.getDate() + 7);
  const dueSoonLimit = getDateInputValue(dueSoonDate);

  if (dueDate < today) {
    return "Overdue";
  }

  if (dueDate <= dueSoonLimit) {
    return "Due soon";
  }

  return "Sent";
}

export function InvoiceDisputeResolutionEditor({
  invoice,
  isSaving,
  onUpdate,
}: Props) {
  const [outcome, setOutcome] = useState<
    InvoiceDisputeResolutionOutcome | ""
  >("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [sentAt, setSentAt] = useState(invoice.sentAt);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [paidAt, setPaidAt] = useState(invoice.paidAt);
  const [message, setMessage] = useState("");

  const fieldPrefix = `invoice-dispute-${invoice.id}`;
  const outstandingStatus = dueDate
    ? getOutstandingStatus(dueDate)
    : null;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!outcome) {
      setMessage("Choose how the dispute was resolved.");
      return;
    }

    if (resolutionNote.trim().length < 5) {
      setMessage("Add a short dispute resolution note.");
      return;
    }

    let resolvedStatus: InvoiceStatus;
    const updates: InvoiceRecordUpdates = {
      disputeResolutionOutcome: outcome,
      disputeResolutionNote: resolutionNote.trim(),
    };

    if (outcome === "Payment received") {
      if (!paidAt) {
        setMessage("Enter the date payment was received.");
        return;
      }

      if (sentAt && paidAt < sentAt) {
        setMessage(
          "The payment date cannot be before the sent date.",
        );
        return;
      }

      resolvedStatus = "Paid";
      updates.paidAt = paidAt;
    } else if (outcome === "Payment still due") {
      if (!sentAt || !dueDate) {
        setMessage("Enter both the sent date and due date.");
        return;
      }

      if (dueDate < sentAt) {
        setMessage(
          "The due date cannot be before the sent date.",
        );
        return;
      }

      resolvedStatus = getOutstandingStatus(dueDate);
      updates.sentAt = sentAt;
      updates.dueDate = dueDate;
      updates.paidAt = "";
    } else {
      resolvedStatus = "Voided";
      updates.paidAt = "";
    }

    updates.status = resolvedStatus;

    try {
      await onUpdate(invoice.id, updates);
      setMessage("Payment dispute resolved.");
    } catch {
      setMessage(
        "The payment dispute could not be resolved.",
      );
    }
  }

  return (
    <form
      className="mt-4 grid gap-4 rounded-md border border-red-200 bg-red-50 p-4"
      onSubmit={submit}
    >
      <div>
        <h6 className="font-bold text-[#17201C]">
          Resolve Payment Dispute
        </h6>
        <p className="mt-2 text-sm leading-6 text-[#5F6862]">
          Record what happened to this specific invoice before
          payment follow-up continues.
        </p>
      </div>

      <div className="rounded-md bg-white p-4">
        <p className="text-sm font-bold text-[#17201C]">
          Original dispute reason
        </p>
        <p className="mt-2 leading-7 text-[#5F6862]">
          {invoice.disputeReason}
        </p>
      </div>

      <label
        className="grid gap-2 font-bold"
        htmlFor={`${fieldPrefix}-outcome`}
      >
        Resolution outcome
        <select
          id={`${fieldPrefix}-outcome`}
          className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
          value={outcome}
          onChange={(event) => {
            const nextOutcome = event.target.value as
              | InvoiceDisputeResolutionOutcome
              | "";

            setOutcome(nextOutcome);

            if (nextOutcome === "Payment received" && !paidAt) {
              setPaidAt(getDateInputValue());
            }

            setMessage("");
          }}
        >
          <option value="">Choose an outcome</option>
          {invoiceDisputeResolutionOutcomeOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>
      </label>

      {outcome === "Payment received" ? (
        <DateField
          id={`${fieldPrefix}-paid-at`}
          label="Payment received date"
          onChange={setPaidAt}
          value={paidAt}
        />
      ) : null}

      {outcome === "Payment still due" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              id={`${fieldPrefix}-sent-at`}
              label="Sent date"
              onChange={setSentAt}
              value={sentAt}
            />
            <DateField
              id={`${fieldPrefix}-due-date`}
              label="Payment due date"
              onChange={setDueDate}
              value={dueDate}
            />
          </div>

          {outstandingStatus ? (
            <p className="rounded-md bg-white p-3 text-sm">
              Resulting status:{" "}
              <span className="font-bold">
                {getInvoiceStatusLabel(outstandingStatus)}
              </span>
            </p>
          ) : null}
        </>
      ) : null}

      <label
        className="grid gap-2 font-bold"
        htmlFor={`${fieldPrefix}-note`}
      >
        Resolution note
        <textarea
          id={`${fieldPrefix}-note`}
          className="min-h-24 rounded-md border border-[#D9DED8] bg-white px-4 py-3"
          value={resolutionNote}
          onChange={(event) => {
            setResolutionNote(event.target.value);
            setMessage("");
          }}
          placeholder={
            outcome === "Invoice voided or replaced"
              ? "Explain whether the invoice was cancelled or replaced."
              : "Record the agreed resolution and any useful context."
          }
        />
      </label>

      {message ? (
        <p className="text-sm font-semibold text-[#5F6862]">
          {message}
        </p>
      ) : null}

      <button
        className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white disabled:opacity-70"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Resolving..." : "Resolve Payment Dispute"}
      </button>
    </form>
  );
}

function DateField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 font-bold" htmlFor={id}>
      {label}
      <input
        id={id}
        className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}