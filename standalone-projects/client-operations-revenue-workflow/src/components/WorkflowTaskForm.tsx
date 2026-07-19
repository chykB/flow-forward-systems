"use client";

import { useState } from "react";
import type {
  TaskCriticality,
  TaskType,
  WorkflowStatus,
} from "@/lib/client-workflow-types";
import type {
  NewWorkflowTask,
} from "@/lib/application/workspace-api";

type WorkflowTaskFormProps = {
  clientWorkflowRecordId: string;
  isSubmitting: boolean;
  onAddTask: (task: NewWorkflowTask) => Promise<void>;
};

type FormValues = {
  title: string;
  type: TaskType;
  owner: string;
  dueDate: string;
  status: WorkflowStatus;
  criticality: TaskCriticality;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const taskTypes: TaskType[] = [
  "Follow-up",
  "Onboarding",
  "Delivery",
  "Approval",
  "Payment",
  "Handoff",
];

const statuses: WorkflowStatus[] = [
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Complete",
  "Not needed",
];

const criticalityLevels: TaskCriticality[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

const initialValues: FormValues = {
  title: "",
  type: "Follow-up",
  owner: "",
  dueDate: "",
  status: "Not started",
  criticality: "Medium",
};

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = "Enter a task title.";
  }

  if (values.owner.trim().length < 2) {
    errors.owner = "Enter who owns this task.";
  }

  if (!values.dueDate) {
    errors.dueDate = "Choose a due date.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-semibold text-red-700">{message}</p>;
}

export function WorkflowTaskForm({
  clientWorkflowRecordId,
  isSubmitting,
  onAddTask,
}: WorkflowTaskFormProps) {
  const [values, setValues] =
    useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState("");

  function updateField<Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
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

  async function submitTask() {
    const validationErrors = validateForm(values);
    setErrors(validationErrors);
    setFormMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      await onAddTask({
        clientWorkflowRecordId,
        title: values.title.trim(),
        type: values.type,
        owner: values.owner.trim(),
        dueDate: values.dueDate,
        status: values.status,
        criticality: values.criticality,
      });

      setValues(initialValues);
      setErrors({});
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "The work item could not be saved.",
      );
    }
  }

  return (
    <form
      className="mt-4 rounded-md border border-[#D9DED8] bg-[#F7F8F6] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submitTask();
      }}
    >
      <h4 className="font-bold">Add Work Item</h4>
      <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Add a supporting task for follow-up, onboarding, delivery, approval,
payment, or handoff.
      </p>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <label className="font-bold" htmlFor="task-title">
            Task title
          </label>
          <input
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
            id="task-title"
            value={values.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
          <FieldError message={errors.title} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="font-bold" htmlFor="task-type">
              Task type
            </label>
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="task-type"
              value={values.type}
              onChange={(event) =>
                updateField("type", event.target.value as TaskType)
              }
            >
              {taskTypes.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {taskType}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="font-bold" htmlFor="task-owner">
              Owner
            </label>
            <input
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="task-owner"
              placeholder="Example: Founder, VA, assistant"
              value={values.owner}
              onChange={(event) => updateField("owner", event.target.value)}
            />
            <FieldError message={errors.owner} />
          </div>

          <div className="grid gap-2">
            <label className="font-bold" htmlFor="task-due-date">
              Due date
            </label>
            <input
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="task-due-date"
              type="date"
              value={values.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
            />
            <FieldError message={errors.dueDate} />
          </div>

          <div className="grid gap-2">
            <label className="font-bold" htmlFor="task-status">
              Status
            </label>
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="task-status"
              value={values.status}
              onChange={(event) =>
                updateField("status", event.target.value as WorkflowStatus)
              }
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <label className="font-bold" htmlFor="task-criticality">
              Criticality
            </label>
            <select
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 outline-none focus:border-[#174F42]"
              id="task-criticality"
              value={values.criticality}
              onChange={(event) =>
                updateField(
                  "criticality",
                  event.target.value as TaskCriticality,
                )
              }
            >
              {criticalityLevels.map((criticality) => (
                <option key={criticality} value={criticality}>
                  {criticality}
                </option>
              ))}
            </select>
          </div>
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
        {isSubmitting ? "Saving..." : "Add Work Item"}
      </button>
    </form>
  );
}
