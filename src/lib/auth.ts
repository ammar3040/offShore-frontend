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

/** Returns true if token has exp in the past (or no exp claim) */
function isTokenExpired(token: string): boolean {
  const exp = getJwtExp(token);
  if (exp == null) return false; // no exp = treat as valid, backend will decide
  return exp < Date.now() / 1000;
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEY);
  // #region agent log
  const exp = token ? getJwtExp(token) : null;
  const expired = token ? isTokenExpired(token) : false;
  fetch('http://127.0.0.1:7243/ingest/abba73b6-88d9-45e1-a3bb-58f7114b5f40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:getAccessToken',message:'Token read',data:{hasToken:!!token,tokenLen:token?.length??0,exp,expired,storageKey:STORAGE_KEY,issuer:token?getIssuerFromJwt(token):null,isFirebase:token?isFirebaseToken(token):false},hypothesisId:'H2',runId:'post-fix',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/abba73b6-88d9-45e1-a3bb-58f7114b5f40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:setAccessToken',message:'Token stored',data:{tokenLen:token.length,storageKey:STORAGE_KEY,issuer:getIssuerFromJwt(token)},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAccessToken(): boolean {
  return !!getAccessToken();
}
