"use client";

import { useState } from "react";
import type { ClientWorkflowRecord } from "@/lib/client-workflow-types";

type NextActionFormProps = {
  onUpdateRecord: (updates: Partial<ClientWorkflowRecord>, note: string) => void;
  record: ClientWorkflowRecord;
};

type FormValues = {
  nextAction: string;
  nextFollowUpAt: string;
  assignedTo: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.nextAction.trim().length < 5) {
    errors.nextAction = "Enter the next action.";
  }

  if (!values.nextFollowUpAt) {
    errors.nextFollowUpAt = "Choose a follow-up date.";
  }

  if (values.assignedTo.trim().length < 2) {
    errors.assignedTo = "Enter the owner.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-semibold text-red-700">{message}</p>;
}

export function NextActionForm({
  onUpdateRecord,
  record,
}: NextActionFormProps) {
  const [values, setValues] = useState<FormValues>({
    nextAction: record.nextAction,
    nextFollowUpAt: record.nextFollowUpAt,
    assignedTo: record.assignedTo,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  function updateField(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    onUpdateRecord(
      {
        nextAction: values.nextAction.trim(),
        nextFollowUpAt: values.nextFollowUpAt,
        assignedTo: values.assignedTo.trim(),
      },
      `Next action updated to: ${values.nextAction.trim()}.`,
    );
  }

  return (
    <form
      className="mt-6 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      onSubmit={submitForm}
    >
      <h3 className="font-bold">Update Next Action</h3>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Keep the next action, follow-up date, and owner clear so work does not
        depend on memory.
      </p>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="next-action">
            Next action
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="next-action"
            value={values.nextAction}
            onChange={(event) => updateField("nextAction", event.target.value)}
          />
          <FieldError message={errors.nextAction} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="font-bold" htmlFor="next-follow-up">
              Follow-up date
            </label>
            <input
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="next-follow-up"
              type="date"
              value={values.nextFollowUpAt}
              onChange={(event) =>
                updateField("nextFollowUpAt", event.target.value)
              }
            />
            <FieldError message={errors.nextFollowUpAt} />
          </div>

          <div className="grid gap-2">
            <label className="font-bold" htmlFor="next-owner">
              Owner
            </label>
            <input
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="next-owner"
              value={values.assignedTo}
              onChange={(event) => updateField("assignedTo", event.target.value)}
            />
            <FieldError message={errors.assignedTo} />
          </div>
        </div>
      </div>

      <button
        className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
        type="submit"
      >
        Save Next Action
      </button>
    </form>
  );
}