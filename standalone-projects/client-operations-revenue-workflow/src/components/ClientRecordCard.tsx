import type { ClientWorkflowRecord } from "@/lib/client-workflow-types";

type ClientRecordCardProps = {
  isSelected: boolean;
  onSelect: () => void;
  record: ClientWorkflowRecord;
};

export function ClientRecordCard({
  isSelected,
  onSelect,
  record,
}: ClientRecordCardProps) {
  return (
    <button
      className={`w-full rounded-lg border bg-white p-5 text-left transition hover:border-[#174F42] ${
        isSelected ? "border-[#174F42] ring-2 ring-[#174F42]/20" : "border-[#D9DED8]"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <h3 className="text-xl font-bold">{record.name}</h3>
          <p className="mt-1 text-[#5F6862]">{record.businessName}</p>
          <p className="mt-4 leading-7 text-[#5F6862]">{record.message}</p>
        </div>

        <div className="grid gap-3 rounded-md bg-[#EDF3EF] p-4">
          <p>
            <span className="font-bold">Stage:</span> {record.lifecycleStage}
          </p>
          <p>
            <span className="font-bold">Next action:</span>{" "}
            {record.nextAction}
          </p>
          <p>
            <span className="font-bold">Follow-up:</span>{" "}
            {record.nextFollowUpAt}
          </p>
          <p>
            <span className="font-bold">Owner:</span> {record.assignedTo}
          </p>
          <p>
            <span className="font-bold">Risk:</span> {record.riskLevel}
          </p>
        </div>
      </div>
    </button>
  );
}