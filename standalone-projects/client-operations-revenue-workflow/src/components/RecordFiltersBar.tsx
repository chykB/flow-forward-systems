import type {
  LifecycleStage,
  RiskLevel,
} from "@/lib/client-workflow-types";
import type { RecordFilters } from "@/lib/record-filters";

type RecordFiltersBarProps = {
  filters: RecordFilters;
  onChange: (filters: RecordFilters) => void;
  owners: string[];
};

const lifecycleStages: (LifecycleStage | "All")[] = [
  "All",
  "New lead",
  "Qualified lead",
  "Follow-up needed",
  "Discovery or call booked",
  "Proposal sent",
  "Won client",
  "Onboarding",
  "In delivery",
  "Waiting for approval",
  "Payment follow-up",
  "At risk",
  "Completed",
  "Lost or inactive",
];

const riskLevels: (RiskLevel | "All")[] = ["All", "High", "Medium", "Low"];

export function RecordFiltersBar({
  filters,
  onChange,
  owners,
}: RecordFiltersBarProps) {
  return (
    <div className="rounded-lg border border-[#D9DED8] bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr]">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-search">
            Search records
          </label>
          <input
            className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
            id="record-search"
            placeholder="Search by name, business, interest, or next action"
            value={filters.query}
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="stage-filter">
            Stage
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="stage-filter"
            value={filters.stage}
            onChange={(event) =>
              onChange({
                ...filters,
                stage: event.target.value as RecordFilters["stage"],
              })
            }
          >
            {lifecycleStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="risk-filter">
            Risk
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="risk-filter"
            value={filters.riskLevel}
            onChange={(event) =>
              onChange({
                ...filters,
                riskLevel: event.target.value as RecordFilters["riskLevel"],
              })
            }
          >
            {riskLevels.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="owner-filter">
            Owner
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="owner-filter"
            value={filters.owner}
            onChange={(event) =>
              onChange({ ...filters, owner: event.target.value })
            }
          >
            <option value="All">All</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}