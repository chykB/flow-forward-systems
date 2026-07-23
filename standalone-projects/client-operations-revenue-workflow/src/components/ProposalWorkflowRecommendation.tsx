"use client";

import { useState } from "react";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
  ProposalRecord,
} from "@/lib/client-workflow-types";
import { getLifecycleStageLabel } from "@/lib/client-workflow-display";
import {
  getProposalWorkflowRecommendation,
  type ProposalWorkflowRecommendation,
} from "@/lib/proposal-workflow";

type ProposalWorkflowRecommendationProps = {
  isApplying: boolean;
  engagement: ClientEngagement;
  proposal: ProposalRecord;
  record: ClientWorkflowRecord;
  onApply: (
    proposal: ProposalRecord,
    recommendation: ProposalWorkflowRecommendation,
  ) => Promise<void>;
};

function formatEstimatedValue(
  amount: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function buildChangeSummary(
  recommendation: ProposalWorkflowRecommendation,
  proposal: ProposalRecord,
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
) {
  const changes: string[] = [];
  const updates = recommendation.updates;

  if (
    updates.lifecycleStage &&
    updates.lifecycleStage !== engagement.lifecycleStage
  ) {
    changes.push(
      `Lifecycle stage: ${getLifecycleStageLabel(
        updates.lifecycleStage,
      )}`,
    );
  }

  if (
    updates.clientType &&
    updates.clientType !== record.clientType
  ) {
    changes.push(`Client type: ${updates.clientType}`);
  }
  if (
    updates.returningClientStatus &&
    updates.returningClientStatus !== record.returningClientStatus
  ) {
    changes.push(
      `Returning client status: ${updates.returningClientStatus}`,
    );
  }

  if (
    updates.nextAction &&
    updates.nextAction !== engagement.nextAction
  ) {
    changes.push(`Next action: ${updates.nextAction}`);
  }

  if (
    updates.nextFollowUpAt &&
    updates.nextFollowUpAt !== engagement.nextFollowUpAt
  ) {
    changes.push(
      `Next follow-up date: ${updates.nextFollowUpAt}`,
    );
  }

  if (
    updates.onboardingStatus &&
    updates.onboardingStatus !== engagement.onboardingStatus
  ) {
    changes.push(
      `Onboarding status: ${updates.onboardingStatus}`,
    );
  }

  if (
    updates.priority &&
    updates.priority !== engagement.priority
  ) {
    changes.push(`Priority: ${updates.priority}`);
  }

  if (
    updates.estimatedValue !== undefined &&
    updates.estimatedValue !== engagement.estimatedValue
  ) {
    changes.push(
      `Estimated job value: ${formatEstimatedValue(
        updates.estimatedValue,
        proposal.currency,
      )}`,
    );
  }

  return changes;
}

export function ProposalWorkflowRecommendation({
  isApplying,
  engagement,
  proposal,
  record,
  onApply,
}: ProposalWorkflowRecommendationProps) {
  const [message, setMessage] = useState("");
  const currentStatusAlreadyApplied =
    proposal.workflowActionAppliedStatus === proposal.status;

  if (currentStatusAlreadyApplied) {
    return (
      <div className="mt-5 rounded-md bg-[#EDF3EF] p-4">
        <p className="font-bold text-[#174F42]">
          Job workflow is up to date
        </p>
        <p className="mt-2 leading-7 text-[#5F6862]">
          The recommended job workflow update for this proposal
          status has already been applied.
        </p>
      </div>
    );
  }

  const recommendation = getProposalWorkflowRecommendation(
    proposal,
    record,
    engagement,
  );

  if (!recommendation) {
    return null;
  }

  const availableRecommendation = recommendation;

  const changeSummary = buildChangeSummary(
    availableRecommendation,
    proposal,
    record,
    engagement,
  );

  if (changeSummary.length === 0) {
    return (
      <div className="mt-5 rounded-md bg-[#EDF3EF] p-4">
        <p className="font-bold text-[#174F42]">
          Job workflow is up to date
        </p>
        <p className="mt-2 leading-7 text-[#5F6862]">
          This job already reflects the current proposal status and
          recommended next step.
        </p>
      </div>
    );
  }

  async function applyRecommendation() {
    setMessage("");

    try {
      await onApply(proposal, availableRecommendation);
      setMessage("Recommended next step applied.");
    } catch {
      setMessage(
        "The recommended next step could not be applied. Please try again.",
      );
    }
  }

  return (
    <div className="mt-5 rounded-md bg-[#EDF3EF] p-4">
      <p className="text-sm font-bold uppercase text-[#5F6862]">
        Recommended next step
      </p>
      <h6 className="mt-2 text-lg font-bold text-[#17201C]">
        {recommendation.title}
      </h6>
      <p className="mt-2 leading-7 text-[#5F6862]">
        {recommendation.reason}
      </p>

      {changeSummary.length > 0 ? (
        <div className="mt-4">
          <p className="font-bold text-[#17201C]">
            This will update
          </p>
          <ul className="mt-2 grid gap-2 text-sm text-[#5F6862]">
            {changeSummary.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <p
          className={`mt-4 rounded-md bg-white p-3 font-semibold ${
            message === "Recommended next step applied."
              ? "text-[#174F42]"
              : "text-red-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isApplying}
        onClick={() => void applyRecommendation()}
        type="button"
      >
        {isApplying
          ? "Applying..."
          : "Apply Recommended Next Step"}
      </button>
    </div>
  );
}
