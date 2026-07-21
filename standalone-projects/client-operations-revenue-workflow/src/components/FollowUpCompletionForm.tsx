"use client";

import { useState } from "react";
import type {
  CompleteFollowUpInput,
} from "@/lib/application/workspace-api";
import type {
  ClientWorkflowRecord,
  EngagementFollowUp,
  FollowUpOutcome,
} from "@/lib/client-workflow-types";
import { getLocalDateKey } from "@/lib/date-key";
import { formatDateTime } from "@/lib/format-date";

const outcomes: FollowUpOutcome[] = [
  "Replied",
  "No response",
  "Meeting booked",
  "Decision received",
  "Not proceeding",
  "Other",
];

type FormValues = {
  outcome: FollowUpOutcome;
  note: string;
  scheduleNext: boolean;
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
};

type FormErrors = Partial<
  Record<keyof FormValues, string>
>;

type Props = {
  errorMessage: string;
  followUps: EngagementFollowUp[];
  isLoading: boolean;
  isSubmitting: boolean;
  onComplete: (
    completion: CompleteFollowUpInput,
  ) => Promise<void>;
  record: ClientWorkflowRecord;
};

function getInitialValues(
  record: ClientWorkflowRecord,
): FormValues {
  const today = getLocalDateKey(new Date());

  return {
    outcome: "Replied",
    note: "",
    scheduleNext: Boolean(record.nextFollowUpAt),
    nextAction: record.nextAction,
    nextFollowUpAt:
      record.nextFollowUpAt >= today
        ? record.nextFollowUpAt
        : "",
    assignedTo: record.assignedTo,
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-semibold text-red-700">
      {message}
    </p>
  ) : null;
}

export function FollowUpCompletionForm({
  errorMessage,
  followUps,
  isLoading,
  isSubmitting,
  onComplete,
  record,
}: Props) {
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(record),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState("");

  function updateField<K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormMessage("");
  }

  async function submitForm(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    const today = getLocalDateKey(new Date());

    if (values.note.trim().length < 5) {
      nextErrors.note = "Add a short note about what happened.";
    }

    if (values.scheduleNext) {
      if (values.nextAction.trim().length < 3) {
        nextErrors.nextAction = "Enter the next action.";
      }

      if (!values.nextFollowUpAt) {
        nextErrors.nextFollowUpAt =
          "Choose the next follow-up date.";
      } else if (values.nextFollowUpAt < today) {
        nextErrors.nextFollowUpAt =
          "The next follow-up cannot be in the past.";
      }
    }

    if (values.assignedTo.trim().length < 2) {
      nextErrors.assignedTo = "Enter the owner.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await onComplete({
        outcome: values.outcome,
        note: values.note.trim(),
        nextAction: values.scheduleNext
          ? values.nextAction.trim()
          : "No further follow-up planned.",
        nextFollowUpAt: values.scheduleNext
          ? values.nextFollowUpAt
          : null,
        assignedTo: values.assignedTo.trim(),
      });

      setValues((current) => ({
        ...current,
        note: "",
      }));
      setFormMessage("");
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The follow-up could not be completed.",
      );
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <form
        className="rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
        onSubmit={submitForm}
      >
        <h3 className="font-bold">Complete follow-up</h3>
        <p className="mt-2 text-sm leading-6 text-[#5F6862]">
          Record the outcome, then schedule the next step or end
          this follow-up sequence.
        </p>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 font-bold">
            Outcome
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
              value={values.outcome}
              onChange={(event) =>
                updateField(
                  "outcome",
                  event.target.value as FollowUpOutcome,
                )
              }
            >
              {outcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 font-bold">
            Outcome note
            <textarea
              className="min-h-24 rounded-md border border-[#D9DED8] bg-white px-4 py-3"
              value={values.note}
              onChange={(event) =>
                updateField("note", event.target.value)
              }
            />
            <FieldError message={errors.note} />
          </label>

          <label className="flex items-center gap-3 font-bold">
            <input
              checked={values.scheduleNext}
              className="h-5 w-5 accent-[#174F42]"
              type="checkbox"
              onChange={(event) =>
                updateField("scheduleNext", event.target.checked)
              }
            />
            Schedule another follow-up
          </label>

          {values.scheduleNext ? (
            <>
              <label className="grid gap-2 font-bold">
                Next action
                <input
                  className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
                  value={values.nextAction}
                  onChange={(event) =>
                    updateField("nextAction", event.target.value)
                  }
                />
                <FieldError message={errors.nextAction} />
              </label>

              <label className="grid gap-2 font-bold">
                Next follow-up date
                <input
                  className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
                  min={getLocalDateKey(new Date())}
                  type="date"
                  value={values.nextFollowUpAt}
                  onChange={(event) =>
                    updateField(
                      "nextFollowUpAt",
                      event.target.value,
                    )
                  }
                />
                <FieldError message={errors.nextFollowUpAt} />
              </label>
            </>
          ) : (
            <p className="rounded-md bg-white p-4 text-sm leading-6 text-[#5F6862]">
              The engagement will keep its history, but no new
              follow-up date will be scheduled.
            </p>
          )}

          <label className="grid gap-2 font-bold">
            Owner
            <input
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3"
              value={values.assignedTo}
              onChange={(event) =>
                updateField("assignedTo", event.target.value)
              }
            />
            <FieldError message={errors.assignedTo} />
          </label>
        </div>

        {formMessage || errorMessage ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-700">
            {formMessage || errorMessage}
          </p>
        ) : null}

        <button
          className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Completing..." : "Complete follow-up"}
        </button>
      </form>

      <section>
        <h3 className="font-bold">Follow-up history</h3>
        {isLoading ? (
          <p className="mt-3 text-[#5F6862]">
            Loading completed follow-ups...
          </p>
        ) : followUps.length === 0 ? (
          <p className="mt-3 rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
            No completed follow-ups have been recorded yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {followUps.map((followUp) => (
              <article
                className="rounded-md border border-[#D9DED8] p-4"
                key={followUp.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold">{followUp.outcome}</p>
                  <p className="text-sm text-[#5F6862]">
                    {formatDateTime(followUp.completedAt)}
                  </p>
                </div>
                <p className="mt-2 leading-7 text-[#5F6862]">
                  {followUp.note}
                </p>
                <p className="mt-2 text-sm text-[#5F6862]">
                  {followUp.nextFollowUpAt
                    ? `Next: ${followUp.nextAction} on ${followUp.nextFollowUpAt}`
                    : "No further follow-up scheduled"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
