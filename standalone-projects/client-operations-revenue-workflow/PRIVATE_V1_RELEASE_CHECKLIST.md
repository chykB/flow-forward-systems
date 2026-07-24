# Private V1 Release Checklist

Use this checklist for an approved private deployment. Private V1 is not a
public launch.

## Release Record

- Production origin:
  `https://client-operations-revenue-workflow.processes.workers.dev`
- Deployed commit: `14e7511`
- Cloudflare Worker version: `87a675de-445b-4e46-b06d-160ed1cda88d`
- Deployment time: `2026-07-24T13:04:12.816Z`
- Deployed by: `malikchika86@gmail.com`
- Supabase project reference: `kdanlmcobbamwggejrvc`
- Approved by: `malikchika86@gmail.com`
- Acceptance date: 2026-07-24
- Production smoke test: Passed on 2026-07-24
- Release status: Private V1 deployed and approved for continued private use;
  remaining acceptance checks are listed below.

## Access And Data

- [x] Disable new-user registration in Supabase Auth.
- [x] Keep `NEXT_PUBLIC_ALLOW_SIGN_UP=false`.
- [ ] Provision only approved Private V1 users.
- [x] Confirm every real record is workspace-scoped and row-level security is
      enabled.
- [x] Confirm no service-role key, database password, or other secret is present
      in browser environment variables, source control, or client logs.
- [ ] Keep synthetic fixtures out of real workspaces.

## Database

- [x] Run `./node_modules/.bin/supabase migration list --linked`.
- [x] Confirm every local migration has a matching remote migration.
- [x] Run `./node_modules/.bin/supabase db push --linked --dry-run`.
- [x] Confirm the dry run reports that the remote database is up to date.
- [x] Retain the latest verified rollback scripts outside the deployment
      artifact.

## Build

- [x] Use Node.js 20.9 or later.
- [x] Run `npm install` once after adding the Cloudflare deployment
      dependencies and commit the resulting lockfile.
- [x] Use `npm ci` for subsequent clean release builds.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run build:cloudflare`.
- [x] Confirm `.open-next/worker.js` and `.open-next/assets` were generated.
- [x] Confirm the build contains only expected application routes.
- [x] Confirm `.env.local`, `.dev.vars`, `.wrangler`, `.open-next`, Supabase
      temporary files, dependencies, and build output are not committed.

## Dependency Security

- [x] Run `npm audit --omit=dev` against the release dependency tree.
- [x] Confirm the reviewed OpenNext deployment source map does not include
      PostCSS or Sharp.
- [ ] Re-run the production audit whenever Next.js or OpenNext changes.
- [ ] Replace the recorded exception when a compatible patched stable Next.js
      release is available.

Review note for 2026-07-24: npm reports three high-severity findings through
the latest stable Next.js 16.2.11 dependency tree (`next`, its nested
`postcss`, and `sharp`). The reviewed Cloudflare Worker source map contains
neither PostCSS nor Sharp. Do not use `npm audit fix --force`, because its
current remediation downgrades Next.js across a breaking major-version
boundary.

## Hosting

- [x] Authenticate the local Wrangler CLI with the intended Cloudflare account.
- [x] Configure the deployment root as
      `standalone-projects/client-operations-revenue-workflow`.
- [x] Confirm `.env.local` contains the approved
      `NEXT_PUBLIC_SUPABASE_URL` before each build.
- [x] Confirm `.env.local` contains the approved
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` before each build.
- [x] Confirm `.env.local` contains `NEXT_PUBLIC_ALLOW_SIGN_UP=false` before
      each build.
- [x] Run `npm run preview` and complete the smoke test in the local Workers
      runtime before deploying.
- [x] Run `npm run deploy` only from the reviewed commit.
- [x] Record the resulting `workers.dev` or custom-domain HTTPS origin.
- [x] Confirm Cloudflare Workers observability is receiving request and error
      logs.
- [x] Confirm HTTPS is enforced by the hosting provider.
- [x] Confirm responses include the configured frame, content-type, referrer,
      and permissions security headers.

## Supabase Auth

- [x] Set the Auth Site URL to the exact production HTTPS origin.
- [x] Allow `http://localhost:3000/**` only for local development.
- [x] Add only approved preview redirect patterns.
- [x] Prefer exact production redirect URLs over production wildcards.
- [ ] Test sign-in, sign-out, session restoration, and rejected credentials.

## Accessibility And Responsive Acceptance

- [ ] Complete the core workflow using only a keyboard.
- [x] Confirm focus is always visible.
- [x] Confirm the skip link moves focus to workspace content.
- [x] Confirm forms expose visible labels and announce errors or status changes.
- [x] Confirm desktop and mobile pages have no page-level horizontal overflow.
- [x] Confirm mobile workspace navigation scrolls within its own navigation
      region.
- [x] Confirm the interface remains usable with reduced-motion preferences.
- [ ] Confirm the light interface remains readable when the operating system
      uses dark mode.

## Product Smoke Test

- [x] Sign in as an approved user and load the correct workspace.
- [x] Create a client and a second job, then confirm job-scoped data remains
      isolated.
- [x] Set and complete a next action.
- [x] Create sequential Work Items and verify readiness behavior.
- [x] Add handoff context to the exact Handoff Work Item.
- [x] Create and update a proposal.
- [x] Create a proposal-linked invoice and update its payment status.
- [x] Confirm Workflow Health, relationship concern, Action Queue, readiness,
      and Activity stay correctly scoped.
- [x] Confirm closed jobs are read-only.
- [x] Refresh after each consequential write and confirm durable state.

## Release Decision

- [x] Record the deployed commit SHA and production URL.
- [x] Record the Supabase project reference used by the deployment.
- [x] Record the person approving the release and the acceptance date.
- [x] Keep the deployment private until export/delete, backups, monitoring,
      support, complete permissions, and privacy controls meet the later public
      release gate.
