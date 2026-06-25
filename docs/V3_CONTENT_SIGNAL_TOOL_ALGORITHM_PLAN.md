# V3 Content Signal-To-Content Tool Algorithm Plan

## Purpose

This document defines the upgraded content workflow tool for V3.

The old tool name was Google Alert-To-Content Idea Generator. The improved tool is broader:

Content Signal-To-Content Tool

The tool should not be a generic content template machine. It should be a content decision tool.

Its value is helping the creator decide:

- Is this worth creating?
- Who is this for?
- What is the fresh angle?
- What format fits best?
- What should I create first?
- What should I avoid saying?
- How do I make it sound like me?

## Product Principle

The tool should turn signals into useful content decisions.

Signal -> Decision -> Angle -> Format -> Draft -> Review -> Publishing guidance

## Scope For First Version

The first version should be text-input based.

Users can paste:

- Google Alert text
- Article or news summary
- Newsletter excerpt
- Social media post
- Customer question
- Sales call note
- Support ticket summary
- Podcast or video transcript excerpt
- Research report excerpt
- Personal idea
- Screenshot description
- Competitor post
- Trend note
- Internal company update

The first version should not support:

- File upload
- PDF parsing
- Image OCR
- Video transcription
- Live link scraping
- Automatic source verification
- Publishing automation

## User-Facing Tool Name

Preferred UI name:

Content Signal-To-Content Tool

Alternative:

Content Opportunity Analyzer

Recommended:

Content Signal-To-Content Tool

## Input Signal Types

Suggested options:

- Google Alert
- Article or news link
- Newsletter
- Social media post
- Customer question
- Sales call note
- Support ticket
- Podcast/video transcript
- Research report
- Personal idea
- Screenshot description
- Competitor post
- Trend
- Internal company update
- Other

If "Other" is selected, show a short text field.

## Creator Profile Inputs

Ask for:

- Creator niche
- Target audience
- Brand point of view
- Preferred platform
- Preferred output format
- Tone
- Topics to avoid

Optional later:

- Offer/product
- Past post examples
- Repurpose preference
- Performance goal

## Audience Context

The tool should adapt output based on audience.

Examples:

- Business owners: practical, ROI, workflow, decisions
- Job seekers: skills, career, positioning
- Children: simple, visual, story-based
- Parents: safety, guidance, plain language
- Executives: strategy, risk, business impact
- Technical users: depth, architecture, tradeoffs
- General public: simple explainer, relevance
- Creators: content ideas, audience, monetization
- Students: learning, examples, study angle

## Core Algorithm

Input Signal
-> Classify Signal Type
-> Extract Signal Data
-> Check Source And Claim Risk
-> Identify Audience Context
-> Score Content Potential
-> Extract Themes
-> Find Non-Obvious Insight
-> Capture Human POV
-> Recommend Format
-> User Chooses Output
-> Select Structure
-> Draft
-> Review
-> Publishing Guidance
-> Follow-Up Ideas

## Signal Classification

The tool should classify the signal into one of these categories:

| Input Type | Likely Content Use |
|---|---|
| News alert | Trend, explainer, commentary |
| Customer question | Educational post, FAQ, sales content |
| Personal story | Narrative, lesson learned |
| Research/report | Data-led post, carousel, blog |
| Social post | Response, hot take, conversation starter |
| Product update | Launch post, use case, demo |
| Support ticket | Pain-point content, how-to |
| Trend | Thought leadership, prediction |
| Screenshot description | Visual post, breakdown, meme |
| Competitor post | Positioning, contrast, industry commentary |
| Internal update | Behind-the-scenes, lesson, announcement |

## Signal Data Extraction

The tool should extract:

- Topic
- People or companies mentioned
- Source
- Date or freshness cue
- Main claim
- Trend
- Problem
- Opportunity
- Risk
- Audience affected
- Emotional angle
- Useful examples
- Possible lesson

## Source And Claim Risk

The tool cannot fully verify sources in the first version.

Instead, it should classify source and claim risk.

Possible outputs:

- Strong source
- Needs verification
- Use as signal only
- Avoid strong claim
- Safe for commentary
- Treat as opinion
- Vendor claim: verify before citing
- Sensitive topic: review carefully

Checks:

- Is this a reliable source?
- Is it a press release?
- Is it opinion?
- Is it a vendor claim?
- Is it legal, financial, medical, hiring, or sensitive?
- Does the claim need verification?
- Should this be cited or treated only as a signal?

## Content Potential Scoring

Score areas:

- Relevance
- Freshness
- Credibility
- Practical value
- Novelty
- Emotional pull
- Format potential
- Risk

Each score can be:

- Low
- Medium
- High

The tool should then give a content decision:

- Create now
- Save for later
- Combine with more signals
- Use as supporting source
- Ignore
- Needs verification first

## Topic Clustering

If multiple signals are provided, the tool should group them into clusters.

Example clusters:

- AI governance
- Workflow automation
- RevOps
- Customer behavior
- Job market
- Creator economy
- Legal risk
- Productivity
- Education
- Children's safety

First version can support this through text only. If the user pastes multiple signals, the output should identify likely clusters.

## Common-Knowledge Check

The tool should prevent generic content by identifying:

- Obvious take
- What everyone else may say
- Overdone angle
- Deeper angle
- Surprising angle
- Practical lesson
- Useful takeaway

## Human POV Layer

The tool should ask for or use the creator's point of view.

Prompt questions:

- What do I believe about this?
- Do I agree or disagree?
- What should my audience understand?
- What should they do differently?
- What warning or opportunity do I see?
- What personal experience connects to this?

## Original Insight Filter

The tool should generate:

- Obvious take
- Deeper take
- Contrarian take
- Practical lesson
- Memorable phrase
- Audience-specific insight
- Possible content angles

Example:

Obvious take:
AI can automate workflows.

Deeper take:
Autonomy without boundaries becomes a control risk.

Memorable phrase:
The future is not full autonomy. It is bounded autonomy.

## Format Fit Recommendation

The tool should recommend the best formats.

| Signal Pattern | Best Format |
|---|---|
| Misconception | Myth-busted post |
| Serious risk | Checklist, explainer, warning post |
| Human story | Narrative post |
| Practical steps | How-to, checklist, carousel |
| Complex idea | Explainer, thread, video |
| Funny contradiction | Meme, short post |
| Trend pattern | Thought-leadership post |
| Research/data | Carousel, blog, thread |
| Visual process | Diagram, infographic |
| Emotional topic | Conversational post |
| Product/service | Use case, demo, comparison |

The output should explain the recommendation.

Example:

Best fit:
LinkedIn post + carousel

Why:
The idea needs explanation and a saveable checklist.

## User-Selected Format And Platform

The user can choose:

Platform:

- LinkedIn
- X / Twitter
- Instagram
- Facebook
- YouTube
- TikTok
- Blog
- Newsletter
- Other

Output format:

- Text post
- Image + caption
- Video script + caption
- Carousel outline
- Meme concept
- Blog outline
- Newsletter section
- X thread
- LinkedIn post
- Instagram caption
- Facebook post
- YouTube script
- TikTok script

Tone:

- Practical
- Professional
- Friendly
- Contrarian
- Educational
- Conversational
- Analytical
- Story-driven

## Structure Selection

The tool should select a structure based on format.

| Format | Structure |
|---|---|
| Myth-busted | Myth, reality, explanation, correction |
| Narrative | Setup, conflict, realization, lesson |
| Checklist | Problem, checklist, saveable reminder |
| Framework | Problem, lens, framework, example |
| Explainer | Concept, why it matters, example, action |
| Meme | Setup, contrast, punchline |
| Video | Hook, body, example, takeaway, CTA |
| Carousel | Slide hook, key points, checklist, final action |
| Blog | Intro, sections, examples, conclusion |

## Output Schema

The tool should return:

- Signal summary
- Signal type
- Source and claim notes
- Audience fit
- Content potential score
- Content decision
- Obvious take
- Deeper take
- Contrarian or fresh angle
- Practical lesson
- Recommended format
- Draft content for selected output
- Safety and accuracy review
- Publishing guidance
- Follow-up ideas

## Output Should Match User Selection

If the user selects LinkedIn post, output a LinkedIn post.

If the user selects video script, output a video script.

If the user selects carousel outline, output a carousel outline.

The tool should not overwhelm the user with every possible format unless they request repurposing.

## Publishing Guidance

The tool can suggest:

- Title or hook
- Caption
- Hashtags
- First comment
- CTA style
- Visual recommendation
- Whether to cite source
- Whether to tag source/company

Avoid pretending to know the perfect posting time unless platform/account data exists.

## Review Checks

The output should include a review section:

- Does this sound aligned with the creator's point of view?
- Are claims safe?
- Does it need a citation?
- Is it too generic?
- Is the tone right for the audience?
- Is the CTA appropriate?
- Should any sensitive claim be softened?

## Future Tracking Fields

When performance tracking is added later, track:

- Input signal
- Audience
- Topic
- Angle
- Format
- Platform
- Hook
- CTA
- Publish date
- Impressions
- Likes
- Comments
- Shares
- Saves
- Clicks
- DMs
- Best-performing line
- Follow-up ideas

## Future Learning Loop

Later versions can learn:

- Which formats work for the creator
- Which topics perform
- Which hooks get comments
- Which posts get saves
- Which angles fit the audience
- Which signals produce better content

## Safety Requirements

The first version should:

- Avoid claiming a source is verified when it is not.
- Tell the user when claims need verification.
- Warn against overclaiming.
- Flag legal, financial, medical, hiring, or sensitive topics.
- Encourage human review before publishing.
- Avoid copying large amounts of source text.
- Avoid plagiarism.
- Avoid making claims stronger than the input supports.

## UI Copy Rules

Use user-facing copy like:

- Content Signal
- Content Decision
- Fresh Angles
- Best Format
- Draft Content
- Review Before Publishing
- Publishing Guidance

Avoid implementation-facing copy like:

- Algorithm
- Rule-based
- Fallback
- Classifier
- Logic engine

## Definition Of Done

- Algorithm plan documented.
- Tool scope is broader than Google Alerts.
- First version remains text-input based.
- Source verification limitation is documented.
- Output schema is documented.
- Safety rules are documented.


# V3 Tools Modal Refactor And Sales Tool Test Notes

## Date
June 25, 2026

## Scope
Refactored the V3 tools area so each tool is separated by responsibility and displayed through the modal tool experience.

## Structure Verified
- Shared list UI extracted to `SectionList`.
- Content signal logic extracted to `src/lib/tools/contentSignal.ts`.
- Content signal UI extracted to `ContentSignalTool`.
- Workflow audit UI extracted to `WorkflowAuditTool`.
- Sales workflow logic added in `src/lib/tools/salesWorkflow.ts`.
- Sales workflow UI added in `SalesWorkflowTool`.
- `WorkflowTools` now acts mainly as the tool launcher and modal wrapper.

## Manual Test Results

### Tools Section
- AI Workflow Audit Tool card appears: Pass
- Content Signal-To-Content Tool card appears: Pass
- Sales Workflow Improvement Tool card appears: Pass
- Tool card buttons align on desktop: Pass
- Tool cards stack cleanly on mobile: Pass

### AI Workflow Audit Tool
- Opens modal: Pass
- Empty form shows validation errors: Pass
- Other business type shows text field: Pass
- Other workflow area shows text field: Pass
- Other tools shows text field: Pass
- Valid form generates workflow analysis: Pass
- Close button closes modal: Pass

### Content Signal-To-Content Tool
- Opens modal: Pass
- Empty form shows validation errors: Pass
- Other signal type shows text field: Pass
- Valid form generates content plan: Pass
- Content decision appears: Pass
- Fresh angle appears: Pass
- Draft output appears: Pass
- Close button closes modal: Pass

### Sales Workflow Improvement Tool
- Opens modal: Pass
- Empty form shows validation errors: Pass
- Other business type shows text field: Pass
- Other lead source shows text field: Pass
- Other CRM/tool shows text field: Pass
- Valid form generates sales workflow plan: Pass
- Priority outcomes appear: Pass
- Lead capture recommendations appear: Pass
- Follow-up sequence appears: Pass
- CRM fields appear: Pass
- Suggested deal stages appear: Pass
- Sales reporting metrics appear: Pass
- Close button closes modal: Pass

### General
- Header still works: Pass
- Contact section still works: Pass
- Mobile modal layout works: Pass
- No horizontal scroll: Pass
- Browser console has no critical errors: Pass

## Verification Commands
- `npm run lint`: Pass
- `npm run build`: Pass

## Notes
The old follow-up-only tool has been expanded into a broader Sales Workflow Improvement Tool. It now supports lead capture, speed-to-lead, qualification, follow-up, CRM fields, deal stages, reporting visibility, automation opportunities, and human review points.

# V3 Tools Copy Polish Test Notes

## Date
June 25, 2026

## Scope
Polished user-facing copy for the V3 tools section, modal titles, modal descriptions, button labels, and result section labels.

## Copy Decisions
- Kept Workflow Audit Tool positioned as an instant self-serve analysis tool.
- Renamed the content tool user-facing experience from signal-focused language to clearer idea/source language.
- Kept the sales tool focused on improving lead capture, speed-to-lead, follow-up, CRM updates, deal tracking, reporting, and automation.
- Replaced internal-feeling labels with clearer visitor-facing labels.

## Manual Test Results

### Tools Section
- Tool card copy feels clear: Pass
- Button labels are clear: Pass
- Modal titles are clear: Pass
- Modal descriptions are clear: Pass
- Mobile cards still look good: Pass
- No horizontal scroll: Pass

### Result Labels
- Workflow audit result labels feel user-facing: Pass
- Content planner result labels feel user-facing: Pass
- Sales workflow result labels feel user-facing: Pass
- Mobile modal layout still works: Pass
- No horizontal scroll: Pass

## Verification Commands
- `npm run lint`: Pass
- `npm run build`: Pass