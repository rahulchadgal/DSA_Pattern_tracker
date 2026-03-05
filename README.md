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

Backend:

```bash
cd backend-api
mvn spring-boot:run
```

Shared core build:

```bash
cd tooling
mvn -pl shared-core -am clean install
```

Or use root helper scripts:

```bash
./dev/run-frontend.sh
./dev/run-backend.sh
./dev/build-shared-core.sh
```
