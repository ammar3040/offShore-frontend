import type { Flight, FlightDirection, ItinerarySegment, Journey } from '../types/flight';

export function isRoundTripFlight(
  flight: Flight,
): flight is Flight & { tripType: 'round-trip'; outbound: FlightDirection; inbound: FlightDirection } {
  return flight.tripType === 'round-trip' && !!flight.outbound && !!flight.inbound;
}

function isItinerarySegment(value: unknown): value is ItinerarySegment {
  return (
    typeof value === 'object' &&
    value != null &&
    'flightNumber' in value &&
    typeof (value as ItinerarySegment).flightNumber === 'string'
  );
}

/** Resolve segment list for a direction, preferring booking leg itinerary when available. */
export function getDirectionItinerary(
  direction?: FlightDirection,
  journeyLeg?: Journey,
): ItinerarySegment[] {
  if (journeyLeg?.itinerary?.length) return journeyLeg.itinerary;

  const dirLegs = direction?.legs;
  if (!dirLegs?.length) return [];

  if (isItinerarySegment(dirLegs[0])) return dirLegs as ItinerarySegment[];
  return (dirLegs as Journey[]).flatMap((leg) => leg.itinerary ?? []);
}

/** Format elapsed time between two ISO timestamps as e.g. "07h 25m". */
export function formatFlightDurationFromTimes(
  departureTime?: string,
  arrivalTime?: string,
): string | undefined {
  if (!departureTime?.trim() || !arrivalTime?.trim()) return undefined;
  const dep = new Date(departureTime);
  const arr = new Date(arrivalTime);
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return undefined;
  const diffMs = arr.getTime() - dep.getTime();
  if (diffMs <= 0) return undefined;
  const totalMinutes = Math.round(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

export interface FlightDirectionDisplay {
  fromAirport: string;
  toAirport: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  via: string | null;
  airlineName: string;
  airlineCode: string;
}

export function getDirectionDisplay(
  direction: FlightDirection,
  journeyLeg?: Journey,
): FlightDirectionDisplay {
  const segments = getDirectionItinerary(direction, journeyLeg);
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  return {
    fromAirport: firstSeg?.fromAirport ?? firstSeg?.from ?? direction.from,
    toAirport: lastSeg?.toAirport ?? lastSeg?.to ?? direction.to,
    departureTime: direction.departureTime,
    arrivalTime: direction.arrivalTime,
    duration: direction.duration,
    stops: direction.stops,
    via: journeyLeg?.via ?? direction.via ?? null,
    airlineName: direction.airlineName,
    airlineCode: direction.airlineCode,
  };
}

/** One-way display derived from the first/last booking legs. */
export function getOneWayDisplay(flight: Flight): FlightDirectionDisplay {
  const firstLeg = flight.legs?.[0];
  const lastLeg = flight.legs?.[flight.legs.length - 1];
  const firstSeg = firstLeg?.itinerary?.[0];
  const lastSeg = lastLeg?.itinerary?.[lastLeg.itinerary.length - 1];

  return {
    fromAirport: firstSeg?.fromAirport ?? firstSeg?.from ?? firstLeg?.from ?? '—',
    toAirport: lastSeg?.toAirport ?? lastSeg?.to ?? lastLeg?.to ?? '—',
    departureTime: flight.departureTime ?? firstLeg?.departureTime ?? '',
    arrivalTime: flight.arrivalTime ?? lastLeg?.arrivalTime ?? '',
    duration: firstLeg?.duration ?? '—',
    stops: firstLeg?.stops ?? 0,
    via: firstLeg?.via ?? null,
    airlineName: firstLeg?.airlineName ?? '—',
    airlineCode: firstLeg?.airlineCode ?? '',
  };
}

export function isFlightNonStop(flight: Flight): boolean {
  if (isRoundTripFlight(flight)) {
    return flight.outbound.stops === 0 && flight.inbound.stops === 0;
  }
  const firstLeg = flight.legs?.[0];
  const stops = firstLeg?.stops ?? 0;
  return stops === 0;
}

export type FlightSegmentGroup = {
  label: string;
  segments: ItinerarySegment[];
};

export function getFlightSegmentGroups(flight: Flight): FlightSegmentGroup[] {
  if (isRoundTripFlight(flight)) {
    return [
      {
        label: 'Outbound',
        segments: getDirectionItinerary(flight.outbound, flight.legs?.[0]),
      },
      {
        label: 'Return',
        segments: getDirectionItinerary(flight.inbound, flight.legs?.[1]),
      },
    ].filter((group) => group.segments.length > 0);
  }

  const segments = flight.legs?.flatMap((leg) => leg.itinerary ?? []) ?? [];
  return segments.length > 0 ? [{ label: '', segments }] : [];
}
