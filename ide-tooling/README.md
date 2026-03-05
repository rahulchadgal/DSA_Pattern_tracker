# IDE Tooling Workspace

This folder contains cross-IDE tooling for the DSA Pattern Tracker.

## Modules

- `shared-core` (Maven): common REST client + LeetCode JSON parser + tree builder.
- `eclipse-plugin` (PDE skeleton): STS/Eclipse OSGi plugin boilerplate with `ViewPart` + `TreeViewer`.
- `intellij-bridge` (reference): IntelliJ secure token + bridge classes + Gradle dependency example.

## Build shared core

```bash
cd ide-tooling
mvn -pl shared-core -am clean install
```
