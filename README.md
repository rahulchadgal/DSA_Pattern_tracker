# DSA Pattern Tracker Monorepo

This repository is organized so each major component can be opened directly in its preferred IDE.

## Folder layout

- `frontend-app/` - React + Vite UI
- `backend-api/` - Spring Boot 4 API
- `tooling/shared-core/` - shared Java library for IDE plugins
- `tooling/eclipse-plugin/` - STS/Eclipse PDE plugin
- `tooling/intellij-plugin/` - IntelliJ SDK plugin bridge/reference

## Open in IDE

- IntelliJ IDEA:
  - Open `frontend-app/` for frontend work, or
  - Open `backend-api/` for backend work, or
  - Open `tooling/` for shared/plugin Java code
- STS/Eclipse:
  - Import existing Maven project from `backend-api/`
  - Import existing projects from `tooling/eclipse-plugin` and `tooling/shared-core`
  - Use PDE target platform for Eclipse plugin dependencies

## Run locally

Frontend:

```bash
cd frontend-app
npm install
npm run dev
```

Set env first (see `frontend-app/.env.example`):
- `VITE_API_BASE_URL`

Backend:

```bash
cd backend-api
mvn spring-boot:run
```

Set env first (choose Spring active profile `local` or `prod` in IDE/Run config):
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`
- `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS` (for future large object storage)

Initialize Aiven/Postgres schema before first backend run:

```bash
# one-time: copy/edit credentials file
cp dev/.env.aiven.example dev/.env.aiven
# then run init
./dev/init-aiven-schema.sh
```

Seed question catalog from `frontend-app/constants.tsx`:

```bash
./dev/seed-aiven-questions.sh
```

Import company question bank from public GitHub repo:

```bash
# parse + summary only (no DB write)
./dev/import-company-bank.sh --dry-run

# clone/pull repo and upsert into question_catalog
./dev/import-company-bank.sh
```

Optional env overrides for importer:
- `COMPANY_BANK_REPO_URL`
- `COMPANY_BANK_REPO_BRANCH`
- `COMPANY_BANK_REPO_CACHE_DIR`

Recommended for managed DB environments:
- set `HIBERNATE_DDL_AUTO=validate` after schema is initialized.

Shared core build:

```bash
cd tooling
mvn -pl shared-core -am clean install
```

Or use root helper scripts:

```bash
./dev/run-frontend.sh
./dev/build-shared-core.sh
```
