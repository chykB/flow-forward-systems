# Client Operations & Revenue Workflow System

Private workspace software for small service businesses managing clients from
lead and proposal through delivery, approval, invoicing, payment, and handoff.

## Status

Private V1 is deployed. V1.5 Operations Agent work is in progress.

The application uses authenticated, workspace-scoped Supabase data. It is not a
public demo and must not be deployed with open registration or synthetic data
mixed into a real workspace.

Returning-client opportunities are intentionally deferred. The current Private
V1 scope ends with Workflow Readiness, Work Item handoff context, and the
existing client operations workflow.

## Product Areas

- Today: concise daily priorities and readiness items.
- Operations Agent: Suggest-mode guided client intake with explicit review.
- Workflow Snapshot: current engagement stages and active workflow issues.
- Client Records: clients, jobs, next actions, Work Items, handoff context,
  proposals, invoices, Workflow Health, and Activity.
- Action Queue: complete job-scoped issue and readiness workbench.
- Activity: durable history of meaningful workflow changes.

## Architecture

- Next.js 16 App Router with TypeScript and Tailwind CSS.
- Cloudflare Workers deployment through the OpenNext adapter.
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
- A Cloudflare account with Workers enabled.
- A linked Supabase project with the repository migrations applied.

## Environment

Create `.env.local` from `.env.example` and provide:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_ALLOW_SIGN_UP=false
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
OPENAI_API_KEY=YOUR_SERVER_ONLY_OPENAI_API_KEY
OPENAI_OPERATIONS_AGENT_MODEL=gpt-5.6-luna
```

Only publishable or anonymous Supabase keys belong in browser environment
variables. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only
secrets used by the guided client intake route. Never prefix them with
`NEXT_PUBLIC_`, expose them to browser code, or commit their values.

`NEXT_PUBLIC_ALLOW_SIGN_UP` defaults to `false`. Keep it false for Private V1
and disable new-user registration in Supabase Auth. Provision approved users
through the controlled project administration path.

## Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Guided client intake requires the two server-only secrets in the uncommitted
`.env.local`. The rest of the application, including the manual client form,
continues to work when the AI provider is unavailable.

## Verification

```bash
npm run lint
npm run build
npm run build:cloudflare
./node_modules/.bin/supabase migration list --linked
./node_modules/.bin/supabase db push --linked --dry-run
```

The dry run must report that the remote database is up to date before a release
is promoted.

## Deployment

Private V1 deploys to Cloudflare Workers through `@opennextjs/cloudflare`.
Cloudflare Pages is not used for this full Next.js application.

The application root in the monorepo is:

`standalone-projects/client-operations-revenue-workflow`

The `NEXT_PUBLIC_*` variables are embedded into the browser bundle during the
build. Keep the approved values in the uncommitted `.env.local` before running a
preview or deployment. They are public application configuration, not
server-side secrets.

Authenticate Wrangler and test the Worker runtime locally:

```bash
./node_modules/.bin/wrangler login
npm run preview
```

The preview normally runs at `http://localhost:8787`. Complete the signed-out
and signed-in smoke tests there before deploying.

Configure the production server secrets directly in Cloudflare before enabling
guided client intake:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

`OPENAI_OPERATIONS_AGENT_MODEL` defaults to `gpt-5.6-luna`. It may be set as a
non-secret Cloudflare Worker variable. The deployment script preserves
dashboard-managed variables while Wrangler preserves secrets.

Deploy the exact reviewed source:

```bash
npm run deploy
```

Record the resulting `workers.dev` URL and deployed commit SHA. Then set the
Supabase Auth Site URL to that exact HTTPS origin and add only the redirect URLs
required for local development and approved deployment previews. A custom
domain can replace the `workers.dev` Site URL after it is attached and tested.

Cloudflare hosts the Next.js application only. The planned Python/FastAPI agent
and external API services remain separate backend components. The first
Operations Agent capability runs in a protected Next.js server route; a future
worker service can take over the same durable runtime and command contracts
without moving this frontend.

Use [PRIVATE_V1_RELEASE_CHECKLIST.md](PRIVATE_V1_RELEASE_CHECKLIST.md) for the
complete deployment and acceptance review.

## Product Source Of Truth

Product planning lives in:

`AI Automation Career Client System/standalone-projects/sales-follow-up-automation-system/`

The implementation lives in:

`flow-forward-systems/standalone-projects/client-operations-revenue-workflow/`
