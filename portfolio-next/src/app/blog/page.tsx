import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SiteShell } from "@/components/SiteShell";

const categories = [
  {
    title: "AI That Acts, Not Just Talks",
    description:
      "Insights on the difference between simple AI outputs and workflow systems that move business processes forward.",
  },
  {
    title: "Workflow Design",
    description:
      "How to map processes, identify bottlenecks, and decide what should be automated first.",
  },
  {
    title: "RevOps Automation",
    description:
      "Ideas for reducing missed follow-ups, CRM gaps, manual handoffs, and revenue process leaks.",
  },
  {
    title: "Customer Support Automation",
    description:
      "Practical ways AI and automation can improve response speed while keeping human review in sensitive cases.",
  },
  {
    title: "Content Systems",
    description:
      "Turning alerts, research, and ideas into structured content workflows.",
  },
];

export default function BlogPage() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-[#174F42] md:text-6xl">
            AI Automation And Workflow Design Insights
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5F6862]">
            Practical notes on AI that acts, workflow automation, RevOps,
            customer support, sales follow-up, and content systems.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Featured Insight" />
          <InfoCard
            title="AI Tools Are Not Enough. Businesses Need Workflow Design."
            description="Many businesses start by asking which AI tool to use. A better starting point is identifying which workflow is slow, repetitive, risky, or leaking revenue. This post will explain why practical automation starts with workflow design before AI is added."
          />
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Categories" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <InfoCard
                key={category.title}
                title={category.title}
                description={category.description}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-lg bg-[#174F42] p-8 md:p-10">
            <h2 className="text-3xl font-bold text-white">
              Turn Insight Into A Workflow
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-white">
              Use the free tools to identify automation opportunities, then
              review the project examples to see how workflow systems are
              designed.
            </p>
            <Link
              href="/#tools"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Try the free tools
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}