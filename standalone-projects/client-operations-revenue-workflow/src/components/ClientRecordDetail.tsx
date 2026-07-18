"use client";


import { HandoffNoteForm } from "@/components/HandoffNoteForm";
import { NextActionForm } from "@/components/NextActionForm";
import { ProposalPanel } from "@/components/ProposalPanel";
import { RecordStatusControls } from "@/components/RecordStatusControls";
import { WorkflowTaskForm } from "@/components/WorkflowTaskForm";
import { formatDateTime } from "@/lib/format-date";
import { InvoicePanel } from "@/components/InvoicePanel";
import type { NewInvoiceRecord, InvoiceRecordUpdates } from "@/lib/supabase/invoice-records";
import { RiskSignalPanel } from "@/components/RiskSignalPanel";
import { WorkflowTaskStatusEditor } from "@/components/WorkflowTaskStatusEditor";
import type {
  WorkflowTaskStatusUpdate,
} from "@/lib/supabase/workflow-tasks";
import type {
  InvoiceWorkflowRecommendation as InvoiceRecommendationData,
} from "@/lib/invoice-workflow";
import type {
  ProposalWorkflowRecommendation as ProposalWorkflowRecommendationData,
} from "@/lib/proposal-workflow";
import type {
  ActivityLog,
  ClientWorkflowRecord,
  HandoffNote,
  InvoiceRecord,
  ProposalRecord,
  RiskSignal,
  WorkflowTask,

} from "@/lib/client-workflow-types";
import type {
  RiskSignalStatusUpdate,
} from "@/lib/supabase/risk-signals";
import type {
  NewProposalRecord,
  ProposalRecordUpdates,
} from "@/lib/supabase/proposal-records";
import type {
  NewHandoffNote,
} from "@/lib/supabase/handoff-notes";
import type {
  NewWorkflowTask,
} from "@/lib/supabase/workflow-tasks";

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
  handoffNotes: HandoffNote[];
  isProposalLoading: boolean;
  isProposalSaving: boolean;
  onAddHandoffNote: (
    note: NewHandoffNote,
  ) => Promise<void>;
  isHandoffSaving: boolean;
  onAddProposal: (proposal: NewProposalRecord) => Promise<void>;
  onAddTask: (task: NewWorkflowTask) => Promise<void>;
  onUpdateProposal: (
    proposalId: string,
    updates: ProposalRecordUpdates,
  ) => Promise<void>;
  onUpdateRecord: (
    updates: Partial<ClientWorkflowRecord>,
    note: string,
  ) => void;
  proposalMessage: string;
  proposals: ProposalRecord[];
  record: ClientWorkflowRecord;
  tasks: WorkflowTask[];
  tasksMessage: string;
  isTasksLoading: boolean;
  isTaskSaving: boolean;
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
  updatingTaskId: string | null;
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

export function ClientRecordDetail({
  activeTab,
  onTabChange,
  activityLogs,
  handoffNotes,
  invoiceMessage,
  invoices,
  isInvoiceLoading,
  isInvoiceSaving,
  isProposalLoading,
  isProposalSaving,
  onAddHandoffNote,
  onAddInvoice,
  onUpdateInvoice,
  onAddProposal,
  onAddTask,
  onApplyProposalRecommendation,
  onUpdateProposal,
  onUpdateRecord,
  proposalMessage,
  proposals,
  record,
  tasks,
  tasksMessage,
  isTasksLoading,
  isTaskSaving,
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
  updatingTaskId,
}: ClientRecordDetailProps) {


  const recordTasks = tasks.filter(
    (task) => task.clientWorkflowRecordId === record.id,
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
            {record.workflowHealthScore}/100 health
          </span>
          <span
            className={`rounded-md px-3 py-2 text-sm font-bold ${getRiskClasses(
              record.riskLevel,
            )}`}
          >
            {record.riskLevel} risk
          </span>
        </div>
      </div>

      <div
        aria-label="Client record sections"
        className="mt-5 flex gap-2 overflow-x-auto border-b border-[#D9DED8] pb-3 lg:flex-wrap lg:overflow-visible"
        role="tablist"
      >
        {detailTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold ${
              activeTab === tab.key
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

      {activeTab === "overview" ? (
        <div className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailRow
              label="Workflow stage"
              value={record.lifecycleStage}
            />
            <DetailRow
              label="Next action"
              value={record.nextAction}
            />
            <DetailRow
              label="Follow-up date"
              value={record.nextFollowUpAt}
            />
            <DetailRow
              label="Owner"
              value={record.assignedTo}
            />
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

          <RecordStatusControls
            record={record}
            onUpdateRecord={onUpdateRecord}
          />
        </div>
      ) : null}
      {activeTab === "workflow-health" ? (
        <div className="mt-5">
          <RiskSignalPanel
            errorMessage={riskSignalMessage}
            isLoading={isRiskSignalsLoading}
            isSaving={isRiskSignalSaving}
            onUpdateStatus={onUpdateRiskSignalStatus}
            record={record}
            riskSignals={riskSignals}
          />
        </div>
      ) : null}

      {activeTab === "next-action" ? (
        <div className="mt-5">
          <div className="rounded-md bg-[#EDF3EF] p-4">
            <h3 className="font-bold">Current Next Action</h3>
            <p className="mt-2 leading-7 text-[#5F6862]">
              {record.nextAction}
            </p>
            <p className="mt-2 text-sm text-[#5F6862]">
              Follow-up: {record.nextFollowUpAt} | Owner:{" "}
              {record.assignedTo}
            </p>
          </div>

          <NextActionForm
            record={record}
            onUpdateRecord={onUpdateRecord}
          />
        </div>
      ) : null}

      {activeTab === "proposals" ? (
        <div className="mt-5">
          <ProposalPanel
            clientWorkflowRecordId={record.id}
            errorMessage={proposalMessage}
            isApplyingRecommendation={
              isApplyingProposalRecommendation
            }
            isLoading={isProposalLoading}
            isSaving={isProposalSaving}
            onApplyRecommendation={
              onApplyProposalRecommendation
            }
            onCreate={onAddProposal}
            onUpdate={onUpdateProposal}
            proposals={proposals}
            record={record}
          />
        </div>
      ) : null}

      {activeTab === "invoices" ? (
      <div className="mt-5">
        <InvoicePanel
          clientWorkflowRecordId={record.id}
          errorMessage={invoiceMessage}
          invoices={invoices}
          isLoading={isInvoiceLoading}
          isSaving={isInvoiceSaving}
          onCreate={onAddInvoice}
          onUpdate={onUpdateInvoice}
          isApplyingRecommendation={
            isApplyingInvoiceRecommendation
          }
          onApplyRecommendation={
            onApplyInvoiceRecommendation
          }
          record={record}
        />
      </div>
    ) : null}

      {activeTab === "work-items" ? (
        <div className="mt-5">
          <h3 className="font-bold">Work Items</h3>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            Supporting tasks for follow-up, onboarding, delivery,
            approvals, payments, or handoff.
          </p>

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
              {recordTasks.length > 0 ? (
                recordTasks.map((task) => (
                  <div
                    className="rounded-md border border-[#D9DED8] p-4"
                    key={task.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">{task.title}</p>
                        <p className="mt-1 text-sm text-[#5F6862]">
                          {task.type} | {task.owner}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-[#174F42]">
                        {task.status}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-[#5F6862]">
                      Due: {task.dueDate} | Criticality:{" "}
                      {task.criticality}
                    </p>
                    <WorkflowTaskStatusEditor
                      isSaving={updatingTaskId === task.id}
                      onUpdateStatus={(update) =>
                        onUpdateTaskStatus(task.id, update)
                      }
                      task={task}
                    />
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                  No work items added yet.
                </p>
              )}
            </div>
          )}

          <WorkflowTaskForm
            clientWorkflowRecordId={record.id}
            isSubmitting={isTaskSaving}
            onAddTask={onAddTask}
          />
        </div>
      ) : null}

      {activeTab === "handoff" ? (
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
                  No handoff notes yet. Add context before
                  delegating this client workflow.
                </p>
              )}
            </div>
          )}

          <HandoffNoteForm
            clientWorkflowRecordId={record.id}
            isSubmitting={isHandoffSaving}
            onAddNote={onAddHandoffNote}
          />
        </div>
      ) : null}

      {activeTab === "activity" ? (
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
