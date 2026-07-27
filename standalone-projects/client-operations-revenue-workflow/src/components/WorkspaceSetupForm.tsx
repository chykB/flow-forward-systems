"use client";

import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  workspaceWorkingDays,
  workspaceWorkflowStages,
  type GuidedWorkspaceSetupDraftValues,
  type ReviewedWorkspaceSetup,
  type WorkspaceWorkingDay,
  type WorkspaceWorkflowStage,
} from "@/lib/operations-agent-types";

type WorkspaceSetupFormProps = {
  initialValues: GuidedWorkspaceSetupDraftValues;
  onSave: (configuration: ReviewedWorkspaceSetup) => Promise<unknown>;
};

type ReviewValues = {
  businessType: string;
  workflowStages: WorkspaceWorkflowStage[];
  commonOwnersText: string;
  workingDays: WorkspaceWorkingDay[];
  dailyBriefingEnabled: boolean | null;
  immediateFailureAlertsEnabled: boolean | null;
  opportunityAlertsEnabled: boolean | null;
};

function normalizeOwners(value: string) {
  return value
    .split(",")
    .map((owner) => owner.trim())
    .filter(Boolean);
}

function toggleSelection<T extends string>(
  values: T[],
  value: T,
) {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

export function WorkspaceSetupForm({
  initialValues,
  onSave,
}: WorkspaceSetupFormProps) {
  const [values, setValues] = useState<ReviewValues>({
    businessType: initialValues.businessType ?? "",
    workflowStages: initialValues.workflowStages,
    commonOwnersText: initialValues.commonOwners.join(", "),
    workingDays: initialValues.workingDays,
    dailyBriefingEnabled: initialValues.dailyBriefingEnabled,
    immediateFailureAlertsEnabled:
      initialValues.immediateFailureAlertsEnabled,
    opportunityAlertsEnabled:
      initialValues.opportunityAlertsEnabled,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const owners = useMemo(
    () => normalizeOwners(values.commonOwnersText),
    [values.commonOwnersText],
  );
  const duplicateOwnerCount =
    owners.length -
    new Set(owners.map((owner) => owner.toLowerCase())).size;
  const isComplete =
    values.businessType.trim().length >= 2 &&
    values.workflowStages.length > 0 &&
    owners.length > 0 &&
    owners.length <= 10 &&
    duplicateOwnerCount === 0 &&
    values.workingDays.length > 0 &&
    values.dailyBriefingEnabled !== null &&
    values.immediateFailureAlertsEnabled !== null &&
    values.opportunityAlertsEnabled !== null;

  async function submit() {
    if (!isComplete) {
      setMessage(
        "Review every section and complete each required choice.",
      );
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      await onSave({
        businessType: values.businessType.trim(),
        workflowStages: values.workflowStages,
        commonOwners: owners,
        workingDays: values.workingDays,
        dailyBriefingEnabled:
          values.dailyBriefingEnabled as boolean,
        immediateFailureAlertsEnabled:
          values.immediateFailureAlertsEnabled as boolean,
        opportunityAlertsEnabled:
          values.opportunityAlertsEnabled as boolean,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The workspace setup could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-[#D9DED8] bg-white p-5 sm:p-7">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
        Prepared Draft
      </p>
      <h3 className="mt-3 text-2xl font-bold">
        Review workspace setup
      </h3>
      <p className="mt-2 leading-7 text-[#5F6862]">
        Check every choice. Saving updates how this workspace is
        organized.
      </p>

      <div className="mt-7 grid gap-7">
        <label className="block font-bold">
          Business type
          <input
            autoComplete="organization-title"
            className="mt-2 min-h-12 w-full rounded-md border border-[#D9DED8] px-4 py-3 font-normal outline-none focus:border-[#174F42]"
            maxLength={120}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                businessType: event.target.value,
              }))
            }
            placeholder="Example: design studio, consultancy, agency"
            value={values.businessType}
          />
        </label>

        <fieldset>
          <legend className="font-bold">Workflow stages used</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {workspaceWorkflowStages.map((stage) => (
              <label
                className="flex min-h-11 items-center gap-3 rounded-md border border-[#D9DED8] px-3 py-2"
                key={stage}
              >
                <input
                  checked={values.workflowStages.includes(stage)}
                  className="size-5 accent-[#174F42]"
                  onChange={() =>
                    setValues((current) => ({
                      ...current,
                      workflowStages: toggleSelection(
                        current.workflowStages,
                        stage,
                      ),
                    }))
                  }
                  type="checkbox"
                />
                <span>{stage}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block font-bold">
          Common owners
          <input
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-md border border-[#D9DED8] px-4 py-3 font-normal outline-none focus:border-[#174F42]"
            maxLength={500}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                commonOwnersText: event.target.value,
              }))
            }
            placeholder="Example: Founder, VA, Project lead"
            value={values.commonOwnersText}
          />
          <span className="mt-2 block text-sm font-normal leading-6 text-[#5F6862]">
            Separate owner labels with commas. Add up to 10.
          </span>
        </label>

        <fieldset>
          <legend className="font-bold">Working days</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {workspaceWorkingDays.map((day) => (
              <label
                className="flex min-h-11 items-center gap-2 rounded-md border border-[#D9DED8] px-3 py-2"
                key={day}
              >
                <input
                  checked={values.workingDays.includes(day)}
                  className="size-5 accent-[#174F42]"
                  onChange={() =>
                    setValues((current) => ({
                      ...current,
                      workingDays: toggleSelection(
                        current.workingDays,
                        day,
                      ),
                    }))
                  }
                  type="checkbox"
                />
                <span>{day}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <h4 className="font-bold">Notifications</h4>
          <div className="mt-3 divide-y divide-[#D9DED8] border-y border-[#D9DED8]">
            <PreferenceChoice
              label="Daily workspace briefing"
              name="daily-briefing"
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  dailyBriefingEnabled: value,
                }))
              }
              value={values.dailyBriefingEnabled}
            />
            <PreferenceChoice
              label="Immediate alerts when an agent run fails"
              name="failure-alerts"
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  immediateFailureAlertsEnabled: value,
                }))
              }
              value={values.immediateFailureAlertsEnabled}
            />
            <PreferenceChoice
              label="Returning-client opportunity reminders"
              name="opportunity-alerts"
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  opportunityAlertsEnabled: value,
                }))
              }
              value={values.opportunityAlertsEnabled}
            />
          </div>
        </div>
      </div>

      {message ? (
        <p
          className="mt-5 rounded-md bg-red-50 p-4 font-semibold text-red-700"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <button
        className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!isComplete || isSaving}
        onClick={submit}
        type="button"
      >
        {isSaving ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin"
          />
        ) : null}
        {isSaving ? "Saving..." : "Save Workspace Setup"}
      </button>
    </div>
  );
}

type PreferenceChoiceProps = {
  label: string;
  name: string;
  onChange: (value: boolean) => void;
  value: boolean | null;
};

function PreferenceChoice({
  label,
  name,
  onChange,
  value,
}: PreferenceChoiceProps) {
  return (
    <fieldset className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <legend className="font-semibold sm:contents">
        <span>{label}</span>
      </legend>
      <div className="flex gap-2">
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#D9DED8] px-3 py-2">
          <input
            checked={value === true}
            className="size-5 accent-[#174F42]"
            name={name}
            onChange={() => onChange(true)}
            type="radio"
          />
          Yes
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#D9DED8] px-3 py-2">
          <input
            checked={value === false}
            className="size-5 accent-[#174F42]"
            name={name}
            onChange={() => onChange(false)}
            type="radio"
          />
          Not now
        </label>
      </div>
    </fieldset>
  );
}
