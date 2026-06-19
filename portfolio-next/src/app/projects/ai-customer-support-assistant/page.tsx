import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description: "Standalone demo app.",
  },
  {
    title: "Agentic Level",
    description:
      "Low first, medium later. The first demo can classify and route support messages with rule-based logic. Later versions can use AI to summarize context, detect urgency, draft responses, and recommend next actions.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1.2 project page and specification available. Rule-based support triage demo planned as the next standalone prototype.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Planned. GitHub/code: Planned. Screenshots or walkthrough: Planned. Architecture diagram: Planned.",
  },
];

export default function AiCustomerSupportAssistantPage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Project Hub + Demo Case Study"
          title="AI Customer Support Assistant"
          description="A support workflow project for classifying customer messages, identifying urgency, preparing response drafts, and keeping human review in sensitive cases."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The AI Customer Support Assistant helps teams sort incoming
              customer messages, identify urgency, prepare draft responses, and
              keep sensitive cases under human review.
            </p>
            <p>
              The first planned demo will use rule-based logic to classify
              messages before any AI API is added.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Customer messages are often slow to sort, prioritize, and answer.
              Support requests may arrive through email, forms, chat, social
              media, or messaging apps, and teams can lose time deciding what is
              urgent and who should respond.
            </p>
            <p>
              This creates delayed replies, inconsistent service quality, missed
              complaints, and unnecessary pressure on support staff.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current State"
              description="A customer sends a message, a team member reads it manually, decides the issue type, judges urgency, drafts a response, and decides whether to escalate."
            />
            <InfoCard
              title="Common Failure Points"
              description="Urgent messages may be missed, complaints may not be escalated quickly, repetitive questions consume time, and response quality may vary across team members."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Trigger"
              description="A new customer message is submitted through a form, inbox, support channel, or manual entry."
            />
            <InfoCard
              title="Workflow Steps"
              description="The message is classified by issue type, scored for urgency and sentiment, routed to the right response path, and prepared with a draft reply when appropriate."
            />
            <InfoCard
              title="Final Outcome"
              description="The support team can respond faster, prioritize risky messages, and keep a record of customer issues and response decisions."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Current V1.2 Functionality">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Project Specification"
              description="This page defines the support workflow, business problem, AI role, human review points, and future demo direction."
            />
            <InfoCard
              title="Planned Rule-Based Demo"
              description="The first working prototype should classify customer messages with simple rules, such as refund, complaint, technical issue, billing, general question, or urgent escalation."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Future Production Functionality">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Message Intake"
              description="Collect support messages from forms, email, chat, or CRM/support platforms."
            />
            <InfoCard
              title="Issue Classification"
              description="Classify messages by category, urgency, sentiment, customer type, and required next action."
            />
            <InfoCard
              title="AI Draft Replies"
              description="Generate suggested replies for human review, especially for repetitive support questions."
            />
            <InfoCard
              title="Response Log"
              description="Track message status, assigned owner, response draft, approval state, and final outcome."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Tools And Tech Stack">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current V1.2 Stack"
              description="Static HTML and CSS for the project page. The first standalone demo can use HTML, CSS, and JavaScript with rule-based logic."
            />
            <InfoCard
              title="Future Stack"
              description="Next.js and TypeScript for the frontend, Python and FastAPI for backend workflow logic, AI provider integration, database storage for support logs, and AWS deployment."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can classify issue type, detect urgency, detect sentiment,
            summarize customer context, and draft replies. AI should not send
            sensitive customer-facing responses without human review.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should review refunds, legal issues, angry customers,
            complaints, sensitive requests, billing disputes, account changes,
            and any response that could affect customer trust.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Workload Reduction"
              description="Reduces manual support workload by helping teams classify and prioritize messages faster."
            />
            <InfoCard
              title="Hiring Pressure"
              description="Helps avoid hiring pressure for repetitive support tasks by reducing the time spent sorting and drafting common replies."
            />
            <InfoCard
              title="Response Speed"
              description="Improves response time by making urgent issues easier to identify and route."
            />
            <InfoCard
              title="Customer Trust"
              description="Keeps human review in sensitive cases so automation supports service quality instead of weakening it."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1.2 Constraints"
              description="This page is a static project specification and does not process or store customer messages."
            />
            <InfoCard
              title="Future Reliability"
              description="A production version should validate inputs, avoid duplicate tickets, track message status, log approvals, and preserve a clear escalation path."
            />
            <InfoCard
              title="Data Protection"
              description="Support workflows can contain sensitive customer data, so future versions should avoid unnecessary data collection and protect stored messages."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Planned proof: a rule-based support triage demo that classifies
            sample messages and shows urgency, suggested response type, and
            human review requirement.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This project shows how support operations can move from manual
            message sorting to structured triage, AI-assisted drafting,
            escalation rules, and human review.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1 Demo"
              description="Build a rule-based support triage form that classifies sample customer messages in the browser."
            />
            <InfoCard
              title="V3"
              description="Add server-side AI for summarization, issue classification, sentiment detection, and draft replies."
            />
            <InfoCard
              title="V4"
              description="Add backend ticket logging, escalation workflows, approval history, and retry-safe notification handling."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to Customer Support Automation, Workflow
              Audit, Workflow Automation Setup, and AI-Assisted Workflow Setup
              services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Discuss a support workflow
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}