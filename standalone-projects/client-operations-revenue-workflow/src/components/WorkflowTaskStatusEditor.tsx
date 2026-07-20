"use client";

import { useState } from "react";
import type {
  WorkflowStatus,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import type {
  WorkflowTaskStatusUpdate,
} from "@/lib/application/workspace-api";

type WorkflowTaskStatusEditorProps = {
  isSaving: boolean;
  onUpdateStatus: (
    update: WorkflowTaskStatusUpdate,
  ) => Promise<void>;
  task: WorkflowTask;
};

const activeWorkflowStatuses: WorkflowStatus[] = [
  "Not started",
  "In progress",
  "Waiting",
  "Blocked",
  "Complete",
  "Not needed",
];

const plannedWorkflowStatuses: WorkflowStatus[] = [
  "Planned",
  "Not started",
  "In progress",
  "Not needed",
];

export function WorkflowTaskStatusEditor({
  isSaving,
  onUpdateStatus,
  task,
}: WorkflowTaskStatusEditorProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<WorkflowStatus>(task.status);
  const [message, setMessage] = useState("");
  const workflowStatuses =
    task.status === "Planned"
      ? plannedWorkflowStatuses
      : activeWorkflowStatuses;

  async function saveStatus() {
    setMessage("");

    if (selectedStatus === task.status) {
      return;
    }

    try {
      await onUpdateStatus({
        status: selectedStatus,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The work item status could not be saved.",
      );
    }
  }

  return (
    <form
      className="mt-4 border-t border-[#D9DED8] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void saveStatus();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label
          className="grid flex-1 gap-2 font-bold"
          htmlFor={`work-item-status-${task.id}`}
        >
          Update status
          <select
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 font-normal outline-none focus:border-[#174F42]"
            disabled={isSaving}
            id={`work-item-status-${task.id}`}
            onChange={(event) => {
              setSelectedStatus(
                event.target.value as WorkflowStatus,
              );
              setMessage("");
            }}
            value={selectedStatus}
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <button
          className="rounded-md bg-[#174F42] px-4 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={
            isSaving || selectedStatus === task.status
          }
          type="submit"
        >
          {isSaving ? "Saving..." : "Save Status"}
        </button>
      </div>

      {message ? (
        <p className="mt-3 font-semibold text-red-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
