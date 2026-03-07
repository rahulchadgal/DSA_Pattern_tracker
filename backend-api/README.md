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
- `GET /api/v2/questions` (metadata/streaming-ready)
- `POST /api/v2/questions`
- `GET /api/progress` (JWT required)
- `POST /api/progress` (JWT required)

## Environment variables
Use `.env.example` values in Render environment:
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
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
7. In Vercel frontend, set `VITE_API_BASE_URL` to Render backend `/api` path.

## Note
AI classification and Excel import remain as upcoming feature modules and can be toggled by feature flags.
