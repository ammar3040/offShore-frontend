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

export interface CrewTicketApi {
  id: string;
  crew_id: CrewTicketCrewRef;
  project_id: CrewTicketProjectRef;
  from: AirportLocation;
  to: AirportLocation;
  class: string;
  adult: number;
  children: number;
  infants: number;
  trip: string;
  /** URL to uploaded ticket PDF when present */
  pdf?: string;
}

export interface GetCrewTicketsResponse {
  crewTickets: CrewTicketApi[];
}

export interface CreateFlightTicketPayload {
  crew_id: string;
  project_id: string;
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
 * GET /api/crew-ticket/crew/:crew_id
 */
export async function getCrewTicketsByCrewId(crewId: string): Promise<GetCrewTicketsResponse> {
  const crewToken = localStorage.getItem(env.crewTokenKey);
  if (!crewToken) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-ticket/crew/${encodeURIComponent(crewId)}`, {
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
  const crewTickets = Array.isArray(data?.crewTickets) ? data.crewTickets : [];
  return { crewTickets };
}

/**
 * Fetches all crew tickets. GET /api/crew-ticket (admin)
 */
export async function getCrewTickets(): Promise<GetCrewTicketsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-ticket`, {
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
  const crewTickets = Array.isArray(data?.crewTickets) ? data.crewTickets : [];
  return { crewTickets };
}

/**
 * Creates a flight ticket for a crew member. POST /api/crew-ticket
 */
export async function createFlightTicket(payload: CreateFlightTicketPayload): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-ticket`, {
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
 * Uploads a PDF for a crew ticket. POST /api/crew-ticket/:id/upload-ticket
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

  const response = await fetch(`${env.apiBaseUrl}/api/crew-ticket/${encodeURIComponent(ticketId)}/upload-ticket`, {
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
 * Uploads a PDF for a crew ticket (crew context). POST /api/crew-ticket/:id/upload-ticket
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

  const response = await fetch(`${env.apiBaseUrl}/api/crew-ticket/${encodeURIComponent(ticketId)}/upload-ticket`, {
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
