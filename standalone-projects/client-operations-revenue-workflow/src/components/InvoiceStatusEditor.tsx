"use client";

import { useState, type SubmitEvent } from "react";
import {
  InvoiceDisputeResolutionEditor,
} from "@/components/InvoiceDisputeResolutionEditor";
import type {
  InvoiceRecord,
  InvoiceStatus,
} from "@/lib/client-workflow-types";
import {
  invoiceStatusOptions,
  invoiceStatusRequiresIssuedDetails,
} from "@/lib/invoice-options";

import type { InvoiceRecordUpdates } from "@/lib/application/workspace-api";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-workflow";

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

export function InvoiceStatusEditor(props: Props) {
  if (props.invoice.status === "Disputed") {
    return (
      <InvoiceDisputeResolutionEditor
        invoice={props.invoice}
        isSaving={props.isSaving}
        onUpdate={props.onUpdate}
      />
    );
  }

  return (
    <StandardInvoiceStatusEditor
      key={props.invoice.updatedAt}
      {...props}
    />
  );
}

function StandardInvoiceStatusEditor({
  invoice,
  isSaving,
  onUpdate,
}: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice.invoiceNumber,
  );
  const [amount, setAmount] = useState(
    invoice.amount > 0 ? String(invoice.amount) : "",
  );
  const [currency, setCurrency] = useState(invoice.currency);
  const [status, setStatus] = useState(
    getEffectiveInvoiceStatus(invoice, new Date()),
  );
  const [sentAt, setSentAt] = useState(invoice.sentAt);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [paidAt, setPaidAt] = useState(invoice.paidAt);
  const [disputeReason, setDisputeReason] = useState(
    invoice.disputeReason,
  );
  const [message, setMessage] = useState("");

  const needsSchedule = scheduleStatuses.includes(status);
  const showSchedule = needsSchedule || status === "Paid";
  const invoiceNeeded = status !== "Not needed";
  const invoiceIssued =
    invoiceStatusRequiresIssuedDetails(status);
  const isProposalLinked = Boolean(invoice.proposalRecordId);
  const fieldPrefix = `invoice-status-${invoice.id}`;

  async function submit(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage("");

    const parsedAmount = amount.trim() ? Number(amount) : 0;

    if (
      invoiceIssued &&
      invoiceNumber.trim().length < 2
    ) {
      setMessage(
        "Enter the invoice number before issuing it.",
      );
      return;
    }

    if (invoiceNumber.trim().length > 80) {
      setMessage("Invoice number must be 80 characters or less.");
      return;
    }

    if (
      amount.trim() &&
      (Number.isNaN(parsedAmount) || parsedAmount < 0)
    ) {
      setMessage("Enter a valid invoice amount.");
      return;
    }

    if (invoiceIssued && parsedAmount <= 0) {
      setMessage(
        "Enter an amount greater than zero before issuing the invoice.",
      );
      return;
    }

    if (
      invoiceNeeded &&
      !/^[A-Za-z]{3}$/.test(currency.trim())
    ) {
      setMessage("Use a three-letter currency code.");
      return;
    }

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

    const effectiveStatus = getEffectiveInvoiceStatus(
      { dueDate, status },
      new Date(),
    );
    const updates: InvoiceRecordUpdates = {
      status: effectiveStatus,
      invoiceNumber: invoiceNeeded
        ? invoiceNumber.trim()
        : invoice.invoiceNumber,
      amount: invoiceNeeded
        ? parsedAmount
        : invoice.amount,
      currency: invoiceNeeded
        ? currency.trim().toUpperCase()
        : invoice.currency,
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
      setMessage("No invoice changes to save.");
      return;
    }

    try {
      await onUpdate(invoice.id, updates);
      setMessage("Invoice changes saved.");
    } catch {
      setMessage("The invoice could not be updated.");
    }
  }

  return (
    <form
      className="mt-4 grid gap-4 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      onSubmit={submit}
    >
      <label className="grid gap-2 font-bold">
        Invoice status
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
            <option
              disabled={option.automatic}
              key={option.value}
              value={option.value}
            >
              {option.label}
              {option.automatic ? " (automatic)" : ""}
            </option>
          ))}
        </select>
      </label>

      {invoiceNeeded ? (
        <div className="grid gap-4">
          <label
            className="grid gap-2 font-bold"
            htmlFor={`${fieldPrefix}-number`}
          >
            {invoiceIssued
              ? "Invoice number"
              : "Invoice number (optional until issued)"}
            <input
              id={`${fieldPrefix}-number`}
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
              value={invoiceNumber}
              onChange={(event) =>
                setInvoiceNumber(event.target.value)
              }
              placeholder={
                invoiceIssued
                  ? "Example: INV-2026-001"
                  : "Add when the invoice is prepared"
              }
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_0.6fr]">
            <label
              className="grid gap-2 font-bold"
              htmlFor={`${fieldPrefix}-amount`}
            >
              {invoiceIssued
                ? "Invoice amount"
                : "Invoice amount (optional until issued)"}
              <input
                id={`${fieldPrefix}-amount`}
                className={`rounded-md border border-[#D9DED8] px-4 py-3 ${
                  isProposalLinked ? "bg-[#F7F8F6]" : "bg-white"
                }`}
                min="0"
                readOnly={isProposalLinked}
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label
              className="grid gap-2 font-bold"
              htmlFor={`${fieldPrefix}-currency`}
            >
              Currency
              <input
                id={`${fieldPrefix}-currency`}
                className={`rounded-md border border-[#D9DED8] px-4 py-3 uppercase ${
                  isProposalLinked ? "bg-[#F7F8F6]" : "bg-white"
                }`}
                maxLength={3}
                readOnly={isProposalLinked}
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value)
                }
              />
            </label>
          </div>
          {isProposalLinked ? (
            <p className="text-sm leading-6 text-[#5F6862]">
              The billed value is preserved from the proposal. Void
              this invoice and issue a replacement to change it.
            </p>
          ) : null}
        </div>
      ) : null}

      {showSchedule ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            label={
              status === "Paid"
                ? "Sent date (optional)"
                : "Sent date"
            }
            value={sentAt}
            onChange={setSentAt}
          />
          <DateField
            label={
              status === "Paid"
                ? "Due date (optional)"
                : "Due date"
            }
            value={dueDate}
            onChange={setDueDate}
          />
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
        {isSaving ? "Saving..." : "Save Invoice Changes"}
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
