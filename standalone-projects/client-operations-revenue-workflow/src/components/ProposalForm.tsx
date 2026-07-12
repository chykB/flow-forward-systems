"use client";

import { useState } from "react";
import type { ProposalRecord } from "@/lib/client-workflow-types";
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
  notes: "",
};

const proposalStatusOptions: ProposalRecord["status"][] = [
  "Draft needed",
  "Sent",
  "Revision requested",
  "Accepted",
  "Rejected",
  "Expired",
];

function validateProposal(values: ProposalFormValues) {
  const errors: ProposalFormErrors = {};
  const amount = Number(values.amount);

  if (values.title.trim().length < 2) {
    errors.title = "Enter a proposal or quote title.";
  } else if (values.title.trim().length > 160) {
    errors.title = "Title must be 160 characters or less.";
  }

  if (
    values.amount.trim() === "" ||
    Number.isNaN(amount) ||
    amount < 0
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

  if (values.status === "Expired" && !values.expiresAt) {
    errors.expiresAt = "Enter the proposal expiry date.";
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
  const [errors, setErrors] = useState<ProposalFormErrors>({});
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

  return (
    <form
      className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();

        const validationErrors = validateProposal(values);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
          setFormMessage("Please fix the highlighted fields.");
          return;
        }

        const now = new Date().toISOString();

        try {
          await onCreate({
            clientWorkflowRecordId,
            title: values.title.trim(),
            amount: Number(values.amount),
            currency: values.currency.trim().toUpperCase(),
            status: values.status,
            sentAt: values.sentAt,
            expiresAt: values.expiresAt,
            acceptedAt:
              values.status === "Accepted" ? now : "",
            rejectedAt:
              values.status === "Rejected" ? now : "",
            revisionRequestedAt:
              values.status === "Revision requested" ? now : "",
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
      }}
    >
      <div>
        <h4 className="text-xl font-bold text-[#17201C]">
          Add A Proposal Or Quote
        </h4>
        <p className="mt-2 leading-7 text-[#5F6862]">
          Record the proposed work, value, important dates, and current
          decision status.
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
            placeholder="0.00"
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
            className="uppercase rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
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
            updateField(
              "status",
              event.target.value as ProposalRecord["status"],
            )
          }
        >
          {proposalStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="proposal-sent-at"
          >
            Sent date
          </label>
          <input
            id="proposal-sent-at"
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            value={values.sentAt}
            onChange={(event) =>
              updateField("sentAt", event.target.value)
            }
            type="date"
          />
          {errors.sentAt ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.sentAt}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor="proposal-expires-at"
          >
            Expiry date
          </label>
          <input
            id="proposal-expires-at"
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            value={values.expiresAt}
            onChange={(event) =>
              updateField("expiresAt", event.target.value)
            }
            type="date"
          />
          {errors.expiresAt ? (
            <p className="text-sm font-semibold text-red-700">
              {errors.expiresAt}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <label
          className="font-bold text-[#17201C]"
          htmlFor="proposal-notes"
        >
          Notes or decision context
        </label>
        <textarea
          id="proposal-notes"
          className="min-h-28 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
          value={values.notes}
          onChange={(event) =>
            updateField("notes", event.target.value)
          }
          placeholder="Add scope context, revision details, or the reason for a decision."
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
        {isSubmitting ? "Saving..." : "Add Proposal Or Quote"}
      </button>
    </form>
  );
}