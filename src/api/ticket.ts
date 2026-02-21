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
 * Fetches all crew tickets. GET /api/crew-ticket
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
