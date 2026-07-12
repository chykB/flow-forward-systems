"use client";

import { useState } from "react";
import type { ProposalRecord } from "@/lib/client-workflow-types";
import {
  getTodayDateInputValue,
  newProposalStatusOptions,
} from "@/lib/proposal-options";
import type { NewProposalRecord } from "@/lib/supabase/proposal-records";

type ProposalFormProps = {
  clientWorkflowRecordId: string;
  isSubmitting: boolean;
  onCreate: (proposal: NewProposalRecord) => Promise<void>;
};

type ProposalFormValues = {
  title: string;
  amount: string;
  currency: string;
  status: ProposalRecord["status"];
  sentAt: string;
  expiresAt: string;
  acceptedAt: string;
  rejectedAt: string;
  revisionRequestedAt: string;
  notes: string;
};

type ProposalFormErrors = Partial<
  Record<keyof ProposalFormValues, string>
>;

const initialValues: ProposalFormValues = {
  title: "",
  amount: "",
  currency: "USD",
  status: "Draft needed",
  sentAt: "",
  expiresAt: "",
  acceptedAt: "",
  rejectedAt: "",
  revisionRequestedAt: "",
  notes: "",
};

function validateProposal(values: ProposalFormValues) {
  const errors: ProposalFormErrors = {};
  const amount = values.amount.trim()
    ? Number(values.amount)
    : 0;

  if (values.title.trim().length < 2) {
    errors.title = "Enter a proposal or quote title.";
  } else if (values.title.trim().length > 160) {
    errors.title = "Title must be 160 characters or less.";
  }

  if (
    values.amount.trim() &&
    (Number.isNaN(amount) || amount < 0)
  ) {
    errors.amount = "Enter a valid amount.";
  }

  if (
    ["Sent", "Accepted"].includes(values.status) &&
    amount <= 0
  ) {
    errors.amount = "Enter the proposed amount.";
  }

  if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.currency = "Use a three-letter currency code.";
  }

  if (values.status === "Sent" && !values.sentAt) {
    errors.sentAt = "Enter the date the proposal was sent.";
  }

  if (
    values.status === "Revision requested" &&
    !values.revisionRequestedAt
  ) {
    errors.revisionRequestedAt =
      "Enter the revision request date.";
  }

  if (values.status === "Accepted" && !values.acceptedAt) {
    errors.acceptedAt = "Enter the acceptance date.";
  }

  if (values.status === "Rejected" && !values.rejectedAt) {
    errors.rejectedAt = "Enter the rejection date.";
  }

  if (values.status === "Expired" && !values.expiresAt) {
    errors.expiresAt = "Enter the expiry date.";
  }

  if (
    ["Revision requested", "Rejected"].includes(values.status) &&
    values.notes.trim().length < 5
  ) {
    errors.notes = "Add a short note explaining this decision.";
  }

  if (values.notes.trim().length > 1000) {
    errors.notes = "Notes must be 1,000 characters or less.";
  }

  return errors;
}

export function ProposalForm({
  clientWorkflowRecordId,
  isSubmitting,
  onCreate,
}: ProposalFormProps) {
  const [values, setValues] =
    useState<ProposalFormValues>(initialValues);
  const [errors, setErrors] =
    useState<ProposalFormErrors>({});
  const [formMessage, setFormMessage] = useState("");

  function updateField<K extends keyof ProposalFormValues>(
    field: K,
    value: ProposalFormValues[K],
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

  function updateStatus(status: ProposalRecord["status"]) {
    const today = getTodayDateInputValue();

    setValues((currentValues) => ({
      ...currentValues,
      status,
      sentAt:
        status === "Draft needed"
          ? ""
          : status === "Sent"
            ? currentValues.sentAt || today
            : currentValues.sentAt,
      expiresAt:
        status === "Draft needed"
          ? ""
          : status === "Expired"
            ? currentValues.expiresAt || today
            : currentValues.expiresAt,
      acceptedAt:
        status === "Accepted"
          ? currentValues.acceptedAt || today
          : "",
      rejectedAt:
        status === "Rejected"
          ? currentValues.rejectedAt || today
          : "",
      revisionRequestedAt:
        status === "Revision requested"
          ? currentValues.revisionRequestedAt || today
          : "",
    }));

    setErrors({});
    setFormMessage("");
  }

  async function submitProposal() {
    const validationErrors = validateProposal(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setFormMessage("Please fix the highlighted fields.");
      return;
    }

    try {
      await onCreate({
        clientWorkflowRecordId,
        title: values.title.trim(),
        amount: values.amount.trim()
          ? Number(values.amount)
          : 0,
        currency: values.currency.trim().toUpperCase(),
        status: values.status,
        sentAt: values.sentAt,
        expiresAt: values.expiresAt,
        acceptedAt: values.acceptedAt,
        rejectedAt: values.rejectedAt,
        revisionRequestedAt: values.revisionRequestedAt,
        notes: values.notes.trim(),
      });

      setValues(initialValues);
      setErrors({});
      setFormMessage("");
    } catch {
      setFormMessage(
        "The proposal could not be saved. Please try again.",
      );
    }
  }

  const decisionNoteRequired = [
    "Revision requested",
    "Rejected",
  ].includes(values.status);

  return (
    <form
      className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submitProposal();
      }}
    >
      <div>
        <h4 className="text-xl font-bold text-[#17201C]">
          Add A Proposal Or Quote
        </h4>
        <p className="mt-2 leading-7 text-[#5F6862]">
          Record the proposed work, value, important dates, and
          current decision status.
        </p>
      </div>

      <div className="grid gap-2">
        <label
          className="font-bold text-[#17201C]"
          htmlFor="proposal-title"
        >
          Proposal or quote title
        </label>
        <input
          id="proposal-title"
          className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
          value={values.title}
          onChange={(event) =>
            updateField("title", event.target.value)
          }
          placeholder="Example: Website redesign proposal"
          type="text"
        />
        {errors.title ? (
          <p className="text-sm font-semibold text-red-700">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_0.6fr]">
        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="proposal-amount"
          >
            Proposed amount
          </label>
          <input
            id="proposal-amount"
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            value={values.amount}
            onChange={(event) =>
              updateField("amount", event.target.value)
            }
            min="0"
            step="0.01"
            placeholder={
              values.status === "Draft needed"
                ? "Optional while preparing"
                : "0.00"
            }
            type="number"
          />
          {errors.amount ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.amount}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="proposal-currency"
          >
            Currency
          </label>
          <input
            id="proposal-currency"
            className="rounded-md border border-[#D9DED8] px-4 py-3 uppercase text-[#17201C]"
            value={values.currency}
            onChange={(event) =>
              updateField("currency", event.target.value)
            }
            maxLength={3}
            placeholder="USD"
            type="text"
          />
          {errors.currency ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.currency}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <label
          className="font-bold text-[#17201C]"
          htmlFor="proposal-status"
        >
          Current status
        </label>
        <select
          id="proposal-status"
          className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          value={values.status}
          onChange={(event) =>
            updateStatus(
              event.target.value as ProposalRecord["status"],
            )
          }
        >
          {newProposalStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {values.status === "Sent" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            error={errors.sentAt}
            id="proposal-sent-at"
            label="Sent date"
            onChange={(value) => updateField("sentAt", value)}
            value={values.sentAt}
          />
          <DateField
            error={errors.expiresAt}
            id="proposal-valid-until"
            label="Valid until (optional)"
            onChange={(value) => updateField("expiresAt", value)}
            value={values.expiresAt}
          />
        </div>
      ) : null}

      {values.status === "Revision requested" ? (
        <DateField
          error={errors.revisionRequestedAt}
          id="proposal-revision-requested-at"
          label="Revision request date"
          onChange={(value) =>
            updateField("revisionRequestedAt", value)
          }
          value={values.revisionRequestedAt}
        />
      ) : null}

      {values.status === "Accepted" ? (
        <DateField
          error={errors.acceptedAt}
          id="proposal-accepted-at"
          label="Acceptance date"
          onChange={(value) => updateField("acceptedAt", value)}
          value={values.acceptedAt}
        />
      ) : null}

      {values.status === "Rejected" ? (
        <DateField
          error={errors.rejectedAt}
          id="proposal-rejected-at"
          label="Rejection date"
          onChange={(value) => updateField("rejectedAt", value)}
          value={values.rejectedAt}
        />
      ) : null}

      {values.status === "Expired" ? (
        <DateField
          error={errors.expiresAt}
          id="proposal-expired-at"
          label="Expiry date"
          onChange={(value) => updateField("expiresAt", value)}
          value={values.expiresAt}
        />
      ) : null}

      <div className="grid gap-2">
        <label
          className="font-bold text-[#17201C]"
          htmlFor="proposal-notes"
        >
          {decisionNoteRequired
            ? "Decision note"
            : "Notes (optional)"}
        </label>
        <textarea
          id="proposal-notes"
          className="min-h-28 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
          value={values.notes}
          onChange={(event) =>
            updateField("notes", event.target.value)
          }
          placeholder={
            decisionNoteRequired
              ? "Explain the requested revision or reason for rejection."
              : "Add useful scope or decision context."
          }
        />
        {errors.notes ? (
          <p className="text-sm font-semibold text-red-700">
            {errors.notes}
          </p>
        ) : null}
      </div>

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
        {isSubmitting
          ? "Saving..."
          : "Add Proposal Or Quote"}
      </button>
    </form>
  );
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
      <label className="font-bold text-[#17201C]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />
      {error ? (
        <p className="text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}