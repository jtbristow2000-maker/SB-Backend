# Supabase Persistence

The web backend defaults to in-memory storage so the sandbox console, owner screens, and Vitest
suite run without a database:

```env
PERSISTENCE=memory
```

Use Supabase when you want missed calls, voicemails, callback tasks, owner edits, and outbound
message records to survive a server restart.

## Environment

Create `web/.env.local` from `web/.env.example` and set:

```env
PERSISTENCE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BUSINESS_NAME=Your Business
BUSINESS_PHONE=+13105550199
OWNER_PHONE=+12133734253
TIMEZONE=America/New_York
```

Only use `SUPABASE_SERVICE_ROLE_KEY` on the server. Do not expose it through `NEXT_PUBLIC_*` vars
or browser code.

## Database Setup

Apply the schema in `web/supabase/migrations/0001_init.sql` with either Supabase CLI or `psql`.

Supabase CLI:

```powershell
cd web
supabase db push
```

`psql`:

```powershell
psql "$env:SUPABASE_DB_URL" -f .\supabase\migrations\0001_init.sql
```

The migration is idempotent and creates the tables used by the current backend contract:
businesses, customer profiles, call records, messages, tasks, appointments, quote drafts, and
audit events.

## Run Locally

```powershell
cd web
npm run dev
```

With `PERSISTENCE=supabase`, `getIntakeRuntime()` builds Supabase-backed repositories behind the
same interfaces used by the in-memory demo. If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
missing, startup fails fast with a clear error.

## Test Notes

The default test run stays offline and uses in-memory repositories:

```powershell
cd web
npm test
```

Supabase repository contract tests are skipped unless `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are present.
