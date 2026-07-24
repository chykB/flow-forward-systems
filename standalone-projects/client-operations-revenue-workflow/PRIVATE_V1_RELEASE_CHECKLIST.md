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
- [ ] Run `npm ci`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Confirm the build contains only expected application routes.
- [ ] Confirm `.env.local`, Supabase temporary files, dependencies, and build
      output are not committed.

## Hosting

- [ ] Configure the deployment root as
      `standalone-projects/client-operations-revenue-workflow`.
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` for Preview and Production.
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Preview and Production.
- [ ] Set `NEXT_PUBLIC_ALLOW_SIGN_UP=false` for Preview and Production.
- [ ] Deploy a preview before promoting Production.
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
