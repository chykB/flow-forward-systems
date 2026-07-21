"use client";

import { useState } from "react";
import {
  BriefcaseBusiness,
  Plus,
  X,
} from "lucide-react";
import type {
  NewClientEngagement,
} from "@/lib/application/workspace-api";
import {
  getLifecycleStageLabel,
} from "@/lib/client-workflow-display";
import type {
  ClientEngagement,
  ClientWorkflowRecord,
  LifecycleStage,
  PriorityLevel,
  WorkflowStatus,
} from "@/lib/client-workflow-types";

type ClientEngagementWorkspaceProps = {
  client: ClientWorkflowRecord;
  engagements: ClientEngagement[];
  errorMessage: string;
  isSaving: boolean;
  onCreate: (engagement: NewClientEngagement) => Promise<void>;
  onSelect: (engagementId: string) => void;
  selectedEngagement: ClientEngagement;
};

type FormValues = {
  assignedTo: string;
  estimatedValue: string;
  lifecycleStage: LifecycleStage;
  nextAction: string;
  nextFollowUpAt: string;
  priority: PriorityLevel;
  title: string;
};

const activeLifecycleStages: LifecycleStage[] = [
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
];

const priorities: PriorityLevel[] = ["High", "Medium", "Low"];

function getTodayDateKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function getInitialValues(
  client: ClientWorkflowRecord,
): FormValues {
  return {
    assignedTo: client.assignedTo,
    estimatedValue: "0",
    lifecycleStage: "New lead",
    nextAction: "Contact the client and confirm the next step.",
    nextFollowUpAt: getTodayDateKey(),
    priority: "Medium",
    title: "",
  };
}

function getWorkflowStatuses(
  stage: LifecycleStage,
): {
  approvalStatus: WorkflowStatus;
  deliveryStatus: WorkflowStatus;
  onboardingStatus: WorkflowStatus;
  paymentStatus: WorkflowStatus;
} {
  if (stage === "Payment follow-up") {
    return {
      approvalStatus: "Complete",
      deliveryStatus: "Complete",
      onboardingStatus: "Complete",
      paymentStatus: "Waiting",
    };
  }

  if (stage === "Waiting for approval") {
    return {
      approvalStatus: "Waiting",
      deliveryStatus: "Complete",
      onboardingStatus: "Complete",
      paymentStatus: "Not started",
    };
  }

  if (stage === "In delivery") {
    return {
      approvalStatus: "Not started",
      deliveryStatus: "In progress",
      onboardingStatus: "Complete",
      paymentStatus: "Not started",
    };
  }

  if (stage === "Won client" || stage === "Onboarding") {
    return {
      approvalStatus: "Not started",
      deliveryStatus: "Not started",
      onboardingStatus: "In progress",
      paymentStatus: "Not started",
    };
  }

  return {
    approvalStatus: "Not started",
    deliveryStatus: "Not started",
    onboardingStatus: "Not started",
    paymentStatus: "Not started",
  };
}

export function ClientEngagementWorkspace({
  client,
  engagements,
  errorMessage,
  isSaving,
  onCreate,
  onSelect,
  selectedEngagement,
}: ClientEngagementWorkspaceProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(client),
  );
  const [formMessage, setFormMessage] = useState("");

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }));
  }

  async function submitEngagement() {
    const title = values.title.trim();
    const nextAction = values.nextAction.trim();
    const assignedTo = values.assignedTo.trim();
    const estimatedValue = Number(values.estimatedValue);

    if (title.length < 2) {
      setFormMessage("Enter a job or engagement title.");
      return;
    }

    if (nextAction.length < 3) {
      setFormMessage("Enter the next action for this job.");
      return;
    }

    if (assignedTo.length < 2) {
      setFormMessage("Enter the person responsible for this job.");
      return;
    }

    if (!values.nextFollowUpAt) {
      setFormMessage("Choose the next follow-up date.");
      return;
    }

    if (!Number.isFinite(estimatedValue) || estimatedValue < 0) {
      setFormMessage("Enter a valid estimated value.");
      return;
    }

    setFormMessage("");

    try {
      await onCreate({
        clientWorkflowRecordId: client.id,
        title,
        lifecycleStage: values.lifecycleStage,
        priority: values.priority,
        estimatedValue,
        nextAction,
        nextFollowUpAt: values.nextFollowUpAt,
        assignedTo,
        ...getWorkflowStatuses(values.lifecycleStage),
      });
      setValues(getInitialValues(client));
      setIsFormOpen(false);
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The job could not be created.",
      );
    }
  }

  return (
    <section className="border-b border-[#D9DED8] py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <label
            className="text-sm font-bold text-[#5F6862]"
            htmlFor="selected-client-engagement"
          >
            Current job
          </label>
          <div className="mt-2 flex items-center gap-3">
            <BriefcaseBusiness
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-[#174F42]"
            />
            <select
              className="min-w-0 flex-1 rounded-md border border-[#D9DED8] bg-white px-4 py-3 font-bold text-[#17201C] outline-none focus:border-[#174F42]"
              id="selected-client-engagement"
              onChange={(event) => onSelect(event.target.value)}
              value={selectedEngagement.id}
            >
              {engagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.title}
                  {engagement.isPrimary ? " (Primary)" : ""}
                  {engagement.engagementStatus !== "Active"
                    ? ` - ${engagement.engagementStatus}`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-sm text-[#5F6862]">
            {getLifecycleStageLabel(
              selectedEngagement.lifecycleStage,
            )}
            {" | "}
            {selectedEngagement.engagementStatus}
            {selectedEngagement.isPrimary ? " | Primary job" : ""}
          </p>
        </div>

        <button
          className="flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-md border border-[#174F42] px-4 py-2 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
          onClick={() => setIsFormOpen((current) => !current)}
          type="button"
        >
          {isFormOpen ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Plus aria-hidden="true" className="h-5 w-5" />
          )}
          {isFormOpen ? "Close" : "Add job"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-50 p-4 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isFormOpen ? (
        <div className="mt-5 border-t border-[#D9DED8] pt-5">
          <h3 className="text-lg font-bold text-[#17201C]">
            Add another job for {client.name}
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <label className="font-bold" htmlFor="engagement-title">
                Job title
              </label>
              <input
                className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-title"
                onChange={(event) =>
                  updateValue("title", event.target.value)
                }
                placeholder="Website redesign"
                type="text"
                value={values.title}
              />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="engagement-stage">
                Starting stage
              </label>
              <select
                className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-stage"
                onChange={(event) =>
                  updateValue(
                    "lifecycleStage",
                    event.target.value as LifecycleStage,
                  )
                }
                value={values.lifecycleStage}
              >
                {activeLifecycleStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {getLifecycleStageLabel(stage)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="engagement-priority">
                Priority
              </label>
              <select
                className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-priority"
                onChange={(event) =>
                  updateValue(
                    "priority",
                    event.target.value as PriorityLevel,
                  )
                }
                value={values.priority}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="font-bold" htmlFor="engagement-next-action">
                Next action
              </label>
              <input
                className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-next-action"
                onChange={(event) =>
                  updateValue("nextAction", event.target.value)
                }
                type="text"
                value={values.nextAction}
              />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="engagement-follow-up">
                Follow-up date
              </label>
              <input
                className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-follow-up"
                min={getTodayDateKey()}
                onChange={(event) =>
                  updateValue("nextFollowUpAt", event.target.value)
                }
                type="date"
                value={values.nextFollowUpAt}
              />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="engagement-owner">
                Owner
              </label>
              <input
                className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-owner"
                onChange={(event) =>
                  updateValue("assignedTo", event.target.value)
                }
                type="text"
                value={values.assignedTo}
              />
            </div>

            <div className="grid gap-2">
              <label className="font-bold" htmlFor="engagement-value">
                Estimated value
              </label>
              <input
                className="rounded-md border border-[#D9DED8] px-4 py-3 outline-none focus:border-[#174F42]"
                id="engagement-value"
                min="0"
                onChange={(event) =>
                  updateValue("estimatedValue", event.target.value)
                }
                step="0.01"
                type="number"
                value={values.estimatedValue}
              />
            </div>
          </div>

          {formMessage ? (
            <p className="mt-4 rounded-md bg-red-50 p-4 font-semibold text-red-700">
              {formMessage}
            </p>
          ) : null}

          <button
            className="mt-5 flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSaving}
            onClick={() => void submitEngagement()}
            type="button"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
            {isSaving ? "Adding job..." : "Add job"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
