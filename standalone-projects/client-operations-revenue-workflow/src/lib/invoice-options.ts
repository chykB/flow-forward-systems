import type {
  InvoiceStatus,
} from "@/lib/client-workflow-types";

export const invoiceStatusOptions: {
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
    value: "Due soon",
    label: "Payment due soon",
  },
  {
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

export function getInvoiceStatusLabel(
  status: InvoiceStatus,
) {
  return (
    invoiceStatusOptions.find(
      (option) => option.value === status,
    )?.label ?? status
  );
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