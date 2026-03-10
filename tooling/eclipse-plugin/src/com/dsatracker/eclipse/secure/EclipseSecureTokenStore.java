package com.dsatracker.eclipse.secure;

import java.util.Optional;

import org.eclipse.equinox.security.storage.ISecurePreferences;
import org.eclipse.equinox.security.storage.SecurePreferencesFactory;
import org.eclipse.equinox.security.storage.StorageException;

import com.dsatracker.idecore.auth.TokenStore;

public class EclipseSecureTokenStore implements TokenStore {
    private static final String NODE = "com.dsatracker.eclipse";
    private static final String KEY = "userToken";

    @Override
    public Optional<String> getToken() {
        try {
            ISecurePreferences node = SecurePreferencesFactory.getDefault().node(NODE);
            return Optional.ofNullable(node.get(KEY, null));
        } catch (StorageException e) {
            throw new RuntimeException("Unable to read token from Eclipse secure storage", e);
        }
    }

    @Override
    public void saveToken(String token) {
        try {
            ISecurePreferences node = SecurePreferencesFactory.getDefault().node(NODE);
            node.put(KEY, token, true);
            node.flush();
        } catch (Exception e) {
            throw new RuntimeException("Unable to save token to Eclipse secure storage", e);
        }
    }

    @Override
    public void clearToken() {
        ISecurePreferences node = SecurePreferencesFactory.getDefault().node(NODE);
        node.remove(KEY);
    }
}
