"use client";

import { useState } from "react";

import { SectionList } from "@/components/tools/SectionList";

type WorkflowAuditValues = {
  businessType: string;
  businessTypeOther: string;
  workflowArea: string;
  workflowAreaOther: string;
  workflowName: string;
  workflowPurpose: string;
  peopleInvolved: string;
  startTrigger: string;
  currentProcess: string;
  mainProblem: string;
  desiredOutcome: string;
  handoffs: string;
  decisionPoints: string;
  exceptionsAndFailureCases: string;
  workflowPriority: string;
  problemEvidence: string;
  primaryAutomationGoal: string;
  stakeholderPerspective: string;
  currentBaseline: string;
  targetImprovement: string;
  kpiOwner: string;
  reviewTimeline: string;
  toolsUsed: string[];
  toolsUsedOther: string;
  monthlyVolume: string;
  teamSize: string;
  riskLevel: string;
};

type WorkflowAuditErrors = Partial<Record<keyof WorkflowAuditValues, string>>;

type WorkflowAuditAnalysis = {
  workflowSummary: string;
  workflowScopeSummary: string;
  currentWorkflowBreakdown: string[];
  maturityLevel: {
    level: string;
    reason: string;
  };
  mainBottlenecks: string[];
  handoffRisks: string[];
  decisionPointReview: string[];
  missingInformationToGather: string[];
  automationReadiness: {
    status: string;
    reason: string;
  };
  automationOpportunities: string[];
  aiAssistanceOpportunities: string[];
  humanReviewPoints: string[];
  successMeasurementPlan: {
    primaryGoal: string;
    stakeholderPerspective: string;
    currentBaseline: string;
    targetImprovement: string;
    kpiOwner: string;
    reviewTimeline: string;
  };
  recommendedKpis: string[];
  currentBaselineToCapture: string[];
  targetOutcome: string;
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
  workflowName: "",
  workflowPurpose: "",
  peopleInvolved: "",
  startTrigger: "",
  currentProcess: "",
  mainProblem: "",
  desiredOutcome: "",
  handoffs: "",
  decisionPoints: "",
  exceptionsAndFailureCases: "",
  workflowPriority: "",
  problemEvidence: "",
  primaryAutomationGoal: "",
  stakeholderPerspective: "",
  currentBaseline: "",
  targetImprovement: "",
  kpiOwner: "",
  reviewTimeline: "",
  toolsUsed: [],
  toolsUsedOther: "",
  monthlyVolume: "",
  teamSize: "",
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

const workflowPriorities = ["Low", "Medium", "High", "Critical", "Not sure"];

const automationGoals = [
  "Save time",
  "Reduce cost",
  "Reduce errors",
  "Improve quality or consistency",
  "Improve response speed",
  "Improve reporting or visibility",
  "Reduce missed revenue opportunities",
  "Improve customer experience",
  "Not sure",
];

const stakeholderPerspectives = [
  "Business owner/founder",
  "Sales team",
  "Support team",
  "Operations team",
  "Finance team",
  "Marketing/content team",
  "Leadership/C-suite",
  "Customer success",
  "Other",
  "Not sure",
];

const reviewTimelines = ["2 weeks", "30 days", "60 days", "90 days", "Not sure"];

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

  if (values.workflowName.trim().length > 120) {
  errors.workflowName = "Workflow name must be 120 characters or less.";
  }

  if (values.workflowPurpose.trim().length > 400) {
    errors.workflowPurpose = "Workflow purpose must be 400 characters or less.";
  }

  if (values.peopleInvolved.trim().length > 300) {
    errors.peopleInvolved = "People or roles involved must be 300 characters or less.";
  }

  if (values.startTrigger.trim().length > 250) {
    errors.startTrigger = "Start trigger must be 250 characters or less.";
  }

  if (values.desiredOutcome.trim().length > 500) {
    errors.desiredOutcome = "Desired outcome must be 500 characters or less.";
  }

  if (values.handoffs.trim().length > 500) {
    errors.handoffs = "Handoffs must be 500 characters or less.";
  }

  if (values.decisionPoints.trim().length > 500) {
    errors.decisionPoints = "Decision points must be 500 characters or less.";
  }

  if (values.exceptionsAndFailureCases.trim().length > 500) {
    errors.exceptionsAndFailureCases =
      "Exceptions or failure cases must be 500 characters or less.";
  }

  if (values.problemEvidence.trim().length > 500) {
    errors.problemEvidence = "Evidence of the problem must be 500 characters or less.";
  }

  if (values.currentBaseline.trim().length > 400) {
    errors.currentBaseline = "Current baseline must be 400 characters or less.";
  }

  if (values.targetImprovement.trim().length > 400) {
    errors.targetImprovement = "Target improvement must be 400 characters or less.";
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

        <div className="rounded-md bg-[#EDF3EF] p-4">
          <h4 className="font-bold text-[#17201C]">Workflow scope</h4>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            Define what workflow is being reviewed, where it starts, who is involved,
            and what outcome it should produce.
          </p>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-workflow-name">
            Workflow name
          </label>
          <input
            id="audit-workflow-name"
            value={workflowAuditValues.workflowName}
            onChange={(event) =>
              updateWorkflowAuditField("workflowName", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Example: Lead follow-up workflow"
          />
          {workflowAuditErrors.workflowName ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.workflowName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-workflow-purpose">
            Workflow purpose
          </label>
          <textarea
            id="audit-workflow-purpose"
            value={workflowAuditValues.workflowPurpose}
            onChange={(event) =>
              updateWorkflowAuditField("workflowPurpose", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="What should this workflow accomplish?"
          />
          {workflowAuditErrors.workflowPurpose ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.workflowPurpose}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-people-involved">
            People or roles involved
          </label>
          <input
            id="audit-people-involved"
            value={workflowAuditValues.peopleInvolved}
            onChange={(event) =>
              updateWorkflowAuditField("peopleInvolved", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Example: founder, sales assistant, support lead"
          />
          {workflowAuditErrors.peopleInvolved ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.peopleInvolved}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-start-trigger">
            Start trigger
          </label>
          <input
            id="audit-start-trigger"
            value={workflowAuditValues.startTrigger}
            onChange={(event) =>
              updateWorkflowAuditField("startTrigger", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            type="text"
            placeholder="Example: new form submission, customer email, closed-won deal"
          />
          {workflowAuditErrors.startTrigger ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.startTrigger}
            </p>
          ) : null}
        </div>

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
            placeholder="Example: every qualified lead gets a clear next follow-up date."
          />
          {workflowAuditErrors.desiredOutcome ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.desiredOutcome}
            </p>
          ) : null}
        </div>

        <div className="rounded-md bg-[#EDF3EF] p-4">
          <h4 className="font-bold text-[#17201C]">Workflow risks and decisions</h4>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            Capture where work moves between people or tools, which decisions are made,
            and what usually goes wrong.
          </p>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-handoffs">
            Handoffs
          </label>
          <textarea
            id="audit-handoffs"
            value={workflowAuditValues.handoffs}
            onChange={(event) =>
              updateWorkflowAuditField("handoffs", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Who passes work to whom? Where does information move between tools or people?"
          />
          {workflowAuditErrors.handoffs ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.handoffs}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-decision-points">
            Decision points
          </label>
          <textarea
            id="audit-decision-points"
            value={workflowAuditValues.decisionPoints}
            onChange={(event) =>
              updateWorkflowAuditField("decisionPoints", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="What decisions happen in this workflow, and who makes them?"
          />
          {workflowAuditErrors.decisionPoints ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.decisionPoints}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-failure-cases">
            Exceptions or failure cases
          </label>
          <textarea
            id="audit-failure-cases"
            value={workflowAuditValues.exceptionsAndFailureCases}
            onChange={(event) =>
              updateWorkflowAuditField("exceptionsAndFailureCases", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: missing information, duplicate records, late approvals, no response."
          />
          {workflowAuditErrors.exceptionsAndFailureCases ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.exceptionsAndFailureCases}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-problem-evidence">
            Evidence of the problem
          </label>
          <textarea
            id="audit-problem-evidence"
            value={workflowAuditValues.problemEvidence}
            onChange={(event) =>
              updateWorkflowAuditField("problemEvidence", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="What shows this workflow is not working well today?"
          />
          {workflowAuditErrors.problemEvidence ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.problemEvidence}
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

        <div className="rounded-md bg-[#EDF3EF] p-4">
          <h4 className="font-bold text-[#17201C]">Success measurement</h4>
          <p className="mt-2 text-sm leading-6 text-[#5F6862]">
            Define what success should look like before automation is added.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-workflow-priority">
              Workflow priority
            </label>
            <select
              id="audit-workflow-priority"
              value={workflowAuditValues.workflowPriority}
              onChange={(event) =>
                updateWorkflowAuditField("workflowPriority", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose priority</option>
              {workflowPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-automation-goal">
              Primary automation goal
            </label>
            <select
              id="audit-automation-goal"
              value={workflowAuditValues.primaryAutomationGoal}
              onChange={(event) =>
                updateWorkflowAuditField("primaryAutomationGoal", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose goal</option>
              {automationGoals.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-stakeholder-perspective">
            Who cares most about this workflow?
          </label>
          <select
            id="audit-stakeholder-perspective"
            value={workflowAuditValues.stakeholderPerspective}
            onChange={(event) =>
              updateWorkflowAuditField("stakeholderPerspective", event.target.value)
            }
            className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
          >
            <option value="">Choose stakeholder</option>
            {stakeholderPerspectives.map((stakeholder) => (
              <option key={stakeholder} value={stakeholder}>
                {stakeholder}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-current-baseline">
            Current baseline
          </label>
          <textarea
            id="audit-current-baseline"
            value={workflowAuditValues.currentBaseline}
            onChange={(event) =>
              updateWorkflowAuditField("currentBaseline", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: follow-up takes 1-3 days, 5 leads are missed monthly, CRM fields are often incomplete."
          />
          {workflowAuditErrors.currentBaseline ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.currentBaseline}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#17201C]" htmlFor="audit-target-improvement">
            Target improvement
          </label>
          <textarea
            id="audit-target-improvement"
            value={workflowAuditValues.targetImprovement}
            onChange={(event) =>
              updateWorkflowAuditField("targetImprovement", event.target.value)
            }
            className="min-h-24 rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
            placeholder="Example: respond within 24 hours and track every next follow-up date."
          />
          {workflowAuditErrors.targetImprovement ? (
            <p className="text-sm font-semibold text-red-700">
              {workflowAuditErrors.targetImprovement}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-kpi-owner">
              KPI owner
            </label>
            <input
              id="audit-kpi-owner"
              value={workflowAuditValues.kpiOwner}
              onChange={(event) =>
                updateWorkflowAuditField("kpiOwner", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] px-4 py-3 text-[#17201C]"
              type="text"
              placeholder="Example: founder, sales manager, operations lead"
            />
          </div>

          <div className="grid gap-2">
            <label className="font-bold text-[#17201C]" htmlFor="audit-review-timeline">
              Review timeline
            </label>
            <select
              id="audit-review-timeline"
              value={workflowAuditValues.reviewTimeline}
              onChange={(event) =>
                updateWorkflowAuditField("reviewTimeline", event.target.value)
              }
              className="rounded-md border border-[#D9DED8] bg-white px-4 py-3 text-[#17201C]"
            >
              <option value="">Choose timeline</option>
              {reviewTimelines.map((timeline) => (
                <option key={timeline} value={timeline}>
                  {timeline}
                </option>
              ))}
            </select>
          </div>
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
                Workflow audit generated
              </p>
            </div>

            <div>
              <h4 className="text-xl font-bold text-[#17201C]">Workflow Summary</h4>
              <p className="mt-3 leading-7 text-[#5F6862]">
                {workflowAuditResult.analysis.workflowSummary}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-[#17201C]">Workflow Scope</h4>
              <p className="mt-2 leading-7 text-[#5F6862]">
                {workflowAuditResult.analysis.workflowScopeSummary}
              </p>
            </div>

            <SectionList
              title="Current Workflow Breakdown"
              items={workflowAuditResult.analysis.currentWorkflowBreakdown}
            />

            <div>
              <h4 className="font-bold text-[#17201C]">
                Current Workflow Condition
              </h4>
              <p className="mt-2 leading-7 text-[#5F6862]">
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
              title="Handoff Risks"
              items={workflowAuditResult.analysis.handoffRisks}
            />

            <SectionList
              title="Decision Points To Review"
              items={workflowAuditResult.analysis.decisionPointReview}
            />

            <SectionList
              title="Missing Information To Gather"
              items={workflowAuditResult.analysis.missingInformationToGather}
            />

            <div>
              <h4 className="font-bold text-[#17201C]">Automation Readiness</h4>
              <p className="mt-2 leading-7 text-[#5F6862]">
                <span className="font-bold text-[#17201C]">
                  {workflowAuditResult.analysis.automationReadiness.status}
                </span>{" "}
                - {workflowAuditResult.analysis.automationReadiness.reason}
              </p>
            </div>

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

            <div className="rounded-md border border-[#D9DED8] p-4">
              <h4 className="text-lg font-bold text-[#17201C]">
                Success Measurement Plan
              </h4>

              <div className="mt-4 grid gap-3">
                {Object.entries(workflowAuditResult.analysis.successMeasurementPlan).map(
                  ([label, value]) => (
                    <div key={label} className="rounded-md bg-[#EDF3EF] p-3">
                      <p className="font-bold capitalize text-[#17201C]">
                        {label.replace(/([A-Z])/g, " $1")}
                      </p>
                      <p className="mt-1 leading-7 text-[#5F6862]">{value}</p>
                    </div>
                  ),
                )}
              </div>
            </div>

            <SectionList
              title="Recommended KPIs"
              items={workflowAuditResult.analysis.recommendedKpis}
            />

            <SectionList
              title="Current Baseline To Capture"
              items={workflowAuditResult.analysis.currentBaselineToCapture}
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
              title="Keep Human Review For"
              items={workflowAuditResult.analysis.doNotAutomateYet}
            />

            <p className="rounded-md bg-[#EDF3EF] p-4 leading-7 text-[#5F6862]">
              {workflowAuditResult.analysis.reviewNote}
            </p>
          </div>
        ) : (
          <div className="rounded-md bg-[#EDF3EF] p-5 leading-7 text-[#5F6862]">
            Add workflow details and generate an instant analysis. The result will
            show bottlenecks, handoff risks, decision points, automation readiness,
            success metrics, human review points, and a suggested next action.
          </div>
        )}
      </div>
    </div>
  );
}