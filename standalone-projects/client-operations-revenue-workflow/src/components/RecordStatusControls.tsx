"use client";

import type {
  ClientType,
  ClientWorkflowRecord,
  LifecycleStage,
  ReturningClientStatus,
  RiskLevel,
  WorkflowStatus,
} from "@/lib/client-workflow-types";
import { getLifecycleStageLabel } from "@/lib/client-workflow-display";

type RecordStatusControlsProps = {
  onUpdateRecord: (updates: Partial<ClientWorkflowRecord>, note: string) => void;
  record: ClientWorkflowRecord;
};

const clientTypes: ClientType[] = [
  "Lead",
  "New client",
  "Active client",
  "Returning client",
  "Past client",
];

const returningClientStatuses: ReturningClientStatus[] = [
  "Potential reactivation",
  "Repeat project opportunity",
  "Reactivated",
  "Dormant",
];

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
    <section className="mt-8 border-t border-[#D9DED8] pt-6">
      <h3 className="text-lg font-bold">Update workflow status</h3>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Update the record as the client workflow changes. Each update is added
        to the activity history.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-client-type">
            Lead or client status
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-client-type"
            value={record.clientType}
            onChange={(event) => {
              const clientType = event.target.value as ClientType;

              const returningClientStatus: ReturningClientStatus =
                clientType === "Returning client"
                  ? "Reactivated"
                  : clientType === "Past client"
                    ? "Dormant"
                    : "Not returning";

              onUpdateRecord(
                {
                  clientType,
                  returningClientStatus,
                },
                `Lead or client status changed to ${clientType}.`,
              );
            }}
          >
            {clientTypes.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-stage">
            Workflow stage
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-stage"
            value={record.lifecycleStage}
            onChange={(event) => {
              const lifecycleStage =
                event.target.value as LifecycleStage;

              onUpdateRecord(
                { lifecycleStage },
                `Workflow stage changed to ${getLifecycleStageLabel(
                  lifecycleStage,
                )}.`,
              );
            }}
          >
            {lifecycleStages.map((stage) => (
              <option key={stage} value={stage}>
                {getLifecycleStageLabel(stage)}
              </option>
            ))}
          </select>
        </div>

        {record.clientType === "Returning client" ||
        record.clientType === "Past client" ? (
          <div className="grid gap-2">
            <label className="font-bold" htmlFor="status-returning-client">
              Returning client status
            </label>
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="status-returning-client"
              value={record.returningClientStatus}
              onChange={(event) => {
                const returningClientStatus =
                  event.target.value as ReturningClientStatus;

                onUpdateRecord(
                  { returningClientStatus },
                  `Returning client status changed to ${returningClientStatus}.`,
                );
              }}
            >
              {returningClientStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="status-risk">
            Relationship concern
          </label>
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="status-risk"
            value={record.riskLevel}
            onChange={(event) =>
              onUpdateRecord(
                { riskLevel: event.target.value as RiskLevel },
                `Relationship concern changed to ${event.target.value}.`,
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
    </section>
  );
}
