const STORAGE_KEY = 'crew-panel-theme';

export type CrewPanelTheme = 'light' | 'dark';

export function getCrewPanelTheme(): CrewPanelTheme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'dark';
}

export function setCrewPanelTheme(theme: CrewPanelTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
