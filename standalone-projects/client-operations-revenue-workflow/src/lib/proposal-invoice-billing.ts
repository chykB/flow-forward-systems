import type {
  InvoiceBillingBasis,
  InvoiceRecord,
  ProposalRecord,
} from "@/lib/client-workflow-types";

export const proposalInvoiceBillingOptions: Array<{
  label: string;
  value: InvoiceBillingBasis;
}> = [
  { label: "Full proposal value", value: "Full proposal" },
  { label: "Deposit", value: "Deposit" },
  { label: "Milestone payment", value: "Milestone" },
  { label: "Remaining balance", value: "Remaining balance" },
  { label: "Custom amount", value: "Custom" },
];

export function getProposalInvoicedAmount(
  proposalId: string,
  invoices: InvoiceRecord[],
) {
  return invoices
    .filter(
      (invoice) =>
        invoice.proposalRecordId === proposalId &&
        !["Not needed", "Voided"].includes(invoice.status),
    )
    .reduce((total, invoice) => total + invoice.amount, 0);
}

export function getProposalRemainingAmount(
  proposal: ProposalRecord,
  invoices: InvoiceRecord[],
) {
  return Math.max(
    0,
    proposal.amount -
      getProposalInvoicedAmount(proposal.id, invoices),
  );
}

export function getDefaultProposalBillingBasis(
  proposal: ProposalRecord,
  invoices: InvoiceRecord[],
): InvoiceBillingBasis {
  return getProposalInvoicedAmount(proposal.id, invoices) > 0
    ? "Remaining balance"
    : "Full proposal";
}

export function getProposalInvoiceAmount(
  proposal: ProposalRecord,
  invoices: InvoiceRecord[],
  billingBasis: InvoiceBillingBasis,
  billingPercentage: number | null,
) {
  if (billingBasis === "Full proposal") {
    return proposal.amount;
  }

  if (billingBasis === "Deposit") {
    if (
      billingPercentage === null ||
      !Number.isFinite(billingPercentage)
    ) {
      return null;
    }

    return Math.round(
      proposal.amount * billingPercentage,
    ) / 100;
  }

  if (billingBasis === "Remaining balance") {
    return getProposalRemainingAmount(proposal, invoices);
  }

  return null;
}
