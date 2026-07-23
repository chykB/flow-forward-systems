"use client";

import { useState } from "react";
import type {
  InvoiceBillingBasis,
  InvoiceRecord,
  ProposalRecord,
} from "@/lib/client-workflow-types";
import type { NewInvoiceRecord } from "@/lib/application/workspace-api";
import {
  invoiceStatusOptions,
  invoiceStatusRequiresDisputeReason,
  invoiceStatusRequiresDueDate,
  invoiceStatusRequiresIssuedDetails,
  invoiceStatusRequiresPaidDate,
  invoiceStatusRequiresSentDate,
} from "@/lib/invoice-options";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-workflow";
import {
  getDefaultProposalBillingBasis,
  getProposalInvoiceAmount,
  getProposalInvoicedAmount,
  getProposalRemainingAmount,
  proposalInvoiceBillingOptions,
} from "@/lib/proposal-invoice-billing";

type InvoiceFormProps = {
  clientWorkflowRecordId: string;
  invoices: InvoiceRecord[];
  isSubmitting: boolean;
  onCreate: (invoice: NewInvoiceRecord) => Promise<void>;
  proposals: ProposalRecord[];
};

type InvoiceFormValues = {
  proposalRecordId: string;
  billingBasis: InvoiceBillingBasis;
  billingPercentage: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  description: string;
  status: InvoiceRecord["status"];
  paymentLink: string;
  sentAt: string;
  dueDate: string;
  paidAt: string;
  disputeReason: string;
};

type InvoiceFormErrors = Partial<
  Record<keyof InvoiceFormValues, string>
>;

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

function amountInputValue(amount: number | null) {
  return amount === null
    ? ""
    : amount.toFixed(2).replace(/\.00$/, "");
}

function getEligibleProposals(proposals: ProposalRecord[]) {
  return proposals.filter(
    (proposal) => proposal.status === "Accepted",
  );
}

function getInitialValues(
  proposals: ProposalRecord[],
  invoices: InvoiceRecord[],
): InvoiceFormValues {
  const eligibleProposals = getEligibleProposals(proposals);
  const billableProposals = eligibleProposals.filter(
    (proposal) =>
      getProposalRemainingAmount(proposal, invoices) > 0,
  );
  const proposal =
    billableProposals.length === 1
      ? billableProposals[0]
      : undefined;
  const billingBasis = proposal
    ? getDefaultProposalBillingBasis(proposal, invoices)
    : "Custom";
  const amount = proposal
    ? getProposalInvoiceAmount(
        proposal,
        invoices,
        billingBasis,
        null,
      )
    : null;

  return {
    proposalRecordId: proposal?.id ?? "",
    billingBasis,
    billingPercentage: "",
    invoiceNumber: "",
    amount: amountInputValue(amount),
    currency: proposal?.currency ?? "USD",
    description: proposal?.title ?? "",
    status: "Draft needed",
    paymentLink: "",
    sentAt: "",
    dueDate: "",
    paidAt: "",
    disputeReason: "",
  };
}

function getTodayDateInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;

  return new Date(today.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function isValidPaymentLink(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateInvoice(
  values: InvoiceFormValues,
  proposals: ProposalRecord[],
  invoices: InvoiceRecord[],
) {
  const errors: InvoiceFormErrors = {};
  const invoiceNeeded = values.status !== "Not needed";
  const invoiceIssued =
    invoiceStatusRequiresIssuedDetails(values.status);
  const amount = values.amount.trim()
    ? Number(values.amount)
    : 0;
  const proposal = proposals.find(
    (candidate) =>
      candidate.id === values.proposalRecordId &&
      candidate.status === "Accepted",
  );

  if (values.proposalRecordId && !proposal) {
    errors.proposalRecordId =
      "Choose an accepted proposal from this job.";
  }

  if (
    invoiceNeeded &&
    proposal &&
    values.billingBasis === "Deposit"
  ) {
    const percentage = Number(values.billingPercentage);

    if (
      !values.billingPercentage.trim() ||
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      percentage > 100
    ) {
      errors.billingPercentage =
        "Enter a deposit percentage greater than zero and no more than 100.";
    }
  }

  if (invoiceNeeded && proposal) {
    const invoicedAmount = getProposalInvoicedAmount(
      proposal.id,
      invoices,
    );
    const remainingAmount = getProposalRemainingAmount(
      proposal,
      invoices,
    );

    if (
      values.billingBasis === "Full proposal" &&
      invoicedAmount > 0
    ) {
      errors.billingBasis =
        "Part of this proposal has already been invoiced. Use the remaining balance or another partial amount.";
    }

    if (
      values.billingBasis === "Remaining balance" &&
      remainingAmount <= 0
    ) {
      errors.billingBasis =
        "This proposal has no remaining balance to invoice.";
    }

    if (amount > remainingAmount + 0.005) {
      errors.amount =
        "The invoice amount cannot exceed the proposal balance.";
    }
  }

  if (invoiceIssued && values.invoiceNumber.trim().length < 2) {
    errors.invoiceNumber =
      "Enter the invoice number before issuing it.";
  } else if (values.invoiceNumber.trim().length > 80) {
    errors.invoiceNumber =
      "Invoice number must be 80 characters or less.";
  }

  if (
    invoiceNeeded &&
    values.amount.trim() &&
    (Number.isNaN(amount) || amount < 0)
  ) {
    errors.amount = "Enter a valid invoice amount.";
  } else if (invoiceIssued && amount <= 0) {
    errors.amount =
      "Enter an amount greater than zero before issuing the invoice.";
  }

  if (
    invoiceNeeded &&
    !/^[A-Za-z]{3}$/.test(values.currency.trim())
  ) {
    errors.currency = "Use a three-letter currency code.";
  }

  if (values.description.trim().length < 5) {
    errors.description =
      values.status === "Not needed"
        ? "Explain why an invoice is not needed."
        : "Add a short invoice description.";
  } else if (values.description.trim().length > 500) {
    errors.description =
      "Description must be 500 characters or less.";
  }

  if (
    values.paymentLink.trim() &&
    !isValidPaymentLink(values.paymentLink.trim())
  ) {
    errors.paymentLink =
      "Enter a valid payment link beginning with http or https.";
  }

  if (
    invoiceStatusRequiresSentDate(values.status) &&
    !values.sentAt
  ) {
    errors.sentAt = "Enter the invoice sent date.";
  }

  if (
    invoiceStatusRequiresDueDate(values.status) &&
    !values.dueDate
  ) {
    errors.dueDate = "Enter the payment due date.";
  }

  if (
    values.sentAt &&
    values.dueDate &&
    values.dueDate < values.sentAt
  ) {
    errors.dueDate =
      "The due date cannot be before the sent date.";
  }

  if (
    invoiceStatusRequiresPaidDate(values.status) &&
    !values.paidAt
  ) {
    errors.paidAt = "Enter the payment date.";
  }

  if (
    values.sentAt &&
    values.paidAt &&
    values.paidAt < values.sentAt
  ) {
    errors.paidAt =
      "The payment date cannot be before the sent date.";
  }

  if (
    invoiceStatusRequiresDisputeReason(values.status) &&
    values.disputeReason.trim().length < 5
  ) {
    errors.disputeReason =
      "Add a short explanation of the payment dispute.";
  } else if (values.disputeReason.trim().length > 1000) {
    errors.disputeReason =
      "Dispute reason must be 1,000 characters or less.";
  }

  return errors;
}

export function InvoiceForm({
  clientWorkflowRecordId,
  invoices,
  isSubmitting,
  onCreate,
  proposals,
}: InvoiceFormProps) {
  const [values, setValues] = useState<InvoiceFormValues>(() =>
    getInitialValues(proposals, invoices),
  );
  const [errors, setErrors] =
    useState<InvoiceFormErrors>({});
  const [formMessage, setFormMessage] = useState("");
  const eligibleProposals = getEligibleProposals(proposals);
  const selectedProposal = eligibleProposals.find(
    (proposal) => proposal.id === values.proposalRecordId,
  );
  const invoicedAmount = selectedProposal
    ? getProposalInvoicedAmount(selectedProposal.id, invoices)
    : 0;
  const remainingAmount = selectedProposal
    ? getProposalRemainingAmount(selectedProposal, invoices)
    : 0;
  const amountIsCalculated =
    Boolean(selectedProposal) &&
    ["Full proposal", "Deposit", "Remaining balance"].includes(
      values.billingBasis,
    );

  function updateField<K extends keyof InvoiceFormValues>(
    field: K,
    value: InvoiceFormValues[K],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
    setFormMessage("");
  }

  function selectProposal(proposalRecordId: string) {
    const proposal = eligibleProposals.find(
      (candidate) => candidate.id === proposalRecordId,
    );

    if (!proposal) {
      setValues((currentValues) => ({
        ...currentValues,
        proposalRecordId: "",
        billingBasis: "Custom",
        billingPercentage: "",
        amount: "",
      }));
      setErrors({});
      setFormMessage("");
      return;
    }

    const billingBasis = getDefaultProposalBillingBasis(
      proposal,
      invoices,
    );
    const amount = getProposalInvoiceAmount(
      proposal,
      invoices,
      billingBasis,
      null,
    );

    setValues((currentValues) => ({
      ...currentValues,
      proposalRecordId: proposal.id,
      billingBasis,
      billingPercentage: "",
      amount: amountInputValue(amount),
      currency: proposal.currency,
      description: proposal.title,
    }));
    setErrors({});
    setFormMessage("");
  }

  function selectBillingBasis(billingBasis: InvoiceBillingBasis) {
    if (!selectedProposal) {
      return;
    }

    const billingPercentage =
      billingBasis === "Deposit" ? "25" : "";
    const amount = getProposalInvoiceAmount(
      selectedProposal,
      invoices,
      billingBasis,
      billingBasis === "Deposit" ? 25 : null,
    );

    setValues((currentValues) => ({
      ...currentValues,
      billingBasis,
      billingPercentage,
      amount: amountInputValue(amount),
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      billingBasis: undefined,
      billingPercentage: undefined,
      amount: undefined,
    }));
    setFormMessage("");
  }

  function updateDepositPercentage(value: string) {
    const percentage = value.trim() ? Number(value) : null;
    const amount = selectedProposal
      ? getProposalInvoiceAmount(
          selectedProposal,
          invoices,
          "Deposit",
          percentage,
        )
      : null;

    setValues((currentValues) => ({
      ...currentValues,
      billingPercentage: value,
      amount: amountInputValue(amount),
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      billingPercentage: undefined,
      amount: undefined,
    }));
    setFormMessage("");
  }

  function updateStatus(status: InvoiceRecord["status"]) {
    const today = getTodayDateInputValue();

    setValues((currentValues) => ({
      ...currentValues,
      proposalRecordId:
        status === "Not needed"
          ? ""
          : currentValues.proposalRecordId,
      billingBasis:
        status === "Not needed"
          ? "Custom"
          : currentValues.billingBasis,
      billingPercentage:
        status === "Not needed"
          ? ""
          : currentValues.billingPercentage,
      amount: status === "Not needed" ? "" : currentValues.amount,
      status,
      sentAt: invoiceStatusRequiresSentDate(status)
        ? currentValues.sentAt ||
          (status === "Sent" ? today : "")
        : "",
      dueDate: invoiceStatusRequiresDueDate(status)
        ? currentValues.dueDate
        : "",
      paidAt: invoiceStatusRequiresPaidDate(status)
        ? currentValues.paidAt || today
        : "",
      disputeReason:
        status === "Disputed"
          ? currentValues.disputeReason
          : "",
      paymentLink:
        status === "Not needed"
          ? ""
          : currentValues.paymentLink,
    }));
    setErrors({});
    setFormMessage("");
  }

  async function submitInvoice() {
    const validationErrors = validateInvoice(
      values,
      eligibleProposals,
      invoices,
    );
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setFormMessage("Please fix the highlighted fields.");
      return;
    }

    const invoiceNeeded = values.status !== "Not needed";
    const effectiveStatus = getEffectiveInvoiceStatus(
      values,
      new Date(),
    );

    try {
      await onCreate({
        clientWorkflowRecordId,
        proposalRecordId: invoiceNeeded
          ? values.proposalRecordId
          : "",
        billingBasis: invoiceNeeded
          ? values.billingBasis
          : "Custom",
        billingPercentage:
          invoiceNeeded &&
          values.billingBasis === "Deposit"
            ? Number(values.billingPercentage)
            : null,
        invoiceNumber: invoiceNeeded
          ? values.invoiceNumber.trim()
          : "",
        amount:
          invoiceNeeded && values.amount.trim()
            ? Number(values.amount)
            : 0,
        currency: values.currency.trim().toUpperCase(),
        description: values.description.trim(),
        status: effectiveStatus,
        paymentLink: invoiceNeeded
          ? values.paymentLink.trim()
          : "",
        sentAt: values.sentAt,
        dueDate: values.dueDate,
        paidAt: values.paidAt,
        disputeReason: values.disputeReason.trim(),
      });

      setValues(getInitialValues(proposals, invoices));
      setErrors({});
      setFormMessage("");
    } catch {
      setFormMessage(
        "The invoice could not be saved. Please try again.",
      );
    }
  }

  const invoiceNeeded = values.status !== "Not needed";
  const invoiceIssued =
    invoiceStatusRequiresIssuedDetails(values.status);
  const showSentAndDueDates =
    invoiceStatusRequiresSentDate(values.status) ||
    invoiceStatusRequiresDueDate(values.status);

  return (
    <form
      className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submitInvoice();
      }}
    >
      <div>
        <h4 className="text-xl font-bold text-[#17201C]">
          Add An Invoice
        </h4>
        <p className="mt-2 leading-7 text-[#5F6862]">
          Use an accepted proposal to prefill the value, or record a
          custom invoice for this job.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="font-bold" htmlFor="invoice-status">
          Current status
        </label>
        <select
          id="invoice-status"
          className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
          value={values.status}
          onChange={(event) =>
            updateStatus(
              event.target.value as InvoiceRecord["status"],
            )
          }
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
      </div>

      {invoiceNeeded ? (
        <>
          <div className="grid gap-2">
            <label className="font-bold" htmlFor="invoice-proposal">
              Invoice source
            </label>
            <select
              id="invoice-proposal"
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
              value={values.proposalRecordId}
              onChange={(event) =>
                selectProposal(event.target.value)
              }
            >
              <option value="">No proposal - custom invoice</option>
              {eligibleProposals.map((proposal) => (
                <option
                  disabled={
                    getProposalRemainingAmount(
                      proposal,
                      invoices,
                    ) <= 0
                  }
                  key={proposal.id}
                  value={proposal.id}
                >
                  {proposal.title} (
                  {formatAmount(proposal.amount, proposal.currency)})
                  {getProposalRemainingAmount(
                    proposal,
                    invoices,
                  ) <= 0
                    ? " - fully invoiced"
                    : ""}
                </option>
              ))}
            </select>
            <FieldError message={errors.proposalRecordId} />
            {eligibleProposals.length === 0 ? (
              <p className="text-sm leading-6 text-[#5F6862]">
                Accepted proposals from this job will appear here.
              </p>
            ) : null}
          </div>

          {selectedProposal ? (
            <>
              <div className="grid gap-3 border-y border-[#D9DED8] py-4 text-sm sm:grid-cols-3">
                <p>
                  <span className="block font-bold text-[#17201C]">
                    Proposal value
                  </span>
                  {formatAmount(
                    selectedProposal.amount,
                    selectedProposal.currency,
                  )}
                </p>
                <p>
                  <span className="block font-bold text-[#17201C]">
                    Already invoiced
                  </span>
                  {formatAmount(
                    invoicedAmount,
                    selectedProposal.currency,
                  )}
                </p>
                <p>
                  <span className="block font-bold text-[#17201C]">
                    Remaining
                  </span>
                  {formatAmount(
                    remainingAmount,
                    selectedProposal.currency,
                  )}
                </p>
              </div>

              <div className="grid gap-2">
                <label
                  className="font-bold"
                  htmlFor="invoice-billing-basis"
                >
                  Amount to invoice
                </label>
                <select
                  id="invoice-billing-basis"
                  className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
                  value={values.billingBasis}
                  onChange={(event) =>
                    selectBillingBasis(
                      event.target.value as InvoiceBillingBasis,
                    )
                  }
                >
                  {proposalInvoiceBillingOptions.map((option) => (
                    <option
                      disabled={
                        (option.value === "Full proposal" &&
                          invoicedAmount > 0) ||
                        (option.value === "Remaining balance" &&
                          remainingAmount <= 0)
                      }
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.billingBasis} />
              </div>

              {values.billingBasis === "Deposit" ? (
                <div className="grid gap-2">
                  <label
                    className="font-bold"
                    htmlFor="invoice-billing-percentage"
                  >
                    Deposit percentage
                  </label>
                  <input
                    id="invoice-billing-percentage"
                    className="rounded-md border border-[#D9DED8] px-4 py-3"
                    max="100"
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={values.billingPercentage}
                    onChange={(event) =>
                      updateDepositPercentage(event.target.value)
                    }
                  />
                  <FieldError
                    message={errors.billingPercentage}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="grid gap-2">
            <label className="font-bold" htmlFor="invoice-number">
              {invoiceIssued
                ? "Invoice number"
                : "Invoice number (optional until issued)"}
            </label>
            <input
              id="invoice-number"
              className="rounded-md border border-[#D9DED8] px-4 py-3"
              value={values.invoiceNumber}
              onChange={(event) =>
                updateField("invoiceNumber", event.target.value)
              }
              placeholder={
                invoiceIssued
                  ? "Example: INV-2026-001"
                  : "Add when the invoice is prepared"
              }
            />
            <FieldError message={errors.invoiceNumber} />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_0.6fr]">
            <div className="grid gap-2">
              <label className="font-bold" htmlFor="invoice-amount">
                {invoiceIssued
                  ? "Invoice amount"
                  : "Invoice amount (optional until issued)"}
              </label>
              <input
                id="invoice-amount"
                className={`rounded-md border border-[#D9DED8] px-4 py-3 ${
                  amountIsCalculated ? "bg-[#F7F8F6]" : ""
                }`}
                value={values.amount}
                onChange={(event) =>
                  updateField("amount", event.target.value)
                }
                min="0"
                readOnly={amountIsCalculated}
                step="0.01"
                placeholder="0.00"
                type="number"
              />
              <FieldError message={errors.amount} />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="invoice-currency">
                Currency
              </label>
              <input
                id="invoice-currency"
                className={`rounded-md border border-[#D9DED8] px-4 py-3 uppercase ${
                  selectedProposal ? "bg-[#F7F8F6]" : ""
                }`}
                value={values.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value)
                }
                maxLength={3}
                placeholder="USD"
                readOnly={Boolean(selectedProposal)}
              />
              <FieldError message={errors.currency} />
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-2">
        <label className="font-bold" htmlFor="invoice-description">
          {invoiceNeeded
            ? "Invoice description"
            : "Reason invoice is not needed"}
        </label>
        <textarea
          id="invoice-description"
          className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3"
          value={values.description}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          placeholder={
            invoiceNeeded
              ? "Describe the work or service being invoiced."
              : "Explain why this client workflow does not require an invoice."
          }
        />
        <FieldError message={errors.description} />
      </div>

      {invoiceNeeded ? (
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="invoice-payment-link">
            Payment link (optional)
          </label>
          <input
            id="invoice-payment-link"
            className="rounded-md border border-[#D9DED8] px-4 py-3"
            value={values.paymentLink}
            onChange={(event) =>
              updateField("paymentLink", event.target.value)
            }
            placeholder="https://"
            type="url"
          />
          <FieldError message={errors.paymentLink} />
        </div>
      ) : null}

      {showSentAndDueDates ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            error={errors.sentAt}
            id="invoice-sent-at"
            label="Sent date"
            onChange={(value) => updateField("sentAt", value)}
            value={values.sentAt}
          />
          <DateField
            error={errors.dueDate}
            id="invoice-due-date"
            label="Payment due date"
            onChange={(value) => updateField("dueDate", value)}
            value={values.dueDate}
          />
        </div>
      ) : null}

      {invoiceStatusRequiresPaidDate(values.status) ? (
        <DateField
          error={errors.paidAt}
          id="invoice-paid-at"
          label="Payment date"
          onChange={(value) => updateField("paidAt", value)}
          value={values.paidAt}
        />
      ) : null}

      {invoiceStatusRequiresDisputeReason(values.status) ? (
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="invoice-dispute">
            Dispute reason
          </label>
          <textarea
            id="invoice-dispute"
            className="min-h-28 rounded-md border border-[#D9DED8] px-4 py-3"
            value={values.disputeReason}
            onChange={(event) =>
              updateField("disputeReason", event.target.value)
            }
            placeholder="Explain what the client disputed and what requires review."
          />
          <FieldError message={errors.disputeReason} />
        </div>
      ) : null}

      {formMessage ? (
        <p className="rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {formMessage}
        </p>
      ) : null}

      <button
        className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Add Invoice"}
      </button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-semibold text-red-700">
      {message}
    </p>
  ) : null;
}

function DateField({
  error,
  id,
  label,
  onChange,
  value,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="font-bold" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="rounded-md border border-[#D9DED8] px-4 py-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />
      <FieldError message={error} />
    </div>
  );
}
