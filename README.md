
# 🚀 Deployment Guide: DSA Pattern Tracker

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

## Backend API (Spring Boot)
A backend scaffold is available under `backend/` with JWT auth, CORS, PostgreSQL entities, and Render/Aiven deployment notes.
See: `backend/README.md`.
