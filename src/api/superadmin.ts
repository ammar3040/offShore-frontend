import { env } from '../config/env';
import type { CrewMemberApi } from './crew';
import { normalizeCrewTicket, type CrewTicketApi } from './ticket';

function pickAdminString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeAdmin(raw: Record<string, unknown>): AdminApi {
  const id = String(raw.id ?? raw._id ?? '').trim();
  return {
    id,
    firstname: pickAdminString(raw, 'firstname', 'firstName', 'first_name') ?? '',
    lastname: pickAdminString(raw, 'lastname', 'lastName', 'last_name') ?? '',
    email: pickAdminString(raw, 'email') ?? '',
    phone: pickAdminString(raw, 'phone'),
    company: pickAdminString(raw, 'company', 'companyName', 'company_name', 'organization'),
    address: pickAdminString(raw, 'address'),
    city: pickAdminString(raw, 'city'),
    country: pickAdminString(raw, 'country'),
    createdAt: pickAdminString(raw, 'createdAt', 'created_at'),
    projectsCount: typeof raw.projectsCount === 'number' ? raw.projectsCount : undefined,
    crewCount: typeof raw.crewCount === 'number' ? raw.crewCount : undefined,
    cancellationOutstanding:
      typeof raw.cancellationOutstanding === 'number' ? raw.cancellationOutstanding : undefined,
    cancellationSlotsRemaining:
      typeof raw.cancellationSlotsRemaining === 'number' ? raw.cancellationSlotsRemaining : undefined,
  };
}

function normalizeCrewMember(raw: Record<string, unknown>): CrewMemberApi {
  const id = String(raw.id ?? raw._id ?? '').trim();
  return {
    id,
    firstname: pickAdminString(raw, 'firstname', 'firstName', 'first_name') ?? '',
    lastname: pickAdminString(raw, 'lastname', 'lastName', 'last_name') ?? '',
    dateOfBirth: pickAdminString(raw, 'dateOfBirth', 'date_of_birth') ?? '',
    nationality: pickAdminString(raw, 'nationality') ?? '',
    gender: pickAdminString(raw, 'gender') ?? '',
    email: pickAdminString(raw, 'email') ?? '',
    phone: pickAdminString(raw, 'phone') ?? '',
    alternate_phone: pickAdminString(raw, 'alternate_phone', 'alternatePhone') ?? '',
    address: pickAdminString(raw, 'address') ?? '',
    city: pickAdminString(raw, 'city') ?? '',
    country: pickAdminString(raw, 'country') ?? '',
    postal_code: pickAdminString(raw, 'postal_code', 'postalCode') ?? '',
    organization: pickAdminString(raw, 'organization'),
  };
}

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

export interface SuperadminAdminActivityRow {
  adminId: string;
  email: string;
  projectsCount: number;
  crewCount: number;
  cancellationOutstanding?: number | null;
  cancellationSlotsRemaining?: number | null;
}

export interface AdminAnalytics {
  totalAdmins: number;
  activeAdmins: number;
  totalProjects: number;
  totalCrew: number;
  totalTickets: number;
  adminsByActivity?: SuperadminAdminActivityRow[];
  markup?: number | null;
  markupPercentage?: number | null;
  cashback?: number | null;
  cancellationCharges?: number | null;
  baseCurrency?: 'GBP' | 'USD' | 'INR';
}

export interface AdminApi {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  createdAt?: string;
  projectsCount?: number;
  crewCount?: number;
  cancellationOutstanding?: number | null;
  cancellationSlotsRemaining?: number | null;
}

export interface ApproveCrewTicketResponse {
  message?: string;
  crewTicket: CrewTicketApi;
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

/** Superadmin login - POST /superadmin/login */
export async function superadminLogin(payload: SuperadminLoginPayload): Promise<SuperadminAuthResponse> {
  const body = { email: payload.email.trim(), password: payload.password };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/login`, {
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

/** Dashboard analytics - GET /superadmin/analytics */
export async function getSuperadminAnalytics(): Promise<AdminAnalytics> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/analytics`, {
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

/** List admins - GET /superadmin/admins */
export async function getSuperadminAdmins(): Promise<{ admins: AdminApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/admins`, {
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
  const admins = Array.isArray(data?.admins)
    ? (data.admins as Record<string, unknown>[]).map(normalizeAdmin)
    : [];
  return { admins };
}

/** Crew profile for invoice addressing - GET /crew/:crew_id */
export async function getSuperadminCrewById(crewId: string): Promise<CrewMemberApi | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew/${encodeURIComponent(crewId)}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) return null;

  const data = await response.json();
  const crewRaw = (data?.crew ?? data) as Record<string, unknown>;
  if (!crewRaw || typeof crewRaw !== 'object') return null;
  return normalizeCrewMember(crewRaw);
}

/** Create admin - POST /superadmin/admins */
export async function createSuperadminAdmin(payload: CreateAdminPayload): Promise<AdminApi> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/admins`, {
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

export interface MarkupResponse {
  message: string;
  superAdmin: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone?: string;
    markup: number;
    markupPercentage?: number | null;
    cashback?: number;
    cancellationCharges?: number;
    baseCurrency?: 'GBP' | 'USD' | 'INR';
  };
}

/** Update settings - PUT /superadmin/markup. Amounts aligned with markup/cashback storage (GBP in API). */
export async function updateSuperadminSettings(payload: {
  baseCurrency?: 'GBP' | 'USD' | 'INR';
  markup?: number | null;
  cashback?: number | null;
  cancellationCharges?: number | null;
}): Promise<{ message?: string; superAdmin?: MarkupResponse['superAdmin'] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const body: Record<string, unknown> = {};
  if (payload.baseCurrency != null) body.baseCurrency = payload.baseCurrency;
  if (payload.markup != null) body.markup = payload.markup;
  if (payload.cashback != null) body.cashback = payload.cashback;
  if (payload.cancellationCharges != null) body.cancellationCharges = payload.cancellationCharges;

  const response = await fetch(`${env.apiBaseUrl}/superadmin/markup`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
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

/** Update markup - PUT /superadmin/markup */
export async function updateSuperadminMarkup(markup: number): Promise<MarkupResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/markup`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ markup }),
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

/** Update markup percentage - PUT /superadmin/markup_percentage */
export async function updateSuperadminMarkupPercentage(
  markupPercentage: number | null
): Promise<{ message?: string; superAdmin?: MarkupResponse['superAdmin'] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/markup_percentage`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ markup_percentage: markupPercentage }),
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

/** Update cashback - PUT /superadmin/markup */
export async function updateSuperadminCashback(cashback: number): Promise<MarkupResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/markup`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ cashback }),
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

/** Send ticket email to crew - POST /crew-ticket/:id/send-ticket-email (no body) */
export async function sendSuperadminCrewTicketEmail(ticketId: string): Promise<unknown> {
  const token = localStorage.getItem(env.superadminTokenKey);
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/send-ticket-email`,
    {
      method: 'POST',
      headers,
      signal: controller.signal,
    }
  );
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

/** Approve a crew ticket. PATCH /crew-ticket/:id/approve (PDF is generated client-side via approveAndUploadTicketPdf) */
export async function approveCrewTicket(ticketId: string, bookingReference: string): Promise<ApproveCrewTicketResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/approve`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ bookingReference: bookingReference.trim() }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const fallbackByStatus: Record<number, string> = {
      400: 'Enter a booking reference.',
      403: 'Only superadmins can approve tickets.',
      409: 'This ticket has already been approved.',
      500: 'Could not approve the ticket. Please try again.',
    };
    throw new Error(getErrorMessage(data, fallbackByStatus[response.status] ?? `Request failed (${response.status})`));
  }

  const rawTicket = data.crewTicket ?? data.ticket ?? data;
  return {
    message: typeof data.message === 'string' ? data.message : undefined,
    crewTicket: normalizeCrewTicket(rawTicket as import('./ticket').CrewTicketApiRaw),
  };
}

/** Delete a crew ticket. DELETE /crew/:crew_id/ticket/:ticket_id (superadmin only) */
export async function deleteSuperadminCrewTicket(crewId: string, ticketId: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/crew/${encodeURIComponent(crewId)}/ticket/${encodeURIComponent(ticketId)}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
      signal: controller.signal,
    }
  );
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
}

/** Crew tickets for superadmin - GET /crew-ticket (uses superadmin token; project filter applied client-side if backend omits it) */
export async function getSuperadminCrewTickets(projectId?: string): Promise<{ crewTickets: CrewTicketApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  let url = `${env.apiBaseUrl}/crew-ticket`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
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
  const raw = Array.isArray(data?.crewTickets) ? data.crewTickets : [];
  return { crewTickets: raw.map((ticket: import('./ticket').CrewTicketApiRaw) => normalizeCrewTicket(ticket)) };
}

/** Projects for superadmin - GET /project (uses superadmin token) */
export async function getSuperadminProjects(): Promise<{ projects: import('./project').ProjectApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/project`, {
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

/** Uploads a PDF for a crew ticket. POST /crew-ticket/:id/upload-ticket */
export async function uploadSuperadminCrewTicketPdf(ticketId: string, file: File): Promise<unknown> {
  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are allowed');
  }

  const formData = new FormData();
  formData.append('pdf', file);

  const token = localStorage.getItem(env.superadminTokenKey);
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/upload-ticket`, {
    method: 'POST',
    headers,
    body: formData,
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
