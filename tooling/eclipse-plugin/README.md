# STS/Eclipse Plugin Boilerplate (PDE/OSGi)

This project provides a PDE plugin skeleton with a `ViewPart` named **DSA Patterns**.

## Included

- `plugin.xml`: Registers the `DSA Patterns` sidebar view.
- `DsaPatternsView`: Loads questions from backend `GET /api/v1/questions`.
- Double-click behavior: creates or updates a `.java` starter file under
  `src/main/java/dsa/<mainPattern>/<subPattern>/` and opens it in the Eclipse editor.
- `EclipseSecureTokenStore`: stores JWT token with `SecurePreferencesFactory`.

## Wiring `shared-core` in PDE

1. Build shared-core jar:

```bash
cd tooling
mvn -pl shared-core -am clean install
```

2. The plugin now bundles required runtime jars under `tooling/eclipse-plugin/lib/`:
- `shared-core-0.1.0-SNAPSHOT.jar`
- `jackson-databind-2.18.2.jar`
- `jackson-core-2.18.2.jar`
- `jackson-annotations-2.18.2.jar`

3. Refresh `eclipse-plugin` project in STS after rebuilding shared-core so latest jar is picked up.

## Notes

- Backend URL is editable in the view and defaults using:
  - Java system property: `-Ddsa.backend.url=https://...`
  - Environment variable: `DSA_BACKEND_URL=https://...`
  - Fallback default: `https://dsa-tracker-api-l3na.onrender.com`
- Current view uses `api/v1/questions` (public endpoint), so no login is required.
