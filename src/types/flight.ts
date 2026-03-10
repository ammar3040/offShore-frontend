/**
 * Flight search and book types (aligned with migration plan API contracts).
 */

export interface Airport {
  Name: string;
  COUNTRY: string;
  COUNTRYNAME: string;
}

export interface Fare {
  type: string;
  name: string;
  totalFare: number;
  basicFare: number;
  seats: string;
  cabin: string;
  indicator?: 'M' | 'SM' | 'F' | 'N';
}

export interface ItinerarySegment {
  airlineName: string;
  airlineCode: string;
  flightNumber: string;
  from: string;
  fromAirport: string;
  fromTerminal: string;
  to: string;
  toAirport: string;
  toTerminal: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabin: string;
  baggage: string;
  cabinBaggage: string;
  layover: { location: string; duration: string } | null;
}

export interface Journey {
  airlineName: string;
  airlineCode: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  via: string | null;
  itinerary: ItinerarySegment[];
}

export interface Flight {
  id: string;
  legs: Journey[];
  fares: Fare[];
  cashback?: number | null;
  markup?: number | null;
}

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type CurrencyCode = 'USD' | 'GBP' | 'INR';

export interface SearchPayload {
  tripType: 'one-way' | 'round-trip' | 'split-tickets';
  from: Airport | null;
  to: Airport | null;
  departureDate: string;
  returnDate?: string;
  connectingDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: CabinClass;
  currency: CurrencyCode;
  stops?: string[];
  preferredAirlines?: string[];
  fareTypes?: string[];
  sectorFare?: boolean;
  region?: { id: string; name: string; transitPoints: unknown[] } | null;
  transitPoints?: { code: string; name: string; airport: string }[];
  /** Optional: project and crew context (admin portal) */
  project_id?: string;
  crew_ids?: string[];
  /** Pagination (backend returns paginated results) */
  page?: number;
  limit?: number;
  /** Optional time-based filters (backend filters first leg) */
  /** Minimum departure time, HH:mm (e.g. "08:00") */
  departureTime?: string;
  /** Arrival date at destination, YYYY-MM-DD (e.g. "2025-03-15") */
  arrivalDate?: string;
  /** Maximum arrival time at destination, HH:mm (e.g. "18:00") */
  arrivalTime?: string;
}

/** Result of searchFlights when API returns paginated response */
export interface SearchFlightsResult {
  flights: Flight[];
  total: number;
  page?: number;
  limit?: number;
}
