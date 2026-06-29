export type SalesWorkflowValues = {
  businessType: string;
  businessTypeOther: string;
  leadSources: string[];
  leadSourcesOther: string;
  monthlyLeadVolume: string;
  averageDealValue: string;
  teamSize: string;
  currentResponseTime: string;
  targetResponseTime: string;
  crmTool: string;
  crmToolOther: string;
  currentLeadProcess: string;
  qualificationProcess: string;
  followUpProcess: string;
  dealTrackingProcess: string;
  mainSalesGoals: string[];
  mainSalesProblem: string;
  revenueLeakageEvidence: string;
  salesWorkflowOwner: string;
  targetImprovement: string;
};

export type SalesWorkflowErrors = Partial<
  Record<keyof SalesWorkflowValues, string>
>;

export type SalesFollowUpStep = {
  timing: string;
  action: string;
};

export type SalesWorkflowResult = {
  workflowSummary: string;
  salesWorkflowHealth: {
    status: string;
    reason: string;
  };
  salesWorkflowReadiness: {
    status: string;
    reason: string;
  };
  priorityOutcomes: string[];
  revenueLeakageSignals: string[];
  mainBottlenecks: string[];
  leadCaptureRecommendations: string[];
  speedToLeadRecommendations: string[];
  qualificationQuestions: string[];
  followUpSequence: SalesFollowUpStep[];
  crmFieldsToTrack: string[];
  suggestedDealStages: string[];
  salesReportingMetrics: string[];
  salesKpiPlan: string[];
  baselineToCapture: string[];
  automationOpportunities: string[];
  suggestedFirstAutomation: string;
  humanReviewPoints: string[];
  targetImprovement: string;
  suggestedNextAction: string;
  futureSystemLogPreview: string[];
  doNotAutomateYet: string[];
};

export const initialSalesWorkflowValues: SalesWorkflowValues = {
  businessType: "",
  businessTypeOther: "",
  leadSources: [],
  leadSourcesOther: "",
  monthlyLeadVolume: "",
  averageDealValue: "",
  teamSize: "",
  currentResponseTime: "",
  targetResponseTime: "",
  crmTool: "",
  crmToolOther: "",
  currentLeadProcess: "",
  qualificationProcess: "",
  followUpProcess: "",
  dealTrackingProcess: "",
  mainSalesGoals: [],
  mainSalesProblem: "",
  revenueLeakageEvidence: "",
  salesWorkflowOwner: "",
  targetImprovement: "",
};

export const salesBusinessTypes = [
  "Coaching business",
  "Agency",
  "Consulting business",
  "Local service business",
  "Clinic",
  "SaaS company",
  "Real estate business",
  "Event business",
  "Creator business",
  "Other",
];

export const leadSourceOptions = [
  "Website form",
  "Email",
  "Instagram DMs",
  "LinkedIn",
  "Facebook",
  "WhatsApp",
  "Phone calls",
  "Referrals",
  "Paid ads",
  "Events",
  "Marketplace/platform leads",
  "Other",
];

export const monthlyLeadVolumeOptions = [
  "Less than 25",
  "25-100",
  "101-500",
  "501-1000",
  "More than 1000",
  "Not sure",
];

export const averageDealValueOptions = [
  "Less than $500",
  "$500-$2,000",
  "$2,001-$10,000",
  "$10,001-$50,000",
  "More than $50,000",
  "Not sure",
];

export const salesTeamSizeOptions = [
  "Solo",
  "2-5",
  "6-20",
  "21-50",
  "51+",
  "Not sure",
];

export const responseTimeOptions = [
  "Under 5 minutes",
  "5-30 minutes",
  "30 minutes-2 hours",
  "Same day",
  "Next day",
  "More than 1 day",
  "Not sure",
];

export const crmToolOptions = [
  "No CRM yet",
  "Spreadsheet",
  "HubSpot",
  "Salesforce",
  "Pipedrive",
  "Zoho CRM",
  "Notion",
  "Airtable",
  "Other",
];

export const salesGoalOptions = [
  "Capture more leads properly",
  "Reduce missed follow-ups",
  "Improve speed-to-lead",
  "Qualify leads faster",
  "Organize lead and customer information",
  "Improve CRM updates",
  "Track deal stages more clearly",
  "Improve sales reporting or visibility",
  "Reduce manual data entry",
  "Assign lead owners clearly",
  "Reduce duplicate lead records",
  "Improve proposal follow-up",
  "Create nurture steps for not-ready leads",
  "Track lost reasons",
  "Improve closed-won handoff",
];

export function validateSalesWorkflow(values: SalesWorkflowValues) {
  const errors: SalesWorkflowErrors = {};

  if (!values.businessType) {
    errors.businessType = "Choose a business type.";
  }

  if (values.businessType === "Other" && values.businessTypeOther.trim().length < 2) {
    errors.businessTypeOther = "Describe your business type.";
  }

  if (values.leadSources.length === 0) {
    errors.leadSources = "Choose at least one lead source.";
  }

  if (values.leadSources.includes("Other") && values.leadSourcesOther.trim().length < 2) {
    errors.leadSourcesOther = "List the other lead source.";
  }

  if (!values.monthlyLeadVolume) {
    errors.monthlyLeadVolume = "Choose monthly lead volume.";
  }

  if (!values.averageDealValue) {
    errors.averageDealValue = "Choose average deal value.";
  }

  if (!values.targetResponseTime) {
    errors.targetResponseTime = "Choose target response time.";
  }

  if (values.revenueLeakageEvidence.trim().length > 500) {
    errors.revenueLeakageEvidence =
      "Revenue leakage evidence must be 500 characters or less.";
  }

  if (values.salesWorkflowOwner.trim().length > 120) {
    errors.salesWorkflowOwner = "Sales workflow owner must be 120 characters or less.";
  }

  if (values.targetImprovement.trim().length > 400) {
    errors.targetImprovement = "Target improvement must be 400 characters or less.";
  }

  if (!values.currentResponseTime) {
    errors.currentResponseTime = "Choose current response time.";
  }

  if (!values.crmTool) {
    errors.crmTool = "Choose the CRM or tracker currently used.";
  }

  if (values.crmTool === "Other" && values.crmToolOther.trim().length < 2) {
    errors.crmToolOther = "Name the CRM or tracker.";
  }

  if (values.currentLeadProcess.trim().length < 20) {
    errors.currentLeadProcess = "Describe how leads are currently captured and handled.";
  }

  if (values.followUpProcess.trim().length < 10) {
    errors.followUpProcess = "Describe how follow-up currently happens.";
  }

  if (values.mainSalesGoals.length === 0) {
    errors.mainSalesGoals = "Choose at least one sales workflow goal.";
  }

  if (values.mainSalesProblem.trim().length < 10) {
    errors.mainSalesProblem = "Describe the main sales workflow problem.";
  }

  return errors;
}

function resolveBusinessType(values: SalesWorkflowValues) {
  return values.businessType === "Other" && values.businessTypeOther
    ? values.businessTypeOther
    : values.businessType;
}

function resolveCrmTool(values: SalesWorkflowValues) {
  return values.crmTool === "Other" && values.crmToolOther
    ? values.crmToolOther
    : values.crmTool;
}

function textHas(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function includesGoal(values: SalesWorkflowValues, goal: string) {
  return values.mainSalesGoals.includes(goal);
}

function getSalesWorkflowHealth(values: SalesWorkflowValues) {
  const combinedText = `${values.currentLeadProcess} ${values.followUpProcess} ${values.dealTrackingProcess} ${values.mainSalesProblem}`;
  const slowResponse = ["Same day", "Next day", "More than 1 day", "Not sure"].includes(
    values.currentResponseTime,
  );
  const noCrm = values.crmTool === "No CRM yet" || values.crmTool === "Spreadsheet";
  const manualSignals = textHas(combinedText, [
    "manual",
    "memory",
    "notes",
    "spreadsheet",
    "forget",
    "forgot",
    "miss",
    "unclear",
    "not tracked",
  ]);

  if (slowResponse && noCrm) {
    return {
      status: "High leakage risk",
      reason:
        "Lead response and lead tracking both appear weak, so warm leads may be missed before they are qualified.",
    };
  }

  if (slowResponse || manualSignals || noCrm) {
    return {
      status: "Needs workflow improvement",
      reason:
        "Parts of the sales workflow still depend on manual tracking, delayed response, or unclear visibility.",
    };
  }

  return {
    status: "Structured but improvable",
    reason:
      "The workflow has some structure, but better tracking, follow-up rules, and reporting can improve consistency.",
  };
}

function getPriorityOutcomes(values: SalesWorkflowValues) {
  const outcomes = new Set<string>();

  values.mainSalesGoals.forEach((goal) => outcomes.add(goal));

  if (["Same day", "Next day", "More than 1 day", "Not sure"].includes(values.currentResponseTime)) {
    outcomes.add("Improve speed-to-lead");
  }

  if (values.crmTool === "No CRM yet" || values.crmTool === "Spreadsheet") {
    outcomes.add("Organize lead and customer information");
    outcomes.add("Improve sales reporting or visibility");
  }

  if (textHas(values.followUpProcess, ["manual", "memory", "forget", "forgot", "miss", "spreadsheet"])) {
    outcomes.add("Reduce missed follow-ups");
  }

  return Array.from(outcomes).slice(0, 6);
}

function getRevenueLeakageSignals(values: SalesWorkflowValues) {
  const signals: string[] = [];
  const text = `${values.mainSalesProblem} ${values.revenueLeakageEvidence} ${values.followUpProcess} ${values.dealTrackingProcess}`;

  if (textHas(text, ["miss", "missed", "forgot", "forget", "no follow", "not followed"])) {
    signals.push("Leads or deals may be lost because follow-up is inconsistent.");
  }

  if (["Same day", "Next day", "More than 1 day", "Not sure"].includes(values.currentResponseTime)) {
    signals.push("Slow first response may be reducing conversion from warm leads.");
  }

  if (textHas(text, ["proposal", "quote", "estimate"])) {
    signals.push("Proposal or quote follow-up may be leaking revenue.");
  }

  if (textHas(text, ["crm", "spreadsheet", "not updated", "missing", "incomplete"])) {
    signals.push("CRM or tracker gaps may be hiding sales opportunities.");
  }

  if (textHas(text, ["lost reason", "unknown", "not tracked"])) {
    signals.push("Lost reasons may not be captured clearly enough to improve sales decisions.");
  }

  if (values.averageDealValue.includes("$10,001") || values.averageDealValue.includes("More than")) {
    signals.push("Higher average deal value increases the cost of missed follow-up or weak handoffs.");
  }

  if (signals.length === 0) {
    signals.push("Revenue leakage risk is most likely coming from weak visibility, delayed follow-up, or unclear next actions.");
  }

  return signals;
}

function getSalesWorkflowReadiness(values: SalesWorkflowValues) {
  const hasLeadCapture = values.currentLeadProcess.trim().length >= 20;
  const hasFollowUp = values.followUpProcess.trim().length >= 10;
  const hasCrm = values.crmTool !== "No CRM yet";
  const hasTarget = Boolean(values.targetImprovement);
  const hasOwner = Boolean(values.salesWorkflowOwner);

  if (hasLeadCapture && hasFollowUp && hasCrm && hasTarget && hasOwner) {
    return {
      status: "Ready for simple sales automation",
      reason:
        "Lead capture, follow-up, tracking, ownership, and target improvement are clear enough to automate one focused step.",
    };
  }

  if (!hasCrm) {
    return {
      status: "Needs lead tracking structure first",
      reason:
        "A CRM or structured tracker should be in place before deeper sales automation is added.",
    };
  }

  if (!hasTarget || !hasOwner) {
    return {
      status: "Needs accountability and target definition",
      reason:
        "The workflow needs a clear owner and target improvement before automation success can be measured.",
    };
  }

  return {
    status: "Partially ready",
    reason:
      "The workflow has useful structure, but it needs cleaner tracking, ownership, or measurement before deeper automation.",
  };
}

function getMainBottlenecks(values: SalesWorkflowValues) {
  const bottlenecks: string[] = [];

  if (values.leadSources.length > 2) {
    bottlenecks.push("Leads are coming from several places, so intake needs one clear capture process.");
  }

  if (["Same day", "Next day", "More than 1 day", "Not sure"].includes(values.currentResponseTime)) {
    bottlenecks.push("Speed-to-lead may be slow enough for warm leads to lose interest.");
  }

  if (values.crmTool === "No CRM yet") {
    bottlenecks.push("There is no central CRM or tracker for lead and customer information.");
  }

  if (values.crmTool === "Spreadsheet") {
    bottlenecks.push("Spreadsheet tracking can work early, but it may not show ownership, stage changes, or follow-up risk clearly.");
  }

  if (textHas(values.followUpProcess, ["manual", "memory", "remember", "forgot", "forget", "miss"])) {
    bottlenecks.push("Follow-up appears to depend too much on memory or manual reminders.");
  }

  if (textHas(values.dealTrackingProcess, ["unclear", "not tracked", "no stage", "manual", "notes"])) {
    bottlenecks.push("Deal stages may not be visible enough to know what needs attention.");
  }

  if (values.qualificationProcess.trim().length < 10) {
    bottlenecks.push("Lead qualification may not be structured enough to separate strong leads from low-fit inquiries.");
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push("The main risk is inconsistent tracking across lead capture, follow-up, CRM updates, and deal stages.");
  }

  return bottlenecks;
}

function getLeadCaptureRecommendations(values: SalesWorkflowValues) {
  const recommendations = [
    "Create one required lead intake path with name, contact, source, need, urgency, owner, and consent where needed.",
    "Send every lead source into one tracker or CRM so leads do not stay hidden in inboxes or DMs.",
    "Add a required lead source field so reporting can show which channels create useful opportunities.",
  ];

  if (values.leadSources.includes("Instagram DMs") || values.leadSources.includes("WhatsApp")) {
    recommendations.push("Create a simple manual capture rule for DMs: every serious inquiry should be copied into the lead tracker the same day.");
  }

  if (values.leadSources.includes("Website form")) {
    recommendations.push("Connect the website form to the tracker or CRM and notify the owner immediately.");
  }

  return recommendations;
}

function getSpeedToLeadRecommendations(values: SalesWorkflowValues) {
  if (values.currentResponseTime === "Under 5 minutes") {
    return [
      "Keep the fast response time, but track whether each lead receives the right next step.",
      "Use templates for common first replies so fast response does not reduce quality.",
    ];
  }

  return [
    "Set a first-response target, such as under 15 minutes during working hours.",
    "Create an instant alert when a new lead arrives.",
    "Use a short first-response template that confirms the inquiry and asks the next qualifying question.",
    "Track first response time so slow follow-up becomes visible.",
  ];
}

function getQualificationQuestions(values: SalesWorkflowValues) {
  const businessType = resolveBusinessType(values) || "business";

  return [
    `What problem are you trying to solve with this ${businessType} offer?`,
    "How soon do you want to move forward?",
    "What have you already tried?",
    "What budget range or decision process should we be aware of?",
    "Who else needs to be involved before a decision is made?",
    "What would make this a successful outcome for you?",
  ];
}

function getFollowUpSequence(values: SalesWorkflowValues): SalesFollowUpStep[] {
  const sequence: SalesFollowUpStep[] = [
    {
      timing: "Day 0",
      action: "Respond to the lead, confirm the request, capture the source, and assign an owner.",
    },
    {
      timing: "Day 1",
      action: "Send a helpful follow-up with one clear question or booking link.",
    },
    {
      timing: "Day 3",
      action: "Share a relevant example, answer a likely objection, or restate the next step.",
    },
    {
      timing: "Day 7",
      action: "Send a gentle check-in and update the lead stage based on response.",
    },
    {
      timing: "Day 14",
      action: "Move inactive leads to nurture with a useful resource or future check-in date.",
    },
  ];

  if (includesGoal(values, "Improve proposal follow-up")) {
    sequence.splice(3, 0, {
      timing: "After proposal",
      action: "Track proposal sent date, decision date, stakeholder questions, and next scheduled follow-up.",
    });
  }

  return sequence;
}

function getCrmFieldsToTrack(values: SalesWorkflowValues) {
  const fields = [
    "Lead name",
    "Email or phone",
    "Lead source",
    "Business or company",
    "Need or problem",
    "Lead owner",
    "Lead stage",
    "Qualification status",
    "Last contact date",
    "Next follow-up date",
    "Deal value or estimate",
    "Lost reason",
  ];

  if (values.leadSources.length > 1) {
    fields.push("Original channel");
  }

  if (includesGoal(values, "Improve closed-won handoff")) {
    fields.push("Closed-won handoff status");
  }

  return fields;
}

function getSuggestedDealStages(values: SalesWorkflowValues) {
  const stages = [
    "New lead",
    "Contacted",
    "Qualified",
    "Call booked",
    "Proposal sent",
    "Follow-up needed",
    "Won",
    "Lost",
    "Nurture",
  ];

  if (includesGoal(values, "Improve closed-won handoff")) {
    stages.splice(7, 0, "Closed-won handoff started");
  }

  return stages;
}

function getSalesReportingMetrics(values: SalesWorkflowValues) {
  const metrics = [
    "New leads by source",
    "Average first response time",
    "Leads waiting for follow-up",
    "Qualified leads by source",
    "Proposal sent count",
    "Won/lost count",
    "Lost reasons",
  ];

  if (values.monthlyLeadVolume !== "Less than 25") {
    metrics.push("Stage conversion rate");
    metrics.push("Average time in stage");
  }

  return metrics;
}

function getSalesKpiPlan(values: SalesWorkflowValues) {
  const kpis = [
    "First response time.",
    "Lead capture completion rate.",
    "Missed follow-up count.",
    "Qualified lead rate.",
    "Call booking rate.",
    "Proposal follow-up rate.",
    "CRM field completion rate.",
    "Lost reason capture rate.",
  ];

  if (values.monthlyLeadVolume !== "Less than 25") {
    kpis.push("Stage conversion rate.");
    kpis.push("Stalled deal count.");
  }

  if (values.mainSalesGoals.includes("Improve closed-won handoff")) {
    kpis.push("Closed-won handoff completion rate.");
  }

  return kpis;
}

function getBaselineToCapture(values: SalesWorkflowValues) {
  const baseline = [
    "Current average first response time.",
    "Number of new leads per month.",
    "Number of leads without a next follow-up date.",
    "CRM or tracker fields currently completed.",
    "Number of proposals waiting for follow-up.",
    "Current lost reason capture rate.",
  ];

  if (values.revenueLeakageEvidence) {
    baseline.unshift(`Submitted leakage evidence: ${values.revenueLeakageEvidence}`);
  }

  return baseline;
}

function getSuggestedFirstAutomation(values: SalesWorkflowValues) {
  if (values.currentResponseTime !== values.targetResponseTime) {
    return "Create a new-lead alert and first-response reminder so serious leads are contacted faster.";
  }

  if (values.mainSalesGoals.includes("Reduce missed follow-ups")) {
    return "Create a follow-up reminder based on last contact date and next follow-up date.";
  }

  if (values.crmTool === "No CRM yet" || values.crmTool === "Spreadsheet") {
    return "Create a structured lead tracker before adding deeper sales automation.";
  }

  if (values.mainSalesGoals.includes("Improve proposal follow-up")) {
    return "Create a proposal follow-up reminder and proposal status field.";
  }

  return "Start with one sales tracker update or reminder that makes the next action visible.";
}

function getAutomationOpportunities(values: SalesWorkflowValues) {
  const opportunities = [
    "Create a lead record when a form or qualified inquiry arrives.",
    "Send an alert to the owner when a new lead is captured.",
    "Create reminders from next follow-up date.",
    "Update lead status when a follow-up is completed.",
    "Create reporting views for leads by source, stage, owner, and next action.",
  ];

  if (values.crmTool === "No CRM yet" || values.crmTool === "Spreadsheet") {
    opportunities.unshift("Start with a simple CRM or structured tracker before adding deeper automation.");
  }

  if (includesGoal(values, "Reduce manual data entry")) {
    opportunities.push("Use form fields and CRM required fields to reduce repeated typing.");
  }

  return opportunities;
}

export function generateSalesWorkflowResult(
  values: SalesWorkflowValues,
): SalesWorkflowResult {
  const businessType = resolveBusinessType(values);
  const crmTool = resolveCrmTool(values);
  const salesWorkflowHealth = getSalesWorkflowHealth(values);
  const salesWorkflowReadiness = getSalesWorkflowReadiness(values);
  const suggestedFirstAutomation = getSuggestedFirstAutomation(values);

  return {
    workflowSummary: `This ${businessType} sales workflow currently receives leads through ${values.leadSources.join(", ")} and tracks work using ${crmTool}. The main issue appears to be: ${values.mainSalesProblem}`,
    salesWorkflowHealth,
    salesWorkflowReadiness,
    priorityOutcomes: getPriorityOutcomes(values),
    revenueLeakageSignals: getRevenueLeakageSignals(values),
    // priorityOutcomes: getPriorityOutcomes(values),
    mainBottlenecks: getMainBottlenecks(values),
    leadCaptureRecommendations: getLeadCaptureRecommendations(values),
    speedToLeadRecommendations: getSpeedToLeadRecommendations(values),
    qualificationQuestions: getQualificationQuestions(values),
    followUpSequence: getFollowUpSequence(values),
    crmFieldsToTrack: getCrmFieldsToTrack(values),
    suggestedDealStages: getSuggestedDealStages(values),
    salesReportingMetrics: getSalesReportingMetrics(values),
    salesKpiPlan: getSalesKpiPlan(values),
    baselineToCapture: getBaselineToCapture(values),
    automationOpportunities: getAutomationOpportunities(values),
    suggestedFirstAutomation,
    humanReviewPoints: [
      "High-value leads",
      "Custom pricing",
      "Discount requests",
      "Complaints or sensitive customer situations",
      "Contract or legal questions",
      "Final customer-facing messages before automation sends anything",
    ],
    targetImprovement:
      values.targetImprovement ||
      "Define a measurable target such as faster response time, fewer missed follow-ups, better CRM completion, or improved proposal follow-up.",

    suggestedNextAction: `Start with this first automation: ${suggestedFirstAutomation}`,
      futureSystemLogPreview: [
      "Lead source",
      "Submission time",
      "Assigned owner",
      "First response time",
      "Current stage",
      "Last contact date",
      "Next follow-up date",
      "Outcome",
      "Lost reason",
      "Target response time",
      "Sales workflow owner",
      "KPI result",
    ],
    doNotAutomateYet: [
      "Pricing promises without review",
      "Contract or legal commitments",
      "Sensitive customer replies",
      "Discount approvals",
      "Final proposal terms",
    ],
  };
}