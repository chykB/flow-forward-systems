# Private V1 Release Checklist

Use this checklist for an approved private deployment. Private V1 is not a
public launch.

## Access And Data

- [ ] Disable new-user registration in Supabase Auth.
- [ ] Keep `NEXT_PUBLIC_ALLOW_SIGN_UP=false`.
- [ ] Provision only approved Private V1 users.
- [ ] Confirm every real record is workspace-scoped and row-level security is
      enabled.
- [ ] Confirm no service-role key, database password, or other secret is present
      in browser environment variables, source control, or client logs.
- [ ] Keep synthetic fixtures out of real workspaces.

## Database

- [ ] Run `./node_modules/.bin/supabase migration list --linked`.
- [ ] Confirm every local migration has a matching remote migration.
- [ ] Run `./node_modules/.bin/supabase db push --linked --dry-run`.
- [ ] Confirm the dry run reports that the remote database is up to date.
- [ ] Retain the latest verified rollback scripts outside the deployment
      artifact.

## Build

- [ ] Use Node.js 20.9 or later.
- [ ] Run `npm install` once after adding the Cloudflare deployment
      dependencies and commit the resulting lockfile.
- [ ] Use `npm ci` for subsequent clean release builds.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run build:cloudflare`.
- [ ] Confirm `.open-next/worker.js` and `.open-next/assets` were generated.
- [ ] Confirm the build contains only expected application routes.
- [ ] Confirm `.env.local`, `.dev.vars`, `.wrangler`, `.open-next`, Supabase
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

- [ ] Authenticate the local Wrangler CLI with the intended Cloudflare account.
- [ ] Configure the deployment root as
      `standalone-projects/client-operations-revenue-workflow`.
- [ ] Confirm `.env.local` contains the approved
      `NEXT_PUBLIC_SUPABASE_URL` before each build.
- [ ] Confirm `.env.local` contains the approved
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` before each build.
- [ ] Confirm `.env.local` contains `NEXT_PUBLIC_ALLOW_SIGN_UP=false` before
      each build.
- [ ] Run `npm run preview` and complete the smoke test in the local Workers
      runtime before deploying.
- [ ] Run `npm run deploy` only from the reviewed commit.
- [ ] Record the resulting `workers.dev` or custom-domain HTTPS origin.
- [ ] Confirm Cloudflare Workers observability is receiving request and error
      logs.
- [ ] Confirm HTTPS is enforced by the hosting provider.
- [ ] Confirm responses include the configured frame, content-type, referrer,
      and permissions security headers.

## Supabase Auth

- [ ] Set the Auth Site URL to the exact production HTTPS origin.
- [ ] Allow `http://localhost:3000/**` only for local development.
- [ ] Add only approved preview redirect patterns.
- [ ] Prefer exact production redirect URLs over production wildcards.
- [ ] Test sign-in, sign-out, session restoration, and rejected credentials.

## Accessibility And Responsive Acceptance

- [ ] Complete the core workflow using only a keyboard.
- [ ] Confirm focus is always visible.
- [ ] Confirm the skip link moves focus to workspace content.
- [ ] Confirm forms expose visible labels and announce errors or status changes.
- [ ] Confirm desktop and mobile pages have no page-level horizontal overflow.
- [ ] Confirm mobile workspace navigation scrolls within its own navigation
      region.
- [ ] Confirm the interface remains usable with reduced-motion preferences.
- [ ] Confirm the light interface remains readable when the operating system
      uses dark mode.

## Product Smoke Test

- [ ] Sign in as an approved user and load the correct workspace.
- [ ] Create a client and a second job, then confirm job-scoped data remains
      isolated.
- [ ] Set and complete a next action.
- [ ] Create sequential Work Items and verify readiness behavior.
- [ ] Add handoff context to the exact Handoff Work Item.
- [ ] Create and update a proposal.
- [ ] Create a proposal-linked invoice and update its payment status.
- [ ] Confirm Workflow Health, relationship concern, Action Queue, readiness,
      and Activity stay correctly scoped.
- [ ] Confirm closed jobs are read-only.
- [ ] Refresh after each consequential write and confirm durable state.

## Release Decision

- [ ] Record the deployed commit SHA and production URL.
- [ ] Record the Supabase project reference used by the deployment.
- [ ] Record the person approving the release and the acceptance date.
- [ ] Keep the deployment private until export/delete, backups, monitoring,
      support, complete permissions, and privacy controls meet the later public
      release gate.
