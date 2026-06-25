export type ContentSignalValues = {
  signalType: string;
  signalTypeOther: string;
  signalText: string;
  sourceOrLink: string;
  creatorNiche: string;
  targetAudience: string;
  brandPointOfView: string;
  preferredPlatform: string;
  preferredOutputFormat: string;
  tone: string;
  topicsToAvoid: string;
};

export type ContentSignalErrors = Partial<Record<keyof ContentSignalValues, string>>;

export type ContentPotential = {
  relevance: string;
  freshness: string;
  credibility: string;
  practicalValue: string;
  risk: string;
};

export type ContentSignalResult = {
  signalSummary: string;
  contentDecision: string;
  sourceAndClaimNotes: string[];
  audienceFit: string;
  contentPotential: ContentPotential;
  obviousTake: string;
  deeperTake: string;
  freshAngle: string;
  practicalLesson: string;
  recommendedFormat: {
    format: string;
    reason: string;
  };
  selectedOutput: {
    title: string;
    body: string;
  };
  reviewBeforePublishing: string[];
  publishingGuidance: string[];
  followUpIdeas: string[];
};

export const initialContentSignalValues: ContentSignalValues = {
  signalType: "",
  signalTypeOther: "",
  signalText: "",
  sourceOrLink: "",
  creatorNiche: "",
  targetAudience: "",
  brandPointOfView: "",
  preferredPlatform: "",
  preferredOutputFormat: "",
  tone: "",
  topicsToAvoid: "",
};

export const signalTypes = [
  "Google Alert",
  "Article or news link",
  "Newsletter",
  "Social media post",
  "Customer question",
  "Sales call note",
  "Support ticket",
  "Podcast/video transcript",
  "Research report",
  "Personal idea",
  "Screenshot description",
  "Competitor post",
  "Trend",
  "Internal company update",
  "Other",
];

export const contentPlatforms = [
  "LinkedIn",
  "X / Twitter",
  "Instagram",
  "Facebook",
  "YouTube",
  "TikTok",
  "Blog",
  "Newsletter",
  "Other",
];

export const contentOutputFormats = [
  "LinkedIn post",
  "X thread",
  "Short video script",
  "Carousel outline",
  "Blog outline",
  "Newsletter section",
  "Instagram caption",
  "Meme concept",
  "Image prompt + caption",
];

export const contentTones = [
  "Practical",
  "Professional",
  "Friendly",
  "Contrarian",
  "Educational",
  "Conversational",
  "Analytical",
  "Story-driven",
];

export function validateContentSignal(values: ContentSignalValues) {
  const errors: ContentSignalErrors = {};

  if (!values.signalType) {
    errors.signalType = "Choose a signal type.";
  }

  if (values.signalType === "Other" && values.signalTypeOther.trim().length < 2) {
    errors.signalTypeOther = "Describe the signal type.";
  }

  if (values.signalText.trim().length < 20) {
    errors.signalText = "Add the signal, note, question, or idea you want to turn into content.";
  }

  if (!values.targetAudience.trim()) {
    errors.targetAudience = "Describe the audience this content is for.";
  }

  if (!values.preferredPlatform) {
    errors.preferredPlatform = "Choose a platform.";
  }

  if (!values.preferredOutputFormat) {
    errors.preferredOutputFormat = "Choose an output format.";
  }

  if (values.sourceOrLink.trim().length > 300) {
    errors.sourceOrLink = "Source or link must be 300 characters or less.";
  }

  if (values.creatorNiche.trim().length > 120) {
    errors.creatorNiche = "Creator niche must be 120 characters or less.";
  }

  if (values.brandPointOfView.trim().length > 400) {
    errors.brandPointOfView = "Brand point of view must be 400 characters or less.";
  }

  if (values.topicsToAvoid.trim().length > 300) {
    errors.topicsToAvoid = "Topics to avoid must be 300 characters or less.";
  }

  return errors;
}

function resolveSignalType(values: ContentSignalValues) {
  return values.signalType === "Other" && values.signalTypeOther
    ? values.signalTypeOther
    : values.signalType;
}

function getSignalUse(signalType: string) {
  const normalized = signalType.toLowerCase();

  if (normalized.includes("customer question")) return "educational post, FAQ, sales content";
  if (normalized.includes("sales call")) return "objection handling, sales enablement, educational content";
  if (normalized.includes("support")) return "pain-point content, how-to content, customer education";
  if (normalized.includes("research")) return "data-led post, carousel, blog, or thread";
  if (normalized.includes("social")) return "response, hot take, or conversation starter";
  if (normalized.includes("competitor")) return "positioning, contrast, or industry commentary";
  if (normalized.includes("trend") || normalized.includes("google alert")) return "trend commentary, explainer, or thought leadership";
  if (normalized.includes("personal idea")) return "point-of-view post, reflection, or lesson learned";
  if (normalized.includes("internal")) return "behind-the-scenes update, lesson, or announcement";

  return "explainer, practical commentary, or content idea";
}

function textHas(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function getSourceAndClaimNotes(values: ContentSignalValues) {
  const notes: string[] = [];
  const signalType = resolveSignalType(values).toLowerCase();
  const combinedText = `${values.signalText} ${values.sourceOrLink}`.toLowerCase();

  if (signalType.includes("research")) {
    notes.push("Research-based signals can be strong, but check the date, sample size, and methodology before citing.");
  }

  if (signalType.includes("competitor")) {
    notes.push("Use competitor content as a market signal, not as copy to imitate.");
  }

  if (signalType.includes("social")) {
    notes.push("Treat social posts as opinions or conversation signals unless verified by another source.");
  }

  if (signalType.includes("support") || signalType.includes("customer")) {
    notes.push("Remove private customer details and turn the issue into a general lesson.");
  }

  if (values.sourceOrLink) {
    notes.push("If you make a factual claim from this source, cite or reference it clearly.");
  } else {
    notes.push("No source was provided, so avoid strong factual claims unless you can verify them.");
  }

  if (
    textHas(combinedText, [
      "legal",
      "financial",
      "medical",
      "hiring",
      "privacy",
      "security",
      "billing",
      "compliance",
    ])
  ) {
    notes.push("This signal touches a sensitive area. Verify claims and soften advice before publishing.");
  }

  return notes;
}

function getContentPotential(values: ContentSignalValues): ContentPotential {
  const text = `${values.signalText} ${values.targetAudience} ${values.creatorNiche}`;
  const highPractical = textHas(text, ["workflow", "how", "problem", "question", "mistake", "lead", "support", "sales", "customer", "automation", "step"]);
  const timely = textHas(resolveSignalType(values), ["alert", "news", "trend", "social"]);
  const risky = textHas(text, ["legal", "financial", "medical", "hiring", "privacy", "security", "billing", "compliance"]);

  return {
    relevance: values.targetAudience ? "High" : "Medium",
    freshness: timely ? "High" : "Medium",
    credibility: values.sourceOrLink ? "Medium" : "Low",
    practicalValue: highPractical ? "High" : "Medium",
    risk: risky ? "High" : "Low",
  };
}

function getContentDecision(potential: ContentPotential) {
  if (potential.risk === "High" && potential.credibility === "Low") return "Needs verification first";
  if (potential.relevance === "High" && potential.practicalValue === "High") return "Create now";
  if (potential.credibility === "Low") return "Use as a signal, then verify before making strong claims";
  return "Save for later or combine with more signals";
}

function getAudienceFit(audience: string) {
  const normalized = audience.toLowerCase();

  if (textHas(normalized, ["business owner", "founder", "operator"])) {
    return "Keep the content practical. Connect the idea to time, cost, workflow, decisions, or revenue impact.";
  }

  if (textHas(normalized, ["executive", "leader", "manager"])) {
    return "Focus on strategy, risk, tradeoffs, and business impact.";
  }

  if (textHas(normalized, ["technical", "developer", "engineer"])) {
    return "Add depth, architecture, tradeoffs, and implementation detail.";
  }

  if (textHas(normalized, ["creator", "coach"])) {
    return "Make the idea useful, relatable, and easy to turn into action.";
  }

  if (textHas(normalized, ["student", "job seeker"])) {
    return "Use examples, learning angles, and practical next steps.";
  }

  return "Use plain language and make the relevance clear quickly.";
}

function getInsightLayer(values: ContentSignalValues) {
  const text = values.signalText;

  if (textHas(text, ["ai", "automation", "workflow", "agent", "crm", "revops"])) {
    return {
      obviousTake: "AI and automation can save time.",
      deeperTake: "The real value comes when automation supports a clear workflow decision, handoff, or next action.",
      freshAngle: "The useful question is not which tool to use. It is what workflow decision needs to move forward safely.",
      practicalLesson: "Map the workflow before adding AI, then keep human review where trust, money, customers, or sensitive data are involved.",
    };
  }

  if (textHas(text, ["customer", "question", "support", "ticket"])) {
    return {
      obviousTake: "Customers need better answers.",
      deeperTake: "Repeated questions reveal gaps in onboarding, support, product education, or positioning.",
      freshAngle: "A customer question is not just a support issue. It can become content, process improvement, and product feedback.",
      practicalLesson: "Turn repeated questions into reusable education and improve the workflow that caused the confusion.",
    };
  }

  if (textHas(text, ["report", "data", "study", "research"])) {
    return {
      obviousTake: "The report shows a trend.",
      deeperTake: "The useful question is what decision the trend should change for the audience.",
      freshAngle: "Data becomes valuable when it changes prioritization, not when it is only repeated.",
      practicalLesson: "Pull one decision from the data and explain what the audience should do differently.",
    };
  }

  return {
    obviousTake: "This signal can become content.",
    deeperTake: "The stronger angle comes from connecting the signal to a real audience problem, decision, or behavior.",
    freshAngle: "Do not just repeat the signal. Explain what it reveals and what the audience should do next.",
    practicalLesson: "Choose one practical takeaway and build the content around that.",
  };
}

function getRecommendedFormat(values: ContentSignalValues) {
  const signal = `${values.signalText} ${resolveSignalType(values)}`.toLowerCase();

  if (textHas(signal, ["mistake", "myth", "misconception"])) {
    return {
      format: "Myth-busted post",
      reason: "The signal challenges something people may misunderstand, so a myth/reality structure will make the lesson clearer.",
    };
  }

  if (textHas(signal, ["risk", "warning", "legal", "privacy", "security"])) {
    return {
      format: "Checklist or warning post",
      reason: "The signal involves risk, so a checklist helps the audience review what to do before acting.",
    };
  }

  if (textHas(signal, ["steps", "how to", "process", "workflow"])) {
    return {
      format: "How-to post or carousel",
      reason: "The signal has practical steps, so a saveable format will make it easier to use.",
    };
  }

  if (textHas(signal, ["data", "report", "study", "research"])) {
    return {
      format: "Carousel, blog outline, or thread",
      reason: "The signal includes research or data, so it needs explanation, context, and a clear takeaway.",
    };
  }

  return {
    format: values.preferredOutputFormat || "LinkedIn post",
    reason: "The selected format fits a practical content starting point for this audience.",
  };
}

function buildSelectedOutput(values: ContentSignalValues, freshAngle: string) {
  const audience = values.targetAudience || "your audience";
  const pov = values.brandPointOfView || freshAngle;

  if (values.preferredOutputFormat === "X thread") {
    return {
      title: "X Thread Draft",
      body: `1/ ${freshAngle}

2/ The signal:
${values.signalText}

3/ Why it matters for ${audience}:
This points to a practical decision, behavior, or workflow that deserves attention.

4/ My take:
${pov}

5/ Practical lesson:
Do not only react to the signal. Turn it into a clearer decision or next step.

6/ What to do next:
Pick one action your audience can take this week.`,
    };
  }

  if (values.preferredOutputFormat === "Short video script") {
    return {
      title: "Short Video Script",
      body: `Hook:
Here is what this signal really means for ${audience}.

Body:
${values.signalText}

The obvious take is easy to repeat. The useful take is this: ${freshAngle}

Example:
Think about where this shows up in a real workflow, decision, customer conversation, or repeated problem.

Takeaway:
Use the signal to make one better decision, not just to create more content.

CTA:
Save this if you want to turn signals into practical content ideas.`,
    };
  }

  if (values.preferredOutputFormat === "Carousel outline") {
    return {
      title: "Carousel Outline",
      body: `Slide 1: ${freshAngle}

Slide 2: The signal
${values.signalText}

Slide 3: The obvious take

Slide 4: The deeper lesson for ${audience}

Slide 5: What to do differently

Slide 6: Quick checklist

Slide 7: Final action / CTA`,
    };
  }

  if (values.preferredOutputFormat === "Blog outline") {
    return {
      title: "Blog Outline",
      body: `Working title:
${freshAngle}

Intro:
Explain the signal and why it matters now.

Section 1:
What happened or what the signal says.

Section 2:
Why this matters for ${audience}.

Section 3:
The deeper angle or practical lesson.

Section 4:
Examples or scenarios.

Section 5:
What to do next.

Conclusion:
Restate the practical takeaway and next action.`,
    };
  }

  if (values.preferredOutputFormat === "Meme concept") {
    return {
      title: "Meme Concept",
      body: `Setup:
People reacting to the signal in the obvious way.

Contrast:
The deeper reality is: ${freshAngle}

Punchline:
When you realize the real issue is the workflow, not just the headline.

Caption:
A short practical reminder for ${audience}.`,
    };
  }

  return {
    title: values.preferredOutputFormat || "Content Draft",
    body: `${freshAngle}

The signal:
${values.signalText}

Why it matters for ${audience}:
This points to a practical problem, decision, or opportunity that deserves attention.

My take:
${pov}

Practical lesson:
The value is not just reacting to the signal. The value is turning it into a useful next step for the audience.

Suggested CTA:
What is one workflow, decision, or behavior you would improve based on this?`,
  };
}

export function generateContentSignalResult(values: ContentSignalValues): ContentSignalResult {
  const signalType = resolveSignalType(values);
  const signalUse = getSignalUse(signalType);
  const sourceAndClaimNotes = getSourceAndClaimNotes(values);
  const contentPotential = getContentPotential(values);
  const contentDecision = getContentDecision(contentPotential);
  const audienceFit = getAudienceFit(values.targetAudience);
  const insightLayer = getInsightLayer(values);
  const recommendedFormat = getRecommendedFormat(values);
  const selectedOutput = buildSelectedOutput(values, insightLayer.freshAngle);

  return {
    signalSummary: `This ${signalType} can likely support ${signalUse}.`,
    contentDecision,
    sourceAndClaimNotes,
    audienceFit,
    contentPotential,
    obviousTake: insightLayer.obviousTake,
    deeperTake: insightLayer.deeperTake,
    freshAngle: insightLayer.freshAngle,
    practicalLesson: insightLayer.practicalLesson,
    recommendedFormat,
    selectedOutput,
    reviewBeforePublishing: [
      "Check factual claims before publishing.",
      "Cite or reference the source if you make a specific claim.",
      "Avoid copying source text directly.",
      "Remove private customer or company details.",
      "Make sure the tone fits the audience and platform.",
    ],
    publishingGuidance: [
      "Lead with the fresh angle, not the source itself.",
      "Use one clear CTA.",
      "Add a visual if the idea involves a process, checklist, or contrast.",
      "Use hashtags only when they help discovery and do not clutter the post.",
    ],
    followUpIdeas: [
      "Turn the same signal into a shorter post.",
      "Create a checklist version.",
      "Create a follow-up post with a practical example.",
      "Save this signal as part of a larger content theme.",
    ],
  };
}