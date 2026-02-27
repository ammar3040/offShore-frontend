import { env } from '../config/env';

export interface SuperadminLoginPayload {
  email: string;
  password: string;
}

export interface SuperadminAuthResponse {
  token?: string;
  accessToken?: string;
  access_token?: string;
  message?: string;
}

export interface AdminAnalytics {
  totalAdmins: number;
  activeAdmins: number;
  totalProjects: number;
  totalCrew: number;
  totalTickets: number;
  adminsByActivity?: { adminId: string; email: string; projectsCount: number; crewCount: number }[];
}

export interface AdminApi {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  createdAt?: string;
  projectsCount?: number;
  crewCount?: number;
}

export interface CreateAdminPayload {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phone: string;
}

function getStoredTokenKey(): string {
  return env.superadminTokenKey;
}

function getAuthResponseToken(data: SuperadminAuthResponse): string | null {
  return data.token ?? data.accessToken ?? data.access_token ?? null;
}

function getHeaders(): HeadersInit {
  const token = localStorage.getItem(getStoredTokenKey());
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
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

/** Superadmin login - POST /api/superadmin/login */
export async function superadminLogin(payload: SuperadminLoginPayload): Promise<SuperadminAuthResponse> {
  const body = { email: payload.email.trim(), password: payload.password };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/superadmin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: SuperadminAuthResponse & { message?: string; error?: string; detail?: string | string[]; msg?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data as Record<string, unknown>, `Request failed (${response.status})`));
  }

  const token = getAuthResponseToken(data);
  if (token) localStorage.setItem(getStoredTokenKey(), token);

  return data;
}

/** Dashboard analytics - GET /api/superadmin/analytics */
export async function getSuperadminAnalytics(): Promise<AdminAnalytics> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/superadmin/analytics`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  return response.json();
}

/** List admins - GET /api/superadmin/admins */
export async function getSuperadminAdmins(): Promise<{ admins: AdminApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/superadmin/admins`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return { admins: Array.isArray(data?.admins) ? data.admins : [] };
}

/** Create admin - POST /api/superadmin/admins */
export async function createSuperadminAdmin(payload: CreateAdminPayload): Promise<AdminApi> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/superadmin/admins`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      firstname: payload.firstname.trim(),
      lastname: payload.lastname.trim(),
      email: payload.email.trim(),
      password: payload.password,
      phone: payload.phone.trim(),
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  return response.json();
}

/** Crew tickets for superadmin - GET /api/crew-ticket (uses superadmin token; project filter applied client-side if backend omits it) */
export async function getSuperadminCrewTickets(projectId?: string): Promise<{ crewTickets: import('./ticket').CrewTicketApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const url = new URL(`${env.apiBaseUrl}/api/crew-ticket`);
  if (projectId) url.searchParams.set('project_id', projectId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return { crewTickets: Array.isArray(data?.crewTickets) ? data.crewTickets : [] };
}

/** Projects for superadmin - GET /api/project (uses superadmin token) */
export async function getSuperadminProjects(): Promise<{ projects: import('./project').ProjectApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/project`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return { projects: Array.isArray(data?.projects) ? data.projects : [] };
}
