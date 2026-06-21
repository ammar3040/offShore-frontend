/**
 * Flight search and book types (aligned with migration plan API contracts).
 */

export interface Airport {
  Name: string;
  COUNTRY: string;
  COUNTRYNAME: string;
  Code?: string;
  CityName?: string;
  AirportName?: string;
  distanceKm?: number;
  nearbyAirports?: Airport[];
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

/** Summary for one direction of a round-trip search result. */
export interface FlightDirection {
  departureTime: string;
  arrivalTime: string;
  from: string;
  to: string;
  duration: string;
  stops: number;
  /** Segment-level legs when provided by search API */
  legs?: ItinerarySegment[] | Journey[];
  airlineName: string;
  airlineCode: string;
  via?: string | null;
}

export type FlightTripType = 'one-way' | 'round-trip' | 'split-tickets';

export interface Flight {
  id: string;
  tripType?: FlightTripType;
  legs: Journey[];
  fares: Fare[];
  /** Outbound summary (round-trip search results) */
  outbound?: FlightDirection;
  /** Return summary (round-trip search results) */
  inbound?: FlightDirection;
  /** Full trip bounds: outbound departure through return arrival */
  departureTime?: string;
  arrivalTime?: string;
  cashback?: number | null;
  markup?: number | null;
}

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type CurrencyCode = 'USD' | 'GBP' | 'INR';
export type FlightSortBy = 'price' | 'duration' | 'stops' | 'departureTime' | 'arrivalTime';
export type FlightSortOrder = 'asc' | 'desc';

export type TimeFilterMode = 'before' | 'after';

export interface SearchPayload {
  tripType: 'one-way' | 'round-trip' | 'split-tickets';
  from: Airport | null;
  to: Airport | null;
  departureDate: string;
  returnDate?: string;
  /** Return-leg departure time for round-trip, HH:mm (e.g. "18:00") */
  returnTime?: string;
  /** When returnTime is set: after (default) or before that return departure time */
  returnTimeMode?: TimeFilterMode;
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
  /** Departure time filter, HH:mm (e.g. "08:00") */
  departureTime?: string;
  /** When departureTime is set: after (default) or before that departure time */
  departureTimeMode?: TimeFilterMode;
  /** Arrival date at destination, YYYY-MM-DD (e.g. "2025-03-15") */
  arrivalDate?: string;
  /** Arrival time filter, HH:mm (e.g. "18:00") */
  arrivalTime?: string;
  /** When arrivalTime is set: before (default) or after that arrival time */
  arrivalTimeMode?: TimeFilterMode;
  /** Backend sorting applied after filters and before pagination */
  sortBy?: FlightSortBy;
  sortOrder?: FlightSortOrder;
}

/** Result of searchFlights when API returns paginated response */
export interface SearchFlightsResult {
  flights: Flight[];
  total: number;
  page?: number;
  limit?: number;
}
