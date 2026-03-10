
# 🚀 Deployment Guide: DSA Pattern Tracker

## Environment setup

Copy `frontend-app/.env.example` into `.env` and configure:

- `VITE_API_BASE_URL` - optional. Keep empty to use same-origin `/api/*` serverless routes in Vercel.

## Serverless API (Vercel Functions)

This app now includes serverless API routes under `frontend-app/api/`:
- `GET /api/v1/questions`
- `GET /api/v1/dashboard`
- `GET/POST /api/progress`
- `GET/POST /api/v2/questions`

Set database secrets in Vercel (server-side only):
- `DATABASE_URL` (recommended), or
- `DB_URL` + `DB_USERNAME` + `DB_PASSWORD`

Use `frontend-app/.env.server.example` as the template for required server env keys.

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

## Optional Spring Backend
`backend-api/` still exists for Spring Boot deployment, but frontend can now run end-to-end with Vercel serverless API + PostgreSQL.
