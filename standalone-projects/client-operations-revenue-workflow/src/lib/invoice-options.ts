import type {
  InvoiceDisputeResolutionOutcome,
  InvoiceStatus,
} from "@/lib/client-workflow-types";



export const invoiceStatusOptions: {
  automatic?: boolean;
  label: string;
  value: InvoiceStatus;
}[] = [
  {
    value: "Draft needed",
    label: "Invoice preparation needed",
  },
  {
    value: "Sent",
    label: "Sent to client",
  },
  {
    automatic: true,
    value: "Due soon",
    label: "Payment due soon",
  },
  {
    automatic: true,
    value: "Overdue",
    label: "Invoice overdue",
  },
  {
    value: "Paid",
    label: "Paid",
  },
  {
    value: "Disputed",
    label: "Payment disputed",
  },
  {
    value: "Not needed",
    label: "Invoice not needed",
  },
];

export const invoiceDisputeResolutionOutcomeOptions: {
  label: string;
  value: InvoiceDisputeResolutionOutcome;
}[] = [
  {
    value: "Payment received",
    label: "Payment received",
  },
  {
    value: "Payment still due",
    label: "Payment remains due",
  },
  {
    value: "Invoice voided or replaced",
    label: "Invoice voided or replaced",
  },
];

export function getInvoiceStatusLabel(
  status: InvoiceStatus,
) {
  if (status === "Voided") {
    return "Voided or replaced";
  }

  return (
    invoiceStatusOptions.find(
      (option) => option.value === status,
    )?.label ?? status
  );
}

export function invoiceStatusRequiresIssuedDetails(
  status: InvoiceStatus,
) {
  return ![
    "Not needed",
    "Draft needed",
    "Voided",
  ].includes(status);
}

export function invoiceStatusRequiresSentDate(
  status: InvoiceStatus,
) {
  return [
    "Sent",
    "Due soon",
    "Overdue",
    "Disputed",
  ].includes(status);
}

export function invoiceStatusRequiresDueDate(
  status: InvoiceStatus,
) {
  return [
    "Sent",
    "Due soon",
    "Overdue",
    "Disputed",
  ].includes(status);
}

export function invoiceStatusRequiresPaidDate(
  status: InvoiceStatus,
) {
  return status === "Paid";
}

export function invoiceStatusRequiresDisputeReason(
  status: InvoiceStatus,
) {
  return status === "Disputed";
}
