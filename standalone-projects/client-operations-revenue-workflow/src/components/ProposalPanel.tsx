"use client";

import { useState } from "react";
import { ProposalForm } from "@/components/ProposalForm";
import {
  ProposalWorkflowRecommendation as ProposalRecommendationCard,
} from "@/components/ProposalWorkflowRecommendation";
import type {
  ClientWorkflowRecord,
  ProposalRecord,
} from "@/lib/client-workflow-types";
import type {
  ProposalWorkflowRecommendation as ProposalWorkflowRecommendationData,
} from "@/lib/proposal-workflow";
import {
  getProposalStatusLabel,
  getTodayDateInputValue,
  proposalStatusOptions,
  toDateInputValue,
} from "@/lib/proposal-options";
import type {
  NewProposalRecord,
  ProposalRecordUpdates,
} from "@/lib/application/workspace-api";

type ProposalPanelProps = {
  clientWorkflowRecordId: string;
  proposals: ProposalRecord[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage?: string;
  isApplyingRecommendation: boolean;
  showWorkflowRecommendations: boolean;
  record: ClientWorkflowRecord;
  onApplyRecommendation: (
    proposal: ProposalRecord,
    recommendation: ProposalWorkflowRecommendationData,
  ) => Promise<void>;
  onCreate: (proposal: NewProposalRecord) => Promise<void>;
  onUpdate: (
    proposalId: string,
    updates: ProposalRecordUpdates,
  ) => Promise<void>;
};

function formatAmount(amount: number, currency: string) {
  if (amount <= 0) {
    return "Amount not set";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatProposalDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ProposalDateField({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="font-bold text-[#17201C]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
        disabled={disabled}
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

function ProposalEditor({
  proposal,
  record,
  isSaving,
  isApplyingRecommendation,
  showRecommendation,
  onUpdate,
  onApplyRecommendation,
}: {
  proposal: ProposalRecord;
  record: ClientWorkflowRecord;
  isSaving: boolean;
  isApplyingRecommendation: boolean;
  showRecommendation: boolean;
  onUpdate: ProposalPanelProps["onUpdate"];
  onApplyRecommendation:
    ProposalPanelProps["onApplyRecommendation"];
}) {
  const [status, setStatus] = useState(proposal.status);
  const [notes, setNotes] = useState(proposal.notes);
  const [sentAt, setSentAt] = useState(
    toDateInputValue(proposal.sentAt),
  );
  const [expiresAt, setExpiresAt] = useState(
    toDateInputValue(proposal.expiresAt),
  );
  const [acceptedAt, setAcceptedAt] = useState(
    toDateInputValue(proposal.acceptedAt),
  );
  const [rejectedAt, setRejectedAt] = useState(
    toDateInputValue(proposal.rejectedAt),
  );
  const [revisionRequestedAt, setRevisionRequestedAt] =
    useState(
      toDateInputValue(proposal.revisionRequestedAt),
    );
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");

  function updateStatus(nextStatus: ProposalRecord["status"]) {
    const today = getTodayDateInputValue();

    setStatus(nextStatus);
    setFieldErrors({});
    setMessage("");

    if (nextStatus === "Sent" && !sentAt) {
      setSentAt(today);
    }

    if (
      nextStatus === "Revision requested" &&
      !revisionRequestedAt
    ) {
      setRevisionRequestedAt(today);
    }

    if (nextStatus === "Accepted" && !acceptedAt) {
      setAcceptedAt(today);
    }

    if (nextStatus === "Rejected" && !rejectedAt) {
      setRejectedAt(today);
    }

    if (nextStatus === "Expired" && !expiresAt) {
      setExpiresAt(today);
    }
  }

  async function saveChanges() {
    const errors: Record<string, string> = {};

    if (status === "Sent" && !sentAt) {
      errors.sentAt = "Enter the date the proposal was sent.";
    }

    if (
      status === "Revision requested" &&
      !revisionRequestedAt
    ) {
      errors.revisionRequestedAt =
        "Enter the revision request date.";
    }

    if (status === "Accepted" && !acceptedAt) {
      errors.acceptedAt = "Enter the acceptance date.";
    }

    if (status === "Rejected" && !rejectedAt) {
      errors.rejectedAt = "Enter the rejection date.";
    }

    if (status === "Expired" && !expiresAt) {
      errors.expiresAt = "Enter the expiry date.";
    }

    if (
      ["Revision requested", "Rejected"].includes(status) &&
      notes.trim().length < 5
    ) {
      errors.notes = "Add a short note explaining this decision.";
    }

    if (notes.trim().length > 1000) {
      errors.notes = "Notes must be 1,000 characters or less.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setMessage("Please fix the highlighted fields.");
      return;
    }

    const updates: ProposalRecordUpdates = {
      status,
      notes: notes.trim(),
    };

    if (status === "Sent") {
      updates.sentAt = sentAt;
      updates.expiresAt = expiresAt;
    }

    if (status === "Revision requested") {
      updates.revisionRequestedAt = revisionRequestedAt;
    }

    if (status === "Accepted") {
      updates.acceptedAt = acceptedAt;
    }

    if (status === "Rejected") {
      updates.rejectedAt = rejectedAt;
    }

    if (status === "Expired") {
      updates.expiresAt = expiresAt;
    }

    setMessage("");

    try {
      await onUpdate(proposal.id, updates);
      setMessage("Proposal updated.");
    } catch {
      setMessage(
        "The proposal could not be updated. Please try again.",
      );
    }
  }

  const recordedDates = [
    { label: "Sent", value: proposal.sentAt },
    { label: "Valid until", value: proposal.expiresAt },
    {
      label: "Revision requested",
      value: proposal.revisionRequestedAt,
    },
    { label: "Accepted", value: proposal.acceptedAt },
    { label: "Rejected", value: proposal.rejectedAt },
  ].filter((item) => item.value);

  const decisionNoteRequired = [
    "Revision requested",
    "Rejected",
  ].includes(status);

  return (
    <article className="border-t border-[#D9DED8] py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-lg font-bold text-[#17201C]">
            {proposal.title}
          </h5>
          <p className="mt-1 font-semibold text-[#174F42]">
            {formatAmount(proposal.amount, proposal.currency)}
          </p>
        </div>

        <span className="w-fit rounded-md bg-[#EDF3EF] px-3 py-2 text-sm font-bold text-[#174F42]">
          {getProposalStatusLabel(proposal.status)}
        </span>
      </div>

      {recordedDates.length > 0 ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {recordedDates.map((item) => (
            <div key={item.label}>
              <dt className="font-bold text-[#17201C]">
                {item.label}
              </dt>
              <dd className="mt-1 text-[#5F6862]">
                {formatProposalDate(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor={`proposal-status-${proposal.id}`}
          >
            Update proposal status
          </label>
          <select
            id={`proposal-status-${proposal.id}`}
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            disabled={isSaving}
            value={status}
            onChange={(event) =>
              updateStatus(
                event.target.value as ProposalRecord["status"],
              )
            }
          >
            {proposalStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {status === "Sent" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ProposalDateField
              disabled={isSaving}
              error={fieldErrors.sentAt}
              id={`proposal-sent-at-${proposal.id}`}
              label="Sent date"
              onChange={(value) => {
                setSentAt(value);
                setFieldErrors({});
                setMessage("");
              }}
              value={sentAt}
            />
            <ProposalDateField
              disabled={isSaving}
              error={fieldErrors.expiresAt}
              id={`proposal-valid-until-${proposal.id}`}
              label="Valid until (optional)"
              onChange={(value) => {
                setExpiresAt(value);
                setFieldErrors({});
                setMessage("");
              }}
              value={expiresAt}
            />
          </div>
        ) : null}

        {status === "Revision requested" ? (
          <ProposalDateField
            disabled={isSaving}
            error={fieldErrors.revisionRequestedAt}
            id={`proposal-revision-date-${proposal.id}`}
            label="Revision request date"
            onChange={(value) => {
              setRevisionRequestedAt(value);
              setFieldErrors({});
              setMessage("");
            }}
            value={revisionRequestedAt}
          />
        ) : null}

        {status === "Accepted" ? (
          <ProposalDateField
            disabled={isSaving}
            error={fieldErrors.acceptedAt}
            id={`proposal-accepted-date-${proposal.id}`}
            label="Acceptance date"
            onChange={(value) => {
              setAcceptedAt(value);
              setFieldErrors({});
              setMessage("");
            }}
            value={acceptedAt}
          />
        ) : null}

        {status === "Rejected" ? (
          <ProposalDateField
            disabled={isSaving}
            error={fieldErrors.rejectedAt}
            id={`proposal-rejected-date-${proposal.id}`}
            label="Rejection date"
            onChange={(value) => {
              setRejectedAt(value);
              setFieldErrors({});
              setMessage("");
            }}
            value={rejectedAt}
          />
        ) : null}

        {status === "Expired" ? (
          <ProposalDateField
            disabled={isSaving}
            error={fieldErrors.expiresAt}
            id={`proposal-expiry-date-${proposal.id}`}
            label="Expiry date"
            onChange={(value) => {
              setExpiresAt(value);
              setFieldErrors({});
              setMessage("");
            }}
            value={expiresAt}
          />
        ) : null}

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor={`proposal-notes-${proposal.id}`}
          >
            {decisionNoteRequired
              ? "Decision note"
              : "Notes (optional)"}
          </label>
          <textarea
            id={`proposal-notes-${proposal.id}`}
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            disabled={isSaving}
            maxLength={1000}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setFieldErrors({});
              setMessage("");
            }}
            placeholder={
              decisionNoteRequired
                ? "Explain the requested revision or reason for rejection."
                : "Add useful proposal or decision context."
            }
          />
          {fieldErrors.notes ? (
            <p className="text-sm font-semibold text-red-700">
              {fieldErrors.notes}
            </p>
          ) : null}
        </div>

        {message ? (
          <p
            className={`rounded-md p-3 font-semibold ${
              message === "Proposal updated."
                ? "bg-[#EDF3EF] text-[#174F42]"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        <button
          className="w-fit rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSaving}
          onClick={() => void saveChanges()}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Proposal Update"}
        </button>

        {showRecommendation ? (
          <ProposalRecommendationCard
            isApplying={isApplyingRecommendation}
            onApply={onApplyRecommendation}
            proposal={proposal}
            record={record}
          />
        ) : null}
      </div>
    </article>
  );
}

export function ProposalPanel({
  clientWorkflowRecordId,
  proposals,
  isApplyingRecommendation,
  showWorkflowRecommendations,
  isLoading,
  isSaving,
  errorMessage,
  record,
  onApplyRecommendation,
  onCreate,
  onUpdate,
}: ProposalPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  async function createProposal(proposal: NewProposalRecord) {
    await onCreate(proposal);
    setIsFormOpen(false);
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-xl font-bold text-[#17201C]">
            Proposals &amp; Quotes
          </h4>
          <p className="mt-2 leading-7 text-[#5F6862]">
            Track proposed work, value, important dates, revisions,
            and client decisions.
          </p>
        </div>

        <button
          className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
          onClick={() => setIsFormOpen((isOpen) => !isOpen)}
          type="button"
        >
          {isFormOpen ? "Close Form" : "Add Proposal Or Quote"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isFormOpen ? (
        <div className="mt-5">
          <ProposalForm
            clientWorkflowRecordId={clientWorkflowRecordId}
            isSubmitting={isSaving}
            onCreate={createProposal}
          />
        </div>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
            Loading proposals and quotes...
          </p>
        ) : proposals.length > 0 ? (
          proposals.map((proposal, index) => (
            <ProposalEditor
              isApplyingRecommendation={isApplyingRecommendation}
              isSaving={isSaving}
              key={proposal.id}
              onApplyRecommendation={onApplyRecommendation}
              onUpdate={onUpdate}
              proposal={proposal}
              record={record}
              showRecommendation={
                showWorkflowRecommendations && index === 0
              }
            />
          ))
        ) : (
          <p className="rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#5F6862]">
            No proposals or quotes have been added for this job yet.
          </p>
        )}
      </div>
    </section>
  );
}
