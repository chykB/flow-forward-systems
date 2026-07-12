import type { ProposalRecord } from "@/lib/client-workflow-types";

const THREE_DAYS_IN_MILLISECONDS = 3 * 24 * 60 * 60 * 1000;

function dateHasPassed(value: string, now: Date) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() <= now.getTime()
  );
}

function proposalHasWaitedThreeDays(
  sentAt: string,
  now: Date,
) {
  if (!sentAt) {
    return false;
  }

  const sentDate = new Date(sentAt);

  if (Number.isNaN(sentDate.getTime())) {
    return false;
  }

  return (
    now.getTime() - sentDate.getTime() >=
    THREE_DAYS_IN_MILLISECONDS
  );
}

export function proposalNeedsAction(
  proposal: ProposalRecord,
  now = new Date(),
) {
  if (proposal.status === "Draft needed") {
    return true;
  }

  if (proposal.status === "Revision requested") {
    return true;
  }

  if (proposal.status === "Expired") {
    return true;
  }

  if (proposal.status !== "Sent") {
    return false;
  }

  if (!proposal.sentAt) {
    return true;
  }

  return (
    dateHasPassed(proposal.expiresAt, now) ||
    proposalHasWaitedThreeDays(proposal.sentAt, now)
  );
}

export function getProposalsNeedingAction(
  proposals: ProposalRecord[],
  now = new Date(),
) {
  return proposals.filter((proposal) =>
    proposalNeedsAction(proposal, now),
  );
}