# Phase 7 / V3 Action-Oriented AI Workflow Tools Plan

## Goal

Upgrade the existing rule-based tools into AI-assisted workflow tools that produce structured workflow recommendations, next actions, human review points, and safe implementation guidance.

These tools are not autonomous agents yet. They are action-oriented workflow tools.

## Source Of Truth

This plan follows:

- PROJECT_OVERVIEW_ACTION_ORIENTED.txt
- EXECUTION_ROADMAP_ACTION_ORIENTED.txt

## Core Principle

Do not build AI that only talks. Build workflow systems that act safely.

Each V3 tool should show:

- What triggered the workflow
- What input data was used
- What decision or classification was made
- What next action is recommended
- What human review is required
- What would be logged
- What should happen if the workflow fails

## First V3 Tool To Build

Start with:

AI Workflow Audit Tool

## Why This Tool First

The Workflow Audit Tool is the best first V3 upgrade because it connects directly to:

- The homepage positioning
- The contact workflow audit form
- The service offers
- The RevOps/revenue workflow wedge
- The future lead generation flow

It is also lower risk than tools that generate customer-facing replies or publishable content.

## V3 Tool Output Requirements

Each AI-assisted tool output should include:

- Workflow summary
- Workflow maturity level
- Main bottlenecks
- Automation opportunities
- AI assistance opportunities
- Human review points
- Suggested next action
- Risk notes
- What the system would log
- What should not be automated yet

## Initial Architecture

User -> Next.js frontend -> Server API endpoint -> AI provider
                                -> Structured response
                                -> Optional lead capture / saved result later

## Future Architecture

User -> Next.js frontend -> Python FastAPI backend -> AI provider
                                                  -> Database/logs
                                                  -> Lead capture
                                                  -> Rate limiting

## V3 Safety Requirements

- API keys must stay server-side.
- User input must be validated.
- Prompt injection must be considered.
- Sensitive data should not be requested.
- AI output must not be presented as guaranteed advice.
- Human review must be included in every output.
- The tool must not trigger external actions automatically.
- The tool must clearly remain a workflow tool, not a full agent.

## What Not To Build Yet

- Autonomous agents
- Real CRM integrations
- Email sending automation
- Admin approval dashboard
- Full workflow orchestration
- Docker
- Complex AWS backend
- Payment system

## Phase 7A Definition Of Done

- First V3 tool selected.
- Input schema defined.
- Output schema defined.
- Safety rules documented.
- Provider decision deferred or documented.
- No API key exposed.
- No AI integration added before the design is clear.

## Open Decisions

- AI provider
- Cost limit
- Rate limiting approach
- Whether the first implementation uses Next.js API route or Python FastAPI
- Whether tool outputs should be saved immediately or only displayed first


# V3 Workflow Audit UX Copy Rules

## Purpose

This document defines how to keep the Workflow Audit service request and the AI Workflow Audit Tool clearly separated in the user experience.

The two experiences are related, but they are not the same.

## Workflow Audit Form

The Workflow Audit Form is a contact and lead capture flow.

### User Intent

The user wants help from FlowForward Systems.

### What It Means

The user submits workflow details for human review and follow-up.

### User-Facing Copy Should Say

- Book a Workflow Audit
- Share your workflow challenge for review
- I will review your request and follow up
- Submit Workflow Audit Request
- Request received

### User-Facing Copy Should Avoid

- Generate audit
- Instant analysis
- AI result
- Tool output
- Automated audit

### Product Role

This supports lead capture, consultation, service discovery, and follow-up.

## AI Workflow Audit Tool

The AI Workflow Audit Tool is a self-serve analysis tool.

### User Intent

The user wants an instant AI-assisted workflow analysis.

### What It Means

The user enters workflow details and receives a structured output immediately.

### User-Facing Copy Should Say

- AI Workflow Audit Tool
- Get an instant AI-assisted workflow analysis
- Review bottlenecks, automation opportunities, human review points, and suggested next actions
- Generate Analysis
- Your Workflow Analysis

### User-Facing Copy Should Avoid

- Book
- Consultation
- I will follow up
- Submit request
- Contact request

### Product Role

This supports product demonstration, portfolio proof, education, and conversion into a service request.

## Relationship Between Them

The AI Workflow Audit Tool can recommend the Workflow Audit Form as a next step.

Example:

"If you want help implementing these recommendations, book a workflow audit."

The Workflow Audit Form should not promise instant AI analysis.

The AI Workflow Audit Tool should not imply a human has reviewed the workflow.

## Rule

Form = request help from FlowForward Systems.

Tool = get instant AI-assisted workflow analysis.