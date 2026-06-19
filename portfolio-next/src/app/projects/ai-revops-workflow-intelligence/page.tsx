import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description: "Production-style standalone product.",
  },
  {
    title: "Agentic Level",
    description:
      "Medium in the MVP, high later. The MVP can collect structured revenue workflow inputs, identify leak points, suggest automation opportunities, and estimate impact. Later versions can connect to CRM and revenue tools.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1.2 project page and product specification available. A standalone RevOps Workflow Leak Finder + Automation ROI Dashboard is planned as a future demo.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Planned. GitHub/code: Planned. Screenshots or walkthrough: Planned. Architecture diagram: Planned.",
  },
];

const manualWorkflowItems = [
  {
    title: "Current State",
    description:
      "Revenue teams manually track leads, CRM updates, follow-ups, deal stages, handoffs, onboarding tasks, and customer success signals across several tools and spreadsheets.",
  },
  {
    title: "Common Failure Points",
    description:
      "Leads are not followed up quickly, CRM fields are incomplete, deals stall without alerts, closed-won handoffs are delayed, onboarding tasks are missed, and automation impact is hard to measure.",
  },
];

const automatedWorkflowItems = [
  {
    title: "Trigger",
    description:
      "A user enters revenue workflow details such as monthly lead volume, average deal value, current tools, lead sources, sales stages, follow-up process, handoff points, current automations, and data-quality problems.",
  },
  {
    title: "Workflow Steps",
    description:
      "The system analyzes the inputs, identifies revenue leak points, flags workflow bottlenecks, scores data-quality risks, estimates missed follow-up impact, recommends automation opportunities, and suggests a practical tool approach.",
  },
  {
    title: "Final Outcome",
    description:
      "The user receives a RevOps workflow report with leak points, risks, automation opportunities, human review points, suggested next actions, and rough ROI guidance.",
  },
];

const inputItems = [
  {
    title: "Business And Revenue Context",
    description:
      "Business type, monthly lead volume, average deal value, lead sources, tools currently used, sales stages, and current automations.",
  },
  {
    title: "Workflow Context",
    description:
      "Follow-up process, handoff points, onboarding steps, customer success visibility, and where deals usually get stuck.",
  },
  {
    title: "Data-Quality Context",
    description:
      "Missing CRM fields, duplicate records, poor stage hygiene, manual reporting gaps, and unclear ownership.",
  },
];

const outputItems = [
  {
    title: "Revenue Leak Points",
    description:
      "Where leads, deals, handoffs, onboarding tasks, or customer success signals may be leaking revenue or slowing growth.",
  },
  {
    title: "Workflow Bottlenecks",
    description:
      "Where manual work, unclear ownership, missing alerts, or disconnected tools slow down revenue operations.",
  },
  {
    title: "Automation Opportunities",
    description:
      "Which parts of the workflow are best suited for CRM-native automation, Zapier/Make, AI-assisted workflows, or custom code.",
  },
  {
    title: "ROI Guidance",
    description:
      "Rough planning estimates for potential revenue leakage and operational cost savings. These estimates should be reviewed before making financial decisions.",
  },
];

const roiItems = [
  {
    title: "Revenue Leakage Estimate",
    description:
      "Uses monthly lead volume, average deal value, missed follow-up risk, stalled deal risk, and conversion assumptions to estimate where revenue may be leaking.",
  },
  {
    title: "Operational Cost Estimate",
    description:
      "Uses manual hours, repeated admin work, handoff delays, tool waste, and reporting effort to estimate operational cost savings opportunities.",
  },
  {
    title: "Important Limitation",
    description:
      "All ROI outputs should be treated as rough planning estimates, not financial advice. A human should review assumptions before using the numbers for business decisions.",
  },
];

const futureItems = [
  {
    title: "CRM And Revenue Tool Connections",
    description:
      "Later versions can connect to CRM, marketing automation, spreadsheets, Slack, Zapier/Make, and internal systems.",
  },
  {
    title: "Automation Governance",
    description:
      "Track which automations exist, what workflow they support, who owns them, and whether they are tied to measurable revenue outcomes.",
  },
  {
    title: "Revenue Workflow Monitoring",
    description:
      "Monitor lead response time, stalled deals, handoff delays, onboarding gaps, CRM hygiene, and tool usage patterns.",
  },
  {
    title: "RevOps Automation Command Center",
    description:
      "A later-version concept that maps workflows, audits automations, monitors data quality, applies governance, and reports revenue impact.",
  },
];

const valueItems = [
  {
    title: "Reduced Revenue Leakage",
    description:
      "Helps identify missed leads, poor follow-up, weak handoffs, delayed onboarding follow-up, and stalled deal risks.",
  },
  {
    title: "Cleaner CRM Data",
    description:
      "Highlights missing fields, unclear stages, duplicate records, and data-quality problems that weaken revenue visibility.",
  },
  {
    title: "Improved Deal Velocity",
    description:
      "Surfaces workflow delays that slow down lead response, qualification, handoff, onboarding, and customer success visibility.",
  },
  {
    title: "Tool And Automation Clarity",
    description:
      "Helps teams understand which tools and automations support revenue outcomes and which may be adding complexity without measurable value.",
  },
];

const reliabilityItems = [
  {
    title: "V1.2 Constraints",
    description:
      "This page is a static project specification and does not connect to CRM systems, store revenue data, or calculate live financial metrics.",
  },
  {
    title: "Future Reliability",
    description:
      "A production version should validate inputs, log analysis runs, track assumptions, handle missing CRM data safely, and make scoring rules explainable.",
  },
  {
    title: "Data Protection",
    description:
      "Revenue operations data can be sensitive. Future versions should collect only needed data, avoid storing private customer records unnecessarily, and protect integrations and secrets.",
  },
];

const improvementItems = [
  {
    title: "V1 Demo",
    description:
      "Build a rule-based RevOps leak finder and ROI dashboard using manual inputs.",
  },
  {
    title: "V3",
    description:
      "Add AI-assisted recommendations, structured output generation, and safer explanations of workflow risks and next actions.",
  },
  {
    title: "V5",
    description:
      "Evolve into a RevOps Automation Command Center with integrations, workflow monitoring, governance, and revenue impact reporting.",
  },
];

export default function AiRevOpsWorkflowIntelligencePage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Project Hub + Product Case Study"
          title="AI RevOps Workflow Intelligence System"
          description="A RevOps workflow project for finding revenue leaks, CRM gaps, stalled deals, weak handoffs, data-quality risks, and automation opportunities."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="MVP Direction">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The first MVP should be narrow and useful: a RevOps Workflow Leak
              Finder + Automation ROI Dashboard.
            </p>
            <p>
              It should help users identify revenue leaks, CRM gaps, stalled
              deals, manual handoffs, data-quality issues, automation
              opportunities, and rough impact estimates.
            </p>
            <p>
              The larger RevOps Automation Command Center is a later-version
              vision, not the first MVP.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The AI RevOps Workflow Intelligence System helps businesses
              understand where revenue workflow problems happen across lead
              capture, qualification, CRM stages, sales follow-up, closed-won
              handoff, onboarding, and customer success visibility.
            </p>
            <p>
              The first standalone version should use structured inputs and
              rule-based scoring before adding AI or direct CRM integrations.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Businesses lose revenue when leads, CRM updates, sales follow-ups,
              handoffs, onboarding tasks, customer success signals, and
              automation efforts are disconnected across the revenue workflow.
            </p>
            <p>
              The issue is not only tool sprawl. The deeper problem is revenue
              leakage caused by poor visibility, weak data quality, stalled
              deals, fragmented automation, and difficulty tying automation work
              to outcomes such as speed-to-lead, CAC, deal velocity, and
              pipeline conversion.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            {manualWorkflowItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            {automatedWorkflowItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="MVP Inputs">
          <div className="grid gap-5 md:grid-cols-3">
            {inputItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="MVP Outputs">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {outputItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="ROI Estimate Approach">
          <div className="grid gap-5 md:grid-cols-3">
            {roiItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Current V1.2 Functionality">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Project Specification"
              description="This page defines the RevOps workflow problem, MVP direction, inputs, outputs, AI role, human review points, business value, and future product path."
            />
            <InfoCard
              title="Planned RevOps Leak Finder"
              description="The first working prototype should use manual inputs and rule-based scoring to produce revenue leak points, workflow bottlenecks, automation opportunities, and rough ROI estimates."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Future Production Functionality">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {futureItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Tools And Tech Stack">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current V1.2 Stack"
              description="Static HTML and CSS for the project page. The first standalone demo can use HTML, CSS, and JavaScript with rule-based scoring."
            />
            <InfoCard
              title="Future Stack"
              description="Next.js and TypeScript for the frontend, Python and FastAPI for backend workflow logic, PostgreSQL or DynamoDB for revenue workflow data, AWS services for deployment, and CloudWatch for monitoring."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can summarize lead and deal context, classify lead quality,
            detect missing CRM fields, suggest next best actions, draft
            follow-up messages, flag stalled deals, and recommend where AI,
            automation, or human review should be used.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should review high-value deals, custom pricing, discounts,
            legal issues, contract changes, churn risk, renewal risk, sensitive
            customer situations, and ROI assumptions before acting on
            recommendations.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {valueItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            {reliabilityItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Planned proof: a RevOps Workflow Leak Finder + Automation ROI
            Dashboard prototype with sample inputs, leak analysis, automation
            recommendations, and rough ROI outputs.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This project shows how RevOps automation can move beyond tool sprawl
            and focus on revenue workflow visibility, data quality, automation
            impact, and measurable business outcomes.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            {improvementItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to RevOps Automation, Workflow Audit,
              Workflow Automation Setup, AI-Assisted Workflow Setup, and
              Agentic Automation System Design services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Discuss a RevOps workflow
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}