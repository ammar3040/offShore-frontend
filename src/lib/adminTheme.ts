const STORAGE_KEY = 'admin-panel-theme';

export type AdminTheme = 'light' | 'dark';

export function getAdminTheme(): AdminTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

export function setAdminTheme(theme: AdminTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
