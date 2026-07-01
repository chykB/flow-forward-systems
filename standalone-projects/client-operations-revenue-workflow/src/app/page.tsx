import { ClientRecordCard } from "@/components/ClientRecordCard";
import { PriorityCard } from "@/components/PriorityCard";
import { PrioritySummaryRow } from "@/components/PrioritySummaryRow";
import {
  demoClientWorkflowRecords,
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

const prioritySections = [
  {
    title: "Overdue Follow-Ups",
    description: "Leads or clients that should have been followed up already.",
    count: getOverdueFollowUps(demoClientWorkflowRecords).length,
  },
  {
    title: "Follow-Ups Due Soon",
    description: "Upcoming follow-ups that need a clear next action.",
    count: getFollowUpsDueSoon(demoClientWorkflowRecords).length,
  },
  {
    title: "Approvals Waiting",
    description: "Client approvals that may block delivery progress.",
    count: getWaitingApprovals(demoClientWorkflowRecords).length,
  },
  {
    title: "Payment Follow-Up Needed",
    description: "Payment-related workflow items that need attention.",
    count: getPaymentFollowUps(demoClientWorkflowRecords).length,
  },
  {
    title: "Blocked Delivery",
    description: "Delivery tasks that cannot move forward yet.",
    count: getBlockedDeliveryTasks(demoWorkflowTasks).length,
  },
  {
    title: "At-Risk Clients",
    description: "Clients or leads with higher workflow risk.",
    count: getAtRiskClients(demoClientWorkflowRecords).length,
  },
];

export default function Home() {
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
              href="#records"
            >
              View Client Records
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[#D9DED8] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Today&apos;s Priority View</h2>
          <p className="mt-3 leading-7 text-[#5F6862]">
            Demo mode uses safe sample information so you can review the
            workflow without adding real client data.
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

      <section className="mx-auto max-w-6xl px-6 py-16" id="records">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            Client Workflow Records
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            Leads and clients in progress
          </h2>
          <p className="mt-4 leading-8 text-[#5F6862]">
            Each record shows the current stage, next action, owner, follow-up
            date, and risk level.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          {demoClientWorkflowRecords.map((record) => (
            <ClientRecordCard key={record.id} record={record} />
          ))}
        </div>
      </section>
    </main>
  );
}