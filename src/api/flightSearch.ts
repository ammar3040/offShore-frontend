import { env } from '../config/env';
import type { Flight, SearchPayload } from '../types/flight';

/** Payload for POST /api/crew-ticket/book (matches backend bookFlightSchema) */
export interface BookFlightPayload {
  project_id: string;
  crew_ids: string[];
  flight: {
    id: string;
    legs: Array<{
      itinerary?: Array<{ fromAirport?: string; toAirport?: string }>;
    }>;
    fares?: Array<{ cabin?: string }>;
  };
  adult?: number;
  children?: number;
  infants?: number;
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
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const API_BASE = env.apiBaseUrl || '';

/**
 * POST /api/search – search flights with given criteria.
 * Returns array of Flight. On error throws with message.
 */
export async function searchFlights(payload: SearchPayload): Promise<Flight[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${API_BASE}/api/crew-ticket/search-flights`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    let message = `Search failed (${response.status})`;
    try {
      const err = await response.json();
      message = (err as { error?: string }).error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * POST /api/crew-ticket/book – submit booking for selected crew on a project.
 * Payload is extracted from search flight result to match backend bookFlightSchema.
 * Returns { message?, bookingReference? }. On error throws with message.
 */
export async function bookFlight(params: {
  project_id: string;
  crew_ids: string[];
  flight: Flight;
  adult?: number;
  children?: number;
  infants?: number;
}): Promise<{ message?: string; bookingReference?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const body: BookFlightPayload = {
    project_id: params.project_id,
    crew_ids: params.crew_ids,
    flight: {
      id: params.flight.id,
      legs: (params.flight.legs ?? []).map((leg) => ({
        itinerary: leg.itinerary?.map((seg) => ({
          fromAirport: seg.fromAirport,
          toAirport: seg.toAirport,
        })),
      })),
      fares: params.flight.fares?.map((f) => ({ cabin: f.cabin })),
    },
    adult: params.adult ?? 1,
    children: params.children ?? 0,
    infants: params.infants ?? 0,
  };

  const response = await fetch(`${API_BASE}/api/crew-ticket/book`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error || `Booking failed (${response.status})`;
    throw new Error(message);
  }

  return data as { message?: string; bookingReference?: string };
}
