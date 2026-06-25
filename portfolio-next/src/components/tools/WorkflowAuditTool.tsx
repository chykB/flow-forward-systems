"use client";

import { useState } from "react";

import { SectionList } from "@/components/tools/SectionList";

type WorkflowAuditValues = {
  businessType: string;
  businessTypeOther: string;
  workflowArea: string;
  workflowAreaOther: string;
  currentProcess: string;
  mainProblem: string;
  toolsUsed: string[];
  toolsUsedOther: string;
  monthlyVolume: string;
  teamSize: string;
  desiredOutcome: string;
  riskLevel: string;
};

type WorkflowAuditErrors = Partial<Record<keyof WorkflowAuditValues, string>>;

type WorkflowAuditAnalysis = {
  workflowSummary: string;
  maturityLevel: {
    level: string;
    reason: string;
  };
  mainBottlenecks: string[];
  automationOpportunities: string[];
  aiAssistanceOpportunities: string[];
  humanReviewPoints: string[];
  suggestedNextAction: string;
  systemLogPreview: string[];
  doNotAutomateYet: string[];
  reviewNote: string;
};

type WorkflowAuditMode = "ai" | "rule-based-fallback";

type WorkflowAuditResponse = {
  mode: WorkflowAuditMode;
  analysis: WorkflowAuditAnalysis;
};

const initialWorkflowAuditValues: WorkflowAuditValues = {
  businessType: "",
  businessTypeOther: "",
  workflowArea: "",
  workflowAreaOther: "",
  currentProcess: "",
  mainProblem: "",
  toolsUsed: [],
  toolsUsedOther: "",
  monthlyVolume: "",
  teamSize: "",
  desiredOutcome: "",
  riskLevel: "",
};

const businessTypes = [
  "Coaching business",
  "Agency",
  "Clinic",
  "SaaS company",
  "Creator business",
  "Local service business",
  "Other",
];

const workflowAreas = [
  "Sales",
  "Customer Support",
  "Content",
  "RevOps",
  "Operations",
  "Other",
];

const toolsUsedOptions = [
  "Gmail",
  "Google Sheets",
  "HubSpot",
  "Notion",
  "Slack",
  "Calendly",
  "Zapier",
  "Make",
  "Other",
  "None yet",
];

const monthlyVolumes = [
  "Less than 25",
  "25-100",
  "101-500",
  "501-1000",
  "More than 1000",
  "Not sure",
];

const teamSizes = ["Solo", "2-5", "6-20", "21-50", "51+", "Not sure"];

const riskLevels = ["Low", "Medium", "High", "Not sure"];

function validateWorkflowAudit(values: WorkflowAuditValues) {
  const errors: WorkflowAuditErrors = {};

  if (!values.businessType) {
    errors.businessType = "Choose a business type.";
  }

  if (values.businessType === "Other" && values.businessTypeOther.trim().length < 2) {
    errors.businessTypeOther = "Describe your business type.";
  }

  if (!values.workflowArea) {
    errors.workflowArea = "Choose a workflow area.";
  }

  if (values.workflowArea === "Other" && values.workflowAreaOther.trim().length < 2) {
    errors.workflowAreaOther = "Describe the workflow area.";
  }

  if (values.currentProcess.trim().length < 20) {
    errors.currentProcess = "Describe how the workflow currently happens.";
  }

  if (values.mainProblem.trim().length < 10) {
    errors.mainProblem = "Describe the main workflow problem.";
  }

  if (values.toolsUsed.includes("Other") && values.toolsUsedOther.trim().length < 2) {
    errors.toolsUsedOther = "List the other tools used.";
  }

  return errors;
}

export function WorkflowAuditTool() {
  const [workflowAuditValues, setWorkflowAuditValues] =
    useState<WorkflowAuditValues>(initialWorkflowAuditValues);
  const [workflowAuditErrors, setWorkflowAuditErrors] =
    useState<WorkflowAuditErrors>({});
  const [workflowAuditResult, setWorkflowAuditResult] =
    useState<WorkflowAuditResponse | null>(null);
  const [workflowAuditStatus, setWorkflowAuditStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [workflowAuditMessage, setWorkflowAuditMessage] = useState("");

  function updateWorkflowAuditField(
    field: keyof WorkflowAuditValues,
    value: string,
  ) {
    setWorkflowAuditValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setWorkflowAuditErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));

    setWorkflowAuditResult(null);
    setWorkflowAuditStatus("idle");
    setWorkflowAuditMessage("");
  }

  function toggleToolUsed(tool: string) {
    setWorkflowAuditValues((currentValues) => {
      const exists = currentValues.toolsUsed.includes(tool);

      return {
        ...currentValues,
        toolsUsed: exists
          ? currentValues.toolsUsed.filter((item) => item !== tool)
          : [...currentValues.toolsUsed, tool],
      };
    });

    setWorkflowAuditResult(null);
    setWorkflowAuditStatus("idle");
    setWorkflowAuditMessage("");
  }

  async function generateWorkflowAnalysis() {
    const validationErrors = validateWorkflowAudit(workflowAuditValues);
    setWorkflowAuditErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setWorkflowAuditStatus("error");
      setWorkflowAuditMessage("Please fix the highlighted fields.");
      return;
    }

    setWorkflowAuditStatus("loading");
    setWorkflowAuditMessage("Generating your workflow analysis...");
    setWorkflowAuditResult(null);

    try {
      const response = await fetch("/api/tools/workflow-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workflowAuditValues),
      });

      const result = (await response.json()) as
        | WorkflowAuditResponse
        | { message?: string; errors?: WorkflowAuditErrors };

      if (!response.ok || !("analysis" in result)) {
        if ("errors" in result && result.errors) {
          setWorkflowAuditErrors(result.errors);
        }

        setWorkflowAuditStatus("error");
        setWorkflowAuditMessage(
          "We could not generate the workflow analysis right now. Please try again.",
        );
        return;
      }

      setWorkflowAuditResult(result);
      setWorkflowAuditStatus("idle");
      setWorkflowAuditMessage("");
    } catch {
      setWorkflowAuditStatus("error");
      setWorkflowAuditMessage(
        "We could not generate the workflow analysis right now. Please try again.",
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        className="grid gap-5 rounded-lg border border-[#D9DED8] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void generateWorkflowAnalysis();
        }}
      >
        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-business-type">
            Business type
          </label>
          <select
            id="audit-business-type"
            value={workflowAuditValues.businessType}
            onChange={(event) =>
              updateWorkflowAuditField("businessType", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose a business type</option>
            {businessTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {workflowAuditErrors.businessType ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.businessType}
            </p>
          ) : null}
        </div>

        {workflowAuditValues.businessType === "Other" ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-business-type-other">
              Describe your business type
            </label>
            <input
              id="audit-business-type-other"
              value={workflowAuditValues.businessTypeOther}
              onChange={(event) =>
                updateWorkflowAuditField("businessTypeOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {workflowAuditErrors.businessTypeOther ? (
              <p className="text-sm font-semibold text-red-700">
                {workflowAuditErrors.businessTypeOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-workflow-area">
            Workflow area
          </label>
          <select
            id="audit-workflow-area"
            value={workflowAuditValues.workflowArea}
            onChange={(event) =>
              updateWorkflowAuditField("workflowArea", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose a workflow area</option>
            {workflowAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          {workflowAuditErrors.workflowArea ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.workflowArea}
            </p>
          ) : null}
        </div>

        {workflowAuditValues.workflowArea === "Other" ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-workflow-area-other">
              Describe the workflow area
            </label>
            <input
              id="audit-workflow-area-other"
              value={workflowAuditValues.workflowAreaOther}
              onChange={(event) =>
                updateWorkflowAuditField("workflowAreaOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {workflowAuditErrors.workflowAreaOther ? (
              <p className="text-sm font-semibold text-red-700">
                {workflowAuditErrors.workflowAreaOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-current-process">
            Current process
          </label>
          <textarea
            id="audit-current-process"
            value={workflowAuditValues.currentProcess}
            onChange={(event) =>
              updateWorkflowAuditField("currentProcess", event.target.value)
            }
            className="min-h-32 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Describe how this workflow currently happens."
          />
          {workflowAuditErrors.currentProcess ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.currentProcess}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-main-problem">
            Main problem
          </label>
          <textarea
            id="audit-main-problem"
            value={workflowAuditValues.mainProblem}
            onChange={(event) =>
              updateWorkflowAuditField("mainProblem", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: missed follow-ups, slow replies, unclear ownership."
          />
          {workflowAuditErrors.mainProblem ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.mainProblem}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3">
          <p className="font-bold text-[#17201C]">Tools currently used</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {toolsUsedOptions.map((tool) => (
              <label
                key={tool}
                className="flex items-center gap-2 rounded-md border border-[#D9DED8] bg-white p-3 text-[#17201C]"
              >
                <input
                  checked={workflowAuditValues.toolsUsed.includes(tool)}
                  type="checkbox"
                  onChange={() => toggleToolUsed(tool)}
                />
                {tool}
              </label>
            ))}
          </div>
        </div>

        {workflowAuditValues.toolsUsed.includes("Other") ? (
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-tools-other">
              List other tools used
            </label>
            <input
              id="audit-tools-other"
              value={workflowAuditValues.toolsUsedOther}
              onChange={(event) =>
                updateWorkflowAuditField("toolsUsedOther", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
            />
            {workflowAuditErrors.toolsUsedOther ? (
              <p className="text-sm font-semibold text-red-700">
                {workflowAuditErrors.toolsUsedOther}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-monthly-volume">
              Monthly volume
            </label>
            <select
              id="audit-monthly-volume"
              value={workflowAuditValues.monthlyVolume}
              onChange={(event) =>
                updateWorkflowAuditField("monthlyVolume", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose volume</option>
              {monthlyVolumes.map((volume) => (
                <option key={volume} value={volume}>
                  {volume}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-team-size">
              Team size
            </label>
            <select
              id="audit-team-size"
              value={workflowAuditValues.teamSize}
              onChange={(event) =>
                updateWorkflowAuditField("teamSize", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose team size</option>
              {teamSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-risk-level">
              Risk level
            </label>
            <select
              id="audit-risk-level"
              value={workflowAuditValues.riskLevel}
              onChange={(event) =>
                updateWorkflowAuditField("riskLevel", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose risk level</option>
              {riskLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-desired-outcome">
            Desired outcome
          </label>
          <textarea
            id="audit-desired-outcome"
            value={workflowAuditValues.desiredOutcome}
            onChange={(event) =>
              updateWorkflowAuditField("desiredOutcome", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: fewer missed leads, faster support triage, clearer handoffs."
          />
        </div>

        <p className="rounded-md bg-[#EDF3EF] p-4 text-sm leading-6 text-[#5F6862]">
          Do not include passwords, payment details, private customer records,
          legal documents, or confidential files.
        </p>

        {workflowAuditMessage ? (
          <p className="rounded-md bg-[#EDF3EF] p-4 font-semibold text-red-700">
            {workflowAuditMessage}
          </p>
        ) : null}

        <button
          className="rounded-md bg-[#174F42] px-5 py-3 font-bold text-white hover:bg-[#1F6F5B] disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={workflowAuditStatus === "loading"}
        >
          {workflowAuditStatus === "loading" ? "Generating..." : "Generate Analysis"}
        </button>
      </form>

      <div className="rounded-lg border border-[#D9DED8] bg-white p-5">
        {workflowAuditResult ? (
          <div className="grid gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#5F6862]">
                Analysis Ready
              </p>
              <p className="mt-2 rounded-md bg-[#EDF3EF] p-3 font-bold text-[#17201C]">
                Workflow analysis generated
              </p>
            </div>

            <div>
              <h4 className="text-xl font-bold text-[#17201C]">
                Workflow Summary
              </h4>
              <p className="mt-3 leading-7 text-[#5F6862]">
                {workflowAuditResult.analysis.workflowSummary}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-[#17201C]">
                Current Workflow Condition
              </h4>
              <p className="mt-2 text-[#5F6862]">
                <span className="font-bold text-[#17201C]">
                  {workflowAuditResult.analysis.maturityLevel.level}
                </span>{" "}
                - {workflowAuditResult.analysis.maturityLevel.reason}
              </p>
            </div>

            <SectionList
              title="Main Bottlenecks"
              items={workflowAuditResult.analysis.mainBottlenecks}
            />
            <SectionList
              title="Automation Opportunities"
              items={workflowAuditResult.analysis.automationOpportunities}
            />
            <SectionList
              title="AI Assistance Opportunities"
              items={workflowAuditResult.analysis.aiAssistanceOpportunities}
            />
            <SectionList
              title="Human Review Points"
              items={workflowAuditResult.analysis.humanReviewPoints}
            />

            <div className="rounded-md bg-[#174F42] p-4 text-white">
              <h4 className="font-bold">Suggested Next Action</h4>
              <p className="mt-2 leading-7">
                {workflowAuditResult.analysis.suggestedNextAction}
              </p>
            </div>

            <SectionList
              title="What To Track Going Forward"
              items={workflowAuditResult.analysis.systemLogPreview}
            />
            <SectionList
              title="What Not To Automate Yet"
              items={workflowAuditResult.analysis.doNotAutomateYet}
            />

            <p className="rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#5F6862]">
              {workflowAuditResult.analysis.reviewNote}
            </p>
          </div>
        ) : (
          <div className="rounded-md bg-[#EDF3EF] p-5 leading-7 text-[#5F6862]">
            Add workflow details and generate an instant analysis. The result
            will show bottlenecks, automation opportunities, human review
            points, and a suggested next action.
          </div>
        )}
      </div>
    </div>
  );
}