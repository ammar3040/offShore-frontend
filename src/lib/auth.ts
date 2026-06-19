import { env } from '../config/env';

const STORAGE_KEY = env.authTokenKey;

function getIssuerFromJwt(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 'invalid';
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    return (payload.iss as string) || 'unknown';
  } catch {
    return 'parse-err';
  }
}

/** Backend JWTs lack iss; Firebase tokens have securetoken.google.com */
function isFirebaseToken(token: string): boolean {
  const iss = getIssuerFromJwt(token);
  return iss.includes('securetoken.google.com') || iss.includes('firebase') || iss.includes('google.com');
}

/** Returns exp (seconds since epoch) or null if missing/invalid */
function getJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    const exp = payload.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** Decode JWT payload and return email/name if present */
export function getAdminUserFromToken(): { email?: string; name?: string } | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    const email = payload.email ?? payload.sub;
    const name = payload.name ?? payload.firstname ?? (payload.email ? payload.email.split('@')[0] : undefined);
    return { email: typeof email === 'string' ? email : undefined, name: typeof name === 'string' ? name : undefined };
  } catch {
    return null;
  }
}

/** Returns true if token has exp in the past (or no exp claim). Works for any JWT. */
export function isTokenExpired(token: string): boolean {
  const exp = getJwtExp(token);
  if (exp == null) return false; // no exp = treat as valid, backend will decide
  return exp < Date.now() / 1000;
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEY);
  if (token && isFirebaseToken(token)) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  if (token && isTokenExpired(token)) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return token;
}

export function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAccessToken(): boolean {
  return !!getAccessToken();
}
