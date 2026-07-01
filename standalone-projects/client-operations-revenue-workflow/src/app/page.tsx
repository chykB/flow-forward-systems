"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function Home() {
    const [records, setRecords] = useState<ClientWorkflowRecord[]>(() =>
      readStoredValue(storageKeys.records, demoClientWorkflowRecords),
    );
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
      readStoredValue(storageKeys.activityLogs, demoActivityLogs),
    );
    const [handoffNotes, setHandoffNotes] = useState<HandoffNote[]>(() =>
      readStoredValue(storageKeys.handoffNotes, demoHandoffNotes),
    );
    const [workflowTasks, setWorkflowTasks] = useState<WorkflowTask[]>(() =>
      readStoredValue(storageKeys.tasks, demoWorkflowTasks),
    );
    const [selectedRecordId, setSelectedRecordId] = useState(() => {
      const storedRecords = readStoredValue(
        storageKeys.records,
        demoClientWorkflowRecords,
      );

      return storedRecords[0]?.id;
    });
  

    

    useEffect(() => {
      writeStoredValue(storageKeys.records, records);
    }, [records]);

    useEffect(() => {
      writeStoredValue(storageKeys.activityLogs, activityLogs);
    }, [activityLogs]);

    useEffect(() => {
      writeStoredValue(storageKeys.handoffNotes, handoffNotes);
    }, [handoffNotes]);

    useEffect(() => {
      writeStoredValue(storageKeys.tasks, workflowTasks);
    }, [workflowTasks]);
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
              href="#add-record"
            >
              Add Lead Or Client
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

      <section className="mx-auto max-w-6xl px-6 py-16" id="add-record">
        <ClientRecordForm onAddRecord={addRecord} />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" id="records">
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