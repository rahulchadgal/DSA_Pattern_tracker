# STS/Eclipse Plugin Boilerplate (PDE/OSGi)

This project provides a PDE plugin skeleton with a `ViewPart` named **DSA Patterns**.

## Included

- `plugin.xml`: Registers the `DSA Patterns` sidebar view.
- `DsaPatternsView`: Uses `TreeViewer` and loads backend patterns.
- `PatternTreeContentProvider`: Hierarchical tree for pattern/sub-pattern/problem.
- Double-click behavior: creates or updates a `.java` starter file and opens it in the Eclipse editor.
- `EclipseSecureTokenStore`: stores JWT token with `SecurePreferencesFactory`.

## Wiring `shared-core` in PDE

1. Build shared-core jar:

```bash
cd tooling
mvn -pl shared-core -am clean install
```

2. In Eclipse/STS, create a **Target Platform** that includes:
- Eclipse base + PDE bundles
- A bundle wrapping `shared-core` (or include it as a plugin dependency via bnd/Target definition)

3. Ensure `MANIFEST.MF` imports `com.dsatracker.idecore.*` packages (already scaffolded).

## Notes

- Backend base URL is currently hardcoded to `http://localhost:8080` in `DsaPatternsView`.
- The view expects a JWT token to already exist in secure storage for `/api/v2/questions`.
- Add a login command/dialog that calls `DsaBackendClient.login(...)` and stores token via `EclipseSecureTokenStore`.
