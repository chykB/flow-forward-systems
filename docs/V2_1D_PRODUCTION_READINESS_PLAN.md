# V2.1D Production Readiness Plan

## Purpose

This plan defines what must be ready before deploying the V2 lead capture and contact flow publicly.

The current V2 app works locally, but production deployment requires environment variables, data handling checks, and live testing.

## Current Completed Work

- Contact section has two paths:
  - Book Consultation through Calendly
  - Book Workflow Audit through modal form
- Workflow audit form validates input.
- API route validates submitted data server-side.
- Leads are saved to Supabase.
- Honeypot spam protection is included.
- Success state works.
- Email fallback exists for failed form submission.
- Test notes are documented.

## Required Production Environment Variables

Cloudflare must be configured with:

- SUPABASE_URL
- SUPABASE_SECRET_KEY

These values must not be committed to Git.

## Pre-Deployment Checks

Before deploying:

- Confirm `.env.local` is not tracked by Git.
- Confirm Cloudflare production secrets are configured.
- Confirm Calendly link is correct.
- Confirm Supabase project is active.
- Confirm Supabase `lead_submissions` table exists.
- Confirm Supabase table is not publicly readable.
- Confirm API route uses server-side secret only.
- Confirm no secret values appear in frontend code.
- Run `npm run lint`.
- Run `npm run build`.

## Live Deployment Test Checklist

After deployment:

- Homepage loads.
- Contact section appears.
- Book Consultation opens Calendly.
- Book Workflow Audit opens modal.
- Close exits modal without submitting.
- Empty audit form shows validation errors.
- Invalid email shows validation error.
- Valid audit form submits successfully.
- Submitted lead appears in Supabase.
- Success confirmation appears.
- Done closes modal after confirmation.
- Submit Another Request resets form.
- Honeypot field is not visible.
- Mobile contact flow works.
- No horizontal scroll.
- Browser console has no critical errors.
- No private docs or environment variables are exposed.

## Known Limitations Before Public Use

Duplicate prevention is not complete.

The API route includes a best-effort duplicate check, but duplicate records can still be created. Duplicate records should be manually reviewed and cleaned in Supabase for now.

There is no email notification yet because no verified sending domain exists.

There is no admin dashboard yet. Leads are reviewed directly in Supabase.

There is no rate limiting yet. Honeypot spam protection is the first abuse-prevention layer.

## Recommended Next Hardening

Before heavy public traffic:

- Add stronger duplicate prevention.
- Add basic rate limiting.
- Add Turnstile or CAPTCHA if spam appears.
- Add email notification after a domain is available.
- Add privacy policy or data notice.
- Add lead status review workflow.
- Add monitoring for API failures.

## Deployment Decision

Do not deploy automatically just because the feature exists.

Deploy when:

- Cloudflare secrets are ready.
- Supabase production table is ready.
- Calendly link is verified.
- The live test checklist can be completed.