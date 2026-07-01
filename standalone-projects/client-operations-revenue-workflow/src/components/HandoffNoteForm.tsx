"use client";

import { useState } from "react";
import type { HandoffNote } from "@/lib/client-workflow-types";

type HandoffNoteFormProps = {
  clientWorkflowRecordId: string;
  onAddNote: (note: HandoffNote) => void;
};

type FormValues = {
  title: string;
  note: string;
  owner: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  title: "",
  note: "",
  owner: "",
};

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = "Enter a short note title.";
  }

  if (values.note.trim().length < 10) {
    errors.note = "Add the handoff context.";
  }

  if (values.owner.trim().length < 2) {
    errors.owner = "Enter who owns this note.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-semibold text-red-700">{message}</p>;
}

export function HandoffNoteForm({
  clientWorkflowRecordId,
  onAddNote,
}: HandoffNoteFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
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

    onAddNote({
      id: `handoff-${Date.now()}`,
      clientWorkflowRecordId,
      title: values.title.trim(),
      note: values.note.trim(),
      owner: values.owner.trim(),
      createdAt: new Date().toISOString(),
    });

    setValues(initialValues);
    setErrors({});
  }

  return (
    <form
      className="mt-4 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      onSubmit={submitForm}
    >
      <h4 className="font-bold">Add Handoff Note</h4>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Add the context someone else would need to continue this client
        workflow.
      </p>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="handoff-title">
            Note title
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="handoff-title"
            value={values.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
          <FieldError message={errors.title} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="handoff-note">
            Handoff context
          </label>
          <textarea
            className="min-h-24 rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="handoff-note"
            value={values.note}
            onChange={(event) => updateField("note", event.target.value)}
          />
          <FieldError message={errors.note} />
        </div>

        <div className="grid gap-2">
          <label className="font-bold" htmlFor="handoff-owner">
            Owner
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="handoff-owner"
            placeholder="Example: Founder, VA, assistant"
            value={values.owner}
            onChange={(event) => updateField("owner", event.target.value)}
          />
          <FieldError message={errors.owner} />
        </div>
      </div>

      <button
        className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
        type="submit"
      >
        Add Handoff Note
      </button>
    </form>
  );
}