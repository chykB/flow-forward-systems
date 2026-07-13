import type { InvoiceRecord } from "@/lib/client-workflow-types";

const pendingPaymentStatuses = new Set<
  InvoiceRecord["status"]
>(["Sent", "Due soon"]);

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFutureDateKey(date: Date, days: number) {
  const futureDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  futureDate.setDate(futureDate.getDate() + days);
  return getLocalDateKey(futureDate);
}

function sortByDueDate(invoices: InvoiceRecord[]) {
  return [...invoices].sort((first, second) => {
    if (!first.dueDate) return 1;
    if (!second.dueDate) return -1;

    return first.dueDate.localeCompare(second.dueDate);
  });
}

export function getInvoicesToPrepare(
  invoices: InvoiceRecord[],
) {
  return invoices.filter(
    (invoice) => invoice.status === "Draft needed",
  );
}

export function getInvoicesDueSoon(
  invoices: InvoiceRecord[],
  currentDate = new Date(),
  daysAhead = 7,
) {
  const today = getLocalDateKey(currentDate);
  const windowEnd = getFutureDateKey(currentDate, daysAhead);

  return sortByDueDate(
    invoices.filter(
      (invoice) =>
        pendingPaymentStatuses.has(invoice.status) &&
        Boolean(invoice.dueDate) &&
        invoice.dueDate >= today &&
        invoice.dueDate <= windowEnd,
    ),
  );
}

export function getOverdueInvoices(
  invoices: InvoiceRecord[],
  currentDate = new Date(),
) {
  const today = getLocalDateKey(currentDate);

  return sortByDueDate(
    invoices.filter((invoice) => {
      if (invoice.status === "Overdue") {
        return true;
      }

      return (
        pendingPaymentStatuses.has(invoice.status) &&
        Boolean(invoice.dueDate) &&
        invoice.dueDate < today
      );
    }),
  );
}

export function getDisputedInvoices(
  invoices: InvoiceRecord[],
) {
  return invoices.filter(
    (invoice) => invoice.status === "Disputed",
  );
}