# V3 AI Workflow Audit Tool Schema

## Purpose

This document defines the first action-oriented AI workflow tool before implementation.

The AI Workflow Audit Tool is a self-serve tool that gives users an instant AI-assisted workflow analysis.

It is not the same as the Workflow Audit Form.

- Workflow Audit Form = request help from FlowForward Systems.
- AI Workflow Audit Tool = get instant AI-assisted workflow analysis.

## User Goal

The user wants to understand where a workflow is slow, manual, unclear, risky, or ready for automation.

## Tool Goal

Return a structured workflow analysis that helps the user identify:

- Current workflow summary
- Bottlenecks
- Automation opportunities
- AI assistance opportunities
- Human review points
- Suggested next action
- What should be logged
- What should not be automated yet

## Input Schema

## Flexible Input Rule

Where the tool provides predefined options, it should include an "Other" option when users may not fit the suggested choices.

When "Other" is selected, the UI should show a short text field so the user can describe their own context.

This keeps the tool guided without making it too narrow.

### Required Inputs

- Business type
- Workflow area
- Current process
- Main problem



### Optional Inputs

- Tools currently used
- Monthly volume
- Team size
- Desired outcome
- Risk or sensitivity level

## Input Field Details

### Business Type

Suggested values:

- Coaching business
- Agency
- Clinic
- SaaS company
- Creator business
- Local service business
- Other

If "Other" is selected, show:

- Describe your business type

### Workflow Area

### Workflow Area

Suggested values:

- Sales
- Customer Support
- Content
- RevOps
- Operations
- Other

If "Other" is selected, show:

- Describe the workflow area

### Current Process

Free text description of how the workflow currently happens.

### Main Problem

Free text description of what is not working.

Examples:

- Missed follow-ups
- Slow replies
- Manual reporting
- Unclear ownership
- CRM gaps
- Delayed handoffs
- Repeated copy/paste work

### Tools Currently Used

Optional multi-select or free text.

Suggested values:

- Gmail
- Google Sheets
- HubSpot
- Notion
- Slack
- Calendly
- Zapier
- Make
- Other
- None yet

If "Other" is selected, show:

- List other tools used

### Monthly Volume

Optional select or numeric range.

Suggested values:

- Less than 25
- 25-100
- 101-500
- 501-1000
- More than 1000
- Not sure

### Team Size

Optional select.

Suggested values:

- Solo
- 2-5
- 6-20
- 21-50
- 51+

### Desired Outcome

Optional free text.

Examples:

- Faster follow-up
- Fewer missed leads
- Better visibility
- Less manual reporting
- Faster support triage
- Cleaner handoffs

### Risk Or Sensitivity Level

Optional select.

Allowed values:

- Low
- Medium
- High
- Not sure

## Output Schema

The tool output must be structured into these sections.

### 1. Workflow Summary

A short plain-language summary of the workflow based on the user's input.

### 2. Likely Workflow Maturity Level

One of:

- Manual workflow
- Organized workflow
- Automated workflow
- AI-assisted workflow
- Agentic workflow candidate

Include a short explanation.

### 3. Main Bottlenecks

List 3-5 likely bottlenecks.

Examples:

- Follow-up depends on memory
- Work status is not visible
- Ownership is unclear
- Data is copied between tools manually
- Risky decisions do not have review points

### 4. Automation Opportunities

List practical non-AI automation opportunities.

Examples:

- Add a structured intake form
- Save submissions to a tracker
- Add status stages
- Add follow-up reminders
- Send internal notifications
- Create handoff checklists

### 5. AI Assistance Opportunities

List practical AI-supported steps.

Examples:

- Summarize incoming requests
- Classify lead or ticket type
- Draft follow-up messages
- Detect urgency
- Extract missing fields
- Recommend next action

### 6. Human Review Points

List where human review should stay.

Examples:

- Customer-facing messages
- Pricing or proposal decisions
- Refunds or complaints
- Legal or billing issues
- High-value leads
- Sensitive customer situations

### 7. Suggested Next Action

One clear next step the user can take.

Example:

"Map the workflow from trigger to final outcome, then automate one repeated handoff first."

### 8. What The System Would Log

List what a future workflow system should log.

Examples:

- Submission time
- Workflow area
- Current status
- Assigned owner
- AI recommendation
- Human approval decision
- Final outcome
- Error or failure state

### 9. What Not To Automate Yet

List 2-4 things that should not be automated until the workflow is clearer.

Examples:

- Sending final customer-facing messages
- Approving refunds
- Changing CRM deal stages automatically
- Making financial or legal decisions
- Acting on incomplete data

### 10. Review Note

Always include a note like:

"This analysis is a starting point. Review the recommendations before using them in a real workflow, especially where customers, money, legal issues, or sensitive data are involved."

## Safety Requirements

The tool must:

- Avoid asking for passwords, payment data, private customer records, legal documents, or confidential files.
- Validate required inputs.
- Limit long text inputs.
- Keep API keys server-side.
- Treat user input as untrusted.
- Avoid presenting AI output as guaranteed advice.
- Include human review guidance.
- Avoid taking external actions automatically.

## Prompt Injection Risk

The system should treat user workflow descriptions as data, not instructions.

User text should not be allowed to override:

- Output format
- Safety requirements
- Human review requirements
- Data privacy rules
- Tool boundaries

## UI Requirements

The UI should clearly say:

- AI Workflow Audit Tool
- Get an instant AI-assisted workflow analysis
- This is not a substitute for human review
- Do not include sensitive data

The UI should not say:

- Book a workflow audit
- I will follow up
- Submit contact request

Those belong to the Workflow Audit Form, not the AI tool.

## Future Logging Fields

If results are saved later, store:

- Tool name
- Created timestamp
- Business type
- Workflow area
- Input summary
- Output summary
- Suggested next action
- Human review points
- Optional user email only if the user chooses to share it

## Phase 7B Definition Of Done

- Input schema documented.
- Output schema documented.
- Safety requirements documented.
- UX copy distinction documented.
- No AI provider integration yet.
- No API key added yet.

# V3 Provider And Architecture Decision

## Purpose

This document defines the first implementation direction for V3 action-oriented AI workflow tools.

## Decision

The first V3 AI tool will use:

- Frontend: Next.js + TypeScript
- API layer: Next.js route handler first
- AI provider: OpenAI
- API interface: OpenAI Responses API
- Storage: no tool output storage in the first version
- Deployment: not deployed until API secrets and usage protection are ready

## Why Next.js API Route First

The app already uses Next.js.

A Next.js route handler is the smallest useful backend layer for the first AI tool. It avoids creating a separate Python/FastAPI backend before the first AI workflow tool UX is proven.

This does not replace the long-term roadmap.

Python/FastAPI should still be introduced later when:

- Multiple AI tools exist
- Workflow logic becomes heavier
- Tool results need richer logging
- Background processing is needed
- Integrations, webhooks, queues, and audit logs are added

## Why OpenAI First

OpenAI is a strong first provider for:

- Structured workflow analysis
- Prompt-controlled output
- Server-side API usage
- Future structured outputs
- Future workflow reasoning and tool-calling patterns

## First Tool

The first AI tool remains:

AI Workflow Audit Tool

## First Tool Behavior

The tool should:

- Accept structured workflow inputs
- Validate input server-side
- Send a controlled prompt to OpenAI
- Return structured workflow analysis
- Include human review points
- Include suggested next action
- Include what would be logged
- Include what should not be automated yet

## What The Tool Must Not Do

The first V3 tool must not:

- Take external actions
- Send emails
- Update CRM records
- Save sensitive data automatically
- Claim guaranteed business outcomes
- Pretend to be a full autonomous agent

## Environment Variables

Local development will require:

- OPENAI_API_KEY

The key must be stored in `.env.local`.

The key must not be committed to Git.

Production deployment will require the same secret to be configured in Cloudflare before the AI tool is deployed.

## Cost Control

The first implementation should:

- Use one AI request per tool submission
- Limit input length
- Limit output length
- Avoid streaming initially
- Avoid saving tool outputs initially
- Keep the tool behind server-side validation
- Add rate limiting before serious public deployment

## Safety Rules

The API route should:

- Treat user input as untrusted
- Keep system instructions server-side
- Separate user workflow details from tool instructions
- Reject empty or very long inputs
- Avoid requesting sensitive data
- Include human review guidance in every output
- Return safe error messages

## Initial Architecture

User
-> AI Workflow Audit Tool UI
-> Next.js API route
-> OpenAI Responses API
-> Structured workflow analysis returned to UI

## Future Architecture

User
-> Next.js frontend
-> Python FastAPI backend
-> AI provider
-> Database/logs
-> Rate limiting
-> Lead capture
-> Workflow audit/service conversion path

## Phase 7C Definition Of Done

- Provider decision documented.
- API architecture decision documented.
- Cost and safety requirements documented.
- No API key committed.
- No AI code added yet.

# V3 AI Workflow Audit API Contract

## Endpoint

POST /api/tools/workflow-audit

## Purpose

Accept structured workflow details and return an instant AI-assisted workflow analysis.

This endpoint supports the AI Workflow Audit Tool.

It does not support the Workflow Audit Form.

## Request Body

```json
{
  "businessType": "Agency",
  "businessTypeOther": "",
  "workflowArea": "Sales",
  "workflowAreaOther": "",
  "currentProcess": "Leads come through email and Instagram DMs. Follow-up is tracked manually.",
  "mainProblem": "Follow-ups are missed and there is no clear next action.",
  "toolsUsed": ["Gmail", "Google Sheets"],
  "toolsUsedOther": "",
  "monthlyVolume": "25-100",
  "teamSize": "2-5",
  "desiredOutcome": "Fewer missed leads and clearer follow-up tracking.",
  "riskLevel": "Medium"
}

# V3 Workflow Audit Rule-Based Fallback Plan

## Purpose

This document defines the rule-based fallback for the AI Workflow Audit Tool.

The fallback keeps the tool useful when the AI provider is unavailable, quota is exhausted, parsing fails, or the API call returns an error.

## Core Principle

The tool should degrade gracefully.

AI available:

User -> API validation -> OpenAI -> AI-assisted workflow analysis

AI unavailable:

User -> API validation -> Rule-based fallback -> Structured workflow analysis

## Why This Matters

A production-minded workflow tool should not fail completely just because an AI provider fails.

The fallback:

- Protects user experience
- Controls cost
- Supports local development without AI credits
- Keeps the demo usable
- Shows reliability thinking
- Preserves the same response shape as the AI output

## Response Modes

The API should return one of two modes:

```json
{
  "mode": "ai",
  "analysis": {}
}

# V3 Workflow Audit Fallback Test Notes

## Scope

This checkpoint adds a rule-based fallback to the V3 AI Workflow Audit API route.

The endpoint first attempts to use OpenAI. If OpenAI is unavailable, quota is exhausted, output is empty, output parsing fails, or the API call errors, the route returns a structured rule-based workflow analysis instead.

## Endpoint

POST /api/tools/workflow-audit

## Response Modes

AI success:

```json
{
  "mode": "ai",
  "analysis": {}
}

# V3 AI Workflow Audit UI Test Notes

## Scope

This checkpoint adds the frontend UI for the V3 AI Workflow Audit Tool.

The old always-visible tool form is replaced with a cleaner card-and-modal experience.

## UX Decision

The homepage should not be cluttered with full tool forms.

The tools section now shows tool cards. A user chooses a tool first, then the selected tool opens in a focused modal.

## Workflow Audit Tool Positioning

The AI Workflow Audit Tool is a self-serve analysis tool.

It is separate from the Workflow Audit contact form.

- Workflow Audit contact form = request help from FlowForward Systems.
- AI Workflow Audit Tool = get instant workflow analysis.

## Current Behavior

- Tools section shows three tool cards.
- AI Workflow Audit Tool opens in a modal.
- Required fields validate before analysis.
- "Other" business type shows a text field.
- "Other" workflow area shows a text field.
- "Other" tools shows a text field.
- Valid form generates structured workflow analysis.
- Fallback mode works when OpenAI quota is unavailable.
- User-facing copy hides implementation details such as "rule-based fallback."
- Analysis output uses "Current Workflow Stage" instead of internal maturity language.
- Analysis sections render clearly.
- Close button closes modal.
- Mobile modal layout works.
- No horizontal scroll.

## Manual Test Results

- Tools section shows three tool cards: pass
- AI Workflow Audit Tool opens modal: pass
- Empty AI audit form shows validation errors: pass
- Other business type shows text field: pass
- Other workflow area shows text field: pass
- Other tools shows text field: pass
- Valid AI audit form generates analysis: pass
- Fallback mode works: pass
- Analysis sections render clearly: pass
- Close button closes modal: pass
- Mobile modal layout works: pass
- No horizontal scroll: pass

## Technical Validation

- npm run lint: pass
- npm run build: pass

## Known Limitation

OpenAI quota was unavailable during testing, so the UI was verified using fallback output.

The API still supports AI-assisted analysis when OpenAI quota and production secrets are available.

## Next Step

Move the remaining two tools into the modal flow:

- Google Alert-To-Content Idea Generator
- Sales Follow-Up Sequence Generator