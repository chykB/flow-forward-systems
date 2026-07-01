import type {
  ClientWorkflowRecord,
  LifecycleStage,
  RiskLevel,
} from "./client-workflow-types";

export type RecordFilters = {
  owner: string;
  query: string;
  riskLevel: RiskLevel | "All";
  stage: LifecycleStage | "All";
};

export const initialRecordFilters: RecordFilters = {
  owner: "All",
  query: "",
  riskLevel: "All",
  stage: "All",
};

export function getRecordOwners(records: ClientWorkflowRecord[]) {
  return Array.from(new Set(records.map((record) => record.assignedTo))).filter(Boolean);
}

export function filterRecords(
  records: ClientWorkflowRecord[],
  filters: RecordFilters,
) {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return records.filter((record) => {
    const matchesQuery =
      !normalizedQuery ||
      record.name.toLowerCase().includes(normalizedQuery) ||
      record.businessName.toLowerCase().includes(normalizedQuery) ||
      record.nextAction.toLowerCase().includes(normalizedQuery) ||
      record.interest.toLowerCase().includes(normalizedQuery);

    const matchesStage =
      filters.stage === "All" || record.lifecycleStage === filters.stage;

    const matchesRisk =
      filters.riskLevel === "All" || record.riskLevel === filters.riskLevel;

    const matchesOwner =
      filters.owner === "All" || record.assignedTo === filters.owner;

    return matchesQuery && matchesStage && matchesRisk && matchesOwner;
  });
}