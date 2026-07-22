"use client";

import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  WorkflowTask,
  WorkflowTaskDependency,
} from "@/lib/client-workflow-types";
import { getEligibleWorkItemPrerequisites } from "@/lib/work-item-dependencies";

type WorkflowTaskDependencyEditorProps = {
  dependencies: WorkflowTaskDependency[];
  isSaving: boolean;
  onSave: (prerequisiteIds: string[]) => Promise<void>;
  task: WorkflowTask;
  tasks: WorkflowTask[];
};

function normalizedIds(ids: string[]) {
  return [...new Set(ids)].sort();
}

export function WorkflowTaskDependencyEditor({
  dependencies,
  isSaving,
  onSave,
  task,
  tasks,
}: WorkflowTaskDependencyEditorProps) {
  const initialIds = useMemo(
    () =>
      normalizedIds(
        dependencies
          .filter(
            (dependency) =>
              dependency.workflowTaskId === task.id,
          )
          .map(
            (dependency) =>
              dependency.dependsOnWorkflowTaskId,
          ),
      ),
    [dependencies, task.id],
  );
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [message, setMessage] = useState("");
  const candidates = getEligibleWorkItemPrerequisites(
    task,
    tasks,
    dependencies,
  );
  const isChanged =
    JSON.stringify(normalizedIds(selectedIds)) !==
    JSON.stringify(initialIds);

  function togglePrerequisite(taskId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(taskId)
        ? currentIds.filter((id) => id !== taskId)
        : [...currentIds, taskId],
    );
    setMessage("");
  }

  async function saveDependencies() {
    setMessage("");

    if (!isChanged) {
      return;
    }

    try {
      await onSave(normalizedIds(selectedIds));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The prerequisites could not be saved.",
      );
    }
  }

  return (
    <form
      className="mt-4 border-t border-[#D9DED8] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void saveDependencies();
      }}
    >
      <p className="font-bold">Prerequisites</p>

      {candidates.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <label
              className="flex min-h-12 items-start gap-3 rounded-md border border-[#D9DED8] bg-white px-3 py-3 text-sm"
              key={candidate.id}
            >
              <input
                checked={selectedIds.includes(candidate.id)}
                className="mt-1 size-4 accent-[#174F42]"
                disabled={isSaving}
                onChange={() => togglePrerequisite(candidate.id)}
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block break-words font-semibold">
                  {candidate.title}
                </span>
                <span className="mt-1 block text-[#5F6862]">
                  {candidate.phase} | {candidate.status}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[#5F6862]">
          No eligible earlier work is available.
        </p>
      )}

      {message ? (
        <p className="mt-3 font-semibold text-red-700">
          {message}
        </p>
      ) : null}

      <button
        className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#174F42] bg-white px-4 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving || !isChanged}
        type="submit"
      >
        <Link2 aria-hidden="true" size={18} />
        {isSaving ? "Saving..." : "Save Prerequisites"}
      </button>
    </form>
  );
}
