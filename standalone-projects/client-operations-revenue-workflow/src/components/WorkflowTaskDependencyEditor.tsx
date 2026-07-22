"use client";

import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  WorkflowTask,
  WorkflowTaskDependency,
} from "@/lib/client-workflow-types";
import {
  getDefaultWorkItemPrerequisite,
  getEligibleWorkItemPrerequisites,
} from "@/lib/work-item-dependencies";

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
  const defaultPrerequisite = getDefaultWorkItemPrerequisite(
    task,
    tasks,
    dependencies,
  );
  const canRunInParallel = selectedIds.length === 0;
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

  function toggleParallelWork(allowParallelWork: boolean) {
    setSelectedIds(
      allowParallelWork || !defaultPrerequisite
        ? []
        : [defaultPrerequisite.id],
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
      className="py-4"
      onSubmit={(event) => {
        event.preventDefault();
        void saveDependencies();
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{task.title}</p>
        <span className="text-sm font-semibold text-[#5F6862]">
          {task.phase}
        </span>
      </div>

      {candidates.length > 0 || initialIds.length > 0 ? (
        <>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              checked={canRunInParallel}
              className="mt-1 size-4 accent-[#174F42]"
              disabled={isSaving}
              onChange={(event) =>
                toggleParallelWork(event.target.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block font-semibold">
                Can run in parallel
              </span>
              <span className="mt-1 block text-[#5F6862]">
                Start this item without waiting for earlier work.
              </span>
            </span>
          </label>

          {!canRunInParallel ? (
            <div className="mt-3">
              <p className="text-sm font-semibold">Starts after</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {candidates.map((candidate) => (
                  <label
                    className="flex min-h-12 items-start gap-3 rounded-md border border-[#D9DED8] bg-white px-3 py-3 text-sm"
                    key={candidate.id}
                  >
                    <input
                      checked={selectedIds.includes(candidate.id)}
                      className="mt-1 size-4 accent-[#174F42]"
                      disabled={isSaving}
                      onChange={() =>
                        togglePrerequisite(candidate.id)
                      }
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
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-[#5F6862]">
          This is the first item in the current work order.
        </p>
      )}

      {message ? (
        <p className="mt-3 font-semibold text-red-700">
          {message}
        </p>
      ) : null}

      {candidates.length > 0 || initialIds.length > 0 ? (
        <button
          className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#174F42] bg-white px-4 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !isChanged}
          type="submit"
        >
          <Link2 aria-hidden="true" size={18} />
          {isSaving ? "Saving..." : "Save Work Order"}
        </button>
      ) : null}
    </form>
  );
}
