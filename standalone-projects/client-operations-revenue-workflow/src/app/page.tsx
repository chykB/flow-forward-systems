"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ClientRecordCard } from "@/components/ClientRecordCard";
import { ClientRecordDetail } from "@/components/ClientRecordDetail";
import { ClientRecordForm } from "@/components/ClientRecordForm";
import { PriorityCard } from "@/components/PriorityCard";
import { PrioritySummaryRow } from "@/components/PrioritySummaryRow";
import type {
  ActivityLog,
  ClientWorkflowRecord,
  HandoffNote,
  WorkflowTask,
} from "@/lib/client-workflow-types";
import {
  demoActivityLogs,
  demoClientWorkflowRecords,
  demoHandoffNotes,
  demoWorkflowTasks,
} from "@/lib/demo-data";
import {
  getAtRiskClients,
  getBlockedDeliveryTasks,
  getFollowUpsDueSoon,
  getOverdueFollowUps,
  getPaymentFollowUps,
  getWaitingApprovals,
} from "@/lib/dashboard";

const storageKeys = {
  activityLogs: "client-ops-activity-logs",
  handoffNotes: "client-ops-handoff-notes",
  records: "client-ops-records",
  tasks: "client-ops-tasks",
};

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

export default function Home() {
    const [records, setRecords] = useStoredState<ClientWorkflowRecord[]>(
      storageKeys.records,
      demoClientWorkflowRecords,
    );
    const [activityLogs, setActivityLogs] = useStoredState<ActivityLog[]>(
      storageKeys.activityLogs,
      demoActivityLogs,
    );
    const [handoffNotes, setHandoffNotes] = useStoredState<HandoffNote[]>(
      storageKeys.handoffNotes,
      demoHandoffNotes,
    );
    const [workflowTasks, setWorkflowTasks] = useStoredState<WorkflowTask[]>(
      storageKeys.tasks,
      demoWorkflowTasks,
    );
    const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState(records[0]?.id);
        
  const prioritySections = useMemo(
    () => buildPrioritySections(records, workflowTasks),
    [records, workflowTasks],
  );

  const selectedRecord =
    records.find((record) => record.id === selectedRecordId) || records[0];

  function addRecord(record: ClientWorkflowRecord) {
    const now = new Date().toISOString();

    setRecords((currentRecords) => [record, ...currentRecords]);
    setActivityLogs((currentLogs) => [
      {
        id: `log-${Date.now()}`,
        clientWorkflowRecordId: record.id,
        actionType: "Record created",
        note: `${record.name} was added to the workflow with next action: ${record.nextAction}.`,
        createdAt: now,
      },
      ...currentLogs,
    ]);
    setSelectedRecordId(record.id);
    setIsAddRecordOpen(false);
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

  function resetDemoData() {
    setRecords(demoClientWorkflowRecords);
    setActivityLogs(demoActivityLogs);
    setHandoffNotes(demoHandoffNotes);
    setWorkflowTasks(demoWorkflowTasks);
    setSelectedRecordId(demoClientWorkflowRecords[0]?.id);
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#17201C]">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-10 px-6 py-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            Client Operations & Revenue Workflow
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Know what needs attention before client work slips.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5F6862]">
            Manage leads, clients, follow-ups, onboarding, delivery,
            approvals, payment follow-up, client risk, and handoff notes in one
            focused workflow system.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="rounded-md bg-[#174F42] px-5 py-3 text-center font-bold text-white hover:bg-[#1F6F5B]"
              href="#work-queue"
            >
              View Today&apos;s Work Queue
            </a>
            <a
              className="rounded-md border border-[#174F42] px-5 py-3 text-center font-bold text-[#174F42] hover:bg-white"
              href="#workspace"
            >
              Open Workspace
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[#D9DED8] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Today&apos;s Priority View</h2>
          <p className="mt-3 leading-7 text-[#5F6862]">
            Demo mode uses safe sample information. Changes are saved in this
            browser so you can refresh and keep testing the workflow.
          </p>

          <div className="mt-6 grid gap-3">
            {prioritySections.slice(0, 3).map((section) => (
              <PrioritySummaryRow
                count={section.count}
                description={section.description}
                key={section.title}
                title={section.title}
              />
            ))}
          </div>

          <button
            className="mt-5 rounded-md border border-[#174F42] px-5 py-3 font-bold text-[#174F42] hover:bg-[#EDF3EF]"
            type="button"
            onClick={resetDemoData}
          >
            Reset Demo Data
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" id="work-queue">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            Today&apos;s Work Queue
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            What needs attention today
          </h2>
          <p className="mt-4 leading-8 text-[#5F6862]">
            The work queue groups leads and clients by follow-up, approval,
            payment, delivery, and risk signals so the next action is easier to
            see.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
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

      <section className="mx-auto max-w-6xl px-6 py-16" id="workspace">
        <div className="flex flex-col gap-4 rounded-lg border border-[#D9DED8] bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
              Workspace
            </p>
            <h2 className="mt-3 text-2xl font-bold">Manage client workflow records</h2>
            <p className="mt-2 leading-7 text-[#5F6862]">
              Review current records, add a new lead or client, and update the work that needs attention.
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
            Select a record to review the workflow status, tasks, handoff notes,
            and activity history.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-start gap-4">
            {records.map((record) => (
              <ClientRecordCard
                isSelected={record.id === selectedRecord?.id}
                key={record.id}
                onSelect={() => setSelectedRecordId(record.id)}
                record={record}
              />
            ))}
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
      </section>
    </main>
  );
}