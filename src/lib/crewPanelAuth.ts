/**
 * Crew panel session storage.
 * When real crew auth exists, replace with token-based getCrewMe() from API.
 */

const CREW_PANEL_USER_KEY = 'offshore_crew_panel_user';

export interface CrewPanelUser {
  email: string;
}

export function getStoredCrewPanelUser(): CrewPanelUser | null {
  try {
    const raw = localStorage.getItem(CREW_PANEL_USER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === 'object' && 'email' in data && typeof (data as CrewPanelUser).email === 'string') {
      return data as CrewPanelUser;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setCrewPanelUser(user: CrewPanelUser): void {
  localStorage.setItem(CREW_PANEL_USER_KEY, JSON.stringify(user));
}

export function clearCrewPanelUser(): void {
  localStorage.removeItem(CREW_PANEL_USER_KEY);
}
