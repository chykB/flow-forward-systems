"use client";

import { ChevronDown } from "lucide-react";
import { ClientEngagementWorkspace } from "@/components/ClientEngagementWorkspace";
import { FollowUpCompletionForm } from "@/components/FollowUpCompletionForm";
import { HandoffNoteForm } from "@/components/HandoffNoteForm";
import { InvoicePanel } from "@/components/InvoicePanel";
import { NextActionForm } from "@/components/NextActionForm";
import { ProposalPanel } from "@/components/ProposalPanel";
import { RecordStatusControls } from "@/components/RecordStatusControls";
import { WorkflowTaskForm } from "@/components/WorkflowTaskForm";
import { WorkflowTaskDependencyEditor } from "@/components/WorkflowTaskDependencyEditor";
import {
  getLifecycleStageLabel,
  getRelationshipConcernLabel,
} from "@/lib/client-workflow-display";
import { formatDateTime } from "@/lib/format-date";
import { RiskSignalPanel } from "@/components/RiskSignalPanel";
import { WorkflowTaskStatusEditor } from "@/components/WorkflowTaskStatusEditor";
import type {
  CompleteFollowUpInput,
  ClientWorkflowRecordUpdates,
  NewClientEngagement,
  NewHandoffNote,
  NewProposalRecord,
  NewWorkflowTask,
  ProposalRecordUpdates,
  RiskSignalStatusUpdate,
  WorkflowTaskStatusUpdate,
} from "@/lib/application/workspace-api";
import type {
  InvoiceWorkflowRecommendation as InvoiceRecommendationData,
} from "@/lib/invoice-workflow";
import type {
  ProposalWorkflowRecommendation as ProposalWorkflowRecommendationData,
} from "@/lib/proposal-workflow";
import type {
  ActivityLog,
  ClientEngagement,
  ClientWorkflowRecord,
  EngagementFollowUp,
  HandoffNote,
  InvoiceRecord,
  ProposalRecord,
  RiskSignal,
  WorkflowTask,
  WorkflowTaskDependency,
} from "@/lib/client-workflow-types";
import {
  getWorkItemQueueEntries,
  getWorkItemPrerequisiteIds,
  getWorkItemRootBlockers,
} from "@/lib/work-item-dependencies";
import type { WorkItemQueueState } from "@/lib/work-item-dependencies";
import type {
  InvoiceRecordUpdates,
  NewInvoiceRecord,
} from "@/lib/application/workspace-api";
export type DetailTab =
  | "overview"
  | "workflow-health"
  | "next-action"
  | "proposals"
  | "invoices"
  | "work-items"
  | "handoff"
  | "activity";

type ClientRecordDetailProps = {
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  activityLogs: ActivityLog[];
  engagementMessage: string;
  engagements: ClientEngagement[];
  followUpMessage: string;
  followUps: EngagementFollowUp[];
  handoffNotes: HandoffNote[];
  isProposalLoading: boolean;
  isProposalSaving: boolean;
  onAddHandoffNote: (
    note: NewHandoffNote,
  ) => Promise<void>;
  isHandoffSaving: boolean;
  isFollowUpLoading: boolean;
  isFollowUpSaving: boolean;
  onCompleteFollowUp: (
    completion: CompleteFollowUpInput,
  ) => Promise<void>;
  onCreateEngagement: (
    engagement: NewClientEngagement,
  ) => Promise<void>;
  onAddProposal: (proposal: NewProposalRecord) => Promise<void>;
  onAddTask: (task: NewWorkflowTask) => Promise<void>;
  onUpdateProposal: (
    proposalId: string,
    updates: ProposalRecordUpdates,
  ) => Promise<void>;
  onSelectEngagement: (engagementId: string) => void;
  onUpdateClientRecord: (
    updates: ClientWorkflowRecordUpdates,
    note: string,
  ) => void;
  onUpdateEngagement: (
    updates: Partial<ClientWorkflowRecord>,
    note: string,
  ) => void;
  proposalMessage: string;
  proposals: ProposalRecord[];
  record: ClientWorkflowRecord;
  selectedEngagement: ClientEngagement;
  tasks: WorkflowTask[];
  taskDependencies: WorkflowTaskDependency[];
  tasksMessage: string;
  isTasksLoading: boolean;
  isTaskSaving: boolean;
  isEngagementSaving: boolean;
  isApplyingProposalRecommendation: boolean;
  invoices: InvoiceRecord[];
  invoiceMessage: string;
  isInvoiceLoading: boolean;
  isInvoiceSaving: boolean;
  onAddInvoice: (invoice: NewInvoiceRecord) => Promise<void>;
  onApplyProposalRecommendation: (
    proposal: ProposalRecord,
    recommendation: ProposalWorkflowRecommendationData,
  ) => Promise<void>;
  onUpdateInvoice: (
    invoiceId: string,
    updates: InvoiceRecordUpdates,
  ) => Promise<void>;
  isApplyingInvoiceRecommendation: boolean;
  onApplyInvoiceRecommendation: (
    invoice: InvoiceRecord,
    recommendation: InvoiceRecommendationData,
  ) => Promise<void>;
  isRiskSignalsLoading: boolean;
  isRiskSignalSaving: boolean;
  riskSignalMessage: string;
  riskSignals: RiskSignal[];
  onUpdateRiskSignalStatus: (
    riskSignalId: string,
    update: RiskSignalStatusUpdate,
  ) => Promise<void>;
  activityMessage: string;
  isActivityLoading: boolean;
  handoffMessage: string;
  isHandoffLoading: boolean;
  onUpdateTaskStatus: (
    workflowTaskId: string,
    update: WorkflowTaskStatusUpdate,
  ) => Promise<void>;
  onUpdateTaskDependencies: (
    workflowTaskId: string,
    prerequisiteIds: string[],
  ) => Promise<void>;
  updatingTaskId: string | null;
  updatingTaskDependenciesId: string | null;
};

const detailTabs: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "workflow-health", label: "Workflow Health" },
  { key: "next-action", label: "Next Action" },
  { key: "proposals", label: "Proposals & Quotes" },
  { key: "invoices", label: "Invoices" },
  { key: "work-items", label: "Work Items" },
  { key: "handoff", label: "Handoff Notes" },
  { key: "activity", label: "Activity" },
];

const queueStateLabels: Record<WorkItemQueueState, string> = {
  current: "Current work",
  "up-next": "Up next",
  waiting: "Waiting",
  complete: "Complete",
};

const queueStateClasses: Record<WorkItemQueueState, string> = {
  current: "bg-[#174F42] text-white",
  "up-next": "bg-[#EDF3EF] text-[#174F42]",
  waiting: "bg-amber-50 text-amber-800",
  complete: "bg-[#F1F3F1] text-[#5F6862]",
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-[#D9DED8] py-3">
      <p className="text-sm font-bold text-[#17201C]">{label}</p>
      <p className="mt-1 break-words leading-7 text-[#5F6862]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function ContextItem({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-sm font-bold text-[#5F6862]">
        {label}
      </dt>
      <dd className="mt-1 break-words leading-7 text-[#17201C]">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function getRiskClasses(
  riskLevel: ClientWorkflowRecord["riskLevel"],
) {
  if (riskLevel === "High") {
    return "bg-red-50 text-red-700";
  }

  if (riskLevel === "Medium") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-[#EDF3EF] text-[#174F42]";
}

function ClosedEngagementNotice({
  status,
}: {
  status: ClientEngagement["engagementStatus"];
}) {
  const statusLabel =
    status === "Completed" ? "complete" : "cancelled";

  return (
    <div
      className="mt-5 border-y border-[#D9DED8] bg-[#F7F9F7] px-4 py-3"
      role="status"
    >
      <p className="font-bold text-[#17201C]">
        This job is {statusLabel}
      </p>
      <p className="mt-1 text-sm leading-6 text-[#5F6862]">
        Its workflow history remains available, but changes to this
        job are locked.
      </p>
    </div>
  );
}

export function ClientRecordDetail({
  activeTab,
  onTabChange,
  activityLogs,
  engagementMessage,
  engagements,
  followUpMessage,
  followUps,
  handoffNotes,
  invoiceMessage,
  invoices,
  isInvoiceLoading,
  isInvoiceSaving,
  isProposalLoading,
  isProposalSaving,
  isFollowUpLoading,
  isFollowUpSaving,
  onAddHandoffNote,
  onAddInvoice,
  onUpdateInvoice,
  onAddProposal,
  onAddTask,
  onCompleteFollowUp,
  onCreateEngagement,
  onApplyProposalRecommendation,
  onUpdateProposal,
  onSelectEngagement,
  onUpdateClientRecord,
  onUpdateEngagement,
  proposalMessage,
  proposals,
  record,
  selectedEngagement,
  tasks,
  taskDependencies,
  tasksMessage,
  isTasksLoading,
  isTaskSaving,
  isEngagementSaving,
  isApplyingProposalRecommendation,
  isApplyingInvoiceRecommendation,
  onApplyInvoiceRecommendation,
  isRiskSignalsLoading,
  isRiskSignalSaving,
  onUpdateRiskSignalStatus,
  riskSignalMessage,
  riskSignals,
  activityMessage,
  isActivityLoading,
  handoffMessage,
  isHandoffLoading,
  isHandoffSaving,
  onUpdateTaskStatus,
  onUpdateTaskDependencies,
  updatingTaskId,
  updatingTaskDependenciesId,
}: ClientRecordDetailProps) {

  const workflowRecord: ClientWorkflowRecord = {
    ...record,
    lifecycleStage: selectedEngagement.lifecycleStage,
    priority: selectedEngagement.priority,
    estimatedValue: selectedEngagement.estimatedValue,
    workflowHealthScore:
      selectedEngagement.workflowHealthScore,
    nextAction: selectedEngagement.nextAction,
    nextFollowUpAt: selectedEngagement.nextFollowUpAt,
    assignedTo: selectedEngagement.assignedTo,
    onboardingStatus: selectedEngagement.onboardingStatus,
    deliveryStatus: selectedEngagement.deliveryStatus,
    approvalStatus: selectedEngagement.approvalStatus,
    paymentStatus: selectedEngagement.paymentStatus,
    updatedAt: selectedEngagement.updatedAt,
  };

  const isEngagementReadOnly =
    selectedEngagement.engagementStatus !== "Active";
  const visibleDetailTabs = isEngagementReadOnly
    ? detailTabs.filter((tab) => tab.key !== "next-action")
    : detailTabs;
  const visibleActiveTab =
    isEngagementReadOnly && activeTab === "next-action"
      ? "overview"
      : activeTab;


  const recordTasks = tasks.filter(
    (task) => task.clientWorkflowRecordId === record.id,
  );
  const recordTaskIds = new Set(
    recordTasks.map((task) => task.id),
  );
  const recordTaskDependencies = taskDependencies.filter(
    (dependency) =>
      recordTaskIds.has(dependency.workflowTaskId) &&
      recordTaskIds.has(
        dependency.dependsOnWorkflowTaskId,
      ),
  );
  const rootBlockers = getWorkItemRootBlockers(
    recordTasks,
    recordTaskDependencies,
  );
  const workItemQueue = getWorkItemQueueEntries(
    recordTasks,
    recordTaskDependencies,
  );

  const recordLogs = activityLogs.filter(
    (log) => log.clientWorkflowRecordId === record.id,
  );

  const recordHandoffNotes = handoffNotes.filter(
    (note) => note.clientWorkflowRecordId === record.id,
  );



  return (
    <section className="rounded-lg border border-[#D9DED8] bg-white p-5">
      <div className="flex flex-col gap-4 border-b border-[#D9DED8] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#5F6862]">
            Selected record
          </p>
          <h2 className="mt-3 break-words text-2xl font-bold">
            {record.name}
          </h2>
          <p className="mt-1 break-words text-[#5F6862]">
            {record.businessName || "No business name"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="rounded-md bg-[#EDF3EF] px-3 py-2 text-sm font-bold text-[#174F42]">
            {selectedEngagement.workflowHealthScore}/100 health
          </span>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${getRiskClasses(
              record.riskLevel,
            )}`}
          >
            {getRelationshipConcernLabel(record.riskLevel)}
          </span>
        </div>
      </div>

      <ClientEngagementWorkspace
        client={record}
        engagements={engagements}
        errorMessage={engagementMessage}
        isSaving={isEngagementSaving}
        key={`engagement-workspace-${record.id}`}
        onCreate={onCreateEngagement}
        onSelect={onSelectEngagement}
        selectedEngagement={selectedEngagement}
      />

      {isEngagementReadOnly ? (
        <ClosedEngagementNotice
          status={selectedEngagement.engagementStatus}
        />
      ) : null}

      <div
        aria-label="Client record sections"
        className="mt-5 flex gap-2 overflow-x-auto border-b border-[#D9DED8] pb-3 lg:flex-wrap lg:overflow-visible"
        role="tablist"
      >
        {visibleDetailTabs.map((tab) => (
          <button
            aria-selected={visibleActiveTab === tab.key}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold ${
              visibleActiveTab === tab.key
                ? "bg-[#174F42] text-white"
                : "bg-[#EDF3EF] text-[#17201C] hover:bg-[#D9DED8]"
            }`}
            key={tab.key}
            role="tab"
            type="button"
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleActiveTab === "overview" ? (
        <div className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailRow
              label="Workflow stage"
              value={getLifecycleStageLabel(
                workflowRecord.lifecycleStage,
              )}
            />
            {isEngagementReadOnly ? (
              <>
                <DetailRow
                  label="Job status"
                  value={selectedEngagement.engagementStatus}
                />
                <DetailRow
                  label="Owner"
                  value={workflowRecord.assignedTo}
                />
                <DetailRow
                  label="Last updated"
                  value={formatDateTime(
                    selectedEngagement.updatedAt,
                  )}
                />
              </>
            ) : (
              <>
                <DetailRow
                  label="Next action"
                  value={workflowRecord.nextAction}
                />
                <DetailRow
                  label="Follow-up date"
                  value={
                    workflowRecord.nextFollowUpAt ||
                    "Not scheduled"
                  }
                />
                <DetailRow
                  label="Owner"
                  value={workflowRecord.assignedTo}
                />
              </>
            )}
          </div>

          <section className="mt-8 border-t border-[#D9DED8] pt-6">
            <h3 className="text-lg font-bold text-[#17201C]">
              Client context
            </h3>
            <dl className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
              <ContextItem
                label="Lead or client status"
                value={record.clientType}
              />
              <ContextItem
                label="Interest"
                value={record.interest}
              />
              <ContextItem
                label="Email"
                value={record.email}
              />
              <ContextItem
                label="Phone"
                value={record.phone}
              />
              {record.clientType === "Returning client" ||
              record.clientType === "Past client" ? (
                <ContextItem
                  label="Returning client status"
                  value={record.returningClientStatus}
                />
              ) : null}
              {record.lastProjectDate ? (
                <ContextItem
                  label="Last project date"
                  value={record.lastProjectDate}
                />
              ) : null}
              <ContextItem
                className="md:col-span-2"
                label="Client note"
                value={record.message}
              />
            </dl>
          </section>

          {!isEngagementReadOnly ? (
            <RecordStatusControls
              onUpdateClientRecord={onUpdateClientRecord}
              onUpdateEngagement={onUpdateEngagement}
              record={workflowRecord}
            />
          ) : null}
        </div>
      ) : null}
      {visibleActiveTab === "workflow-health" ? (
        <div className="mt-5">
          <RiskSignalPanel
            errorMessage={riskSignalMessage}
            isReadOnly={isEngagementReadOnly}
            isLoading={isRiskSignalsLoading}
            isSaving={isRiskSignalSaving}
            onOpenSource={(signal) => {
              if (signal.riskType === "overdue_follow_up") {
                onTabChange("next-action");
              } else if (signal.sourceType === "proposal") {
                onTabChange("proposals");
              } else if (signal.sourceType === "invoice") {
                onTabChange("invoices");
              } else {
                onTabChange("work-items");
              }
            }}
            onUpdateStatus={onUpdateRiskSignalStatus}
            record={workflowRecord}
            riskSignals={riskSignals}
          />
        </div>
      ) : null}

      {visibleActiveTab === "next-action" ? (
        <div className="mt-5">
          <div className="rounded-md bg-[#EDF3EF] p-4">
            <h3 className="font-bold">Current Next Action</h3>
            <p className="mt-2 leading-7 text-[#5F6862]">
              {workflowRecord.nextAction}
            </p>
            <p className="mt-2 text-sm text-[#5F6862]">
              Follow-up: {workflowRecord.nextFollowUpAt || "Not scheduled"} | Owner:{" "}
              {workflowRecord.assignedTo}
            </p>
          </div>

          {!isEngagementReadOnly ? (
            <>
              <FollowUpCompletionForm
                errorMessage={followUpMessage}
                followUps={followUps}
                isLoading={isFollowUpLoading}
                isSubmitting={isFollowUpSaving}
                key={`follow-up-${selectedEngagement.id}-${selectedEngagement.updatedAt}`}
                onComplete={onCompleteFollowUp}
                record={workflowRecord}
              />

              <details className="mt-6 border-t border-[#D9DED8] pt-5">
                <summary className="cursor-pointer font-bold text-[#174F42]">
                  Update schedule without completing a follow-up
                </summary>
                <NextActionForm
                  key={`next-action-${selectedEngagement.id}-${selectedEngagement.updatedAt}`}
                  record={workflowRecord}
                  onUpdateRecord={onUpdateEngagement}
                />
              </details>
            </>
          ) : null}
        </div>
      ) : null}

      {visibleActiveTab === "proposals" ? (
        <div className="mt-5">
          <ProposalPanel
            clientWorkflowRecordId={record.id}
            engagement={selectedEngagement}
            errorMessage={proposalMessage}
            isApplyingRecommendation={
              isApplyingProposalRecommendation
            }
            isReadOnly={isEngagementReadOnly}
            isLoading={isProposalLoading}
            isSaving={isProposalSaving}
            onApplyRecommendation={
              onApplyProposalRecommendation
            }
            onCreate={onAddProposal}
            onUpdate={onUpdateProposal}
            proposals={proposals}
            record={workflowRecord}
          />
        </div>
      ) : null}

      {visibleActiveTab === "invoices" ? (
        <div className="mt-5">
          <InvoicePanel
            clientWorkflowRecordId={record.id}
            errorMessage={invoiceMessage}
            invoices={invoices}
            isApplyingRecommendation={
              isApplyingInvoiceRecommendation
            }
            isReadOnly={isEngagementReadOnly}
            isLoading={isInvoiceLoading}
            isSaving={isInvoiceSaving}
            onApplyRecommendation={
              onApplyInvoiceRecommendation
            }
            onCreate={onAddInvoice}
            onUpdate={onUpdateInvoice}
            record={workflowRecord}
            showWorkflowRecommendations={
              selectedEngagement.isPrimary
            }
          />
        </div>
      ) : null}

      {visibleActiveTab === "work-items" ? (
        <div className="mt-5">
          <h3 className="font-bold">Work Items</h3>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            {isEngagementReadOnly
              ? "Review the work item history recorded for this job."
              : "Complete the current item first. Later work becomes ready as earlier steps are finished."}
          </p>

          {rootBlockers.length > 0 ? (
            <section
              aria-labelledby="root-blockers-heading"
              className="mt-4 border-y border-[#D9DED8] py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4
                  className="font-bold"
                  id="root-blockers-heading"
                >
                  Work Blocking Progress
                </h4>
                <span className="text-sm font-semibold text-[#5F6862]">
                  {rootBlockers.length} root {rootBlockers.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="mt-3 divide-y divide-[#D9DED8]">
                {rootBlockers.map(({ task, impactedTasks }) => (
                  <div
                    className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    key={task.id}
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold">
                        {task.title}
                      </p>
                      <p className="mt-1 text-sm text-[#5F6862]">
                        Blocking: {impactedTasks.map(
                          (impactedTask) => impactedTask.title,
                        ).join(", ")}
                      </p>
                    </div>
                    <span className="w-fit rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                      {isEngagementReadOnly
                        ? "Was blocking"
                        : "Resolve first"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tasksMessage ? (
            <p className="mt-4 rounded-md bg-red-50 p-4 font-semibold text-red-700">
              {tasksMessage}
            </p>
          ) : null}

          {isTasksLoading ? (
            <p className="mt-4 text-[#5F6862]">
              Loading work items...
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {workItemQueue.length > 0 ? (
                workItemQueue.map(
                  ({
                    task,
                    position,
                    state,
                    unresolvedPrerequisites,
                  }) => (
                    <div
                      className="rounded-md border border-[#D9DED8] p-4"
                      key={task.id}
                    >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#5F6862]">
                          Step {position}
                        </p>
                        <p className="font-bold">{task.title}</p>
                        <p className="mt-1 text-sm text-[#5F6862]">
                          {task.phase} phase | {task.type} | {task.owner}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-3 py-2 text-sm font-bold ${queueStateClasses[state]}`}
                        >
                          {queueStateLabels[state]}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-[#5F6862]">
                      Due: {task.dueDate} | Criticality:{" "}
                      {task.criticality}
                    </p>
                    {unresolvedPrerequisites.length > 0 ? (
                      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                        Waiting on: {unresolvedPrerequisites.map(
                          (prerequisite) => prerequisite.title,
                        ).join(", ")}
                      </p>
                    ) : null}
                    {!isEngagementReadOnly ? (
                      <WorkflowTaskStatusEditor
                        isSaving={
                          updatingTaskId === task.id ||
                          updatingTaskDependenciesId === task.id
                        }
                        isWaitingForPrerequisite={
                          unresolvedPrerequisites.length > 0
                        }
                        onUpdateStatus={(update) =>
                          onUpdateTaskStatus(task.id, update)
                        }
                        task={task}
                      />
                    ) : null}
                  </div>
                  ),
                )
              ) : (
                <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                  No work items added yet.
                </p>
              )}
            </div>
          )}

          {!isEngagementReadOnly && workItemQueue.length > 1 ? (
            <details className="group mt-4 border-y border-[#D9DED8] py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#174F42]">
                <span>Manage work order</span>
                <ChevronDown
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                  size={20}
                />
              </summary>
              <p className="mt-2 text-sm leading-6 text-[#5F6862]">
                Work is sequential by default. Adjust an item only when
                it can run in parallel or must wait for a different step.
              </p>
              <div className="mt-3 divide-y divide-[#D9DED8]">
                {workItemQueue.map(({ task }) => {
                  const prerequisiteKey =
                    getWorkItemPrerequisiteIds(
                      task.id,
                      recordTaskDependencies,
                    )
                      .sort()
                      .join(":");

                  return (
                    <WorkflowTaskDependencyEditor
                      dependencies={recordTaskDependencies}
                      isSaving={
                        updatingTaskDependenciesId === task.id ||
                        updatingTaskId === task.id
                      }
                      key={`${task.id}:${task.updatedAt}:${prerequisiteKey}`}
                      onSave={(prerequisiteIds) =>
                        onUpdateTaskDependencies(
                          task.id,
                          prerequisiteIds,
                        )
                      }
                      task={task}
                      tasks={recordTasks}
                    />
                  );
                })}
              </div>
            </details>
          ) : null}

          {!isEngagementReadOnly ? (
            <WorkflowTaskForm
              clientWorkflowRecordId={record.id}
              isSubmitting={isTaskSaving}
              onAddTask={onAddTask}
            />
          ) : null}
        </div>
      ) : null}

      {visibleActiveTab === "handoff" ? (
        <div className="mt-5">
          <h3 className="font-bold">Handoff Notes</h3>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            Notes that help a VA, assistant, or teammate continue
            the work with enough context.
          </p>
          {handoffMessage ? (
            <p className="mt-4 rounded-md bg-red-50 p-4 font-semibold text-red-700">
              {handoffMessage}
            </p>
          ) : null}
          {isHandoffLoading ? (
            <p className="mt-4 text-[#5F6862]">
              Loading handoff notes...
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {recordHandoffNotes.length > 0 ? (
                recordHandoffNotes.map((note) => (
                  <div
                    className="rounded-md border border-[#D9DED8] p-4"
                    key={note.id}
                  >
                    <p className="font-bold">{note.title}</p>
                    <p className="mt-2 leading-7 text-[#5F6862]">
                      {note.note}
                    </p>
                    <p className="mt-2 text-sm text-[#5F6862]">
                      Owner: {note.owner}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                  {isEngagementReadOnly
                    ? "No handoff notes were recorded for this job."
                    : "No handoff notes yet. Add context before delegating this client workflow."}
                </p>
              )}
            </div>
          )}

          {!isEngagementReadOnly ? (
            <HandoffNoteForm
              clientWorkflowRecordId={record.id}
              isSubmitting={isHandoffSaving}
              onAddNote={onAddHandoffNote}
            />
          ) : null}
        </div>
      ) : null}

      {visibleActiveTab === "activity" ? (
        <div className="mt-5">
          <h3 className="font-bold">Activity History</h3>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            A simple history of updates made to this workflow
            record.
          </p>
          {activityMessage ? (
            <p className="mt-4 rounded-md bg-red-50 p-4 font-semibold text-red-700">
              {activityMessage}
            </p>
          ) : null}
          {isActivityLoading ? (
            <p className="mt-4 text-[#5F6862]">
              Loading activity history...
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {recordLogs.length > 0 ? (
                recordLogs.map((log) => (
                  <div
                    className="rounded-md border border-[#D9DED8] p-4"
                    key={log.id}
                  >
                    <p className="font-bold">
                      {log.actionType}
                    </p>
                    <p className="mt-2 leading-7 text-[#5F6862]">
                      {log.note}
                    </p>
                    <p className="mt-2 text-sm text-[#5F6862]">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                  No activity has been logged for this record yet.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
