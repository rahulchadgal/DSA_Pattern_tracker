import { useState } from 'react';

export const PROFILE_KEY = 'dsa-handle-v4';
export const AUTH_SESSION_KEY = 'dsa-auth-session-v1';

const resolveInitialHandle = () => {
  const savedSession = localStorage.getItem(AUTH_SESSION_KEY);
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (
        typeof parsed.handle === 'string' &&
        parsed.handle.trim() &&
        typeof parsed.token === 'string' &&
        parsed.token.trim()
      ) {
        return parsed.handle.trim().toLowerCase();
      }
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }
  const urlParams = new URLSearchParams(window.location.search);
  const urlHandle = urlParams.get('user');
  if (urlHandle) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  localStorage.removeItem(PROFILE_KEY);
  return '';
};

export const useProfileHandle = () => {
  const [initialHandle] = useState(resolveInitialHandle);
  const [handle, setHandle] = useState<string>(initialHandle);
  const [showWelcome, setShowWelcome] = useState(false);

  const persistHandle = (value: string, token?: string) => {
    const normalized = value.trim().toLowerCase();
    setHandle(normalized);
    localStorage.setItem(PROFILE_KEY, normalized);
    if (token) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, handle: normalized }));
    }
    setShowWelcome(false);
    return normalized;
  };

  const clearHandle = () => {
    setHandle('');
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    setShowWelcome(true);
  };

  return {
    handle,
    setHandle,
    showWelcome,
    setShowWelcome,
    persistHandle,
    clearHandle
  };
};
