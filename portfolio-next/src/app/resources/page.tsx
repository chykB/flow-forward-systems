import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SiteShell } from "@/components/SiteShell";

const resources = [
  {
    title: "Workflow Audit Checklist",
    description:
      "Identify repetitive work, unclear ownership, manual handoffs, missed follow-ups, and automation opportunities.",
  },
  {
    title: "Human Review Checklist",
    description:
      "Decide where a person should review AI outputs before messages, financial actions, legal steps, or customer-facing decisions happen.",
  },
  {
    title: "Sales Follow-Up Tracker",
    description:
      "Track lead source, lead stage, last contact date, next follow-up date, and current status to reduce missed revenue opportunities.",
  },
  {
    title: "Google Alert-To-Content Template",
    description:
      "Turn alerts and industry updates into business takeaways, LinkedIn posts, blog outlines, short video scripts, and content ideas.",
  },
  {
    title: "AI Automation Readiness Checklist",
    description:
      "Check whether a workflow is structured enough for automation or whether it needs clearer steps, data, ownership, and review points first.",
  },
];

export default function ResourcesPage() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-[#174F42] md:text-6xl">
            AI Automation Templates And Workflow Checklists
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5F6862]">
            Simple resources to help teams spot manual work, review AI outputs
            safely, improve follow-up, and turn ideas into workflows.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Resource Library" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <InfoCard
                key={resource.title}
                title={resource.title}
                description={resource.description}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-lg bg-[#174F42] p-8 md:p-10">
            <h2 className="text-3xl font-bold text-white">
              Start With One Workflow
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-white">
              Choose one manual process, map the steps, identify the risk
              points, then decide what should be automated first.
            </p>
            <Link
              href="/#tools"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Use the free tools
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}