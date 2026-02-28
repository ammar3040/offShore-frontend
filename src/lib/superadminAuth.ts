import { env } from '../config/env';

const STORAGE_KEY = env.superadminTokenKey;

export function getSuperadminAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearSuperadminSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSuperadminAccessToken(): boolean {
  return !!getSuperadminAccessToken();
}
