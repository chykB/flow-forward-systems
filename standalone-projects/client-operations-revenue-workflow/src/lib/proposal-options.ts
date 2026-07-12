import type { ProposalRecord } from "@/lib/client-workflow-types";

type ProposalStatus = ProposalRecord["status"];

export const proposalStatusOptions: {
  value: ProposalStatus;
  label: string;
}[] = [
  { value: "Not needed", label: "No proposal needed" },
  {
    value: "Draft needed",
    label: "Proposal preparation needed",
  },
  { value: "Sent", label: "Sent" },
  { value: "Revision requested", label: "Revision requested" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Rejected" },
  { value: "Expired", label: "Expired" },
];

export const newProposalStatusOptions =
  proposalStatusOptions.filter(
    (option) => option.value !== "Not needed",
  );

export function getProposalStatusLabel(status: ProposalStatus) {
  return (
    proposalStatusOptions.find(
      (option) => option.value === status,
    )?.label ?? status
  );
}

export function getTodayDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}