package com.dsatracker.idecore.client;

public final class BackendUrlResolver {
    public static final String DEFAULT_BACKEND_URL = "https://dsa-tracker-api-l3na.onrender.com";
    private static final String SYSTEM_PROPERTY = "dsa.backend.url";
    private static final String ENV_VARIABLE = "DSA_BACKEND_URL";

    private BackendUrlResolver() {
    }

    public static String resolve() {
        String fromSystemProperty = normalize(System.getProperty(SYSTEM_PROPERTY));
        if (fromSystemProperty != null) {
            return fromSystemProperty;
        }

        String fromEnv = normalize(System.getenv(ENV_VARIABLE));
        if (fromEnv != null) {
            return fromEnv;
        }

        return DEFAULT_BACKEND_URL;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
