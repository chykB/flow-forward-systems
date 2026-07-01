"use client";

import type {
  ClientWorkflowRecord,
  LifecycleStage,
  RiskLevel,
  WorkflowStatus,
} from "@/lib/client-workflow-types";

type RecordStatusControlsProps = {
  onUpdateRecord: (updates: Partial<ClientWorkflowRecord>, note: string) => void;
  record: ClientWorkflowRecord;
};

const lifecycleStages: LifecycleStage[] = [
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

const workflowStatuses: WorkflowStatus[] = [
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Complete",
  "Not needed",
];

const riskLevels: RiskLevel[] = ["High", "Medium", "Low"];

export function RecordStatusControls({
  onUpdateRecord,
  record,
}: RecordStatusControlsProps) {
  return (
    <div className="mt-6 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4">
      <h3 className="font-bold">Update Workflow Status</h3>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Update the record as the client workflow changes. Each update is added
        to the activity history.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-stage">
            Lifecycle stage
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-stage"
            value={record.lifecycleStage}
            onChange={(event) =>
              onUpdateRecord(
                { lifecycleStage: event.target.value as LifecycleStage },
                `Lifecycle stage changed to ${event.target.value}.`,
              )
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
          <label className="font-bold" htmlFor="status-risk">
            Risk level
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-risk"
            value={record.riskLevel}
            onChange={(event) =>
              onUpdateRecord(
                { riskLevel: event.target.value as RiskLevel },
                `Risk level changed to ${event.target.value}.`,
              )
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
          <label className="font-bold" htmlFor="status-onboarding">
            Onboarding
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-onboarding"
            value={record.onboardingStatus}
            onChange={(event) =>
              onUpdateRecord(
                { onboardingStatus: event.target.value as WorkflowStatus },
                `Onboarding status changed to ${event.target.value}.`,
              )
            }
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-delivery">
            Delivery
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-delivery"
            value={record.deliveryStatus}
            onChange={(event) =>
              onUpdateRecord(
                { deliveryStatus: event.target.value as WorkflowStatus },
                `Delivery status changed to ${event.target.value}.`,
              )
            }
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-approval">
            Approval
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-approval"
            value={record.approvalStatus}
            onChange={(event) =>
              onUpdateRecord(
                { approvalStatus: event.target.value as WorkflowStatus },
                `Approval status changed to ${event.target.value}.`,
              )
            }
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-payment">
            Payment
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-payment"
            value={record.paymentStatus}
            onChange={(event) =>
              onUpdateRecord(
                { paymentStatus: event.target.value as WorkflowStatus },
                `Payment status changed to ${event.target.value}.`,
              )
            }
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}