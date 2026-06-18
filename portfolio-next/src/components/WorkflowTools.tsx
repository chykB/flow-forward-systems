"use client";

import { FormEvent, useMemo, useState } from "react";

type ToolKey = "workflow-audit" | "alert-content" | "sales-follow-up";

type ToolField =
  | {
      id: string;
      label: string;
      type: "text" | "textarea";
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      type: "select";
      options: string[];
    };

type ToolData = Record<string, string>;

type ToolConfig = {
  label: string;
  fields: ToolField[];
  generate: (data: ToolData) => string;
};

const tools: Record<ToolKey, ToolConfig> = {
  "workflow-audit": {
    label: "AI Workflow Audit Tool",
    fields: [
      {
        id: "businessType",
        label: "Business type",
        type: "text",
        placeholder: "Example: coaching business, clinic, agency",
      },
      {
        id: "workflowArea",
        label: "Workflow area",
        type: "select",
        options: ["Sales", "Customer Support", "Content", "RevOps", "Operations"],
      },
      {
        id: "currentProcess",
        label: "Current process",
        type: "textarea",
        placeholder: "Describe how this workflow currently happens.",
      },
      {
        id: "mainProblem",
        label: "Main problem",
        type: "textarea",
        placeholder:
          "Example: missed follow-ups, slow replies, manual reporting, unclear ownership.",
      },
    ],
    generate(data) {
      return `Workflow Audit Recommendation

Business type: ${data.businessType || "Not provided"}
Workflow area: ${data.workflowArea || "Not provided"}

Likely workflow gaps:
- Repetitive manual steps may be slowing the process.
- Important work may not be tracked in one place.
- Follow-up may depend too much on memory.
- Human review points may not be clearly defined.

Automation opportunities:
- Capture requests or leads in a structured tracker.
- Add status stages so work does not disappear.
- Use reminders for follow-up and unresolved tasks.
- Use AI later to summarize, classify, draft, or prioritize work.

Human review should stay in:
- Complaints, refunds, legal issues, payment issues, sensitive customer conversations, and final customer-facing messages.

Suggested next action:
Map the current ${data.workflowArea || "workflow"} step by step, then choose one repetitive step to automate first.`;
    },
  },
  "alert-content": {
    label: "Google Alert-To-Content Idea Generator",
    fields: [
      {
        id: "alertTopic",
        label: "Alert, headline, or topic",
        type: "textarea",
        placeholder: "Paste a Google Alert headline, link, or short summary.",
      },
      {
        id: "audience",
        label: "Audience",
        type: "text",
        placeholder: "Example: small business owners, creators, coaches",
      },
      {
        id: "format",
        label: "Preferred content format",
        type: "select",
        options: ["LinkedIn Post", "Blog Outline", "Short Video Script", "X Thread"],
      },
    ],
    generate(data) {
      return `Content Workflow Recommendation

Topic: ${data.alertTopic || "Not provided"}
Audience: ${data.audience || "Small business owners"}
Format: ${data.format || "Not provided"}

Content angle:
AI is most useful when it improves a real workflow, not when it only generates more content.

Business takeaway:
This topic can be framed around how businesses save time, reduce repeated manual work, or make better workflow decisions.

Suggested structure:
1. What happened?
2. Why does it matter?
3. What does it mean for businesses?
4. What should businesses do next?
5. Where can AI or automation help?
6. Where should humans review?

Suggested next action:
Turn this into a ${data.format || "content piece"} that gives one practical workflow lesson and one clear action step.`;
    },
  },
  "sales-follow-up": {
    label: "Sales Follow-Up Sequence Generator",
    fields: [
      {
        id: "businessType",
        label: "Business type",
        type: "text",
        placeholder: "Example: consultant, agency, event planner",
      },
      {
        id: "offer",
        label: "Offer",
        type: "text",
        placeholder: "Example: workflow audit, automation setup, content service",
      },
      {
        id: "leadStage",
        label: "Lead stage",
        type: "select",
        options: ["New Lead", "Interested But Not Booked", "No Response", "Proposal Sent"],
      },
      {
        id: "tone",
        label: "Tone",
        type: "select",
        options: ["Warm", "Professional", "Friendly", "Direct"],
      },
    ],
    generate(data) {
      return `Sales Follow-Up Sequence

Business type: ${data.businessType || "Not provided"}
Offer: ${data.offer || "Not provided"}
Lead stage: ${data.leadStage || "Not provided"}
Tone: ${data.tone || "Not provided"}

Follow-up message 1:
Hi [Name], thank you for your interest in ${data.offer || "this offer"}. I wanted to follow up and understand what you are trying to improve right now.

Follow-up message 2:
Hi [Name], a good next step may be to identify the workflow gap, clarify what is slowing things down, and choose one practical improvement to start with.

Reminder workflow:
- Day 0: Acknowledge the inquiry.
- Day 2: Send first follow-up.
- Day 5: Share a useful idea or example.
- Day 9: Send final gentle follow-up.

Human review point:
Review messages before sending, especially for high-value leads, sensitive requests, refunds, complaints, or custom proposals.

Suggested next action:
Create a simple lead tracker with source, stage, last contact date, next follow-up date, and status.`;
    },
  },
};

const toolKeys = Object.keys(tools) as ToolKey[];

export function WorkflowTools() {
  const [activeTool, setActiveTool] = useState<ToolKey>("workflow-audit");
  const [output, setOutput] = useState(
    "Choose a tool, add your details, and generate a practical starting point.",
  );

  const activeToolConfig = tools[activeTool];

  const activeFields = useMemo(() => activeToolConfig.fields, [activeToolConfig]);

  function handleToolChange(toolKey: ToolKey) {
    setActiveTool(toolKey);
    setOutput("Add your details and generate a practical starting point.");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries()) as ToolData;

    setOutput(activeToolConfig.generate(data));
  }

  return (
    <div className="grid gap-5">
      <div aria-label="Free workflow tools" className="flex flex-wrap gap-3">
        {toolKeys.map((toolKey) => {
          const isActive = toolKey === activeTool;

          return (
            <button
              key={toolKey}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleToolChange(toolKey)}
              className={`rounded-md border px-4 py-3 text-left font-bold ${
                isActive
                  ? "border-[#174F42] bg-[#174F42] text-white"
                  : "border-[#D9DED8] bg-white text-[#17201C] hover:bg-[#EDF3EF] hover:text-[#174F42]"
              }`}
            >
              {tools[toolKey].label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-[#D9DED8] bg-white p-6"
        >
          <div className="grid gap-4">
            {activeFields.map((field) => (
              <div key={field.id} className="grid gap-2">
                <label htmlFor={field.id} className="font-bold text-[#17201C]">
                  {field.label}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    name={field.id}
                    placeholder={field.placeholder}
                    className="min-h-32 w-full rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.id}
                    name={field.id}
                    className="w-full rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    name={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-[#1F6F5B] px-5 py-3 font-bold text-white hover:bg-[#174F42]"
          >
            Generate Recommendation
          </button>
        </form>

        <aside
          aria-live="polite"
          className="rounded-lg border border-[#D9DED8] bg-white p-6"
        >
          <h3 className="text-lg font-bold text-[#174F42]">Your Output</h3>
          <div className="mt-4 min-h-72 whitespace-pre-wrap rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#17201C]">
            {output}
          </div>
        </aside>
      </div>
    </div>
  );
}