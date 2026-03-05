package com.dsatracker.intellijbridge;

import com.dsatracker.idecore.auth.TokenStore;
import com.intellij.credentialStore.CredentialAttributes;
import com.intellij.credentialStore.Credentials;
import com.intellij.ide.passwordSafe.PasswordSafe;

import java.util.Optional;

public class IntellijTokenStore implements TokenStore {
    private static final String SERVICE_NAME = "DSA Pattern Tracker User Token";
    private static final String USER_NAME = "user-token";

    private static CredentialAttributes attrs() {
        return new CredentialAttributes(SERVICE_NAME, USER_NAME);
    }

    @Override
    public Optional<String> getToken() {
        Credentials credentials = PasswordSafe.getInstance().get(attrs());
        return credentials == null ? Optional.empty() : Optional.ofNullable(credentials.getPasswordAsString());
    }

    @Override
    public void saveToken(String token) {
        PasswordSafe.getInstance().set(attrs(), new Credentials(USER_NAME, token));
    }

    @Override
    public void clearToken() {
        PasswordSafe.getInstance().set(attrs(), null);
    }
}
