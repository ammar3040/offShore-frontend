const STORAGE_KEY = 'crew-panel-theme';

export type CrewPanelTheme = 'light' | 'dark';

export function getCrewPanelTheme(): CrewPanelTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

export function setCrewPanelTheme(theme: CrewPanelTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
