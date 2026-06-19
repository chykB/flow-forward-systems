# V2 Deployment Notes

## Hosting Provider

Cloudflare Workers / Cloudflare deployment from GitHub

## Live URL

PASTE_V2_LIVE_URL_HERE

## Deployment Source

GitHub repository: chykB/flow-forward-systems  
Branch: main  
App root: portfolio-next

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Cloudflare Workers
- OpenNext Cloudflare adapter
- Wrangler

## Deployment Configuration

Root directory: /portfolio-next  
Deploy command: npm run deploy  
Build command: none in Cloudflare UI because OpenNext build runs through npm run deploy  

## Deployment Issue Resolved

Cloudflare initially deployed the older V1 static app because it was using stale deployment settings and an older commit. The V2 deployment was fixed by configuring the Next.js app for Cloudflare Workers with OpenNext and ensuring Cloudflare deployed from the latest main commit.

## Live Test Results

V2 live homepage loads: pass  
V2 live blog loads: pass  
V2 live resources loads: pass  
V2 live about loads: pass  

All six project cards open: pass  
Each project page header/nav works: pass  
Each project page service/contact link works: pass  

Tools switch forms: pass  
Workflow Audit output works: pass  
Alert-To-Content output works: pass  
Sales Follow-Up output works: pass  

Mobile homepage works: pass  
Mobile content pages work: pass  
Mobile project pages work: pass  
No horizontal scroll: pass  
Browser console has no critical errors: pass  

## Phase Result

V2 is deployed separately from V1. V1 remains available as a stable static baseline, while V2 proves the migrated Next.js + TypeScript frontend.