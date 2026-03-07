import { useState } from 'react';

export const PROFILE_KEY = 'dsa-handle-v4';

const resolveInitialHandle = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlHandle = urlParams.get('user');
  if (urlHandle) {
    const normalized = urlHandle.trim().toLowerCase();
    localStorage.setItem(PROFILE_KEY, normalized);
    window.history.replaceState({}, '', window.location.pathname);
    return normalized;
  }
  return localStorage.getItem(PROFILE_KEY) || '';
};

export const useProfileHandle = () => {
  const [handle, setHandle] = useState<string>(resolveInitialHandle);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => !resolveInitialHandle());

  const persistHandle = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setHandle(normalized);
    localStorage.setItem(PROFILE_KEY, normalized);
    setShowWelcome(false);
    return normalized;
  };

  return {
    handle,
    setHandle,
    showWelcome,
    setShowWelcome,
    persistHandle
  };
};
