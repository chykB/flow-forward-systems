# V1 Manual Test Notes

Date: 2026-06-15

## Scope Tested

- Static homepage
- Navigation links
- Automation maturity model
- Services section
- Free tools interface
- Rule-based tool outputs
- Projects section
- Contact CTA
- Mobile layout

## Results

- Navigation links: Pass
- Three tool buttons switch forms: Pass
- Workflow Audit output: Pass
- Alert-To-Content output: Pass
- Sales Follow-Up output: Pass
- Six projects visible: Pass
- Mobile layout usable: Pass
- No horizontal scroll: Pass

## Notes

The V1 static website foundation is working locally. The three rule-based tools generate structured browser-based outputs without a backend, database, AI API, or authentication.


# V1.1 Manual Test Notes

Date: 2026-06-16

## Scope Tested

- Homepage
- Blog / Insights page
- Resources page
- About page
- Multi-page navigation
- Free tools after page additions
- Mobile layout

## Results

- Homepage loads: Pass
- Blog page loads: Pass
- Resources page loads: Pass
- About page loads: Pass
- Homepage nav to Blog works: Pass
- Homepage nav to Resources works: Pass
- Homepage nav to About works: Pass
- Blog nav back to Home works: Pass
- Resources nav back to Home works: Pass
- About nav back to Home works: Pass
- Homepage tool buttons still switch forms: Pass
- All three tools still generate output: Pass
- Mobile layout usable on all pages: Pass
- No horizontal scroll on all pages: Pass

## Notes

V1.1 content pages work locally through Live Server. Blog, Resources, and About pages are available as static pages. The existing V1 free tools continue to work after adding multi-page navigation.

# V1.2 Project Page Test Notes

Date: 2026-06-16

## Scope Tested

- Homepage project card links
- Six individual project pages
- Project page navigation
- Project page styling
- Required project metadata
- Closed-Won Deal Automation capstone depth
- Mobile layout

## Results

### Homepage Project Card Links

- Sales Follow-Up Automation System: Pass
- AI Customer Support Assistant: Pass
- Google Alert-To-Content Generator: Pass
- AI Operations Workflow Assistant: Pass
- Closed-Won Deal Automation System: Pass
- AI RevOps Workflow Intelligence System: Pass

### Project Pages

- Sales page loads: Pass
- Support page loads: Pass
- Alert-to-content page loads: Pass
- Operations page loads: Pass
- Closed-won page loads: Pass
- RevOps page loads: Pass

### CSS

- All project pages load styling: Pass

### Navigation

- Each project page can navigate back Home: Pass
- Each project page can navigate to Blog: Pass
- Each project page can navigate to Resources: Pass
- Each project page can navigate to About: Pass

### Content Requirements

- Each page has project level: Pass
- Each page has agentic level: Pass
- Each page has deployment/showcase status: Pass
- Each page has proof links or placeholders: Pass
- Each page has human review point: Pass
- Each page has business value/money-saving impact: Pass

### Capstone

- Closed-won page includes architecture: Pass
- Closed-won page includes event flow: Pass
- Closed-won page includes webhook/API design: Pass
- Closed-won page includes idempotency: Pass
- Closed-won page includes retry strategy: Pass
- Closed-won page includes monitoring/debugging/scaling: Pass

### Mobile

- All project pages readable on mobile: Pass
- No horizontal scroll: Pass

## Notes

V1.2 project pages are working locally through Live Server. Each project page acts as a project hub and case study, with project level, agentic level, deployment/showcase status, placeholder proof links, business value, human review points, and future improvement notes.

# V1.3 Deployment Notes

## Hosting Provider

Cloudflare Pages

## Live URL

https://your-cloudflare-url.pages.dev

## Deployment Source

GitHub repository: chykB/flow-forward-systems  
Branch: main  
Public app folder: portfolio-app

## Why Cloudflare Pages Was Chosen

Cloudflare Pages was chosen for the first public deployment because it is simple, fast, free-friendly, supports GitHub-based deployments, and can deploy the static portfolio app directly from the portfolio-app folder.

AWS Amplify remains a future option when AWS-specific deployment proof becomes more important.

## Manual Test Results

Homepage loads: pass  
Blog page loads: pass  
Resources page loads: pass  
About page loads: pass  

Homepage nav to Blog works: pass  
Homepage nav to Resources works: pass  
Homepage nav to About works: pass  

All six project cards open their project pages: pass  
Each project page links back to Home: pass  
Each project page is readable on mobile: pass  

Tool 1 switches and generates output: pass  
Tool 2 switches and generates output: pass  
Tool 3 switches and generates output: pass  

Contact email link works: pass  
No horizontal scroll: pass  
No private docs visible: pass  
Browser console has no critical errors: pass  

## Phase Result

V1.3 static deployment is complete. The FlowForward Systems portfolio app is publicly accessible and ready to be shared for review.

## Post-Deployment Polish

Added FlowForward Systems header branding, centered desktop navigation, improved mobile header wrapping, and renamed the contact section to Book a Workflow Audit.

Live deployment was retested after pushing the update to GitHub.

Results:
- Logo appears: pass
- Logo links home: pass
- Desktop menu is centered: pass
- Mobile menu wraps cleanly: pass
- Hero still looks correct: pass
- Tools still work: pass
- Project page header works: pass
- No horizontal scroll: pass