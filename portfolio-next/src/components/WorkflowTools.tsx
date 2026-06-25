"use client";

import { useState } from "react";
import { ContentSignalTool } from "@/components/tools/ContentSignalTool";
import { WorkflowAuditTool } from "@/components/tools/WorkflowAuditTool";
import { SalesWorkflowTool } from "@/components/tools/SalesWorkflowTool";

type ToolKey = "workflow-audit" | "alert-content" | "sales-follow-up";

const tools: {
  key: ToolKey;
  title: string;
  description: string;
  buttonLabel: string;
}[] = [
  {
    key: "workflow-audit",
    title: "AI Workflow Audit Tool",
    description:
      "Get an instant workflow analysis with bottlenecks, automation opportunities, human review points, and suggested next actions.",
    buttonLabel: "Open Tool",
  },
  {
    key: "alert-content",
    title: "Content Signal-To-Content Tool",
    description:
      "Turn a signal, question, trend, note, or idea into a useful content decision, fresh angle, and draft starting point.",
    buttonLabel: "Open Tool",
  },
  {
    key: "sales-follow-up",
    title: "Sales Workflow Improvement Tool",
    description:
      "Find gaps in lead capture, speed-to-lead, follow-up, CRM updates, deal tracking, reporting, and sales automation.",
    buttonLabel: "Open Tool",
  },
];


export function WorkflowTools() {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
 
  function closeModal() {
    setActiveTool(null);
  }
 
  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {tools.map((tool) => (
          <article
            key={tool.key}
            className="flex h-full flex-col rounded-lg border border-[#D9DED8] bg-white p-5"
          >
            <h3 className="text-xl font-bold text-[#17201C]">{tool.title}</h3>
            <p className="mt-3 mb-5 leading-7 text-[#5F6862]">{tool.description}</p>
            <button
              className="mt-auto rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B]"
              type="button"
              onClick={() => setActiveTool(tool.key)}
            >
              {tool.buttonLabel}
            </button>
          </article>
        ))}
      </div>

      {activeTool ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 px-4 py-8">
          <div
            aria-modal="true"
            aria-labelledby="tool-dialog-title"
            className="mx-auto max-w-6xl rounded-lg bg-[#F7F8F6] p-4 shadow-xl md:p-6"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3
                  id="tool-dialog-title"
                  className="text-2xl font-bold text-[#17201C]"
                >
                  {activeTool === "workflow-audit"
                    ? "AI Workflow Audit Tool"
                    : activeTool === "alert-content"
                      ? "Content Signal-To-Content Tool"
                      : "Sales Workflow Improvement Tool"}
                </h3>

                <p className="mt-2 max-w-2xl leading-7 text-[#5F6862]">
                  {activeTool === "workflow-audit"
                    ? "Get an instant AI-assisted workflow analysis with practical next steps and human review points."
                    : activeTool === "alert-content"
                      ? "Turn a signal, question, trend, note, or idea into a content decision, fresh angle, and draft starting point."
                      : "Review your sales workflow and get practical improvements for lead capture, follow-up, CRM updates, deal stages, reporting, and automation."}
                </p>
              </div>

              <button
                className="rounded-md border border-[#D9DED8] bg-white px-4 py-2 font-bold text-[#17201C] hover:bg-[#EDF3EF]"
                type="button"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            {activeTool === "workflow-audit" ? (
              <WorkflowAuditTool />
            ) : activeTool === "alert-content" ? (
              <ContentSignalTool />
            ) : (
              <SalesWorkflowTool />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}