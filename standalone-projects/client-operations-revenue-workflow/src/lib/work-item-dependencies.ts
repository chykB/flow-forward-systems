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

export type WorkItemQueueState =
  | "current"
  | "up-next"
  | "waiting"
  | "complete";

export type WorkItemQueueEntry = {
  task: WorkflowTask;
  position: number;
  state: WorkItemQueueState;
  unresolvedPrerequisites: WorkflowTask[];
};

export function isWorkItemComplete(task: WorkflowTask) {
  return completedStatuses.has(task.status);
}

export function sortWorkItemsInSequence(
  tasks: WorkflowTask[],
) {
  return [...tasks].sort((left, right) => {
    const phaseDifference =
      phaseRank[left.phase] - phaseRank[right.phase];

    if (phaseDifference !== 0) {
      return phaseDifference;
    }

    const createdDifference = left.createdAt.localeCompare(
      right.createdAt,
    );

    if (createdDifference !== 0) {
      return createdDifference;
    }

    return left.id.localeCompare(right.id);
  });
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
  const orderedTasks = sortWorkItemsInSequence(tasks);
  const taskIndex = orderedTasks.findIndex(
    (candidate) => candidate.id === task.id,
  );
  const existingPrerequisiteIds = new Set(
    getWorkItemPrerequisiteIds(task.id, dependencies),
  );

  return orderedTasks.filter((candidate, candidateIndex) => {
    const isEarlierInSequence =
      taskIndex >= 0 && candidateIndex < taskIndex;

    return (
      candidate.id !== task.id &&
      (isEarlierInSequence ||
        existingPrerequisiteIds.has(candidate.id)) &&
      phaseRank[candidate.phase] <= phaseRank[task.phase] &&
      !reachesTask(candidate.id, task.id, dependencies)
    );
  });
}

export function getDefaultWorkItemPrerequisite(
  task: WorkflowTask,
  tasks: WorkflowTask[],
  dependencies: WorkflowTaskDependency[],
) {
  const orderedTasks = sortWorkItemsInSequence(tasks);
  const taskIndex = orderedTasks.findIndex(
    (candidate) => candidate.id === task.id,
  );
  const eligibleIds = new Set(
    getEligibleWorkItemPrerequisites(
      task,
      tasks,
      dependencies,
    ).map((candidate) => candidate.id),
  );

  for (let index = taskIndex - 1; index >= 0; index -= 1) {
    const candidate = orderedTasks[index];

    if (
      eligibleIds.has(candidate.id) &&
      !isWorkItemComplete(candidate)
    ) {
      return candidate;
    }
  }

  return null;
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

export function getWorkItemQueueEntries(
  tasks: WorkflowTask[],
  dependencies: WorkflowTaskDependency[],
): WorkItemQueueEntry[] {
  const orderedTasks = sortWorkItemsInSequence(tasks);
  const unresolvedByTask = new Map<string, WorkflowTask[]>(
    orderedTasks.map((task) => [
      task.id,
      getUnresolvedWorkItemPrerequisites(
        task.id,
        orderedTasks,
        dependencies,
      ),
    ]),
  );
  const currentTask = orderedTasks.find(
    (task) =>
      !isWorkItemComplete(task) &&
      (unresolvedByTask.get(task.id) ?? []).length === 0,
  );

  return orderedTasks.map((task, index) => {
    const unresolvedPrerequisites =
      unresolvedByTask.get(task.id) ?? [];
    let state: WorkItemQueueState = "up-next";

    if (isWorkItemComplete(task)) {
      state = "complete";
    } else if (unresolvedPrerequisites.length > 0) {
      state = "waiting";
    } else if (task.id === currentTask?.id) {
      state = "current";
    }

    return {
      task,
      position: index + 1,
      state,
      unresolvedPrerequisites,
    };
  });
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
      (taskId) => taskById.get(taskId)?.status === "Blocked",
    )
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
