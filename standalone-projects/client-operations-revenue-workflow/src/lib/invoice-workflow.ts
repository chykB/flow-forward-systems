import type {
  ClientWorkflowRecord,
  InvoiceRecord,
  InvoiceStatus,
} from "@/lib/client-workflow-types";

export type InvoiceWorkflowUpdates = Partial<
  Pick<
    ClientWorkflowRecord,
    | "paymentStatus"
    | "priority"
    | "nextAction"
    | "nextFollowUpAt"
  >
>;

export type InvoiceWorkflowRecommendation = {
  title: string;
  reason: string;
  effectiveStatus: InvoiceStatus;
  updates: InvoiceWorkflowUpdates;
};

const levelRank = { Low: 0, Medium: 1, High: 2 };
const workflowPriority: Record<InvoiceStatus, number> = {
  Disputed: 7,
  Overdue: 6,
  "Due soon": 5,
  "Draft needed": 4,
  Sent: 3,
  Paid: 2,
  Voided: 1,
  "Not needed": 1,
};

function atLeast<T extends keyof typeof levelRank>(
  current: T,
  minimum: T,
) {
  return levelRank[current] >= levelRank[minimum]
    ? current
    : minimum;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function futureDateKey(date: Date, days: number) {
  const future = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  );
  return dateKey(future);
}

function getPostPaymentNextAction(
  record: ClientWorkflowRecord,
) {
  if (record.onboardingStatus === "Not started") {
    return "Start client onboarding and confirm the first delivery steps.";
  }

  if (
    ["In progress", "Waiting", "Blocked"].includes(
      record.onboardingStatus,
    )
  ) {
    return "Continue client onboarding and resolve its next open step.";
  }

  if (
    ["Not started", "In progress", "Waiting", "Blocked"].includes(
      record.deliveryStatus,
    )
  ) {
    return "Continue the next open client delivery step.";
  }

  if (
    ["Not started", "In progress", "Waiting", "Blocked"].includes(
      record.approvalStatus,
    )
  ) {
    return "Review the next open client approval step.";
  }

  return "Review the next active client workflow step.";
}

function getEffectiveStatus(
  invoice: InvoiceRecord,
  currentDate: Date,
): InvoiceStatus {
  if (!["Sent", "Due soon"].includes(invoice.status)) {
    return invoice.status;
  }

  const today = dateKey(currentDate);

  if (invoice.dueDate && invoice.dueDate < today) {
    return "Overdue";
  }

  if (
    invoice.dueDate &&
    invoice.dueDate <= futureDateKey(currentDate, 7)
  ) {
    return "Due soon";
  }

  return invoice.status;
}

export function getPrimaryInvoiceWorkflowTarget(
  invoices: InvoiceRecord[],
  currentDate = new Date(),
) {
  const orderedInvoices = [...invoices].sort(
    (first, second) => {
      const firstStatus = getEffectiveStatus(
        first,
        currentDate,
      );
      const secondStatus = getEffectiveStatus(
        second,
        currentDate,
      );

      const priorityDifference =
        workflowPriority[secondStatus] -
        workflowPriority[firstStatus];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const firstApplied =
        first.workflowActionAppliedStatus === firstStatus;
      const secondApplied =
        second.workflowActionAppliedStatus === secondStatus;

      if (firstApplied !== secondApplied) {
        return firstApplied ? 1 : -1;
      }

      if (first.dueDate && second.dueDate) {
        const dueDateDifference =
          first.dueDate.localeCompare(second.dueDate);

        if (dueDateDifference !== 0) {
          return dueDateDifference;
        }
      } else if (first.dueDate) {
        return -1;
      } else if (second.dueDate) {
        return 1;
      }

      return first.createdAt.localeCompare(
        second.createdAt,
      );
    },
  );

  return orderedInvoices[0] ?? null;
}

export function getInvoiceWorkflowRecommendation(
  invoice: InvoiceRecord,
  record: ClientWorkflowRecord,
  currentDate = new Date(),
): InvoiceWorkflowRecommendation {
  const effectiveStatus = getEffectiveStatus(invoice, currentDate);
  const reference = invoice.invoiceNumber
    ? `invoice ${invoice.invoiceNumber}`
    : "the invoice";
    const disputeNextAction =
    `Review the dispute for ${reference} ` +
    "before sending any payment reminder.";

  const shouldReplaceResolvedDisputeAction =
    Boolean(invoice.disputeResolvedAt) &&
    record.nextAction === disputeNextAction;
  const today = dateKey(currentDate);

  if (effectiveStatus === "Draft needed") {
    return {
      title: "Prepare the invoice",
      reason: "The invoice still needs to be completed and sent.",
      effectiveStatus,
      updates: {
        paymentStatus: "Not started",
        priority: atLeast(record.priority, "Medium"),
        nextAction: `Prepare and send ${reference}.`,
        nextFollowUpAt: futureDateKey(currentDate, 1),
      },
    };
  }

  if (effectiveStatus === "Sent") {
    const updates: InvoiceWorkflowUpdates = {
      paymentStatus: "Waiting",
    };

    if (shouldReplaceResolvedDisputeAction) {
      updates.nextAction =
        `Monitor ${reference} and prepare payment follow-up ` +
        "near the due date.";
      updates.nextFollowUpAt =
        invoice.dueDate || futureDateKey(currentDate, 7);
    }

    return {
      title: "Monitor the sent invoice",
      reason:
        "The invoice is sent and is not yet close to its due date.",
      effectiveStatus,
      updates,
    };
  }

  if (effectiveStatus === "Due soon") {
    return {
      title: "Prepare for the payment due date",
      reason: "Payment is due within seven days.",
      effectiveStatus,
      updates: {
        paymentStatus: "Waiting",
        priority: atLeast(record.priority, "Medium"),
        nextAction: `Review ${reference} and prepare a payment reminder for approval.`,
        nextFollowUpAt: invoice.dueDate,
      },
    };
  }

  if (effectiveStatus === "Overdue") {
    return {
      title: "Review the overdue invoice",
      reason: "Payment is past due and needs a human-approved follow-up.",
      effectiveStatus,
      updates: {
        paymentStatus: "Waiting",
        priority: "High",
        nextAction: `Review ${reference} and send an approved overdue payment reminder.`,
        nextFollowUpAt: today,
      },
    };
  }

  if (effectiveStatus === "Disputed") {
    return {
      title: "Review the payment dispute",
      reason: "Ordinary reminders should pause until the dispute is reviewed.",
      effectiveStatus,
      updates: {
        paymentStatus: "Blocked",
        priority: "High",
        nextAction: disputeNextAction,
        nextFollowUpAt: today,
      },
    };
  }

  if (effectiveStatus === "Paid") {
    const updates: InvoiceWorkflowUpdates = {
      paymentStatus: "Complete",
    };

    if (shouldReplaceResolvedDisputeAction) {
      updates.nextAction = getPostPaymentNextAction(record);
      updates.nextFollowUpAt = futureDateKey(currentDate, 1);
    }

    return {
      title: "Complete the payment workflow",
      reason:
        "Payment was received. Other client work should continue unchanged.",
      effectiveStatus,
      updates,
    };
  }

  if (effectiveStatus === "Voided") {
    const updates: InvoiceWorkflowUpdates = {
      paymentStatus: "Not needed",
    };

    if (shouldReplaceResolvedDisputeAction) {
      updates.nextAction =
        "Confirm whether a replacement invoice is needed, " +
        "then continue the client workflow.";
      updates.nextFollowUpAt =
        futureDateKey(currentDate, 1);
    }

    return {
      title: "Close the voided invoice workflow",
      reason:
        "The invoice was voided or replaced and should no longer drive payment follow-up.",
      effectiveStatus,
      updates,
    };
  }
  return {
    title: "Close the payment workflow",
    reason: "This client workflow does not require an invoice.",
    effectiveStatus,
    updates: { paymentStatus: "Not needed" },
  };

  
}
