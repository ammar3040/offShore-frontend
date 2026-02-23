import { env } from '../config/env';
import type { Flight, Fare, SearchPayload } from '../types/flight';

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
 * POST /api/flight-ticket/book – submit booking for a flight (and optional selected fare).
 * Returns { message?, bookingReference? }. On error throws with message.
 */
export async function bookFlight(params: {
  flight: Flight;
  selectedFare?: Fare | null;
}): Promise<{ message?: string; bookingReference?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${API_BASE}/api/flight-ticket/book`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ flight: params.flight, selectedFare: params.selectedFare ?? undefined }),
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
