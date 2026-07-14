# Supabase Database Workflow

## Purpose

Supabase stores the product's persistent records, workflow rules, RLS policies,
constraints, functions, triggers, and audit behavior. Database schema history
must remain reproducible from Git.

## Baseline

`20260714164216_remote_schema_baseline.sql` captures the hosted `public` schema
that existed when migration tracking began. It contains schema only, without
customer data or credentials.

The baseline also restores the application-owned `on_auth_user_created` trigger
on `auth.users`, which is outside a public-only schema dump.

The baseline was marked as applied remotely without executing its SQL because
the captured schema already existed.

Never edit the baseline after this checkpoint. Every future schema change must
use a new migration.

## Current Operating Mode

- The hosted Supabase project is the runtime database.
- Git migrations are the schema source of truth from the baseline forward.
- Docker and the local Supabase stack are not currently used.
- The database password must never be committed or placed in command arguments.
- `supabase/.temp/` contains ignored local project-link metadata.
- Customer records and secrets must never appear in migration files.

## Creating A Schema Change

No new schema change is required at this checkpoint.

When a future database change is approved, create one focused migration:

```bash
./node_modules/.bin/supabase migration new descriptive_change_name
```

The CLI creates a timestamped SQL file under `supabase/migrations/`.

Edit only that newly generated migration file. Do not edit
`20260714164216_remote_schema_baseline.sql`.

Every migration must preserve:

- Workspace isolation.
- Row Level Security policies.
- Required database constraints and indexes.
- Restricted function execution permissions.
- Fixed function `search_path` settings.
- Workflow markers, triggers, and audit behavior.

Do not make routine schema changes through the hosted SQL Editor. If an
emergency remote change is unavoidable, capture it immediately in a reviewed
migration so Git remains the source of truth.

## Verification

Before applying a migration, run:

```bash
./node_modules/.bin/supabase migration list --linked
npm run lint
npm run build
git diff --check
```

Review the SQL for destructive operations, missing workspace boundaries,
disabled RLS, broad function execution, credentials, and customer data.

No deployment is currently authorized. At a future approved deployment
checkpoint, inspect pending changes first:

```bash
./node_modules/.bin/supabase db push --linked --dry-run
```

Only run `db push --linked` after explicit review and approval.

## Prohibited Operations

Never run `supabase db reset --linked`.

Do not use `migration repair` as a normal deployment command. It is only for
reconciling migration metadata when the actual schema is already known to
match.

Do not run `db push` from an unreviewed or dirty worktree.