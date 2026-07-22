import type {
  WorkItemPhase,
  WorkflowTask,
  WorkflowTaskDependency,
} from "@/lib/client-workflow-types";

const phaseRank: Record<WorkItemPhase, number> = {
  Lead: 1,
  Proposal: 2,
  Onboarding: 3,
  Delivery: 4,
  Approval: 5,
  Payment: 6,
  Handoff: 7,
};

const completedStatuses = new Set<WorkflowTask["status"]>([
  "Complete",
  "Not needed",
]);

export type WorkItemRootBlocker = {
  task: WorkflowTask;
  impactedTasks: WorkflowTask[];
};

export function isWorkItemComplete(task: WorkflowTask) {
  return completedStatuses.has(task.status);
}

export function getWorkItemPrerequisiteIds(
  taskId: string,
  dependencies: WorkflowTaskDependency[],
) {
  return dependencies
    .filter((dependency) => dependency.workflowTaskId === taskId)
    .map((dependency) => dependency.dependsOnWorkflowTaskId);
}

function reachesTask(
  startTaskId: string,
  targetTaskId: string,
  dependencies: WorkflowTaskDependency[],
) {
  const prerequisitesByTask = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const prerequisiteIds =
      prerequisitesByTask.get(dependency.workflowTaskId) ?? [];
    prerequisiteIds.push(dependency.dependsOnWorkflowTaskId);
    prerequisitesByTask.set(
      dependency.workflowTaskId,
      prerequisiteIds,
    );
  }

  const pending = [startTaskId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const currentTaskId = pending.pop();

    if (!currentTaskId || visited.has(currentTaskId)) {
      continue;
    }

    if (currentTaskId === targetTaskId) {
      return true;
    }

    visited.add(currentTaskId);
    pending.push(
      ...(prerequisitesByTask.get(currentTaskId) ?? []),
    );
  }

  return false;
}

export function getEligibleWorkItemPrerequisites(
  task: WorkflowTask,
  tasks: WorkflowTask[],
  dependencies: WorkflowTaskDependency[],
) {
  return tasks.filter(
    (candidate) =>
      candidate.id !== task.id &&
      phaseRank[candidate.phase] <= phaseRank[task.phase] &&
      !reachesTask(candidate.id, task.id, dependencies),
  );
}

export function getUnresolvedWorkItemPrerequisites(
  taskId: string,
  tasks: WorkflowTask[],
  dependencies: WorkflowTaskDependency[],
) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return getWorkItemPrerequisiteIds(taskId, dependencies)
    .map((prerequisiteId) => taskById.get(prerequisiteId))
    .filter(
      (task): task is WorkflowTask =>
        Boolean(task) && !isWorkItemComplete(task as WorkflowTask),
    );
}

export function getWorkItemRootBlockers(
  tasks: WorkflowTask[],
  dependencies: WorkflowTaskDependency[],
): WorkItemRootBlocker[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dependentsByTask = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const dependentIds =
      dependentsByTask.get(
        dependency.dependsOnWorkflowTaskId,
      ) ?? [];
    dependentIds.push(dependency.workflowTaskId);
    dependentsByTask.set(
      dependency.dependsOnWorkflowTaskId,
      dependentIds,
    );
  }

  const blockerIds = new Set<string>();

  for (const dependency of dependencies) {
    const dependent = taskById.get(dependency.workflowTaskId);
    const prerequisite = taskById.get(
      dependency.dependsOnWorkflowTaskId,
    );

    if (
      dependent &&
      prerequisite &&
      !isWorkItemComplete(dependent) &&
      !isWorkItemComplete(prerequisite)
    ) {
      blockerIds.add(prerequisite.id);
    }
  }

  return [...blockerIds]
    .filter(
      (taskId) =>
        getUnresolvedWorkItemPrerequisites(
          taskId,
          tasks,
          dependencies,
        ).length === 0,
    )
    .map((taskId) => {
      const impactedIds = new Set<string>();
      const pending = [...(dependentsByTask.get(taskId) ?? [])];

      while (pending.length > 0) {
        const impactedId = pending.shift();

        if (!impactedId || impactedIds.has(impactedId)) {
          continue;
        }

        impactedIds.add(impactedId);
        pending.push(...(dependentsByTask.get(impactedId) ?? []));
      }

      return {
        task: taskById.get(taskId) as WorkflowTask,
        impactedTasks: [...impactedIds]
          .map((impactedId) => taskById.get(impactedId))
          .filter(
            (task): task is WorkflowTask =>
              Boolean(task) &&
              !isWorkItemComplete(task as WorkflowTask),
          ),
      };
    })
    .sort((left, right) =>
      left.task.dueDate.localeCompare(right.task.dueDate),
    );
}
