import { env } from '../config/env';

export interface AirportLocation {
  Name: string;
  COUNTRY: string;
  COUNTRYNAME: string;
}

export interface CrewTicketCrewRef {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  [key: string]: unknown;
}

export interface CrewTicketProjectRef {
  _id: string;
  title: string;
  description?: string;
  status: string;
  [key: string]: unknown;
}

export interface CrewTicketRigRef {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface CrewTicketApi {
  id: string;
  crew_id: CrewTicketCrewRef;
  project_id: CrewTicketProjectRef;
  rig_id?: CrewTicketRigRef | string | null;
  from: AirportLocation;
  to: AirportLocation;
  class: string;
  adult: number;
  children: number;
  infants: number;
  trip: string;
  /** Price in GBP (backend converts from original currency) */
  price?: number;
  /** Cashback in GBP */
  cashback?: number;
  /** URL to uploaded ticket PDF when present */
  pdf?: string;
  createdAt?: string;
}

/** Raw API row may use snake_case timestamps. */
export type CrewTicketApiRaw = CrewTicketApi & { created_at?: string };

function createdAtIsoFromMongoObjectId(id: string): string | undefined {
  if (!/^[a-f0-9]{24}$/i.test(id)) return undefined;
  const sec = Number.parseInt(id.slice(0, 8), 16);
  if (!Number.isFinite(sec) || sec <= 0) return undefined;
  return new Date(sec * 1000).toISOString();
}

/** Creation timestamp string from API (`createdAt` or `created_at`). */
export function getCrewTicketCreatedIso(t: CrewTicketApi): string | undefined {
  const raw = t as CrewTicketApiRaw;
  const camel = typeof t.createdAt === 'string' ? t.createdAt.trim() : '';
  if (camel) return camel;
  const snake = typeof raw.created_at === 'string' ? raw.created_at.trim() : '';
  return snake || undefined;
}

/**
 * Parses ticket creation time for UI bucketing. Date-only `YYYY-MM-DD` uses the
 * viewer's local calendar (avoids UTC midnight shifting the local day/month).
 */
export function parseCrewTicketCreatedAt(t: CrewTicketApi): Date | null {
  let iso = getCrewTicketCreatedIso(t);
  if (!iso) {
    const fromId = createdAtIsoFromMongoObjectId(t.id);
    if (!fromId) return null;
    iso = fromId;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isCrewTicketCreatedInLocalCalendarMonth(t: CrewTicketApi, now = new Date()): boolean {
  const d = parseCrewTicketCreatedAt(t);
  if (!d) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function normalizeCrewTicket(row: CrewTicketApiRaw): CrewTicketApi {
  const iso = getCrewTicketCreatedIso(row) ?? createdAtIsoFromMongoObjectId(row.id);
  if (!iso) return row;
  if (row.createdAt?.trim() === iso) return row;
  return { ...row, createdAt: iso };
}

export interface GetCrewTicketsResponse {
  crewTickets: CrewTicketApi[];
}

export interface CreateFlightTicketPayload {
  crew_id: string;
  project_id: string;
  rig_id?: string;
  from: AirportLocation;
  to: AirportLocation;
  class: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  adult: number;
  children: number;
  infants: number;
  trip: 'ONE_WAY' | 'ROUND_TRIP';
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetches crew tickets for a specific crew member (requires crew token).
 * GET /crew-ticket/crew/:crew_id
 */
export async function getCrewTicketsByCrewId(crewId: string): Promise<GetCrewTicketsResponse> {
  const crewToken = localStorage.getItem(env.crewTokenKey);
  if (!crewToken) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/crew/${encodeURIComponent(crewId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${crewToken}`,
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  const data = await response.json();
  const raw = Array.isArray(data?.crewTickets) ? data.crewTickets : [];
  const crewTickets = raw.map((t: CrewTicketApiRaw) => normalizeCrewTicket(t));
  return { crewTickets };
}

/**
 * Fetches all crew tickets. GET /crew-ticket (admin)
 */
export async function getCrewTickets(): Promise<GetCrewTicketsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  const data = await response.json();
  const raw = Array.isArray(data?.crewTickets) ? data.crewTickets : [];
  const crewTickets = raw.map((t: CrewTicketApiRaw) => normalizeCrewTicket(t));
  return { crewTickets };
}

/**
 * Creates a flight ticket for a crew member. POST /crew-ticket
 */
export async function createFlightTicket(payload: CreateFlightTicketPayload): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Cancels a crew ticket (accrues cancellation debt where configured, same as DELETE).
 * POST /crew-ticket/:id/cancel (admin auth)
 */
export async function cancelCrewTicket(ticketId: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/cancel`, {
    method: 'POST',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
}

/**
 * Uploads a PDF for a crew ticket. POST /crew-ticket/:id/upload-ticket
 * Uses admin token. For crew token use uploadCrewTicketPdfByCrew.
 */
export async function uploadCrewTicketPdf(ticketId: string, file: File): Promise<unknown> {
  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are allowed');
  }

  const formData = new FormData();
  formData.append('pdf', file);

  const token = getAuthToken();
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
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Uploads a PDF for a crew ticket (crew context). POST /crew-ticket/:id/upload-ticket
 * Uses crew token – crew can upload for their own tickets.
 */
export async function uploadCrewTicketPdfByCrew(ticketId: string, file: File): Promise<unknown> {
  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are allowed');
  }

  const crewToken = localStorage.getItem(env.crewTokenKey);
  if (!crewToken) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('pdf', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/upload-ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${crewToken}` },
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
}
