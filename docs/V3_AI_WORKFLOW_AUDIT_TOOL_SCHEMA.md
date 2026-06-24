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