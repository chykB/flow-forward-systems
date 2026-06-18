import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SiteShell } from "@/components/SiteShell";

const philosophyItems = [
  {
    title: "Start With The Workflow",
    description:
      "Before choosing an AI tool, understand the process, the handoffs, the delays, and the risk points.",
  },
  {
    title: "Use AI Where It Helps",
    description:
      "AI is useful for summarizing, classifying, drafting, extracting, and recommending next steps when the workflow is clearly defined.",
  },
  {
    title: "Keep Human Review Where Trust Matters",
    description:
      "Customer-facing messages, legal steps, financial actions, complaints, refunds, and sensitive decisions should stay reviewable.",
  },
  {
    title: "Design For Reliability",
    description:
      "Good automation should be trackable, retry-safe, auditable, and clear about what happens when something fails.",
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-[#174F42] md:text-6xl">
            About FlowForward Systems
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5F6862]">
            FlowForward Systems is built to show how practical AI, automation,
            and workflow design can help businesses reduce manual work and move
            processes forward safely.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              I&apos;m Blessing Malik, a software engineer focused on practical
              AI automation, workflow systems, and business process improvement.
            </p>
            <p>
              My work combines software engineering, technical mentoring,
              support workflow experience, and AI automation strategy to design
              systems that are useful, explainable, and grounded in real
              business operations.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader title="Work Philosophy" />
          <div className="grid gap-5 md:grid-cols-2">
            {philosophyItems.map((item) => (
              <InfoCard
                key={item.title}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-lg bg-[#174F42] p-8 md:p-10">
            <h2 className="text-3xl font-bold text-white">Explore My Work</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-white">
              Review the tools, projects, and insights to see how FlowForward
              Systems approaches action-oriented AI and automation workflows.
            </p>
            <Link
              href="/#projects"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              View projects
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}