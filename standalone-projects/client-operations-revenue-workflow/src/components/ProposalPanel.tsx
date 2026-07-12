"use client";

import { useState } from "react";
import type { ProposalRecord } from "@/lib/client-workflow-types";
import type {
  NewProposalRecord,
  ProposalRecordUpdates,
} from "@/lib/supabase/proposal-records";
import { ProposalForm } from "@/components/ProposalForm";

type ProposalPanelProps = {
  clientWorkflowRecordId: string;
  proposals: ProposalRecord[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage?: string;
  onCreate: (proposal: NewProposalRecord) => Promise<void>;
  onUpdate: (
    proposalId: string,
    updates: ProposalRecordUpdates,
  ) => Promise<void>;
};

const proposalStatusOptions: ProposalRecord["status"][] = [
  "Not needed",
  "Draft needed",
  "Sent",
  "Revision requested",
  "Accepted",
  "Rejected",
  "Expired",
];

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

function formatProposalDate(value: string) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ProposalEditor({
  proposal,
  isSaving,
  onUpdate,
}: {
  proposal: ProposalRecord;
  isSaving: boolean;
  onUpdate: ProposalPanelProps["onUpdate"];
}) {
  const [status, setStatus] = useState(proposal.status);
  const [notes, setNotes] = useState(proposal.notes);
  const [message, setMessage] = useState("");

  async function saveChanges() {
    if (
      ["Revision requested", "Rejected"].includes(status) &&
      notes.trim().length < 5
    ) {
      setMessage("Add a short note explaining this decision.");
      return;
    }

    const now = new Date().toISOString();

    const updates: ProposalRecordUpdates = {
      status,
      notes: notes.trim(),
      acceptedAt:
        status === "Accepted" ? proposal.acceptedAt || now : "",
      rejectedAt:
        status === "Rejected" ? proposal.rejectedAt || now : "",
      revisionRequestedAt:
        status === "Revision requested"
          ? proposal.revisionRequestedAt || now
          : "",
    };

    if (status === "Sent" && !proposal.sentAt) {
      updates.sentAt = now;
    }

    if (status === "Expired" && !proposal.expiresAt) {
      updates.expiresAt = now;
    }

    setMessage("");

    try {
      await onUpdate(proposal.id, updates);
      setMessage("Proposal updated.");
    } catch {
      setMessage("The proposal could not be updated. Please try again.");
    }
  }

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
          {proposal.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-[#17201C]">Sent date</dt>
          <dd className="mt-1 text-[#5F6862]">
            {formatProposalDate(proposal.sentAt)}
          </dd>
        </div>

        <div>
          <dt className="font-bold text-[#17201C]">Expiry date</dt>
          <dd className="mt-1 text-[#5F6862]">
            {formatProposalDate(proposal.expiresAt)}
          </dd>
        </div>
      </dl>

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
            onChange={(event) => {
              setStatus(
                event.target.value as ProposalRecord["status"],
              );
              setMessage("");
            }}
          >
            {proposalStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold text-[#17201C]"
            htmlFor={`proposal-notes-${proposal.id}`}
          >
            Decision note
          </label>
          <textarea
            id={`proposal-notes-${proposal.id}`}
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            disabled={isSaving}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setMessage("");
            }}
            placeholder="Record revision details, client feedback, or the reason for the decision."
          />
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
      </div>
    </article>
  );
}

export function ProposalPanel({
  clientWorkflowRecordId,
  proposals,
  isLoading,
  isSaving,
  errorMessage,
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
            Track proposed work, value, follow-up dates, revisions, and
            client decisions.
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
          proposals.map((proposal) => (
            <ProposalEditor
              isSaving={isSaving}
              key={`${proposal.id}-${proposal.updatedAt}`}
              onUpdate={onUpdate}
              proposal={proposal}
            />
          ))
        ) : (
          <p className="rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#5F6862]">
            No proposals or quotes have been added for this client yet.
          </p>
        )}
      </div>
    </section>
  );
}