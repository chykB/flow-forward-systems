import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description: "Portfolio tool.",
  },
  {
    title: "Agentic Level",
    description:
      "None first, low later. The current version is rule-based. A later version could pull alerts, track source links, summarize content, and suggest repurposing steps.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1 portfolio prototype is available through the homepage Google Alert-To-Content Idea Generator.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Current homepage tool prototype. GitHub/code: Planned. Screenshots or walkthrough: Planned. Architecture diagram: Planned.",
  },
];

export default function GoogleAlertToContentGeneratorPage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Project Hub + Demo Case Study"
          title="Google Alert-To-Content Generator"
          description="A content workflow project for turning alerts, headlines, and research notes into practical business content ideas."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The Google Alert-To-Content Generator helps creators and business
              owners turn alerts, headlines, or topic summaries into content
              angles, business takeaways, and reusable content formats.
            </p>
            <p>
              In the current V1 prototype, the project is represented by a
              browser-based rule tool and this project page.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              Creators and business owners often collect industry news, alerts,
              and interesting links, but struggle to turn them into consistent
              useful content.
            </p>
            <p>
              The problem is not only writing. The workflow from research to
              insight to post idea to publishing is often unclear and
              inconsistent.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current State"
              description="A person receives a Google Alert, opens links manually, tries to understand the topic, decides whether it matters, and then writes a post or script from scratch."
            />
            <InfoCard
              title="Common Failure Points"
              description="Useful alerts are ignored, posts become generic, content lacks business insight, and ideas are not repurposed across formats."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Trigger"
              description="A Google Alert, headline, topic, or source summary is added to the tool."
            />
            <InfoCard
              title="Workflow Steps"
              description="The system identifies a content angle, extracts a business takeaway, suggests a format, and structures the output into practical next steps."
            />
            <InfoCard
              title="Final Outcome"
              description="The user gets a clearer content starting point that connects news or research to practical business workflow lessons."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Current V1 Functionality">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Rule-Based Content Idea Generator"
              description="The current tool accepts an alert or topic, target audience, and preferred format, then generates a structured content workflow recommendation."
            />
            <InfoCard
              title="Static Project Page"
              description="This page explains the content workflow, AI role, human review point, business value, and future production path."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Future Production Functionality">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Alert Intake"
              description="Collect Google Alert links, headlines, source summaries, and topic notes in a structured tracker."
            />
            <InfoCard
              title="Content Angle Generator"
              description="Generate content angles based on the business relevance of the alert, not only the headline."
            />
            <InfoCard
              title="Multi-Format Repurposing"
              description="Turn one source into a LinkedIn post, blog outline, X thread, short video script, and carousel idea."
            />
            <InfoCard
              title="Content Tracker"
              description="Track source, status, draft, review state, publishing channel, and engagement notes."
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
              description="Next.js and TypeScript for frontend content workflows, Python and FastAPI for AI-assisted generation, and a database or content tracker for saved ideas and source links."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can summarize alerts, extract business lessons, suggest content
            angles, and generate content formats. AI should support the
            workflow, but a human should verify accuracy and add original
            judgment before publishing.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should check source accuracy, relevance, tone, claims,
            originality, and whether the content includes a useful business
            takeaway before publishing.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Research Time Reduction"
              description="Reduces time spent turning alerts and notes into usable content ideas."
            />
            <InfoCard
              title="Drafting Efficiency"
              description="Creates a stronger starting point for posts, outlines, scripts, and threads."
            />
            <InfoCard
              title="Repurposing Value"
              description="Helps turn one alert into multiple content formats instead of starting from zero each time."
            />
            <InfoCard
              title="Authority Building"
              description="Supports consistent content around AI automation, workflow design, RevOps, support, sales, and operations."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1 Constraints"
              description="The current V1 prototype does not fetch live alerts, store source links, or verify external information automatically."
            />
            <InfoCard
              title="Future Reliability"
              description="A production version should track source links, show review status, avoid unsupported claims, and handle failed content generation safely."
            />
            <InfoCard
              title="Content Safety"
              description="The system should avoid copying full articles, exaggerating claims, or publishing AI-generated output without human review."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Current proof: the homepage includes a working browser-based Google
            Alert-To-Content Idea Generator. Screenshots or walkthrough notes
            can be added after V1.2 project pages are complete.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This project shows how content creation can be treated as a workflow
            with source intake, insight extraction, format generation, human
            review, and publishing readiness.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V2"
              description="Add saved content ideas, categories, source links, and simple content status tracking."
            />
            <InfoCard
              title="V3"
              description="Add server-side AI for summarization, content angle generation, and structured multi-format outputs."
            />
            <InfoCard
              title="V4"
              description="Add source review workflow, publishing approval, content logs, and automated reminders for repurposing."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to AI Content Workflow, Workflow Audit, and
              AI-Assisted Workflow Setup services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Discuss a content workflow
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}