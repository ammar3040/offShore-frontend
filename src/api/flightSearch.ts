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

/**
 * POST /api/crew-ticket/search-flights – search flights with given criteria.
 * Returns paginated result: { flights, total, page?, limit? }. On error throws with message.
 *
 * Optional time-based filters (backend applies to first leg):
 * - departureTime: HH:mm – minimum departure time
 * - arrivalDate: YYYY-MM-DD – arrival date at destination
 * - arrivalTime: HH:mm – maximum arrival time at destination
 */
export async function searchFlights(payload: SearchPayload): Promise<SearchFlightsResult> {
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

  // Paginated envelope: { flights: Flight[], pagination: { total, page, limit } } or { flights, total, page?, limit? }
  if (Array.isArray(data)) {
    return { flights: data, total: data.length };
  }
  const flights = Array.isArray(data?.flights) ? data.flights : [];
  const pagination = data?.pagination;
  const total =
    typeof pagination?.total === 'number'
      ? pagination.total
      : typeof data?.total === 'number'
        ? data.total
        : flights.length;
  const page = typeof pagination?.page === 'number' ? pagination.page : data?.page;
  const limit = typeof pagination?.limit === 'number' ? pagination.limit : data?.limit;

  return { flights, total, page, limit };
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
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

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

  return data as { message?: string; bookingReference?: string; tickets?: unknown[]; emailSent?: boolean; [key: string]: unknown };
}
