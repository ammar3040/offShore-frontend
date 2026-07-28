import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'offshore-app-theme';
const LEGACY_KEYS = ['admin-panel-theme', 'crew-panel-theme', 'superadmin-panel-theme'] as const;

export type AppTheme = 'light' | 'dark';

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy === 'dark' || legacy === 'light') {
      localStorage.setItem(STORAGE_KEY, legacy);
      return legacy;
    }
  }
  return 'light';
}

export function getAppTheme(): AppTheme {
  return readStoredTheme();
}

export function setAppTheme(theme: AppTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  for (const key of LEGACY_KEYS) {
    localStorage.setItem(key, theme);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

export function applyAppTheme(theme: AppTheme = readStoredTheme()): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

/** Shared light/dark theme for Admin, Crew, and Superadmin. */
export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme());

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setAppTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
}
