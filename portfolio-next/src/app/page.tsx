import { InfoCard } from "@/components/InfoCard";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SiteShell } from "@/components/SiteShell";
import { WorkflowTools } from "@/components/WorkflowTools";
import LeadCaptureForm from "@/components/LeadCaptureForm";

const maturityItems = [
  {
    title: "Workflow Automation",
    description:
      "Basic automation for repetitive tasks such as lead capture, follow-up reminders, status tracking, and form-to-database workflows.",
  },
  {
    title: "AI-Assisted Workflow Tools",
    description:
      "AI supports specific workflow steps by summarizing, classifying, drafting, generating ideas, or preparing outputs for human review.",
  },
  {
    title: "Agentic Automation",
    description:
      "AI works across multiple steps, uses tools, makes recommendations, takes safe actions, logs outcomes, and escalates to humans when needed.",
  },
];

const services = [
  {
    title: "Workflow Audit",
    description:
      "Review current processes to identify bottlenecks, repeated tasks, and automation opportunities.",
  },
  {
    title: "Workflow Automation Setup",
    description:
      "Build simple automation workflows that connect tools and reduce manual follow-up.",
  },
  {
    title: "AI-Assisted Workflow Setup",
    description:
      "Add AI support for drafting, summarizing, classifying, and preparing workflow actions.",
  },
  {
    title: "Agentic Automation System Design",
    description:
      "Design more advanced automation systems that can move work through multiple steps with human oversight.",
  },
  {
    title: "RevOps Automation",
    description:
      "Improve sales and revenue operations with cleaner handoffs, alerts, follow-ups, and reporting workflows.",
  },
  {
    title: "AI Content Workflow",
    description:
      "Create structured AI-supported workflows for planning, drafting, repurposing, and publishing content.",
  },
  {
    title: "AI Video Content Workflow",
    description:
      "Build repeatable systems for scripting, planning, generating, editing, and managing AI-assisted video content.",
  },
];

const projects = [
  {
    title: "Sales Follow-Up Automation System",
    description:
      "A workflow system for tracking leads, creating follow-up tasks, and reducing missed revenue opportunities.",
    href: "/projects/sales-follow-up-automation",
  },
  {
    title: "AI Customer Support Assistant",
    description:
      "An AI-assisted support workflow for classifying customer requests, detecting urgency, and preparing response drafts for review.",
    href: "/projects/ai-customer-support-assistant",
  },
  {
    title: "Google Alert-To-Content Generator",
    description:
      "A content workflow that turns relevant alerts into structured ideas, drafts, scripts, and publishing prompts.",
    href: "/projects/google-alert-to-content-generator",
  },
  {
    title: "AI Operations Workflow Assistant",
    description:
      "A system for organizing operational tasks, summarizing updates, recommending next actions, and keeping work visible.",
    href: "/projects/ai-operations-workflow-assistant",
  },
  {
    title: "Closed-Won Deal Automation System",
    description:
      "A revenue workflow that triggers legal, delivery, finance, audit, and follow-up actions after a deal is marked closed-won.",
    href: "/projects/closed-won-deal-automation",
  },
  {
    title: "AI RevOps Workflow Intelligence System",
    description:
      "An AI-supported RevOps system for identifying workflow gaps, delayed handoffs, CRM issues, and revenue process leaks.",
    href: "/projects/ai-revops-workflow-intelligence",
  },
];

export default function Home() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#1F6F5B]">
            AI workflow systems for revenue, sales, support, and operations
          </p>

          <h1 className="max-w-4xl text-5xl font-bold leading-tight text-[#174F42] md:text-7xl">
            FlowForward Systems
          </h1>

          <div className="mt-6 max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Action-oriented AI and automation workflows for sales, customer
              support, content, RevOps, and operations.
            </p>
            <p>
              We help businesses design clearer workflows, reduce manual tasks,
              and build automation systems that move work forward.
            </p>
            <p>
              Our focus is helping teams reduce revenue leakage caused by missed
              follow-ups, weak handoffs, CRM gaps, and disconnected workflows.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Automation Maturity Model" />
          <div className="grid gap-5 md:grid-cols-3">
            {maturityItems.map((item) => (
              <InfoCard
                key={item.title}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Services" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <InfoCard
                key={service.title}
                title={service.title}
                description={service.description}
              />
            ))}
          </div>
        </section>

        <section id="tools" className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            title="Free Tools"
            description="Use these rule-based tools to get a practical starting point for improving a workflow."
          />
          <WorkflowTools />
        </section>
  

        <section id="projects" className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Projects" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.title}
                title={project.title}
                description={project.description}
                href={project.href}
              />
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            title="Book a Workflow Audit"
            description="Share the workflow you want to improve, and what kind of automation support you are considering."
          />
          <LeadCaptureForm />
        </section>
      </main>
    </SiteShell>
  );
}