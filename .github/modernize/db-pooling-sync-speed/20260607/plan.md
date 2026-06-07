# Fix Sync Status, DB Pooling, Company Smoke Test, And DB Index Speed

## Summary
Keep public browsing fast when Postgres is unavailable, make the sync indicator honest about signed-out and unavailable states, and use Aiven's pooler plus targeted secondary indexes for DB-backed auth/progress/admin operations.

## Implementation Notes
- `/api/progress` keeps returning `401` for anonymous or expired-token requests; the frontend should avoid progress calls until a valid auth token exists.
- Vercel production should use the Aiven pooler/PgBouncer URL in `DATABASE_URL` with `PG_USE_POOL=true`, `PG_POOL_MAX=1`, `PG_CONNECTION_TIMEOUT_MS=5000`, and `PG_IDLE_TIMEOUT_MS=1000`.
- If production is still using a direct Aiven database URL, keep `PG_USE_POOL` unset or false until the real pooler endpoint is available.
- Primary keys already exist; speed work is secondary indexes for progress lookups and custom-question loads.

## Test Plan
- Run `cd frontend-app && npm run build`.
- Verify anonymous `/api/progress` returns `401` by design.
- Verify `/`, `/companies`, and `/generated/company-questions.json` load quickly without DB dependency.
- Login with a temporary user, save progress, and confirm the sync dot turns green after sync.
- Trigger the admin DB index action once after Aiven maintenance clears.
