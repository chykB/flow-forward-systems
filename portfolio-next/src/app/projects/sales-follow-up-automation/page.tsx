import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description: "Serious standalone deployed project.",
  },
  {
    title: "Agentic Level",
    description:
      "Medium. The current V1 prototype is rule-based, but the planned version can use AI to summarize lead context, suggest priority, recommend next actions, and support human-reviewed follow-up.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1 portfolio prototype is available through the homepage Sales Follow-Up Sequence Generator. A standalone deployed demo is planned for a later phase.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Current homepage tool prototype. GitHub/code: Planned. Screenshots or walkthrough: Planned. Architecture diagram: Planned.",
  },
];

export default function SalesFollowUpAutomationPage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Project Hub + Demo Case Study"
          title="Sales Follow-Up Automation System"
          description="A workflow project for reducing missed leads, improving follow-up consistency, and helping small businesses respond faster to sales opportunities."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The Sales Follow-Up Automation System helps a business capture
              lead information, track lead stage, generate follow-up steps, and
              reduce the chance that warm leads are forgotten.
            </p>
            <p>
              In the current V1 prototype, the project is represented by a
              static project page and a working rule-based follow-up generator
              in the browser.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Small businesses often lose leads because follow-up is manual,
              inconsistent, or forgotten. A lead may come from a website form,
              social media message, referral, or email, but without a simple
              tracking process, the next step depends on memory.
            </p>
            <p>
              This creates revenue leakage through delayed replies, missed
              follow-ups, unclear lead status, and poor visibility into which
              inquiries need attention.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current State"
              description="A lead sends an inquiry, someone reads it manually, decides what to reply, and tries to remember when to follow up. Lead status may live in email, WhatsApp, spreadsheets, or memory."
            />
            <InfoCard
              title="Common Failure Points"
              description="Follow-ups are delayed, lead quality is unclear, proposals are not tracked, and warm leads may go cold because there is no reminder or owner for the next action."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Trigger"
              description="A new lead is captured from a form, message, or manual entry."
            />
            <InfoCard
              title="Workflow Steps"
              description="The lead is added to a tracker, assigned a status, given a next follow-up date, and connected to a simple follow-up sequence. The system can later use AI to summarize the inquiry, suggest priority, and draft a response for review."
            />
            <InfoCard
              title="Final Outcome"
              description="The business has clearer lead visibility, fewer forgotten conversations, and a repeatable follow-up process."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Current V1 Functionality">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Rule-Based Follow-Up Generator"
              description="The current tool asks for business type, offer, lead stage, and tone. It generates a simple follow-up sequence, reminder schedule, human review point, and suggested next action."
            />
            <InfoCard
              title="Static Project Page"
              description="This page explains the business problem, workflow design, AI role, human review point, value estimate, showcase status, and future production path."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Future Production Functionality">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Lead Capture"
              description="A form captures name, email, business type, offer interest, lead source, and current challenge."
            />
            <InfoCard
              title="Lead Tracker"
              description="Each lead receives a status such as new, reviewed, qualified, needs follow-up, call booked, proposal sent, won, lost, or nurture."
            />
            <InfoCard
              title="AI-Assisted Follow-Up"
              description="AI summarizes the inquiry, suggests lead priority, and drafts a follow-up message for human review."
            />
            <InfoCard
              title="Automation And Audit Log"
              description="Future workflow events can be logged so the business can see when a lead was captured, reviewed, followed up, and moved to the next stage."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Tools And Tech Stack">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current V1 Stack"
              description="HTML, CSS, and JavaScript. The current prototype runs fully in the browser."
            />
            <InfoCard
              title="Future Stack"
              description="Next.js and TypeScript for the frontend, Python and FastAPI for backend workflow logic, PostgreSQL or DynamoDB for lead data, and AWS services for deployment and monitoring."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can summarize lead details, classify lead quality, suggest
            priority, and draft follow-up messages. In V1, this is represented
            with rule-based browser output. In later versions, AI would run
            server-side with validation, rate limits, and human review.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should review messages before sending, especially for
            high-value leads, sensitive requests, custom pricing, complaints,
            refunds, or proposals that affect trust and revenue.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Revenue Protection"
              description="Reduces lost leads by making follow-up visible, scheduled, and repeatable."
            />
            <InfoCard
              title="Conversion Support"
              description="Improves conversion from existing inquiries by reducing delayed responses and forgotten conversations."
            />
            <InfoCard
              title="Time Savings"
              description="Reduces manual tracking and repeated message drafting for common lead follow-up scenarios."
            />
            <InfoCard
              title="Operational Visibility"
              description="Makes it easier to see which leads are new, waiting, followed up, proposal-sent, won, lost, or in nurture."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1 Constraints"
              description="This page is a static demo and does not store lead data. No backend, database, AI API, or authentication is used in V1."
            />
            <InfoCard
              title="Future Reliability"
              description="A production version should validate lead inputs, avoid duplicate lead records, log follow-up events, and handle failed notifications safely."
            />
            <InfoCard
              title="Data Protection"
              description="The system should collect only necessary lead data and avoid storing sensitive information in public frontend code."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Current proof: the homepage includes a working browser-based Sales
            Follow-Up Sequence Generator. Screenshots or walkthrough notes can
            be added after the V1.2 project pages are complete.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This project shows how a simple sales problem can become a workflow
            system with triggers, status tracking, reminders, AI-assisted
            drafting, human review, and future auditability.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V2"
              description="Add a real lead capture form, save submissions, and send an email notification when a new lead arrives."
            />
            <InfoCard
              title="V3"
              description="Add server-side AI to summarize inquiries, classify lead priority, and generate structured follow-up recommendations."
            />
            <InfoCard
              title="V4"
              description="Add webhook-driven lead events, audit logs, retry handling, and human approval before customer-facing messages are sent."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to Workflow Audit, Workflow Automation
              Setup, AI-Assisted Workflow Setup, and RevOps Automation services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Book a workflow audit
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}