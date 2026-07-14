"use client";

import { useState } from "react";
import { HandoffNoteForm } from "@/components/HandoffNoteForm";
import { NextActionForm } from "@/components/NextActionForm";
import { ProposalPanel } from "@/components/ProposalPanel";
import { RecordStatusControls } from "@/components/RecordStatusControls";
import { WorkflowTaskForm } from "@/components/WorkflowTaskForm";
import { formatDateTime } from "@/lib/format-date";
import { InvoicePanel } from "@/components/InvoicePanel";
import type { NewInvoiceRecord, InvoiceRecordUpdates } from "@/lib/supabase/invoice-records";
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
  WorkflowTask,
} from "@/lib/client-workflow-types";
import type {
  NewProposalRecord,
  ProposalRecordUpdates,
} from "@/lib/supabase/proposal-records";

type DetailTab =
  | "overview"
  | "next-action"
  | "proposals"
  | "work-items"
  | "handoff"
  | "activity"
  | "invoices"
  ;

type ClientRecordDetailProps = {
  activityLogs: ActivityLog[];
  handoffNotes: HandoffNote[];
  isProposalLoading: boolean;
  isProposalSaving: boolean;
  onAddHandoffNote: (note: HandoffNote) => void;
  onAddProposal: (proposal: NewProposalRecord) => Promise<void>;
  onAddTask: (task: WorkflowTask) => void;
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
  };

const detailTabs: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
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
    <div className="rounded-md bg-[#EDF3EF] p-4">
      <p className="text-sm font-bold text-[#17201C]">{label}</p>
      <p className="mt-1 leading-7 text-[#5F6862]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export function ClientRecordDetail({
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
  isApplyingProposalRecommendation,
  isApplyingInvoiceRecommendation,
  onApplyInvoiceRecommendation,
}: ClientRecordDetailProps) {
  const [activeTab, setActiveTab] =
    useState<DetailTab>("overview");

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
      <div className="border-b border-[#D9DED8] pb-5">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          Selected Record
        </p>
        <h2 className="mt-3 text-2xl font-bold">
          {record.name}
        </h2>
        <p className="mt-1 text-[#5F6862]">
          {record.businessName}
        </p>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#D9DED8] pb-3">
        {detailTabs.map((tab) => (
          <button
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold ${
              activeTab === tab.key
                ? "bg-[#174F42] text-white"
                : "bg-[#EDF3EF] text-[#17201C] hover:bg-[#D9DED8]"
            }`}
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailRow
              label="Lifecycle stage"
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
            <DetailRow
              label="Onboarding"
              value={record.onboardingStatus}
            />
            <DetailRow
              label="Delivery"
              value={record.deliveryStatus}
            />
            <DetailRow
              label="Approval"
              value={record.approvalStatus}
            />
            <DetailRow
              label="Payment"
              value={record.paymentStatus}
            />
          </div>

          <RecordStatusControls
            record={record}
            onUpdateRecord={onUpdateRecord}
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
                </div>
              ))
            ) : (
              <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
                No work items added yet.
              </p>
            )}
          </div>

          <WorkflowTaskForm
            clientWorkflowRecordId={record.id}
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

          <HandoffNoteForm
            clientWorkflowRecordId={record.id}
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

          <div className="mt-3 grid gap-3">
            {recordLogs.length > 0 ? (
              recordLogs.map((log) => (
                <div
                  className="rounded-md border border-[#D9DED8] p-4"
                  key={log.id}
                >
                  <p className="font-bold">{log.actionType}</p>
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
        </div>
      ) : null}
    </section>
  );
}