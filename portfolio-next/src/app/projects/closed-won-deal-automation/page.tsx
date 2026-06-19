import Link from "next/link";
import { InfoCard } from "@/components/InfoCard";
import { ProjectMetaGrid } from "@/components/ProjectMetaGrid";
import { ProjectPageHeader } from "@/components/ProjectPageHeader";
import { ProjectSection } from "@/components/ProjectSection";
import { SiteShell } from "@/components/SiteShell";

const statusItems = [
  {
    title: "Project Level",
    description: "Production-style standalone capstone.",
  },
  {
    title: "Agentic Level",
    description:
      "High. This system is designed to coordinate multiple steps, use workflow state, handle exceptions, log outcomes, and escalate risky or failed cases to humans.",
  },
  {
    title: "Deployment / Showcase Status",
    description:
      "V1.2 architecture and case study page available. Backend/API proof, pseudocode, logs, audit trail, and deployment proof are planned for later phases.",
  },
  {
    title: "Proof Links",
    description:
      "Live demo: Planned. GitHub/code: Planned. Architecture diagram: Planned. Webhook pseudocode: Planned. Audit/log screenshot: Planned.",
  },
];

export default function ClosedWonDealAutomationPage() {
  return (
    <SiteShell>
      <main>
        <ProjectPageHeader
          label="Production-Style Capstone Case Study"
          title="Closed-Won Deal Automation System"
          description="A technical capstone showing how a CRM closed-won event can trigger legal, signing, delivery, finance, audit, retry, and human escalation workflows."
        />

        <ProjectMetaGrid items={statusItems} />

        <ProjectSection title="What The Project Does">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              The Closed-Won Deal Automation System models what should happen
              after a CRM deal is marked as closed-won. It coordinates legal
              document generation, signature request, delivery system setup,
              finance record creation, audit logging, and failure handling.
            </p>
            <p>
              In V1.2, this is an architecture and case study page. It does not
              run a backend yet.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Business Problem">
          <div className="max-w-3xl space-y-4 text-lg leading-8 text-[#5F6862]">
            <p>
              When a deal becomes closed-won, several teams usually need to act:
              sales, legal, delivery, finance, and customer success. If
              handoffs are manual, clients may miss NDAs, receive duplicate
              requests, wait too long for onboarding, or lack correct billing
              records.
            </p>
            <p>
              The business risk is operational rework, client confusion, delayed
              onboarding, missed billing, and poor visibility into where the
              process failed.
            </p>
          </div>
        </ProjectSection>

        <ProjectSection title="Manual Workflow">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Current State"
              description="A salesperson marks a deal as won, then manually informs legal, delivery, finance, and operations. Each team creates its own tasks and records, often with repeated data entry."
            />
            <InfoCard
              title="Common Failure Points"
              description="NDAs may be missed or duplicated, signed documents may not trigger onboarding, finance records may be delayed, and teams may not know which step failed."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Automated Workflow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Trigger"
              description="A CRM sends a closed-won webhook event when a deal reaches the closed-won stage."
            />
            <InfoCard
              title="Workflow Steps"
              description="The automation validates the webhook, checks idempotency, creates a workflow run, generates an NDA, sends it for signature, waits for signed-document event, creates delivery and finance records, and logs each step."
            />
            <InfoCard
              title="Final Outcome"
              description="The business gets a reliable, auditable post-sale handoff process with fewer duplicate records, fewer missed tasks, and clearer recovery paths when something fails."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Architecture">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="System Flow"
              description="CRM Webhook -> API Gateway -> Webhook Listener -> Signature Verification -> Payload Validation -> Idempotency Check -> Workflow Orchestrator -> Audit Log -> Legal Document Service -> Signing Service -> Signed Event Handler -> Delivery System -> Finance System -> Monitoring + Alerts -> Human Escalation Queue."
            />
            <InfoCard
              title="Systems Involved"
              description="CRM, automation service, legal document service, signing service, delivery system, finance system, database/audit log, queue, monitoring system, and human escalation process."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Event Flow">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Closed-Won Event"
              description="The CRM sends a closed-won event containing deal ID, account ID, client contact, deal value, owner, timestamp, and event ID."
            />
            <InfoCard
              title="Document Flow"
              description="The automation creates an NDA request, sends it to the signing service, and waits for a signed-document webhook before continuing to downstream setup."
            />
            <InfoCard
              title="Delivery And Finance Flow"
              description="After signing, the system creates a delivery client record and finance billing record, then marks the workflow run complete."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="API And Webhook Design">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="CRM Webhook Endpoint"
              description="POST /api/webhooks/crm/deal-closed-won receives closed-won deal events from the CRM."
            />
            <InfoCard
              title="Signed Document Endpoint"
              description="POST /api/webhooks/signing/document-signed receives signed-document events from the signing provider."
            />
            <InfoCard
              title="Admin Retry Endpoint"
              description="POST /api/admin/workflow-runs/:id/retry allows an authenticated admin to retry a failed workflow step in a future version."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Idempotency And Duplicate Prevention">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Event ID Check"
              description="Every external event should include a unique event ID. If the same event arrives twice, the system should return the existing workflow status instead of creating duplicate NDAs, delivery records, or finance records."
            />
            <InfoCard
              title="Workflow Run State"
              description="The system should store workflow status and current step so it can resume from the failed step instead of repeating the entire workflow."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Retry Strategy">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Temporary Failures"
              description="Retry temporary provider failures with backoff, such as a signing service timeout or finance API rate limit."
            />
            <InfoCard
              title="Validation Failures"
              description="Do not retry invalid payloads or missing required data automatically. Send them to human review."
            />
            <InfoCard
              title="Partial Failure Recovery"
              description="If legal succeeds but finance fails, the system should not regenerate the NDA. It should resume from the finance step after the issue is resolved."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Monitoring And Observability">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="Logs"
              description="Log request received, validation result, idempotency result, workflow step started, workflow step completed, provider error, retry attempt, and human escalation."
            />
            <InfoCard
              title="Metrics"
              description="Track workflow success rate, workflow failure rate, duplicate webhook count, average processing time, failed finance syncs, and failed document signing flows."
            />
            <InfoCard
              title="Alerts"
              description="Alert when repeated workflow failures happen, signing events are missing, finance sync fails repeatedly, or queue backlog grows."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Debugging Scenario">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="Missing Finance Record"
              description="Search by workflow run ID, confirm the signed-document event arrived, inspect the audit log, identify whether delivery succeeded, check the finance step error, and retry only the failed finance step after validation."
            />
            <InfoCard
              title="Duplicate NDA"
              description="Search by external event ID and idempotency key, confirm whether duplicate webhook events were processed, and verify that document generation is protected by stored workflow state."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Scaling Plan">
          <div className="grid gap-5 md:grid-cols-2">
            <InfoCard
              title="At 10x Volume"
              description="Move long-running work to a queue, separate webhook intake from workflow processing, add concurrency controls, handle provider rate limits, and use managed AWS services for state, logs, and alerts."
            />
            <InfoCard
              title="Future Deployment"
              description="Python and FastAPI can handle webhook/API logic, AWS Lambda can process small steps, SQS can queue workflow work, DynamoDB or PostgreSQL can store workflow state, and CloudWatch can capture logs and alarms."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="AI Role">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            AI can optionally summarize deal context, detect missing fields,
            draft internal exception notes, and explain failure reasons. AI
            should not generate legal documents, approve billing, or trigger
            high-risk actions without human review.
          </p>
        </ProjectSection>

        <ProjectSection title="Human Review Point">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            A human should review missing client data, legal document
            exceptions, failed billing syncs, repeated failures, contract
            changes, high-value deals, and sensitive client records.
          </p>
        </ProjectSection>

        <ProjectSection title="Business Value And Money-Saving Impact">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Reduced Manual Handoffs"
              description="Reduces the manual coordination needed between sales, legal, delivery, finance, and operations."
            />
            <InfoCard
              title="Duplicate Prevention"
              description="Prevents duplicate NDAs, duplicate client records, and repeated billing setup through idempotency and workflow state."
            />
            <InfoCard
              title="Billing Accuracy"
              description="Reduces missed billing records and delayed finance handoffs after a deal closes."
            />
            <InfoCard
              title="Operational Recovery"
              description="Makes failed steps visible and recoverable without restarting the entire workflow."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Reliability And Security Considerations">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1.2 Constraints"
              description="This is an architecture and case study page. It does not run a live backend, store client data, or process real webhooks yet."
            />
            <InfoCard
              title="Security Requirements"
              description="Future versions should verify webhook signatures, validate payloads, protect admin routes, store secrets securely, use least-privilege permissions, and avoid logging sensitive full payloads."
            />
            <InfoCard
              title="Reliability Requirements"
              description="Future versions should use idempotency keys, audit logs, retry strategy, partial failure recovery, monitoring, and human escalation."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Screenshots Or Demo Notes">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            Planned proof: architecture diagram, event sequence, webhook payload
            examples, pseudocode for the CRM webhook listener, audit log mock,
            and debugging walkthrough.
          </p>
        </ProjectSection>

        <ProjectSection title="What This Project Shows">
          <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
            This capstone shows production automation thinking: webhooks,
            validation, idempotency, retries, audit logs, partial failure
            recovery, monitoring, scaling, and human escalation.
          </p>
        </ProjectSection>

        <ProjectSection title="What Would Improve Next">
          <div className="grid gap-5 md:grid-cols-3">
            <InfoCard
              title="V1.2"
              description="Add architecture diagram, payload examples, and webhook listener pseudocode."
            />
            <InfoCard
              title="V4"
              description="Build a backend webhook demo with validation, idempotency, workflow state, and audit logs."
            />
            <InfoCard
              title="V5"
              description="Add production-style deployment proof, monitoring, retry handling, scaling plan, and exception support."
            />
          </div>
        </ProjectSection>

        <ProjectSection title="Service Connection">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-[#5F6862]">
              This project connects to Agentic Automation System Design,
              Workflow Automation Setup, RevOps Automation, and production
              automation architecture services.
            </p>
            <Link
              href="/#contact"
              className="mt-6 inline-block rounded-md bg-[#B8892E] px-5 py-3 font-bold text-[#17201C] hover:bg-white hover:text-[#174F42]"
            >
              Discuss an automation system
            </Link>
          </div>
        </ProjectSection>
      </main>
    </SiteShell>
  );
}