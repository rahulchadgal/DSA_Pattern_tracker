# Frontend App

React + Vite frontend for DSA Pattern Tracker. This folder also owns the Vercel serverless API routes used by production.

## App Features

- Syllabus pattern tracker with progress percentages.
- Company-bank browser with search and time filters.
- Global question search across syllabus and company data.
- Roulette mode for random unsolved question selection.
- Personal solution notes with lazy loading.
- Official solution modal with question, hint, and Java solution views.
- Dual UI themes:
  - Neo Glass
  - Old School Classic
- Login-required progress, notes, and custom question workflows.
- Local-first sync with debounced batch progress writes.

## Local Development

```bash
npm install
npm run dev
```

The app defaults to same-origin `/api/*` calls, which matches Vercel. For a custom API base, create `frontend-app/.env`:

```bash
VITE_API_BASE_URL=
```

Build:

```bash
npm run build
```

## Vercel Settings

Use these project settings:

- Framework: `vite`
- Root directory: `frontend-app`
- Production branch: `main`
- Cron file: `frontend-app/vercel.json`

Domains:

- `www.rahulchadgal.in`
- `rahulchadgal.in` redirects to `www.rahulchadgal.in`

## Environment Variables

Set these in Vercel Project Settings:

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

Recommended serverless pool defaults:

```bash
PG_USE_POOL=true
PG_POOL_MAX=1
PG_CONNECTION_TIMEOUT_MS=5000
PG_IDLE_TIMEOUT_MS=1000
```

Use Vercel's dashboard for real values. Do not commit secrets.

## Serverless API Routes

Routes are in `frontend-app/api`:

- `GET /api/progress` - load progress rows.
- `POST /api/progress` - save one progress row or `{ items: [...] }` batch.
- `GET /api/v2/questions` - load custom questions.
- `POST /api/v2/questions` - save custom questions.
- `GET/POST /api/auth` - login/signup/session operations.
- `GET/POST /api/admin` - admin users, indexes, database sync.
- `GET /api/cron/keep-db-awake` - Vercel cron keepalive.
- `GET /api/health/db` - DB health check.

## Sync Behavior

The frontend avoids continuous polling:

- Progress changes update local UI immediately.
- Pending changes are cached in localStorage.
- Writes are batched after a short debounce.
- Multiple tabs use a localStorage lock to avoid duplicate flushes.
- Remote progress loads once per signed-in handle, then only on stale focus or manual retry.

This keeps Vercel function invocation usage low.

## Static Generated Data

Generated assets are served from `public/generated`:

- `company-questions.json`
- `leetcode-solutions.json`

Refresh after updating the sibling source repos:

```bash
cd ..
node dev/generate-static-leetcode-data.mjs
```

## Testing

Production build check:

```bash
npm run build
```

Playwright tests/config are present for browser checks:

```bash
npx playwright test
```

Run Playwright only when local browser dependencies are available.
