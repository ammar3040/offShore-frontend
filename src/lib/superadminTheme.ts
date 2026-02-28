const STORAGE_KEY = 'superadmin-panel-theme';

export type SuperadminTheme = 'light' | 'dark';

export function getSuperadminTheme(): SuperadminTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

export function setSuperadminTheme(theme: SuperadminTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
