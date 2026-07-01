import { HandoffNoteForm } from "@/components/HandoffNoteForm";
import { WorkflowTaskForm } from "@/components/WorkflowTaskForm";
import type {
  ActivityLog,
  ClientWorkflowRecord,
  HandoffNote,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import { RecordStatusControls } from "@/components/RecordStatusControls";
import { NextActionForm } from "@/components/NextActionForm";

type ClientRecordDetailProps = {
  activityLogs: ActivityLog[];
  handoffNotes: HandoffNote[];
  onAddHandoffNote: (note: HandoffNote) => void;
  onAddTask: (task: WorkflowTask) => void;
  record: ClientWorkflowRecord;
  tasks: WorkflowTask[];
  onUpdateRecord: (updates: Partial<ClientWorkflowRecord>, note: string) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#EDF3EF] p-4">
      <p className="text-sm font-bold text-[#17201C]">{label}</p>
      <p className="mt-1 leading-7 text-[#5F6862]">{value || "Not provided"}</p>
    </div>
  );
}

export function ClientRecordDetail({
  activityLogs,
  handoffNotes,
  onAddHandoffNote,
  onAddTask,
  record,
  tasks,
  onUpdateRecord,
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
      <div className="border-b border-[#D9DED8] pb-5">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          Selected Record
        </p>
        <h2 className="mt-3 text-2xl font-bold">{record.name}</h2>
        <p className="mt-1 text-[#5F6862]">{record.businessName}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <DetailRow label="Lifecycle stage" value={record.lifecycleStage} />
        <DetailRow label="Next action" value={record.nextAction} />
        <DetailRow label="Follow-up date" value={record.nextFollowUpAt} />
        <DetailRow label="Owner" value={record.assignedTo} />
        <DetailRow label="Onboarding" value={record.onboardingStatus} />
        <DetailRow label="Delivery" value={record.deliveryStatus} />
        <DetailRow label="Approval" value={record.approvalStatus} />
        <DetailRow label="Payment" value={record.paymentStatus} />
      </div>

        <RecordStatusControls record={record} onUpdateRecord={onUpdateRecord} />
        <NextActionForm record={record} onUpdateRecord={onUpdateRecord} />

      <div className="mt-6">
        <h3 className="font-bold">Work Items</h3>
        <p className="mt-2 text-sm leading-6 text-[#5F6862]">
        Supporting tasks for follow-up, onboarding, delivery, approvals, payments, or handoff.
        </p>
        <div className="mt-3 grid gap-3">
          {recordTasks.length > 0 ? (
            recordTasks.map((task) => (
              <div className="rounded-md border border-[#D9DED8] p-4" key={task.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{task.title}</p>
                    <p className="mt-1 text-sm text-[#5F6862]">
                      {task.type} · {task.owner}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#174F42]">
                    {task.status}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[#5F6862]">
                  Due: {task.dueDate} · Criticality: {task.criticality}
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

      <div className="mt-6">
        <h3 className="font-bold">Handoff Notes</h3>
        <div className="mt-3 grid gap-3">
          {recordHandoffNotes.length > 0 ? (
            recordHandoffNotes.map((note) => (
              <div className="rounded-md border border-[#D9DED8] p-4" key={note.id}>
                <p className="font-bold">{note.title}</p>
                <p className="mt-2 leading-7 text-[#5F6862]">{note.note}</p>
                <p className="mt-2 text-sm text-[#5F6862]">Owner: {note.owner}</p>
              </div>
            ))
          ) : (
            <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
              No handoff notes yet. Add context before delegating this client workflow.
            </p>
          )}
        </div>

        <HandoffNoteForm
          clientWorkflowRecordId={record.id}
          onAddNote={onAddHandoffNote}
        />
      </div>

      <div className="mt-6">
        <h3 className="font-bold">Activity History</h3>
        <div className="mt-3 grid gap-3">
          {recordLogs.length > 0 ? (
            recordLogs.map((log) => (
              <div className="rounded-md border border-[#D9DED8] p-4" key={log.id}>
                <p className="font-bold">{log.actionType}</p>
                <p className="mt-2 leading-7 text-[#5F6862]">{log.note}</p>
                <p className="mt-2 text-sm text-[#5F6862]">{log.createdAt}</p>
              </div>
            ))
          ) : (
            <p className="rounded-md bg-[#EDF3EF] p-4 text-[#5F6862]">
              No activity has been logged for this record yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}