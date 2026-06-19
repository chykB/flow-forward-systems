import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description:
      "Standalone demo app first, with an agentic workflow simulator possible later.",
  },
  {
    title: "Agentic Level",
    description:
      "Medium later. The first demo should focus on operations task triage. Later versions can show multi-step workflows, tool actions, logging, failure paths, and escalation.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1.2 project page and specification available. A rule-based operations task triage assistant is planned as the first standalone demo.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Planned. GitHub/code: Planned. Screenshots or walkthrough: Planned. Architecture diagram: Planned.",
  },
];

export default function AiOperationsWorkflowAssistantPage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Project Hub + Demo Case Study"
          title="AI Operations Workflow Assistant"
          description="An operations workflow project for turning internal requests, task updates, and scattered messages into clear summaries, priorities, owners, and next actions."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The AI Operations Workflow Assistant helps small teams turn messy
              internal requests into structured operational next steps.
            </p>
            <p>
              The first planned demo will accept a request or task update and
              return a summary, priority, owner suggestion, next action, and
              human review point.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Small teams often receive tasks, customer requests, internal
              updates, and operational questions across many channels. The work
              may be important, but the next action is unclear.
            </p>
            <p>
              This creates repeated coordination, missed ownership, delayed
              decisions, and operational rework.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current State"
              description="A message or task arrives, someone reads it manually, tries to understand what it means, decides who should handle it, and follows up across different tools."
            />
            <InfoCard
              title="Common Failure Points"
              description="Requests are unclear, ownership is missing, priority is guessed, follow-up is delayed, and the same context has to be explained repeatedly."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Trigger"
              description="An internal request, task update, support handoff, or operations message is entered into the assistant."
            />
            <InfoCard
              title="Workflow Steps"
              description="The system summarizes the request, identifies the likely category, recommends priority, suggests an owner, proposes the next action, and flags whether human approval is needed."
            />
            <InfoCard
              title="Final Outcome"
              description="The team gets a clearer operational action plan instead of another unstructured message to interpret."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Current V1.2 Functionality">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Project Specification"
              description="This page defines the operations workflow, business problem, AI role, human review point, value estimate, and future demo direction."
            />
            <InfoCard
              title="Planned Operations Triage Demo"
              description="The first working prototype should accept an internal request and return a structured summary, priority, suggested owner, next action, and review requirement using rule-based logic."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Future Production Functionality">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Request Intake"
              description="Collect task requests from forms, messages, internal tools, support handoffs, or manual entry."
            />
            <InfoCard
              title="Task Structuring"
              description="Summarize the request, classify the workflow area, identify missing information, and suggest the next operational step."
            />
            <InfoCard
              title="Approval Checkpoint"
              description="Flag external actions, customer-facing communication, billing issues, legal questions, and risky changes for human review."
            />
            <InfoCard
              title="Workflow Log"
              description="Track request summary, owner, priority, action taken, approval status, and outcome."
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
              description="Next.js and TypeScript for the frontend, Python and FastAPI for backend workflow logic, database storage for task logs, and AWS services for deployment and monitoring."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can summarize requests, identify missing context, recommend next
            actions, classify operational priority, and draft internal or
            customer-facing outputs for review.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should review external actions, customer-facing
            communication, billing issues, legal questions, sensitive
            operational changes, and decisions that affect customer trust or
            money.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Coordination Time Reduction"
              description="Reduces the time spent clarifying requests, repeating context, and deciding who should act next."
            />
            <InfoCard
              title="Less Rework"
              description="Reduces operational rework by making next actions clearer before work begins."
            />
            <InfoCard
              title="Improved Visibility"
              description="Creates a clearer record of what was requested, who owns it, and what should happen next."
            />
            <InfoCard
              title="Better Escalation"
              description="Makes sensitive or risky requests easier to route for human decision-making."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1.2 Constraints"
              description="This page is a static project specification and does not process or store operational requests."
            />
            <InfoCard
              title="Future Reliability"
              description="A production version should validate input, track request status, log owner assignment, and handle failed notifications or missing context safely."
            />
            <InfoCard
              title="Data Protection"
              description="Internal operations data may include customer or business-sensitive information, so future versions should collect only what is needed and protect stored records."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Planned proof: an operations task triage demo that turns a messy
            request into a summary, priority, owner suggestion, next action, and
            review point.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This project shows how internal operations can move from scattered
            messages to structured workflow decisions, clearer ownership, and
            safer next actions.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1 Demo"
              description="Build a rule-based operations task triage assistant in the browser."
            />
            <InfoCard
              title="V3"
              description="Add server-side AI to summarize requests, classify priority, recommend next actions, and identify missing information."
            />
            <InfoCard
              title="V4"
              description="Add request logging, approval workflows, retry-safe notifications, status tracking, and escalation history."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to Workflow Audit, Workflow Automation
              Setup, AI-Assisted Workflow Setup, and Agentic Automation System
              Design services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Discuss an operations workflow
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}