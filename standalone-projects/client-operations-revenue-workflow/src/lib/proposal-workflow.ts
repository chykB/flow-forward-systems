import type {
  ClientEngagement,
  ClientWorkflowRecord,
  LifecycleStage,
  PriorityLevel,
  ProposalRecord,
} from "@/lib/client-workflow-types";

export type ProposalWorkflowUpdates = Partial<
  Pick<
    ClientWorkflowRecord,
    | "lifecycleStage"
    | "clientType"
    | "returningClientStatus"
    | "nextAction"
    | "nextFollowUpAt"
    | "onboardingStatus"
    | "priority"
    | "estimatedValue"
  >
>;

export type ProposalWorkflowRecommendation = {
  title: string;
  reason: string;
  updates: ProposalWorkflowUpdates;
};

const priorityRank: Record<PriorityLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const lifecycleStageRank: Record<LifecycleStage, number> = {
  "New lead": 1,
  "Qualified lead": 2,
  "Follow-up needed": 3,
  "Discovery or call booked": 4,
  "Proposal sent": 5,
  "Won client": 6,
  Onboarding: 7,
  "In delivery": 8,
  "Waiting for approval": 9,
  "Payment follow-up": 10,
  Completed: 11,
  "Lost or inactive": 11,
};

function raisePriority(
  current: PriorityLevel,
  recommended: PriorityLevel,
) {
  return priorityRank[current] >= priorityRank[recommended]
    ? current
    : recommended;
}

function forwardLifecycleStageUpdate(
  current: LifecycleStage,
  recommended: LifecycleStage,
) {
  return lifecycleStageRank[recommended] >
    lifecycleStageRank[current]
    ? { lifecycleStage: recommended }
    : {};
}

function toDateInputValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

function addDaysToDate(value: string, days: number) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function chooseEarlierDate(first: string, second: string) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first <= second ? first : second;
}

function estimatedValueUpdate(proposal: ProposalRecord) {
  return proposal.amount > 0
    ? { estimatedValue: proposal.amount }
    : {};
}

export function getProposalWorkflowRecommendation(
  proposal: ProposalRecord,
  record: ClientWorkflowRecord,
  engagement: ClientEngagement,
  now = new Date(),
): ProposalWorkflowRecommendation | null {
  const today = toDateInputValue(now);

  if (proposal.status === "Not needed") {
    return null;
  }

  if (proposal.status === "Draft needed") {
    return {
      title: "Prepare the proposal or quote",
      reason:
        "The opportunity cannot move to a client decision until the proposal or quote is ready.",
      updates: {
        nextAction: "Prepare the proposal or quote.",
        priority: raisePriority(engagement.priority, "Medium"),
        ...estimatedValueUpdate(proposal),
      },
    };
  }

  if (proposal.status === "Sent") {
    const threeDayFollowUp = addDaysToDate(
      proposal.sentAt,
      3,
    );

    return {
      title: "Schedule proposal follow-up",
      reason:
        "A sent proposal needs a clear follow-up date so the opportunity does not become inactive.",
      updates: {
        ...forwardLifecycleStageUpdate(
          engagement.lifecycleStage,
          "Proposal sent",
        ),
        nextAction: "Follow up on the proposal decision.",
        nextFollowUpAt: chooseEarlierDate(
          threeDayFollowUp,
          proposal.expiresAt.slice(0, 10),
        ),
        priority: raisePriority(engagement.priority, "Medium"),
        ...estimatedValueUpdate(proposal),
      },
    };
  }

  if (proposal.status === "Revision requested") {
    return {
      title: "Prepare the requested revision",
      reason:
        "The client has requested changes, so the proposal needs an owner and a clear next action.",
      updates: {
        ...forwardLifecycleStageUpdate(
          engagement.lifecycleStage,
          "Proposal sent",
        ),
        nextAction:
          "Review the requested changes and prepare the revised proposal.",
        nextFollowUpAt: today,
        priority: raisePriority(engagement.priority, "High"),
        ...estimatedValueUpdate(proposal),
      },
    };
  }

  if (proposal.status === "Accepted") {
    const isLead =
      engagement.isPrimary && record.clientType === "Lead";

    const isNewClientAtProposalStage =
      engagement.isPrimary &&
      record.clientType === "New client" &&
      [
        "New lead",
        "Qualified lead",
        "Follow-up needed",
        "Discovery or call booked",
        "Proposal sent",
      ].includes(engagement.lifecycleStage);

    const isReturningEngagement =
      record.clientType === "Returning client" ||
      record.clientType === "Past client";

    if (isLead || isNewClientAtProposalStage) {
      const onboardingStatus =
        engagement.onboardingStatus === "In progress" ||
        engagement.onboardingStatus === "Complete"
          ? engagement.onboardingStatus
          : "Not started";

      return {
        title: "Start client onboarding",
        reason: isLead
          ? "The first proposal has been accepted, so this lead is now a confirmed new client."
          : "The proposal has been accepted, so the confirmed new client can move into onboarding.",
        updates: {
          ...forwardLifecycleStageUpdate(
            engagement.lifecycleStage,
            "Won client",
          ),
          ...(isLead ? { clientType: "New client" as const } : {}),
          onboardingStatus,
          nextAction:
            "Start client onboarding and confirm the first delivery steps.",
          nextFollowUpAt: today,
          priority: raisePriority(engagement.priority, "High"),
          ...estimatedValueUpdate(proposal),
        },
      };
    }

    if (isReturningEngagement) {
      return {
        title: "Start the returning client engagement",
        reason:
          "The client has accepted new work, so the returning engagement needs a clear owner and start plan.",
        updates: {
          ...forwardLifecycleStageUpdate(
            engagement.lifecycleStage,
            "Won client",
          ),
          ...(engagement.isPrimary &&
          record.clientType === "Past client"
            ? { clientType: "Returning client" as const }
            : {}),
          ...(engagement.isPrimary
            ? {
                returningClientStatus: "Reactivated" as const,
              }
            : {}),
          nextAction:
            "Confirm the returning engagement scope, owner, start date, and delivery steps.",
          nextFollowUpAt: today,
          priority: raisePriority(engagement.priority, "High"),
          ...estimatedValueUpdate(proposal),
        },
      };
    }

    return {
      title: "Confirm the accepted work",
      reason:
        "An existing client has accepted additional work, so the scope, owner, and delivery start should be confirmed.",
      updates: {
        nextAction:
          "Confirm the accepted scope, owner, start date, and delivery steps.",
        nextFollowUpAt: today,
        priority: raisePriority(engagement.priority, "High"),
        ...estimatedValueUpdate(proposal),
      },
    };
  }

  if (proposal.status === "Rejected") {
    return {
      title: "Review the proposal decision",
      reason:
        "A rejected proposal needs a human decision before the opportunity is revised or closed.",
      updates: {
        nextAction:
          "Review the client feedback and decide whether to revise or close the opportunity.",
        nextFollowUpAt: today,
        priority: raisePriority(engagement.priority, "High"),
        ...estimatedValueUpdate(proposal),
      },
    };
  }

  return {
    title: "Renew or close the proposal",
    reason:
      "The proposal has expired and should not remain open without a decision.",
    updates: {
      ...forwardLifecycleStageUpdate(
        engagement.lifecycleStage,
        "Proposal sent",
      ),
      nextAction:
        "Renew the proposal or close the opportunity.",
      nextFollowUpAt: today,
      priority: raisePriority(engagement.priority, "High"),
      ...estimatedValueUpdate(proposal),
    },
  };
}
