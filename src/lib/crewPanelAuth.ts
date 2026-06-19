/**
 * Crew panel session storage.
 * When real crew auth exists, replace with token-based getCrewMe() from API.
 */

import { env } from '../config/env';
import { isTokenExpired } from './auth';

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

/** Clears crew session (user + token). Use on logout. */
export function clearCrewSession(): void {
  clearCrewPanelUser();
  localStorage.removeItem(env.crewTokenKey);
}

/** Returns valid crew token or null if missing/expired. Cleans up invalid token. */
export function getCrewAccessToken(): string | null {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return null;
  if (isTokenExpired(token)) {
    localStorage.removeItem(env.crewTokenKey);
    clearCrewPanelUser();
    return null;
  }
  return token;
}

export function hasCrewAccessToken(): boolean {
  return !!getCrewAccessToken();
}
