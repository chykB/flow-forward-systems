import OpenAI from "openai";
import { NextResponse } from "next/server";

type WorkflowAuditMode = "ai" | "structured-analysis";

type WorkflowAuditRequestBody = {
  businessType?: unknown;
  businessTypeOther?: unknown;
  workflowArea?: unknown;
  workflowAreaOther?: unknown;
  workflowName?: unknown;
  workflowPurpose?: unknown;
  peopleInvolved?: unknown;
  startTrigger?: unknown;
  currentProcess?: unknown;
  mainProblem?: unknown;
  desiredOutcome?: unknown;
  handoffs?: unknown;
  decisionPoints?: unknown;
  exceptionsAndFailureCases?: unknown;
  workflowPriority?: unknown;
  problemEvidence?: unknown;
  primaryAutomationGoal?: unknown;
  stakeholderPerspective?: unknown;
  currentBaseline?: unknown;
  targetImprovement?: unknown;
  kpiOwner?: unknown;
  reviewTimeline?: unknown;
  toolsUsed?: unknown;
  toolsUsedOther?: unknown;
  monthlyVolume?: unknown;
  teamSize?: unknown;
  riskLevel?: unknown;
};

type WorkflowAuditErrors = Partial<Record<keyof WorkflowAuditRequestBody, string>>;

type WorkflowAuditValues = {
  businessType: string;
  workflowArea: string;
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

const workflowAreas = [
  "Sales",
  "Customer Support",
  "Content",
  "RevOps",
  "Operations",
  "Other",
];

const businessTypes = [
  "Coaching business",
  "Agency",
  "Clinic",
  "SaaS company",
  "Creator business",
  "Local service business",
  "Other",
];

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isAllowedValue(value: string, allowedValues: string[]) {
  return allowedValues.includes(value);
}

function textHas(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();

  return keywords.some((keyword) => normalized.includes(keyword));
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength;
}

function formatBusinessType(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "this business";
  }

  const lower = normalized.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? "an" : "a";

  return `${article} ${lower}`;
}

function normalizeSentence(value: string) {
  const trimmed = value.trim().replace(/[.?!]+$/, "");

  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function validateWorkflowAuditPayload(body: WorkflowAuditRequestBody) {
  const errors: WorkflowAuditErrors = {};

  const businessTypeRaw = getString(body.businessType);
  const businessTypeOther = getString(body.businessTypeOther);
  const workflowAreaRaw = getString(body.workflowArea);
  const workflowAreaOther = getString(body.workflowAreaOther);

  const values: WorkflowAuditValues = {
    businessType:
      businessTypeRaw === "Other" && businessTypeOther
        ? businessTypeOther
        : businessTypeRaw,
    workflowArea:
      workflowAreaRaw === "Other" && workflowAreaOther
        ? workflowAreaOther
        : workflowAreaRaw,
    workflowName: getString(body.workflowName),
    workflowPurpose: getString(body.workflowPurpose),
    peopleInvolved: getString(body.peopleInvolved),
    startTrigger: getString(body.startTrigger),
    currentProcess: getString(body.currentProcess),
    mainProblem: getString(body.mainProblem),
    desiredOutcome: getString(body.desiredOutcome),
    handoffs: getString(body.handoffs),
    decisionPoints: getString(body.decisionPoints),
    exceptionsAndFailureCases: getString(body.exceptionsAndFailureCases),
    workflowPriority: getString(body.workflowPriority),
    problemEvidence: getString(body.problemEvidence),
    primaryAutomationGoal: getString(body.primaryAutomationGoal),
    stakeholderPerspective: getString(body.stakeholderPerspective),
    currentBaseline: getString(body.currentBaseline),
    targetImprovement: getString(body.targetImprovement),
    kpiOwner: getString(body.kpiOwner),
    reviewTimeline: getString(body.reviewTimeline),
    toolsUsed: getStringArray(body.toolsUsed),
    toolsUsedOther: getString(body.toolsUsedOther),
    monthlyVolume: getString(body.monthlyVolume),
    teamSize: getString(body.teamSize),
    riskLevel: getString(body.riskLevel),
  };

  if (!businessTypeRaw || !isAllowedValue(businessTypeRaw, businessTypes)) {
    errors.businessType = "Choose a business type.";
  }

  if (businessTypeRaw === "Other" && businessTypeOther.length < 2) {
    errors.businessTypeOther = "Describe your business type.";
  }

  if (!workflowAreaRaw || !isAllowedValue(workflowAreaRaw, workflowAreas)) {
    errors.workflowArea = "Choose a workflow area.";
  }

  if (workflowAreaRaw === "Other" && workflowAreaOther.length < 2) {
    errors.workflowAreaOther = "Describe the workflow area.";
  }

  if (values.currentProcess.length < 20) {
    errors.currentProcess = "Describe how the workflow currently happens.";
  }

  if (values.mainProblem.length < 10) {
    errors.mainProblem = "Describe the main workflow problem.";
  }

  if (values.toolsUsed.includes("Other") && values.toolsUsedOther.length < 2) {
    errors.toolsUsedOther = "List the other tools used.";
  }

  const maxLengthChecks: [keyof WorkflowAuditValues, string, number][] = [
    ["workflowName", "Workflow name must be 120 characters or less.", 120],
    ["workflowPurpose", "Workflow purpose must be 400 characters or less.", 400],
    ["peopleInvolved", "People or roles involved must be 300 characters or less.", 300],
    ["startTrigger", "Start trigger must be 250 characters or less.", 250],
    ["desiredOutcome", "Desired outcome must be 500 characters or less.", 500],
    ["handoffs", "Handoffs must be 500 characters or less.", 500],
    ["decisionPoints", "Decision points must be 500 characters or less.", 500],
    [
      "exceptionsAndFailureCases",
      "Exceptions or failure cases must be 500 characters or less.",
      500,
    ],
    ["problemEvidence", "Evidence of the problem must be 500 characters or less.", 500],
    ["currentBaseline", "Current baseline must be 400 characters or less.", 400],
    ["targetImprovement", "Target improvement must be 400 characters or less.", 400],
  ];

  maxLengthChecks.forEach(([field, message, maxLength]) => {
    const value = values[field];

    if (typeof value === "string" && limitText(value, maxLength)) {
      errors[field] = message;
    }
  });

  return { errors, values };
}

function getCurrentWorkflowCondition(values: WorkflowAuditValues) {
  const text = `${values.currentProcess} ${values.mainProblem} ${values.handoffs} ${values.problemEvidence}`;

  if (
    textHas(text, [
      "manual",
      "memory",
      "missed",
      "forgot",
      "spreadsheet",
      "unclear",
      "delayed",
      "duplicate",
      "not tracked",
    ])
  ) {
    return {
      level: "Manual or partially structured workflow",
      reason:
        "The workflow appears to depend on manual tracking, unclear ownership, delayed updates, or scattered information.",
    };
  }

  if (values.currentBaseline && values.targetImprovement) {
    return {
      level: "Structured workflow ready for measurement",
      reason:
        "The workflow has enough context to compare the current state against a target improvement.",
    };
  }

  return {
    level: "Workflow needs clearer mapping",
    reason:
      "The workflow can be improved, but the start point, steps, owners, outcomes, or measurement baseline may need more detail.",
  };
}

function getMainBottlenecks(values: WorkflowAuditValues) {
  const text = `${values.currentProcess} ${values.mainProblem} ${values.problemEvidence}`;
  const bottlenecks: string[] = [];

  if (textHas(text, ["follow", "lead", "response", "reply"])) {
    bottlenecks.push("Follow-up or response timing may be inconsistent.");
  }

  if (textHas(text, ["manual", "copy", "spreadsheet", "notes"])) {
    bottlenecks.push("Manual tracking or repeated data entry may be slowing the workflow.");
  }

  if (textHas(text, ["ownership", "owner", "who", "unclear"])) {
    bottlenecks.push("Workflow ownership may not be clear enough.");
  }

  if (textHas(text, ["handoff", "handover", "passed", "transfer"])) {
    bottlenecks.push("Handoffs may be causing delays or lost context.");
  }

  if (textHas(text, ["duplicate", "missing", "incomplete", "wrong"])) {
    bottlenecks.push("Data quality issues may be creating rework or poor visibility.");
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push("The workflow needs clearer step tracking, ownership, and success measurement.");
  }

  return bottlenecks;
}

function getHandoffRisks(values: WorkflowAuditValues) {
  if (!values.handoffs) {
    return [
      "List every person, team, or tool that receives work from another step.",
      "Check where work waits for approval, manual update, or follow-up.",
      "Identify where context is lost between tools or people.",
    ];
  }

  return [
    "Review whether each handoff has a clear owner.",
    "Confirm what information must be passed during each handoff.",
    "Track where delays happen after a handoff.",
    `Current handoff note: ${values.handoffs}`,
  ];
}

function getDecisionPointReview(values: WorkflowAuditValues) {
  if (!values.decisionPoints) {
    return [
      "Identify which decisions happen inside the workflow.",
      "Write the rule or judgment used for each decision.",
      "Separate decisions that can be assisted by AI from decisions that require human review.",
    ];
  }

  return [
    `Current decision points: ${values.decisionPoints}`,
    "Use clear rules for repeatable decisions.",
    "Keep human review for sensitive, high-value, legal, financial, or customer-trust decisions.",
  ];
}

function getMissingInformationToGather(values: WorkflowAuditValues) {
  const missing: string[] = [];

  if (!values.workflowName) {
    missing.push("Workflow name.");
  }

  if (!values.workflowPurpose) {
    missing.push("Workflow purpose.");
  }

  if (!values.peopleInvolved) {
    missing.push("People or roles involved.");
  }

  if (!values.startTrigger) {
    missing.push("Start trigger.");
  }

  if (!values.desiredOutcome) {
    missing.push("Desired outcome.");
  }

  if (!values.currentBaseline) {
    missing.push("Current baseline for time, cost, errors, volume, or response speed.");
  }

  if (!values.targetImprovement) {
    missing.push("Target improvement that would count as success.");
  }

  if (missing.length === 0) {
    missing.push("No major missing workflow details were detected from the information provided.");
  }

  return missing;
}

function getAutomationReadiness(values: WorkflowAuditValues) {
  const hasScope = Boolean(values.workflowPurpose && values.startTrigger && values.desiredOutcome);
  const hasMeasurement = Boolean(values.currentBaseline && values.targetImprovement);
  const hasDecisions = Boolean(values.decisionPoints);
  const hasFailures = Boolean(values.exceptionsAndFailureCases);

  if (hasScope && hasMeasurement && hasDecisions && hasFailures) {
    return {
      status: "Ready for a focused automation plan",
      reason:
        "The workflow has scope, measurement, decision points, and failure cases defined well enough to choose a first automation safely.",
    };
  }

  if (hasScope || hasMeasurement) {
    return {
      status: "Partially ready",
      reason:
        "The workflow has useful context, but more detail is needed before deeper automation is designed.",
    };
  }

  return {
    status: "Map before automating",
    reason:
      "The workflow should be mapped more clearly before automation is added.",
  };
}

function getAutomationOpportunities(values: WorkflowAuditValues) {
  const opportunities = [
    "Create a structured workflow tracker with owner, status, next action, and due date.",
    "Add required fields so important information is captured before work moves forward.",
    "Use reminders or alerts when work is waiting too long.",
    "Create a simple status view so delayed or stuck work is visible.",
  ];

  if (values.startTrigger) {
    opportunities.unshift("Use the start trigger to capture new workflow items consistently.");
  }

  if (values.currentBaseline && values.targetImprovement) {
    opportunities.push("Track the baseline and target improvement so automation impact can be measured.");
  }

  return opportunities;
}

function getAiAssistanceOpportunities(values: WorkflowAuditValues) {
  const opportunities = [
    "Summarize workflow requests or updates.",
    "Classify workflow items by type, urgency, or risk.",
    "Draft next-step recommendations for human review.",
    "Identify missing information before work moves forward.",
  ];

  if (values.decisionPoints) {
    opportunities.push("Assist repeatable decisions while keeping final approval with a human.");
  }

  return opportunities;
}

function getHumanReviewPoints(values: WorkflowAuditValues) {
  const points = [
    "Customer-facing messages.",
    "Pricing, refunds, billing, or financial decisions.",
    "Legal, compliance, security, or privacy issues.",
    "High-value or sensitive workflow decisions.",
  ];

  if (values.riskLevel === "High") {
    points.unshift("Any workflow step marked high risk.");
  }

  return points;
}

function getRecommendedKpis(values: WorkflowAuditValues) {
  const area = values.workflowArea.toLowerCase();

  if (area.includes("sales") || area.includes("revops")) {
    return [
      "First response time.",
      "Missed follow-up count.",
      "Lead stage completion.",
      "CRM field completion rate.",
      "Stalled deal count.",
      "Lost reason capture rate.",
    ];
  }

  if (area.includes("support")) {
    return [
      "First response time.",
      "Resolution time.",
      "Escalation rate.",
      "Reopened request count.",
      "Customer satisfaction or feedback trend.",
    ];
  }

  if (area.includes("content")) {
    return [
      "Time from idea to draft.",
      "Publishing consistency.",
      "Repurposed content count.",
      "Review completion time.",
      "Engagement by content type.",
    ];
  }

  if (area.includes("operations")) {
    return [
      "Cycle time.",
      "Manual touches per workflow run.",
      "Rework count.",
      "Approval delay.",
      "Completion rate.",
    ];
  }

  return [
    "Time saved.",
    "Manual steps reduced.",
    "Error or rework rate.",
    "Workflow completion time.",
    "Successful versus failed workflow runs.",
  ];
}

function getCurrentBaselineToCapture(values: WorkflowAuditValues) {
  const baseline = [
    "Current workflow completion time.",
    "Number of workflow runs per week or month.",
    "Manual steps required today.",
    "Error, delay, duplicate, or rework count.",
    "Current owner and status visibility.",
  ];

  if (values.currentBaseline) {
    baseline.unshift(`Submitted baseline: ${values.currentBaseline}`);
  }

  return baseline;
}

function buildRuleBasedWorkflowAuditAnalysis(
  values: WorkflowAuditValues,
  
): WorkflowAuditAnalysis {
  const businessType = formatBusinessType(values.businessType);
  const workflowName = values.workflowName || "This workflow";
  const workflowPurpose = values.workflowPurpose
    ? normalizeSentence(values.workflowPurpose)
    : "move work toward a defined business outcome";
  const condition = getCurrentWorkflowCondition(values);
  const automationReadiness = getAutomationReadiness(values);
  const targetOutcome =
    values.targetImprovement ||
    values.desiredOutcome ||
    "Define a measurable target before implementing automation.";

  return {
    workflowSummary: `This ${values.workflowArea.toLowerCase()} workflow for ${businessType} currently works like this: ${values.currentProcess}`,
    workflowScopeSummary:
      values.workflowName || values.workflowPurpose
        ? `${workflowName} exists to ${workflowPurpose}.`
        : "The workflow needs a clearer name, purpose, start trigger, and desired outcome.",
    currentWorkflowBreakdown: [
      `Starts when: ${values.startTrigger || "Not provided."}`,
      `People or roles involved: ${values.peopleInvolved || "Not provided."}`,
      `Current process: ${values.currentProcess}`,
      `Desired outcome: ${values.desiredOutcome || "Not provided."}`,
    ],
    maturityLevel: condition,
    mainBottlenecks: getMainBottlenecks(values),
    handoffRisks: getHandoffRisks(values),
    decisionPointReview: getDecisionPointReview(values),
    missingInformationToGather: getMissingInformationToGather(values),
    automationReadiness,
    automationOpportunities: getAutomationOpportunities(values),
    aiAssistanceOpportunities: getAiAssistanceOpportunities(values),
    humanReviewPoints: getHumanReviewPoints(values),
    successMeasurementPlan: {
      primaryGoal: values.primaryAutomationGoal || "Clarify the main automation goal.",
      stakeholderPerspective:
        values.stakeholderPerspective ||
        "Clarify which stakeholder will judge whether the workflow improved.",
      currentBaseline:
        values.currentBaseline ||
        "Capture the current time, cost, error rate, response speed, or manual effort before automation.",
      targetImprovement: targetOutcome,
      kpiOwner: values.kpiOwner || "Assign one person to own KPI tracking.",
      reviewTimeline:
        values.reviewTimeline || "Review the workflow after 30 to 60 days of use.",
    },
    recommendedKpis: getRecommendedKpis(values),
    currentBaselineToCapture: getCurrentBaselineToCapture(values),
    targetOutcome,
    suggestedNextAction:
      "Map the workflow from trigger to outcome, confirm the owner for each handoff, capture the current baseline, then automate one repeatable step first.",
    systemLogPreview: [
      "Workflow name.",
      "Submission time.",
      "Workflow area.",
      "Start trigger.",
      "Owner.",
      "Current status.",
      "Next action.",
      "Human review point.",
      "KPI result.",
      "Final outcome.",
    ],
    doNotAutomateYet: [
      "Steps with unclear ownership.",
      "Decisions without clear rules.",
      "Customer-facing messages without review.",
      "Financial, legal, billing, refund, or pricing decisions.",
      "Actions based on incomplete or unverified data.",
    ],
    reviewNote:
      "This analysis is a planning aid. Review the workflow with the people involved, confirm the baseline, and keep human review where customers, money, legal issues, or sensitive data are involved.",
  };
}

function buildWorkflowAuditPrompt(values: WorkflowAuditValues) {
  return `You are helping perform a practical workflow audit for a business.

Return only valid JSON. Do not include markdown.

Use this exact JSON shape:
{
  "workflowSummary": "string",
  "workflowScopeSummary": "string",
  "currentWorkflowBreakdown": ["string"],
  "maturityLevel": { "level": "string", "reason": "string" },
  "mainBottlenecks": ["string"],
  "handoffRisks": ["string"],
  "decisionPointReview": ["string"],
  "missingInformationToGather": ["string"],
  "automationReadiness": { "status": "string", "reason": "string" },
  "automationOpportunities": ["string"],
  "aiAssistanceOpportunities": ["string"],
  "humanReviewPoints": ["string"],
  "successMeasurementPlan": {
    "primaryGoal": "string",
    "stakeholderPerspective": "string",
    "currentBaseline": "string",
    "targetImprovement": "string",
    "kpiOwner": "string",
    "reviewTimeline": "string"
  },
  "recommendedKpis": ["string"],
  "currentBaselineToCapture": ["string"],
  "targetOutcome": "string",
  "suggestedNextAction": "string",
  "systemLogPreview": ["string"],
  "doNotAutomateYet": ["string"],
  "reviewNote": "string"
}

Rules:
- Make the audit practical and business-focused.
- Include bottlenecks, handoff risks, decision points, automation readiness, and measurement.
- Do not promise guaranteed savings or revenue.
- Keep human review for money, legal, privacy, security, customers, pricing, refunds, and sensitive decisions.
- Recommend KPIs that fit the workflow area.
- If the user did not provide enough detail, include it in missingInformationToGather.

Workflow details:
${JSON.stringify(values, null, 2)}`;
}

function parseJsonOutput(outputText: string) {
  const cleaned = outputText
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  return JSON.parse(cleaned) as WorkflowAuditAnalysis;
}

export async function POST(request: Request) {
  let body: WorkflowAuditRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }

  const { errors, values } = validateWorkflowAuditPayload(body);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { message: "Please fix the highlighted fields.", errors },
      { status: 400 },
    );
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const aiEnabled = process.env.WORKFLOW_AUDIT_AI_ENABLED === "true";

  if (!aiEnabled || !openAiApiKey) {
    return NextResponse.json({
      mode: "structured-analysis" satisfies WorkflowAuditMode,
      analysis: buildRuleBasedWorkflowAuditAnalysis(values),
    });
  }

  const openai = new OpenAI({
    apiKey: openAiApiKey,
  });

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: buildWorkflowAuditPrompt(values),
      temperature: 0.2,
      max_output_tokens: 1800,
    });

    const outputText = response.output_text;

    if (!outputText) {
      return NextResponse.json({
        mode: "structured-analysis" satisfies WorkflowAuditMode,
        analysis: buildRuleBasedWorkflowAuditAnalysis(values),
      });
    }

    return NextResponse.json({
      mode: "ai" satisfies WorkflowAuditMode,
      analysis: parseJsonOutput(outputText),
    });
  } catch (error) {
    console.error("Workflow audit AI generation failed", error);

    return NextResponse.json({
      mode: "structured-analysis" satisfies WorkflowAuditMode,
      analysis: buildRuleBasedWorkflowAuditAnalysis(values),
    });
  }
}