# IntelliJ Bridge (Reuse `shared-core`)

Use this reference to wire `shared-core` into your IntelliJ SDK plugin project and avoid duplicating backend logic.

## 1) Install the shared module locally

From `tooling/`:

```bash
mvn -pl shared-core -am clean install
```

This publishes `com.dsatracker:shared-core:0.1.0-SNAPSHOT` to your local Maven repo.

## 2) Add dependency in IntelliJ plugin project

In your IntelliJ plugin `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.dsatracker:shared-core:0.1.0-SNAPSHOT")
}
```

If you prefer source-level linking during development, use Gradle composite builds:

```kotlin
includeBuild("../tooling/shared-core")
```

## 3) Token storage with PasswordSafe

Use `IntellijTokenStore` as your `TokenStore` implementation. It stores/retrieves the JWT via IntelliJ secure storage API (`PasswordSafe`).

## 4) Call backend once, reuse everywhere

Use `IntellijBackendBridge` to fetch `QuestionV2` and build a pattern tree via shared `PatternTreeBuilder`.

Backend URL resolution order used by `IntellijBackendBridge()`:
- Java system property: `-Ddsa.backend.url=https://...`
- Environment variable: `DSA_BACKEND_URL=https://...`
- Fallback default: `https://dsa-tracker-api-l3na.onrender.com`
