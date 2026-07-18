import { CalendarDays, UserRound } from "lucide-react";
import {
  getLifecycleStageLabel,
  getRelationshipConcernLabel,
} from "@/lib/client-workflow-display";
import type { ClientWorkflowRecord } from "@/lib/client-workflow-types";

type ClientRecordCardProps = {
  isSelected: boolean;
  onSelect: () => void;
  record: ClientWorkflowRecord;
};

function getRiskClasses(
  riskLevel: ClientWorkflowRecord["riskLevel"],
) {
  if (riskLevel === "High") {
    return "bg-red-50 text-red-700";
  }

  if (riskLevel === "Medium") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-[#EDF3EF] text-[#174F42]";
}

export function ClientRecordCard({
  isSelected,
  onSelect,
  record,
}: ClientRecordCardProps) {
  return (
    <button
      aria-pressed={isSelected}
      className={`w-full rounded-md border bg-white p-4 text-left transition hover:border-[#174F42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174F42] ${
        isSelected ? "border-[#174F42] ring-2 ring-[#174F42]/20" : "border-[#D9DED8]"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold text-[#17201C]">
            {record.name}
          </h3>
          <p className="mt-1 break-words text-sm text-[#5F6862]">
            {record.businessName || "No business name"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${getRiskClasses(
            record.riskLevel,
          )}`}
        >
          {getRelationshipConcernLabel(record.riskLevel)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#5F6862]">
        <span>
          {getLifecycleStageLabel(record.lifecycleStage)}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRound aria-hidden="true" className="size-4 shrink-0" />
          <span className="break-words">{record.assignedTo}</span>
        </span>
      </div>

      <div className="mt-4 border-t border-[#D9DED8] pt-3">
        <p className="text-xs font-bold text-[#5F6862]">
          Next action
        </p>
        <p className="mt-1 line-clamp-2 leading-6 text-[#17201C]">
          {record.nextAction || "No next action set"}
        </p>

        <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#5F6862]">
          <CalendarDays aria-hidden="true" className="size-4" />
          Follow-up {record.nextFollowUpAt || "not scheduled"}
        </p>
      </div>
    </button>
  );
}
