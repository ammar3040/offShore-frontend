import { env } from '../config/env';
import type { Flight, SearchPayload, SearchFlightsResult } from '../types/flight';

/** Full itinerary segment shape sent to POST /api/crew-ticket/book */
export interface BookItinerarySegment {
  airlineName?: string;
  airlineCode?: string;
  flightNumber?: string;
  from?: string;
  fromAirport?: string;
  fromTerminal?: string;
  to?: string;
  toAirport?: string;
  toTerminal?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  cabin?: string;
  baggage?: string;
  cabinBaggage?: string;
  layover?: { location: string; duration: string } | null;
}

/** Full leg shape sent to POST /api/crew-ticket/book */
export interface BookLeg {
  airlineName?: string;
  airlineCode?: string;
  from?: string;
  to?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
  via?: string | null;
  itinerary?: BookItinerarySegment[];
}

/** Full fare shape sent to POST /api/crew-ticket/book */
export interface BookFare {
  type?: string;
  name?: string;
  indicator?: string;
  totalFare?: number;
  basicFare?: number;
  seats?: string;
  cabin?: string;
}

/** Payload for POST /api/crew-ticket/book (matches backend bookFlightSchema) */
export interface BookFlightPayload {
  project_id: string;
  crew_ids: string[];
  flight: {
    id: string;
    legs: BookLeg[];
    fares?: BookFare[];
  };
  cashback?: number;
  price?: number;
  currency?: string;
  adult: number;
  children: number;
  infants: number;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Paginated envelope: { flights: Flight[], pagination: { total, page, limit } } or { flights, total, page?, limit? }
function parseSearchResult(data: unknown): SearchFlightsResult {
  if (Array.isArray(data)) {
    return { flights: data as Flight[], total: (data as Flight[]).length };
  }
  const d = data as Record<string, unknown>;
  const flights = Array.isArray(d?.flights) ? (d.flights as Flight[]) : [];
  const pagination = d?.pagination as Record<string, number> | undefined;
  const total =
    typeof pagination?.total === 'number'
      ? pagination.total
      : typeof d?.total === 'number'
        ? (d.total as number)
        : flights.length;
  const page = typeof pagination?.page === 'number' ? pagination.page : (typeof d?.page === 'number' ? (d.page as number) : undefined);
  const limit = typeof pagination?.limit === 'number' ? pagination.limit : (typeof d?.limit === 'number' ? (d.limit as number) : undefined);
  return { flights, total, page, limit };
}

async function pollSearchResult(jobId: string): Promise<SearchFlightsResult> {
  const POLL_INTERVAL_MS = 2000;
  const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const pollController = new AbortController();
    const pollTimeoutId = setTimeout(() => pollController.abort(), 10_000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/crew-ticket/search-flights/result/${jobId}`, {
        headers: getHeaders(),
        signal: pollController.signal,
      });
    } catch {
      clearTimeout(pollTimeoutId);
      continue; // transient network error — retry
    }
    clearTimeout(pollTimeoutId);

    if (res.status === 202) continue; // still pending

    if (!res.ok) {
      let message = `Search failed (${res.status})`;
      try {
        const err = await res.json();
        message = (err as { error?: string }).error || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return parseSearchResult(await res.json());
  }

  throw new Error('Flight search timed out waiting for results. Please try again.');
}

/**
 * POST /api/crew-ticket/search-flights – search flights with given criteria.
 * Returns paginated result: { flights, total, page?, limit? }. On error throws with message.
 *
 * Cache hit  → 200 with flights immediately.
 * Cache miss → 202 with { jobId } → polls GET /result/:jobId every 2s until 200.
 *
 * Optional time-based filters (backend applies to first leg):
 * - departureTime: HH:mm – minimum departure time
 * - arrivalDate: YYYY-MM-DD – arrival date at destination
 * - arrivalTime: HH:mm – maximum arrival time at destination
 */
export async function searchFlights(payload: SearchPayload): Promise<SearchFlightsResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    env.apiTimeout,
  );

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/crew-ticket/search-flights`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new Error(`Flight search timed out after ${env.apiTimeout / 1000}s. Please try again.`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  // Cache miss: backend is fetching from Riya API asynchronously
  if (response.status === 202) {
    const pending = await response.json();
    const jobId = (pending as { jobId?: string }).jobId;
    if (!jobId) throw new Error('Search is processing but no job ID was returned.');
    return pollSearchResult(jobId);
  }

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

  return parseSearchResult(await response.json());
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
  cashback?: number;
  price?: number;
  currency?: string;
  adult?: number;
  children?: number;
  infants?: number;
}): Promise<{
  message?: string;
  bookingReference?: string;
  tickets?: unknown[];
  emailSent?: boolean;
  [key: string]: unknown;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    env.apiTimeout,
  );

  const body: BookFlightPayload = {
    project_id: params.project_id,
    crew_ids: params.crew_ids,
    flight: {
      id: params.flight.id,
      legs: (params.flight.legs ?? []).map((leg) => ({
        airlineName: leg.airlineName,
        airlineCode: leg.airlineCode,
        from: leg.from,
        to: leg.to,
        departureTime: leg.departureTime,
        arrivalTime: leg.arrivalTime,
        duration: leg.duration,
        stops: leg.stops,
        via: leg.via,
        itinerary: leg.itinerary?.map((seg) => ({
          airlineName: seg.airlineName,
          airlineCode: seg.airlineCode,
          flightNumber: seg.flightNumber,
          from: seg.from,
          fromAirport: seg.fromAirport,
          fromTerminal: seg.fromTerminal,
          to: seg.to,
          toAirport: seg.toAirport,
          toTerminal: seg.toTerminal,
          departureTime: seg.departureTime,
          arrivalTime: seg.arrivalTime,
          duration: seg.duration,
          cabin: seg.cabin,
          baggage: seg.baggage,
          cabinBaggage: seg.cabinBaggage,
          layover: seg.layover,
        })),
      })),
      fares: params.flight.fares?.map((f) => ({
        type: f.type,
        name: f.name,
        indicator: f.indicator,
        totalFare: f.totalFare,
        basicFare: f.basicFare,
        seats: f.seats,
        cabin: f.cabin,
      })),
    },
    cashback: params.cashback ?? 0,
    price: params.price ?? 0,
    currency: params.currency ?? 'USD',
    adult: params.adult ?? 1,
    children: params.children ?? 0,
    infants: params.infants ?? 0,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/crew-ticket/book`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new Error(`Booking request timed out after ${env.apiTimeout / 1000}s. Please try again.`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error || `Booking failed (${response.status})`;
    throw new Error(message);
  }

  return data as { message?: string; bookingReference?: string; tickets?: unknown[]; emailSent?: boolean; [key: string]: unknown };
}
