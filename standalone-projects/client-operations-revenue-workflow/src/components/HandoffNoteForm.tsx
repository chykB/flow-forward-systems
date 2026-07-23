"use client";

import { useState } from "react";
import type {
  NewHandoffNote,
} from "@/lib/application/workspace-api";
import type { WorkflowTask } from "@/lib/client-workflow-types";

type HandoffNoteFormProps = {
  clientWorkflowRecordId: string;
  isSubmitting: boolean;
  onAddNote: (
    workflowTaskId: string,
    note: NewHandoffNote,
  ) => Promise<void>;
  task: WorkflowTask;
};

type FormValues = {
  title: string;
  note: string;
  owner: string;
};

type FormErrors = Partial<
  Record<keyof FormValues, string>
>;

function getInitialValues(task: WorkflowTask): FormValues {
  return {
    title: task.title,
    note: "",
    owner: task.owner,
  };
}

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = "Enter a short note title.";
  }

  if (values.note.trim().length < 10) {
    errors.note = "Add the handoff context.";
  }

  if (values.owner.trim().length < 2) {
    errors.owner = "Enter who will receive this handoff.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-semibold text-red-700">
      {message}
    </p>
  );
}

export function HandoffNoteForm({
  clientWorkflowRecordId,
  isSubmitting,
  onAddNote,
  task,
}: HandoffNoteFormProps) {
  const [values, setValues] =
    useState<FormValues>(() => getInitialValues(task));
  const [errors, setErrors] =
    useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState("");

  function updateField(
    field: keyof FormValues,
    value: string,
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    setFormMessage("");
  }

  async function submitNote() {
    const validationErrors = validateForm(values);
    setErrors(validationErrors);
    setFormMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      await onAddNote(task.id, {
        clientWorkflowRecordId,
        title: values.title.trim(),
        note: values.note.trim(),
        owner: values.owner.trim(),
      });

      setValues(getInitialValues(task));
      setErrors({});
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The handoff note could not be saved.",
      );
    }
  }

  return (
    <form
      className="mt-4 scroll-mt-6 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      id={`handoff-context-form-${task.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submitNote();
      }}
    >
      <h4 className="font-bold">Add handoff context</h4>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Record what the receiving owner needs to continue this
        Work Item.
      </p>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <label
            className="font-bold"
            htmlFor={`handoff-context-title-${task.id}`}
          >
            Handoff title
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id={`handoff-context-title-${task.id}`}
            maxLength={200}
            value={values.title}
            onChange={(event) =>
              updateField("title", event.target.value)
            }
          />
          <FieldError message={errors.title} />
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold"
            htmlFor={`handoff-context-note-${task.id}`}
          >
            Handoff context
          </label>
          <textarea
            className="min-h-24 rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id={`handoff-context-note-${task.id}`}
            maxLength={5000}
            value={values.note}
            onChange={(event) =>
              updateField("note", event.target.value)
            }
          />
          <FieldError message={errors.note} />
        </div>

        <div className="grid gap-2">
          <label
            className="font-bold"
            htmlFor={`handoff-context-owner-${task.id}`}
          >
            Receiving owner
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id={`handoff-context-owner-${task.id}`}
            maxLength={200}
            placeholder="Example: Founder, VA, assistant"
            value={values.owner}
            onChange={(event) =>
              updateField("owner", event.target.value)
            }
          />
          <FieldError message={errors.owner} />
        </div>
      </div>

      {formMessage ? (
        <p className="mt-4 font-semibold text-red-700">
          {formMessage}
        </p>
      ) : null}

      <button
        className="mt-4 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Save handoff context"}
      </button>
    </form>
  );
}
