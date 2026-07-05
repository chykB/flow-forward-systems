"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ClientRecordCard } from "@/components/ClientRecordCard";
import { ClientRecordDetail } from "@/components/ClientRecordDetail";
import { ClientRecordForm } from "@/components/ClientRecordForm";
import { PriorityCard } from "@/components/PriorityCard";
import { RecordFiltersBar } from "@/components/RecordFiltersBar";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import {
  createClientWorkflowRecord,
  getClientWorkflowRecords,
} from "@/lib/supabase/client-workflow-records";
import type {
  ActivityLog,
  ClientWorkflowRecord,
  HandoffNote,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import {
  getAtRiskClients,
  getBlockedDeliveryTasks,
  getFollowUpsDueSoon,
  getOverdueFollowUps,
  getPaymentFollowUps,
  getWaitingApprovals,
} from "@/lib/dashboard";
import {
  filterRecords,
  getRecordOwners,
  initialRecordFilters,
} from "@/lib/record-filters";

function buildPrioritySections(
  records: ClientWorkflowRecord[],
  tasks: WorkflowTask[],
) {
  return [
    {
      title: "Overdue Follow-Ups",
      description: "Leads or clients that should have been followed up already.",
      count: getOverdueFollowUps(records).length,
    },
    {
      title: "Follow-Ups Due Soon",
      description: "Upcoming follow-ups that need a clear next action.",
      count: getFollowUpsDueSoon(records).length,
    },
    {
      title: "Approvals Waiting",
      description: "Client approvals that may block delivery progress.",
      count: getWaitingApprovals(records).length,
    },
    {
      title: "Payment Follow-Up Needed",
      description: "Payment-related workflow items that need attention.",
      count: getPaymentFollowUps(records).length,
    },
    {
      title: "Blocked Delivery",
      description: "Delivery tasks that cannot move forward yet.",
      count: getBlockedDeliveryTasks(tasks).length,
    },
    {
      title: "At-Risk Clients",
      description: "Clients or leads with higher workflow risk.",
      count: getAtRiskClients(records).length,
    },
  ];
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return fallback;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function subscribeToStoredState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("client-ops-storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("client-ops-storage", onStoreChange);
  };
}

function notifyStoredStateChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("client-ops-storage"));
}

function getStoredSnapshot<T>(key: string, fallback: T) {
  return JSON.stringify(readStoredValue(key, fallback));
}

function useStoredState<T>(key: string, fallback: T) {
  const snapshot = useSyncExternalStore(
    subscribeToStoredState,
    () => getStoredSnapshot(key, fallback),
    () => JSON.stringify(fallback),
  );

  const value = useMemo(() => JSON.parse(snapshot) as T, [snapshot]);

  function setStoredValue(valueOrUpdater: T | ((currentValue: T) => T)) {
    const currentValue = readStoredValue(key, fallback);
    const nextValue =
      typeof valueOrUpdater === "function"
        ? (valueOrUpdater as (currentValue: T) => T)(currentValue)
        : valueOrUpdater;

    writeStoredValue(key, nextValue);
    notifyStoredStateChanged();
  }

  return [value, setStoredValue] as const;
}

type WorkspaceDashboardProps = {
  workspaceId: string;
};

function WorkspaceDashboard({ workspaceId }: WorkspaceDashboardProps) {
  const storageKeys = useMemo(
    () => ({
      activityLogs: `client-ops:${workspaceId}:activity-logs`,
      handoffNotes: `client-ops:${workspaceId}:handoff-notes`,
      records: `client-ops:${workspaceId}:records`,
      tasks: `client-ops:${workspaceId}:tasks`,
    }),
    [workspaceId],
  );
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [records, setRecords] = useState<ClientWorkflowRecord[]>([]);
  const [recordsStatus, setRecordsStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [recordsMessage, setRecordsMessage] = useState("");

  const [activityLogs, setActivityLogs] = useStoredState<ActivityLog[]>(
    storageKeys.activityLogs,
    [],
  );
  const [handoffNotes, setHandoffNotes] = useStoredState<HandoffNote[]>(
    storageKeys.handoffNotes,
    [],
  );
  const [workflowTasks, setWorkflowTasks] = useStoredState<WorkflowTask[]>(
    storageKeys.tasks,
    [],
  );
  const [recordFilters, setRecordFilters] = useState(initialRecordFilters);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(
    records[0]?.id,
  );

  const filteredRecords = useMemo(
    () => filterRecords(records, recordFilters),
    [recordFilters, records],
  );

  const recordOwners = useMemo(() => getRecordOwners(records), [records]);

  const prioritySections = useMemo(
    () => buildPrioritySections(records, workflowTasks),
    [records, workflowTasks],
  );

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ||
    filteredRecords[0] ||
    null;

  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      setRecordsStatus("loading");
      setRecordsMessage("");

      try {
        const workspaceRecords = await getClientWorkflowRecords(
          supabase,
          workspaceId,
        );

        if (!isMounted) {
          return;
        }

        setRecords(workspaceRecords);
        setSelectedRecordId(workspaceRecords[0]?.id);
        setRecordsStatus("ready");
      } catch {
        if (!isMounted) {
          return;
        }

        setRecordsStatus("error");
        setRecordsMessage("Workspace records could not be loaded. Refresh and try again.");
      }
    }

    void loadRecords();

    return () => {
      isMounted = false;
    };
  }, [supabase, workspaceId]);
  
  async function addRecord(record: ClientWorkflowRecord) {
    const now = new Date().toISOString();

    try {
      const savedRecord = await createClientWorkflowRecord(
        supabase,
        workspaceId,
        record,
      );

      setRecords((currentRecords) => [savedRecord, ...currentRecords]);

      setActivityLogs((currentLogs) => [
        {
          id: `log-${Date.now()}`,
          clientWorkflowRecordId: savedRecord.id,
          actionType: "Record created",
          note: `${savedRecord.name} was added to the workflow with next action: ${savedRecord.nextAction}.`,
          createdAt: now,
        },
        ...currentLogs,
      ]);
      
      setRecordFilters(initialRecordFilters);
      setSelectedRecordId(savedRecord.id);
      setIsAddRecordOpen(false);
      setRecordsMessage("");
      } catch (error) {
        console.error("Create client workflow record failed", error);

        setRecordsMessage(
          error instanceof Error
            ? error.message
            : "The record could not be saved. Please try again.",
        );
      }
  }

  function addHandoffNote(note: HandoffNote) {
    const now = new Date().toISOString();

    setHandoffNotes((currentNotes) => [note, ...currentNotes]);
    setActivityLogs((currentLogs) => [
      {
        id: `log-${Date.now()}`,
        clientWorkflowRecordId: note.clientWorkflowRecordId,
        actionType: "Handoff note added",
        note: `${note.title} was added for delegation context.`,
        createdAt: now,
      },
      ...currentLogs,
    ]);
  }

  function addWorkflowTask(task: WorkflowTask) {
    const now = new Date().toISOString();

    setWorkflowTasks((currentTasks) => [task, ...currentTasks]);
    setActivityLogs((currentLogs) => [
      {
        id: `log-${Date.now()}`,
        clientWorkflowRecordId: task.clientWorkflowRecordId,
        actionType: "Work item added",
        note: `${task.title} was added as a ${task.type.toLowerCase()} work item.`,
        createdAt: now,
      },
      ...currentLogs,
    ]);
  }

  function updateSelectedRecord(
    updates: Partial<ClientWorkflowRecord>,
    note: string,
  ) {
    if (!selectedRecord) {
      return;
    }

    const now = new Date().toISOString();

    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === selectedRecord.id
          ? {
              ...record,
              ...updates,
              updatedAt: now,
            }
          : record,
      ),
    );

    setActivityLogs((currentLogs) => [
      {
        id: `log-${Date.now()}`,
        clientWorkflowRecordId: selectedRecord.id,
        actionType: "Workflow status updated",
        note,
        createdAt: now,
      },
      ...currentLogs,
    ]);
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#17201C]">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
          Today&apos;s Priority View
        </p>
        <h2 className="mt-3 text-3xl font-bold">What needs attention today</h2>
        <p className="mt-3 max-w-3xl leading-7 text-[#5F6862]">
          Review follow-ups, approvals, payments, delivery blockers, and client risks
          before moving into individual records.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12" id="work-queue">
        <div className="grid gap-4 md:grid-cols-3">
          {prioritySections.map((section) => (
            <PriorityCard
              count={section.count}
              description={section.description}
              key={section.title}
              title={section.title}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10" id="workspace">
        <div className="flex flex-col gap-4 rounded-lg border border-[#D9DED8] bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
              Client Records
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              Manage leads and client work
            </h2>
            <p className="mt-2 leading-7 text-[#5F6862]">
              Add leads or clients, then track next actions, work items,
              handoff notes, and activity history.
            </p>
          </div>

          <button
            className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
            type="button"
            onClick={() => setIsAddRecordOpen((isOpen) => !isOpen)}
          >
            {isAddRecordOpen ? "Close Form" : "Add Lead Or Client"}
          </button>
        </div>

        {isAddRecordOpen ? (
          <div className="mt-5">
            <ClientRecordForm onAddRecord={addRecord} />
          </div>
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16" id="records">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            Client Workflow Records
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            Leads and clients in progress
          </h2>
          <p className="mt-4 leading-8 text-[#5F6862]">
            Select a record to review workflow status, work items, handoff
            notes, and activity history.
          </p>
        </div>

        {records.length > 0 ? (
          <div className="mt-8">
            <RecordFiltersBar
              filters={recordFilters}
              onChange={setRecordFilters}
              owners={recordOwners}
            />
          </div>
        ) : null}
        {recordsMessage ? (
          <p className="mt-5 rounded-md bg-white p-4 font-semibold text-red-700">
            {recordsMessage}
          </p>
        ) : null}
        {recordsStatus === "loading" ? (
          <div className="mt-8 rounded-lg border border-[#D9DED8] bg-white p-6">
            <h3 className="text-2xl font-bold text-[#17201C]">
              Loading client records
            </h3>
            <p className="mt-3 leading-7 text-[#5F6862]">
              Checking this workspace for saved leads and client workflow records.
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className="mt-8 rounded-lg border border-[#D9DED8] bg-white p-6">
            <h3 className="text-2xl font-bold text-[#17201C]">
              No client records yet
            </h3>
            <p className="mt-3 max-w-2xl leading-7 text-[#5F6862]">
              Add your first lead or client to start tracking follow-ups, work
              items, handoff notes, and activity history.
            </p>
            <button
              className="mt-5 rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
              type="button"
              onClick={() => setIsAddRecordOpen(true)}
            >
              Add First Lead Or Client
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid content-start gap-4">
              {filteredRecords.map((record) => (
                <ClientRecordCard
                  isSelected={record.id === selectedRecord?.id}
                  key={record.id}
                  onSelect={() => setSelectedRecordId(record.id)}
                  record={record}
                />
              ))}

              {filteredRecords.length === 0 ? (
                <p className="rounded-lg border border-[#D9DED8] bg-white p-5 text-[#5F6862]">
                  No records match the current filters.
                </p>
              ) : null}
            </div>

            {selectedRecord ? (
              <ClientRecordDetail
                activityLogs={activityLogs}
                handoffNotes={handoffNotes}
                onAddHandoffNote={addHandoffNote}
                onAddTask={addWorkflowTask}
                onUpdateRecord={updateSelectedRecord}
                record={selectedRecord}
                tasks={workflowTasks}
              />
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <WorkspaceGate>
      {({ workspace }) =>
        workspace ? (
          <WorkspaceDashboard key={workspace.id} workspaceId={workspace.id} />
        ) : null
      }
    </WorkspaceGate>
  );
}