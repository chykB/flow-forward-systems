import { RotateCcw, Search } from "lucide-react";
import type {
  LifecycleStage,
  RiskLevel,
} from "@/lib/client-workflow-types";
import type { RecordFilters } from "@/lib/record-filters";

type RecordFiltersBarProps = {
  filters: RecordFilters;
  onChange: (filters: RecordFilters) => void;
  onReset: () => void;
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
  onReset,
  owners,
}: RecordFiltersBarProps) {
  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.stage !== "All" ||
    filters.riskLevel !== "All" ||
    filters.owner !== "All";

  return (
    <div className="rounded-lg border border-[#D9DED8] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#17201C]">Filter clients</h3>
          <p className="mt-1 text-sm text-[#5F6862]">
            Narrow the list without leaving the selected workflow.
          </p>
        </div>

        {hasActiveFilters ? (
          <button
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#174F42] hover:bg-[#EDF3EF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42]"
            onClick={onReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.8fr_0.8fr]">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="record-search">
            Search records
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#5F6862]"
            />
            <input
              className="w-full rounded-md border border-[#D9DED8] py-3 pl-11 pr-4 outline-none focus:border-[#174F42]"
              id="record-search"
              placeholder="Name, business, interest, or next action"
              value={filters.query}
              onChange={(event) =>
                onChange({ ...filters, query: event.target.value })
              }
            />
          </div>
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
