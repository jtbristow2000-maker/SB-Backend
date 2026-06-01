# Archive — not in use

Earlier versions and prototypes, kept for reference only. **Nothing in this folder is
part of the live product.**

The live product is the Next.js app in **`web/`** (deployed to Vercel, backed by
Supabase). If you're looking for the real code, it's there.

## Contents

- **`dashboard-winforms/`** — the original C# .NET WinForms desktop prototype of the
  owner dashboard. Superseded by the web owner screens in `web/src/app/owner/`. Frozen;
  not built or run anymore. (Its `bin/` and `obj/` build output is git-ignored.)
- **`dashboard-dist/`** — the compiled `BusinessDashboard.exe` from that prototype
  (git-ignored; exists only on your local machine).
- **`legacy/backend-python/`** — the original FastAPI / SQLAlchemy backend prototype,
  replaced by the Next.js API routes + Supabase persistence in `web/`.
- **`env.example.python`** — the old root `.env.example` (sqlite / `APP_ENV` era) used
  by the Python backend. The current environment template is `web/.env.example`.

## Recovering something

Nothing was deleted — everything here is still in git history and on disk. To bring a
file back into active use, move it with `git mv archive/<path> <new-location>`.
