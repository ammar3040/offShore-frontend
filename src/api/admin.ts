import { env } from '../config/env';

export interface AdminRegisterPayload {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phone: string;
}

export interface AdminLoginPayload {
  email: string;
  password: string;
}

/** Common auth response shape (backend may use token, accessToken, or access_token) */
export interface AdminAuthResponse {
  token?: string;
  accessToken?: string;
  access_token?: string;
  message?: string;
}

function getStoredTokenKey(): string {
  return env.authTokenKey;
}

function getAuthResponseToken(data: AdminAuthResponse): string | null {
  return data.token ?? data.accessToken ?? data.access_token ?? null;
}

export async function adminRegister(payload: AdminRegisterPayload): Promise<AdminAuthResponse> {
  const body = {
    firstname: payload.firstname.trim(),
    lastname: payload.lastname.trim(),
    email: payload.email.trim(),
    password: payload.password,
    phone: payload.phone.trim(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/admin/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: AdminAuthResponse & { message?: string; error?: string; detail?: string | string[]; msg?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const message = getErrorMessage(data as Record<string, unknown>, `Request failed (${response.status})`);
    throw new Error(message);
  }

  const token = getAuthResponseToken(data);
  if (token) {
    localStorage.setItem(getStoredTokenKey(), token);
  }

  return data;
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

export async function adminLogin(payload: AdminLoginPayload): Promise<AdminAuthResponse> {
  const body = {
    email: payload.email.trim(),
    password: payload.password,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: AdminAuthResponse & { message?: string; error?: string; detail?: string | string[]; msg?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const message = getErrorMessage(data as Record<string, unknown>, `Request failed (${response.status})`);
    throw new Error(message);
  }

  const token = getAuthResponseToken(data);
  if (token) {
    localStorage.setItem(getStoredTokenKey(), token);
  }

  return data;
}
