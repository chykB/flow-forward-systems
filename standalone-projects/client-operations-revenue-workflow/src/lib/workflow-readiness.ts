import type {
  ClientEngagement,
  HandoffNote,
  WorkflowTask,
} from "@/lib/client-workflow-types";

export type ReadinessItemType =
  | "missing_next_action"
  | "missing_handoff_context";

export type ReadinessDestination =
  | "next-action"
  | "work-items";

export type WorkflowReadinessItem = {
  id: string;
  clientWorkflowRecordId: string;
  clientEngagementId: string;
  workflowTaskId?: string;
  type: ReadinessItemType;
  destination: ReadinessDestination;
  title: string;
  reason: string;
  recommendedAction: string;
  actionLabel: string;
};

const unclearNextActions = new Set([
  "n/a",
  "na",
  "no next action",
  "no next action planned",
  "no next action set",
  "none",
  "not set",
  "tbd",
  "to be decided",
  "to be determined",
  "unknown",
]);

const activeHandoffStatuses = new Set<
  WorkflowTask["status"]
>(["Not started", "In progress", "Waiting", "Blocked"]);

const priorityRank: Record<ClientEngagement["priority"], number> =
  {
    High: 1,
    Medium: 2,
    Low: 3,
  };

function normalizeNextAction(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();
}

export function hasClearNextAction(value: string) {
  const normalizedValue = normalizeNextAction(value);

  return (
    normalizedValue.length >= 5 &&
    !unclearNextActions.has(normalizedValue)
  );
}

export function hasRequiredHandoffContext(
  note: HandoffNote,
) {
  return (
    note.title.trim().length >= 3 &&
    note.note.trim().length >= 10 &&
    note.owner.trim().length >= 2
  );
}

export function isActiveHandoffRequirement(
  task: WorkflowTask,
) {
  return (
    (task.type === "Handoff" || task.phase === "Handoff") &&
    activeHandoffStatuses.has(task.status)
  );
}

export function getWorkflowReadinessItems(
  engagements: ClientEngagement[],
  tasks: WorkflowTask[],
  handoffNotes: HandoffNote[],
) {
  const tasksByEngagement = new Map<string, WorkflowTask[]>();
  const notesByTaskId = new Map<string, HandoffNote[]>();

  tasks.forEach((task) => {
    const engagementTasks =
      tasksByEngagement.get(task.clientEngagementId) ?? [];
    engagementTasks.push(task);
    tasksByEngagement.set(
      task.clientEngagementId,
      engagementTasks,
    );
  });

  handoffNotes.forEach((note) => {
    if (!note.workflowTaskId) {
      return;
    }

    const taskNotes =
      notesByTaskId.get(note.workflowTaskId) ?? [];
    taskNotes.push(note);
    notesByTaskId.set(note.workflowTaskId, taskNotes);
  });

  const items: WorkflowReadinessItem[] = [];

  engagements
    .filter(
      (engagement) => engagement.engagementStatus === "Active",
    )
    .forEach((engagement) => {
      if (!hasClearNextAction(engagement.nextAction)) {
        items.push({
          id: `${engagement.id}:missing-next-action`,
          clientWorkflowRecordId:
            engagement.clientWorkflowRecordId,
          clientEngagementId: engagement.id,
          type: "missing_next_action",
          destination: "next-action",
          title: "Next action needs clarification",
          reason:
            "This active job does not have a specific next action.",
          recommendedAction:
            "Add the next action, follow-up date, and owner.",
          actionLabel: "Add next action",
        });
      }

      (tasksByEngagement.get(engagement.id) ?? [])
        .filter(isActiveHandoffRequirement)
        .forEach((task) => {
          const hasHandoffContext = (
            notesByTaskId.get(task.id) ?? []
          ).some(hasRequiredHandoffContext);

          if (hasHandoffContext) {
            return;
          }

          items.push({
            id: `${task.id}:missing-handoff-context`,
            clientWorkflowRecordId:
              engagement.clientWorkflowRecordId,
            clientEngagementId: engagement.id,
            workflowTaskId: task.id,
            type: "missing_handoff_context",
            destination: "work-items",
            title: "Handoff context is incomplete",
            reason: `"${task.title}" has no saved context or receiving owner.`,
            recommendedAction:
              "Record what the next person needs to continue the work.",
            actionLabel: "Add handoff context",
          });
        });
    });

  const engagementById = new Map(
    engagements.map((engagement) => [
      engagement.id,
      engagement,
    ]),
  );

  return items.sort((left, right) => {
    const leftEngagement = engagementById.get(
      left.clientEngagementId,
    );
    const rightEngagement = engagementById.get(
      right.clientEngagementId,
    );
    const priorityDifference =
      priorityRank[leftEngagement?.priority ?? "Low"] -
      priorityRank[rightEngagement?.priority ?? "Low"];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    if (left.type !== right.type) {
      return left.type === "missing_next_action" ? -1 : 1;
    }

    return left.id.localeCompare(right.id);
  });
}
