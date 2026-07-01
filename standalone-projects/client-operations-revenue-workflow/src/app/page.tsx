const productHighlights = [
  "See which leads and clients need action today.",
  "Track follow-ups, approvals, payments, delivery, and client risk.",
  "Keep handoff notes ready for a VA, assistant, or team member.",
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
              href="#demo"
            >
              View Demo Workflow
            </a>
            <a
              className="rounded-md border border-[#174F42] px-5 py-3 text-center font-bold text-[#174F42] hover:bg-white"
              href="#how-it-works"
            >
              See What It Tracks
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[#D9DED8] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Today&apos;s Priority View</h2>
          <p className="mt-3 leading-7 text-[#5F6862]">
            Demo mode will show sample leads and clients so the product can be
            reviewed safely without exposing real client data.
          </p>

          <div className="mt-6 grid gap-3">
            {productHighlights.map((highlight) => (
              <div
                className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-[#17201C]"
                key={highlight}
              >
                {highlight}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-6xl px-6 py-16"
        id="how-it-works"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            What It Tracks
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            One workflow for the client lifecycle.
          </h2>
          <p className="mt-4 leading-8 text-[#5F6862]">
            V1 starts with a thin but complete workflow: lead capture,
            follow-up, onboarding, delivery, approvals, payment follow-up,
            client risk, and handoff notes.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            "Lead and client records",
            "Next actions and follow-up dates",
            "Delivery, approval, and payment status",
            "Risk flags and blocked work",
            "SOP and handoff notes",
            "Activity history",
          ].map((item) => (
            <article
              className="rounded-lg border border-[#D9DED8] bg-white p-5"
              key={item}
            >
              <h3 className="font-bold">{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" id="demo">
        <div className="rounded-lg border border-[#D9DED8] bg-white p-6">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#5F6862]">
            Demo Mode
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            Safe sample data comes next.
          </h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#5F6862]">
            The next build step connects this product shell to sample workflow
            records and shows what needs attention today. No real client data is
            needed for the public demo.
          </p>
        </div>
      </section>
    </main>
  );
}