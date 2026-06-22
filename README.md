# DSA Pattern Tracker

A React + Vite app for tracking DSA pattern practice, LeetCode progress, company-tagged questions, and personal solution notes.

The production app is deployed as a Vercel frontend with serverless API routes in `frontend-app/api`. The older Spring Boot backend remains in `backend-api/` for reference and local backend work, but the live app does not require it.

## What It Does

- Tracks solved questions across the DSA syllabus.
- Supports company question browsing with `All`, `30 Days`, `3 Months`, and `6 Months` filters.
- Includes global question search by LeetCode ID or title.
- Saves personal solution notes and lazy-loads note content when needed.
- Shows official solution/hint/code content from generated static assets.
- Supports two visual modes:
  - Neo Glass
  - Old School Classic
- Requires login for progress, notes, and custom question changes.
- Uses local-first progress updates with debounced batch sync to reduce Vercel function invocations.

## Repository Layout

- `frontend-app/` - React app, Vercel serverless API routes, static generated data.
- `backend-api/` - Spring Boot API retained for backend/reference workflows.
- `dev/` - database migration and generated-data helper scripts.
- `tooling/` - shared/plugin reference code.

## Run Locally

```bash
cd frontend-app
npm install
npm run dev
```

By default the frontend calls same-origin `/api/*` routes. For local experiments with a separate backend, set `VITE_API_BASE_URL` in `frontend-app/.env`.

Build:

```bash
cd frontend-app
npm run build
```

## Vercel Deployment

The Vercel project should use:

- Framework: `vite`
- Root directory: `frontend-app`
- Production branch: `main`
- Domain setup:
  - `www.rahulchadgal.in`
  - `rahulchadgal.in` redirecting to `www.rahulchadgal.in`

Required Vercel environment variables:

- `DB_PROVIDER`
- `NEON_DATABASE_URL`
- `AIVEN_DATABASE_URL`
- `DATABASE_URL` or `DB_URL` as optional fallback
- `AUTH_TOKEN_SECRET`
- `ADMIN_ACCESS_KEY`
- `CRON_SECRET`
- `PG_USE_POOL`
- `PG_POOL_MAX`
- `PG_CONNECTION_TIMEOUT_MS`
- `PG_IDLE_TIMEOUT_MS`

Use pooled database URLs for serverless production where appropriate. Keep real env values in Vercel only; do not commit them.

## API Routes

Serverless routes live under `frontend-app/api`:

- `GET /api/progress`
- `POST /api/progress`
- `GET /api/v2/questions`
- `POST /api/v2/questions`
- `GET/POST /api/auth`
- `GET/POST /api/admin`
- `GET /api/health/db`
- `GET /api/cron/keep-db-awake`

Progress writes support both single-row saves and batch saves through `POST /api/progress`.

## Sync Model

The app is local-first:

- UI updates immediately.
- Progress changes are stored in local pending cache.
- Pending changes flush after a short debounce as a batch.
- No continuous background polling is used.
- On focus/visibility regain, the app only refreshes after a long stale window.
- Multiple tabs coordinate through a lightweight localStorage lock.

This is intentional to keep Vercel function invocations low.

## Generated Static Data

Company-bank data and official LeetCode solution data are static frontend assets:

- `frontend-app/public/generated/company-questions.json`
- `frontend-app/public/generated/leetcode-solutions.json`

Refresh them with:

```bash
node dev/generate-static-leetcode-data.mjs
```

The generator expects sibling checkouts for the source LeetCode repos as documented inside the script.

## Database Migration Helpers

Migration scripts live in `dev/`, including Aiven-to-Neon helpers. Use the example env files as templates and keep real credentials out of Git.

```bash
cp dev/.env.neon-migration.example dev/.env.neon-migration
./dev/migrate-aiven-to-neon.sh all
```

## Notes

- `vercel-export-*/` folders are ignored because they can contain migration metadata and env values.
- `backend-api/UIredisgn.md` is intentionally untracked unless explicitly committed later.
