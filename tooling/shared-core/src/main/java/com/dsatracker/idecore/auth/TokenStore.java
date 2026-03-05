package com.dsatracker.idecore.auth;

import java.util.Optional;

/**
 * IDE-agnostic abstraction for secure token persistence.
 */
public interface TokenStore {
    Optional<String> getToken();

    void saveToken(String token);

    void clearToken();
}
