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
  city?: string;
  country?: string;
  organization?: string;
  address?: string;
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

export type CrewTicketStatus = 'UNAPPROVED' | 'APPROVED';

export interface CrewTicketFlightItinerarySegment {
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  from?: string;
  to?: string;
  fromAirport?: string;
  toAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  cabin?: string;
  aircraft?: string;
  baggage?: string;
  cabinBaggage?: string;
  layover?: { location?: string; duration?: string } | null;
}

export interface CrewTicketFlightLeg {
  from?: string;
  to?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  airlineName?: string;
  airlineCode?: string;
  itinerary?: CrewTicketFlightItinerarySegment[];
}

export interface CrewTicketFlightSnapshot {
  airlineName?: string;
  airlineCode?: string;
  currency?: string;
  legs?: CrewTicketFlightLeg[];
  fares?: Array<{ totalFare?: number; cabin?: string; name?: string }>;
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
  /** Approval flow status. Missing legacy values should be treated as UNAPPROVED. */
  status?: CrewTicketStatus | string;
  /** Reference supplied by superadmin during approval. */
  bookingReference?: string;
  /** Approval timestamp from backend. */
  approvedAt?: string;
  /** Superadmin identifier/email when returned by backend. */
  approvedBy?: string;
  /** True when a PDF is stored server-side (fetch via GET /crew-ticket/:id/pdf). */
  hasPdf?: boolean;
  /** Relative API path for authenticated PDF download. */
  pdfDownloadUrl?: string;
  /** @deprecated Legacy Cloudinary URL — no longer returned by API; do not open directly. */
  pdf?: string;
  /** Flight details captured at booking time — used for PDF rendering. */
  flightSnapshot?: CrewTicketFlightSnapshot;
  createdAt?: string;
}

/** Raw API row may use snake_case timestamps or legacy pdf fields. */
export type CrewTicketApiRaw = CrewTicketApi & {
  created_at?: string;
  has_pdf?: boolean;
  pdf_download_url?: string;
};

export type CrewTicketPdfAuthRole = 'admin' | 'crew' | 'superadmin';

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

export function getTicketStatus(ticket: Pick<CrewTicketApi, 'status'>): CrewTicketStatus {
  return ticket.status === 'APPROVED' ? 'APPROVED' : 'UNAPPROVED';
}

export function getTicketStatusLabel(ticket: Pick<CrewTicketApi, 'status'>): string {
  return getTicketStatus(ticket) === 'APPROVED' ? 'Approved' : 'Pending Approval';
}

export function ticketHasStoredPdf(ticket: Pick<CrewTicketApi, 'hasPdf' | 'pdf'>): boolean {
  if (typeof ticket.hasPdf === 'boolean') return ticket.hasPdf;
  return Boolean(ticket.pdf);
}

export function canUseTicketPdf(
  ticket: Pick<CrewTicketApi, 'status' | 'hasPdf' | 'pdf' | 'bookingReference'>
): boolean {
  return getTicketStatus(ticket) === 'APPROVED';
}

export function getCrewTicketPdfFilename(
  ticket: Pick<CrewTicketApi, 'id' | 'bookingReference'>
): string {
  return `crew-ticket-${ticket.bookingReference ?? ticket.id}.pdf`;
}

function hasParseableFlightDateTime(value: string): boolean {
  if (!value?.trim()) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function formatTicketDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

function formatTicketTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

/** First segment departure from the booked flight snapshot. */
export function getTicketDepartureIso(ticket: CrewTicketApi): string {
  for (const leg of ticket.flightSnapshot?.legs ?? []) {
    const fromSegment = leg.itinerary?.[0]?.departureTime?.trim();
    if (fromSegment) return fromSegment;
    const fromLeg = leg.departureTime?.trim();
    if (fromLeg) return fromLeg;
  }
  return '';
}

/** Last segment arrival from the booked flight snapshot. */
export function getTicketArrivalIso(ticket: CrewTicketApi): string {
  const legs = ticket.flightSnapshot?.legs ?? [];
  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i]!;
    const itinerary = leg.itinerary ?? [];
    if (itinerary.length > 0) {
      const fromSegment = itinerary[itinerary.length - 1]?.arrivalTime?.trim();
      if (fromSegment) return fromSegment;
    }
    const fromLeg = leg.arrivalTime?.trim();
    if (fromLeg) return fromLeg;
  }
  return '';
}

/** Human-readable departure/arrival label for ticket lists. */
export function formatTicketSchedule(iso: string): string {
  if (!iso?.trim()) return '—';
  if (hasParseableFlightDateTime(iso)) return `${formatTicketDate(iso)}, ${formatTicketTime(iso)}`;
  return iso.trim();
}

export function normalizeCrewTicket(row: CrewTicketApiRaw): CrewTicketApi {
  const raw = row as CrewTicketApiRaw & { _id?: string; booking_reference?: string };
  const id = String(row.id ?? raw._id ?? '').trim();
  const bookingReference =
    typeof row.bookingReference === 'string'
      ? row.bookingReference
      : typeof raw.booking_reference === 'string'
        ? raw.booking_reference
        : undefined;
  const iso = getCrewTicketCreatedIso(row) ?? (id ? createdAtIsoFromMongoObjectId(id) : undefined);
  const normalizedStatus = getTicketStatus(row);
  const hasPdf =
    typeof row.hasPdf === 'boolean'
      ? row.hasPdf
      : typeof row.has_pdf === 'boolean'
        ? row.has_pdf
        : Boolean(row.pdf);
  const pdfDownloadUrl =
    typeof row.pdfDownloadUrl === 'string'
      ? row.pdfDownloadUrl
      : typeof row.pdf_download_url === 'string'
        ? row.pdf_download_url
        : id
          ? `/crew-ticket/${id}/pdf`
          : undefined;

  const { pdf: _legacyPdf, has_pdf: _hasPdf, pdf_download_url: _pdfDownloadUrl, ...rest } = row;
  const base =
    row.status === normalizedStatus
      ? rest
      : { ...rest, status: normalizedStatus };

  const normalized: CrewTicketApi = {
    ...base,
    id,
    bookingReference,
    hasPdf,
    pdfDownloadUrl,
  };

  if (!iso) return normalized;
  if (normalized.createdAt?.trim() === iso) return normalized;
  return { ...normalized, createdAt: iso };
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

function getCrewTicketPdfAuthHeaders(role?: CrewTicketPdfAuthRole): HeadersInit {
  const pick = (key: string) => localStorage.getItem(key);

  if (role === 'crew') {
    const token = pick(env.crewTokenKey);
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  }
  if (role === 'superadmin') {
    const token = pick(env.superadminTokenKey);
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  }
  if (role === 'admin') {
    const token = pick(env.authTokenKey);
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  }

  const token = pick(env.superadminTokenKey) ?? pick(env.authTokenKey) ?? pick(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

/** Fetch ticket PDF via authenticated backend stream (private Cloudinary assets). */
export async function fetchCrewTicketPdfBlob(
  ticketId: string,
  role?: CrewTicketPdfAuthRole
): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}/pdf`,
    {
      method: 'GET',
      headers: getCrewTicketPdfAuthHeaders(role),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text) as Record<string, unknown>;
        message =
          (typeof errorData.message === 'string' && errorData.message) ||
          (typeof errorData.error === 'string' && errorData.error) ||
          message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.blob();
}

function triggerBlobDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function scheduleRevokeObjectUrl(url: string): void {
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function previewCrewTicketPdf(
  ticket: Pick<CrewTicketApi, 'id' | 'bookingReference'>,
  role?: CrewTicketPdfAuthRole,
  previewWindow?: Window | null
): Promise<void> {
  const blob = await fetchCrewTicketPdfBlob(ticket.id, role);
  const url = URL.createObjectURL(blob);
  scheduleRevokeObjectUrl(url);

  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.replace(url);
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    triggerBlobDownload(url, getCrewTicketPdfFilename(ticket));
  }
}

export async function openCrewTicketPdf(
  ticket: Pick<CrewTicketApi, 'id' | 'bookingReference'>,
  role?: CrewTicketPdfAuthRole
): Promise<void> {
  await previewCrewTicketPdf(ticket, role);
}

export async function downloadCrewTicketPdf(
  ticket: Pick<CrewTicketApi, 'id' | 'bookingReference'>,
  role?: CrewTicketPdfAuthRole
): Promise<void> {
  const blob = await fetchCrewTicketPdfBlob(ticket.id, role);
  const url = URL.createObjectURL(blob);
  triggerBlobDownload(url, getCrewTicketPdfFilename(ticket));
  scheduleRevokeObjectUrl(url);
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
 * Fetches a single crew ticket by id. GET /crew-ticket/:id
 */
export async function getCrewTicketById(
  ticketId: string,
  role?: CrewTicketPdfAuthRole
): Promise<{ crewTicket: CrewTicketApi }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/crew-ticket/${encodeURIComponent(ticketId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getCrewTicketPdfAuthHeaders(role),
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
  const raw = (data?.crewTicket ?? data?.ticket ?? data) as CrewTicketApiRaw;
  return { crewTicket: normalizeCrewTicket(raw) };
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
