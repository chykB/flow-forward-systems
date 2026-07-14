# Supabase Database Workflow

## Purpose

Supabase stores the product's persistent records, workflow rules, RLS policies,
constraints, functions, and triggers. Database schema history must remain
reproducible from Git.

## Baseline

`20260714164216_remote_schema_baseline.sql` captures the existing hosted
`public` schema without customer data or credentials.

The baseline also restores the application-owned `on_auth_user_created`
trigger on `auth.users`, which is outside a public-only schema dump.

The baseline was marked applied remotely without executing its SQL because
the captured schema already existed.

Never edit the baseline after this checkpoint. Every future schema change must
use a new migration.

## Current Operating Mode

- The hosted Supabase project is the runtime database.
- Git migrations are the schema source of truth from the baseline forward.
- Docker and the local Supabase stack are not currently used.
- The database password must never be committed or placed in command arguments.
- `supabase/.temp/` contains ignored local link metadata.
- Customer records and secrets must never appear in migration files.

## Creating A Schema Change

Create one focused migration:

```bash
./node_modules/.bin/supabase migration new descriptive_change_name