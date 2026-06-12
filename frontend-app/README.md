
# 🚀 Deployment Guide: DSA Pattern Tracker

## Environment setup

Client (`frontend-app/.env`):
- `VITE_API_BASE_URL` (optional)
  - Leave empty to use same-origin `/api/*` (Vercel serverless functions).
  - Set `http://localhost:8888` only if you want to call Spring backend directly in local.

Serverless (`Vercel Project > Settings > Environment Variables`):
- `DB_PROVIDER=neon` or `DB_PROVIDER=aiven` to choose the active database
- `NEON_DATABASE_URL` as the Neon pooled Postgres URL
- `AIVEN_DATABASE_URL` as the Aiven Postgres URL
- `DATABASE_URL` or `DB_URL` as optional backward-compatible fallback for the active database
- `DB_USERNAME` and `DB_PASSWORD` when a JDBC-style `DB_URL` does not already include credentials
- `ADMIN_ACCESS_KEY` for admin access
- `CRON_SECRET` for the daily database keepalive cron
- `PG_USE_POOL=true` only when the active database URL points to a pooled/PgBouncer URL
- `PG_POOL_MAX=1` serverless-safe pool size
- `PG_CONNECTION_TIMEOUT_MS=5000` and `PG_IDLE_TIMEOUT_MS=1000` to give auth enough time while still releasing idle DB connections quickly

For Neon production on Vercel, use the Neon pooled connection string for `NEON_DATABASE_URL`. Admin login now includes a manual `Sync Active DB To Backup` button that copies `DB_PROVIDER`'s database into the inactive provider.

Example serverless env file is available at `frontend-app/.env.server.example`.

To get your app live on your **GoDaddy Domain** for free:

## Step 1: Push to GitHub
1. Create a new repository on [GitHub](https://github.com).
2. Upload these files to the repository.

## Step 2: Connect to Vercel (Free Hosting)
1. Go to [Vercel.com](https://vercel.com) and sign up with GitHub.
2. Click **"Add New"** > **"Project"**.
3. Import your GitHub repository.
4. Click **"Deploy"**. Your app is now live on a `.vercel.app` URL!

## Step 3: Link your GoDaddy Domain
1. In your Vercel Project dashboard, go to **Settings** > **Domains**.
2. Type your GoDaddy domain (e.g., `www.yourname.com`) and click **Add**.
3. Vercel will show you two DNS records (usually an **A record** and a **CNAME record**).
4. Log into **GoDaddy** > **My Products** > **DNS Management** for your domain.
5. **Update the records:**
   - Change the `A` record `@` to point to the IP Vercel gave you.
   - Change the `CNAME` record `www` to point to `cname.vercel-dns.com`.
6. Wait 5-10 minutes. Your DSA tracker is now live on your personal site!

---

### Why this setup?
- **Fast:** Vercel uses a Global Edge Network (much faster than GoDaddy's servers).
- **SSL Included:** You get a free Padlock (HTTPS) automatically.
- **Auto-Update:** Whenever you change your code on GitHub, your website updates automatically.
- **Zero Cost:** The hosting is free forever as long as you aren't getting millions of hits.

## API routes now hosted in frontend deployment
This app now includes Vercel serverless functions:
- `GET /api/v2/questions`
- `POST /api/v2/questions`
- `GET /api/progress`
- `POST /api/progress`
- `GET /api/cron/keep-db-awake` (scheduled by Vercel Cron)
- `GET/POST /api/auth`
- `GET/POST /api/admin`
- `POST /api/admin` with action `ensure-indexes` to run the admin-protected performance indexes once after database maintenance

`backend-api/` is kept in the repo as-is, but frontend production can run independently via these serverless routes.

## Vercel Cron Keepalive
`frontend-app/vercel.json` registers one daily cron job at `0 3 * * *` UTC. It calls `/api/cron/keep-db-awake`, which runs `SELECT 1` against Postgres so the database receives a request every day.

When `CRON_SECRET` is set in Vercel, Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` for cron invocations.

## Aiven To Neon Migration
Use the helper script to move the full current Aiven `public` schema and data into Neon:

```bash
cp dev/.env.neon-migration.example dev/.env.neon-migration
# Fill AIVEN_DATABASE_URL, NEON_DIRECT_DATABASE_URL, and NEON_POOLED_DATABASE_URL.
./dev/migrate-aiven-to-neon.sh all
```

The restore uses `NEON_DIRECT_DATABASE_URL`; Vercel production should use `NEON_POOLED_DATABASE_URL` with `PG_USE_POOL=true`.

## Company Bank Filter
Company-bank questions are rendered in the `Companies` route with:
- company search
- time filters (`All`, `30 Days`, `3 Months`, `6 Months`)
- same question cards as Syllabus

Filtering uses the generated static company question bank in `public/generated/company-questions.json`; database sync for company-bank data is handled outside Vercel serverless APIs.

## Generated LeetCode Data
Official solution content and company-bank data are static frontend assets so the 1 GB database can stay focused on users, progress, custom questions, and personal notes.

Refresh generated data after updating the sibling source repos:

```bash
cd /Users/rahulchadgal/WorkSpace/DSA_Pattern_tracker
node dev/generate-static-leetcode-data.mjs
```

The generator expects these sibling checkouts by default:
- `/Users/rahulchadgal/WorkSpace/leetcode`
- `/Users/rahulchadgal/WorkSpace/leetcode-companywise-interview-questions`
