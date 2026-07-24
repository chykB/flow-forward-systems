# Client Operations & Revenue Workflow System

Private workspace software for small service businesses managing clients from
lead and proposal through delivery, approval, invoicing, payment, and handoff.

## Status

Private V1 release candidate.

The application uses authenticated, workspace-scoped Supabase data. It is not a
public demo and must not be deployed with open registration or synthetic data
mixed into a real workspace.

Returning-client opportunities are intentionally deferred. The current Private
V1 scope ends with Workflow Readiness, Work Item handoff context, and the
existing client operations workflow.

## Product Areas

- Today: concise daily priorities and readiness items.
- Workflow Snapshot: current engagement stages and active workflow issues.
- Client Records: clients, jobs, next actions, Work Items, handoff context,
  proposals, invoices, Workflow Health, and Activity.
- Action Queue: complete job-scoped issue and readiness workbench.
- Activity: durable history of meaningful workflow changes.

## Architecture

- Next.js 16 App Router with TypeScript and Tailwind CSS.
- Supabase Auth and PostgreSQL.
- Row-level security on workspace data.
- Reviewed SQL migrations under `supabase/migrations`.
- Typed application commands for consequential writes, idempotency, stale-write
  protection, and Activity history.
- Deterministic workflow stages, readiness, risk reconciliation, and health
  scoring.

## Requirements

- Node.js 20.9 or later.
- npm.
- A linked Supabase project with the repository migrations applied.

## Environment

Create `.env.local` from `.env.example` and provide:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_ALLOW_SIGN_UP=false
```

Only publishable or anonymous Supabase keys belong in browser environment
variables. Never expose a service-role key.

`NEXT_PUBLIC_ALLOW_SIGN_UP` defaults to `false`. Keep it false for Private V1
and disable new-user registration in Supabase Auth. Provision approved users
through the controlled project administration path.

## Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
./node_modules/.bin/supabase migration list --linked
./node_modules/.bin/supabase db push --linked --dry-run
```

The dry run must report that the remote database is up to date before a release
is promoted.

## Deployment

Deploy as a Next.js Node.js application. In a monorepo host, set the project
root to:

`standalone-projects/client-operations-revenue-workflow`

Configure the required environment variables for Preview and Production. After
the production URL exists, set the Supabase Auth Site URL to that exact HTTPS
URL and add only the redirect URLs required for local development and approved
deployment previews.

Use [PRIVATE_V1_RELEASE_CHECKLIST.md](PRIVATE_V1_RELEASE_CHECKLIST.md) for the
complete deployment and acceptance review.

## Product Source Of Truth

Product planning lives in:

`AI Automation Career Client System/standalone-projects/sales-follow-up-automation-system/`

The implementation lives in:

`flow-forward-systems/standalone-projects/client-operations-revenue-workflow/`
