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
      "Review a workflow and find bottlenecks, automation opportunities, human review points, and practical next steps.",
    buttonLabel: "Analyze Workflow",
  },
  {
    key: "alert-content",
    title: "Content Idea Planner",
    description:
      "Turn an alert, article, customer question, trend, note, or idea into a content decision, fresh angle, and draft starting point.",
    buttonLabel: "Plan Content",
  },
  {
    key: "sales-follow-up",
    title: "Sales Workflow Improvement Tool",
    description:
      "Find gaps in lead capture, response time, follow-up, CRM updates, deal tracking, reporting, and sales automation.",
    buttonLabel: "Improve Sales Workflow",
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
                      ? "Content Idea Planner"
                      : "Sales Workflow Improvement Tool"}
                </h3>

                <p className="mt-2 max-w-2xl leading-7 text-[#5F6862]">
                  {activeTool === "workflow-audit"
                    ? "Use this self-serve tool to understand where a workflow slows down and what can be improved first."
                    : activeTool === "alert-content"
                      ? "Use this tool to decide whether an idea is worth turning into content, what angle to use, and what to review before publishing."
                      : "Use this tool to improve how leads are captured, followed up, qualified, tracked, and reported."}
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