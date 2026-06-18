
import { SiteShell } from "@/components/SiteShell";

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
      </main>
    </SiteShell>
  );
}