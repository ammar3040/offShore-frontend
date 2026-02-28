import { env } from '../config/env';
import { setCrewPanelUser } from '../lib/crewPanelAuth';

export interface AuthLoginPayload {
  email: string;
  password: string;
}

type Role = 'admin' | 'crew' | 'superadmin';

/** Centralized auth login response - backend determines role from credentials */
export interface AuthLoginResponse {
  token?: string;
  accessToken?: string;
  access_token?: string;
  user?: {
    role?: Role;
    email?: string;
    [key: string]: unknown;
  };
  role?: Role;
  [key: string]: unknown;
}

function getToken(data: AuthLoginResponse): string | null {
  return data.token ?? data.accessToken ?? data.access_token ?? null;
}

function getRole(data: AuthLoginResponse): Role | null {
  const role = data.user?.role ?? data.role;
  if (role === 'admin' || role === 'crew' || role === 'superadmin') {
    return role;
  }
  return null;
}

function getErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const msg =
    typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : typeof data?.detail === 'string'
          ? data.detail
          : Array.isArray(data?.detail)
            ? (data.detail as string[]).join('. ')
            : typeof data?.msg === 'string'
              ? data.msg
              : null;
  return msg ?? fallback;
}

/**
 * Centralized login - POST /api/auth/login
 * Sends email and password; backend returns token and user role.
 * Stores token in the appropriate key based on role and returns redirect path.
 */
export async function authLogin(payload: AuthLoginPayload): Promise<{ redirectTo: string }> {
  const body = {
    email: payload.email.trim(),
    password: payload.password,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: AuthLoginResponse & { message?: string; error?: string; detail?: string | string[]; msg?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data as Record<string, unknown>, `Login failed (${response.status})`));
  }

  const token = getToken(data);
  const role = getRole(data);

  if (!token) {
    throw new Error('Invalid response: missing access token');
  }

  const email = data.user?.email ?? payload.email.trim();

  switch (role) {
    case 'admin':
      localStorage.setItem(env.authTokenKey, token);
      return { redirectTo: '/' };
    case 'crew':
      localStorage.setItem(env.crewTokenKey, token);
      setCrewPanelUser({ email });
      return { redirectTo: '/panel/crew/dashboard' };
    case 'superadmin':
      localStorage.setItem(env.superadminTokenKey, token);
      return { redirectTo: '/panel/superadmin/dashboard' };
    default:
      // Fallback: treat as admin if role not specified
      localStorage.setItem(env.authTokenKey, token);
      return { redirectTo: '/' };
  }
}
