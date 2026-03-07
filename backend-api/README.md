# DSA Tracker Backend (Spring Boot 4 / Spring Framework 7)

Backend scaffold for migration from frontend-managed persistence to secure API-driven architecture.

## Stack baseline
- Java 21 (compatible with Java 25 in later upgrade)
- Spring Boot 4.0 / Spring Framework 7
- Jakarta EE 11 APIs (via Spring Boot 4 platform)
- PostgreSQL + Spring Data JPA

## Implemented modules
- JWT auth + CORS for Vercel frontend
- User profile/handle model
- Question catalog with support for default and custom-imported questions
- Progress tracking with `LocalDateTime`
- Resilience pattern sample using `@Retryable` + `@Recover`
- Versioned Question API using `@RequestMapping` path versions (`v1`, `v2`)

## API map
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/v1/questions` (basic list)
- `GET /api/v2/questions` (metadata/streaming-ready; supports `customOnly` and `importedByHandle`)
- `POST /api/v2/questions`
- `GET /api/progress` (supports JWT or `?handle=<handle>`)
- `POST /api/progress` (supports JWT or request-body `handle`)

## Environment variables
Use `.env.example` values in Render environment:
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
  - local dev default should include `http://localhost:3000` for Vite frontend
- `HIBERNATE_DDL_AUTO` (`update` for local dev, `validate` recommended for managed DB after schema init)

## Aiven + Render setup
1. Create PostgreSQL in Aiven and copy host/port/db/user/password.
2. Construct JDBC URL:
   `jdbc:postgresql://<host>:<port>/<database>`
3. Initialize schema from repo:
   ```bash
   cp dev/.env.aiven.example dev/.env.aiven
   ./dev/init-aiven-schema.sh
   ```
4. Seed default catalog questions from `frontend-app/constants.tsx`:
   ```bash
   ./dev/seed-aiven-questions.sh
   ```
5. Deploy backend on Render using `backend-api/render.yaml`.
6. Fill secret env vars in Render dashboard.
7. In Vercel frontend, set `VITE_API_BASE_URL` to the Render backend base URL (for example `https://your-backend.onrender.com`).

## Deploy backend to Render via GitHub
1. Push this repo to GitHub (if not already pushed).
2. In Render, click `New +` -> `Blueprint` and select your GitHub repo.
3. Keep `backend-api/render.yaml` as the deployment blueprint and create the service.
4. In Render service settings, confirm:
   - `Root Directory`: `backend-api`
   - `Runtime`: `Docker`
   - `Health Check Path`: `/actuator/health`
5. Set required environment variables:
   - `DB_URL`
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `JWT_SECRET`
   - `JWT_EXPIRATION_MS` (optional override)
6. Set `CORS_ALLOWED_ORIGINS` to at least:
   - `https://www.rahulchadgal.in`
   - `https://rahulchadgal.in`
   - `https://dsa-pattern-tracker-git-main-rahulchadgals-projects.vercel.app`
   - `https://dsa-pattern-tracker-oz3jjzlxp-rahulchadgals-projects.vercel.app`
7. Deploy. After deploy, copy backend URL and set `VITE_API_BASE_URL` in Vercel.
8. In Render logs, verify request traces from `RequestLoggingFilter`:
   - each request has method/path/status/duration
   - failures include stack traces with `requestId` for debugging

## Note
AI classification and Excel import remain as upcoming feature modules and can be toggled by feature flags.
