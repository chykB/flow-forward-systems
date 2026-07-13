"use client";

import { useState } from "react";
import type {
  InvoiceRecord,
  InvoiceStatus,
} from "@/lib/client-workflow-types";
import { invoiceStatusOptions } from "@/lib/invoice-options";
import type { InvoiceRecordUpdates } from "@/lib/supabase/invoice-records";

type Props = {
  invoice: InvoiceRecord;
  isSaving: boolean;
  onUpdate: (
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) => Promise<void>;
};

const scheduleStatuses: InvoiceStatus[] = [
  "Sent",
  "Due soon",
  "Overdue",
  "Disputed",
];

function getToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function InvoiceStatusEditor({
  invoice,
  isSaving,
  onUpdate,
}: Props) {
  const [status, setStatus] = useState(invoice.status);
  const [sentAt, setSentAt] = useState(invoice.sentAt);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [paidAt, setPaidAt] = useState(invoice.paidAt);
  const [disputeReason, setDisputeReason] = useState(
    invoice.disputeReason,
  );
  const [message, setMessage] = useState("");

  const needsSchedule = scheduleStatuses.includes(status);
  const showSchedule = needsSchedule || status === "Paid";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (needsSchedule && (!sentAt || !dueDate)) {
      setMessage("Enter both the sent date and due date.");
      return;
    }

    if (sentAt && dueDate && dueDate < sentAt) {
      setMessage("Due date cannot be before the sent date.");
      return;
    }

    if (status === "Paid" && !paidAt) {
      setMessage("Enter the date payment was received.");
      return;
    }

    if (status === "Disputed" && disputeReason.trim().length < 5) {
      setMessage("Explain why the payment is disputed.");
      return;
    }

    const updates: InvoiceRecordUpdates = {
      status,
      sentAt,
      dueDate,
      paidAt,
      disputeReason: disputeReason.trim(),
    };

    const hasChanges = Object.entries(updates).some(
      ([key, value]) =>
        value !== invoice[key as keyof InvoiceRecord],
    );

    if (!hasChanges) {
      setMessage("No invoice status changes to save.");
      return;
    }

    try {
      await onUpdate(invoice.id, updates);
      setMessage("Invoice status updated.");
    } catch {
      setMessage("The invoice status could not be updated.");
    }
  }

  return (
    <form
      className="mt-4 grid gap-4 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      onSubmit={submit}
    >
      <label className="grid gap-2 font-bold">
        Payment status
        <select
          className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
          value={status}
          onChange={(event) => {
            const nextStatus = event.target.value as InvoiceStatus;
            setStatus(nextStatus);

            if (scheduleStatuses.includes(nextStatus) && !sentAt) {
              setSentAt(getToday());
            }

            if (nextStatus === "Paid" && !paidAt) {
              setPaidAt(getToday());
            }

            setMessage("");
          }}
        >
          {invoiceStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showSchedule ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label="Sent date" value={sentAt} onChange={setSentAt} />
          <DateField label="Due date" value={dueDate} onChange={setDueDate} />
        </div>
      ) : null}

      {status === "Paid" ? (
        <DateField label="Paid date" value={paidAt} onChange={setPaidAt} />
      ) : null}

      {status === "Disputed" ? (
        <label className="grid gap-2 font-bold">
          Dispute reason
          <textarea
            className="min-h-24 rounded-md border border-[#D9DED8] bg-white px-4 py-3"
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
          />
        </label>
      ) : null}

      {message ? (
        <p className="text-sm font-semibold text-[#5F6862]">{message}</p>
      ) : null}

      <button
        className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white disabled:opacity-70"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : "Save Payment Status"}
      </button>
    </form>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 font-bold">
      {label}
      <input
        className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}