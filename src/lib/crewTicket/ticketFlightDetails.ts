import type {
  CrewTicketApi,
  CrewTicketFlightItinerarySegment,
  CrewTicketFlightLeg,
} from '../../api/ticket';
import {
  formatFlightDate,
  formatFlightDateTime,
  formatFlightTime,
  resolveFlightDuration,
} from './flightDuration';

export type TicketSegmentDisplay = {
  airlineName: string;
  flightCode: string;
  from: string;
  to: string;
  fromAirport: string;
  toAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration: string;
  cabin?: string;
  baggage?: string;
  layover?: string;
};

type SegmentRow = {
  segment: CrewTicketFlightItinerarySegment;
  leg: CrewTicketFlightLeg;
  layoverAfter?: { location?: string; duration?: string } | null;
};

function extractIata(code?: string): string {
  if (!code?.trim()) return '—';
  const trimmed = code.trim();
  if (/^[A-Z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/\b([A-Z]{3})\b/i);
  return match ? match[1].toUpperCase() : trimmed.slice(0, 3).toUpperCase();
}

function getFlightCode(segment: CrewTicketFlightItinerarySegment): string {
  const code = segment.airlineCode?.trim().toUpperCase() ?? '';
  const number = segment.flightNumber?.trim() ?? '';
  if (code && number) return `${code} ${number}`;
  return code || number || '—';
}

function collectSegmentRows(ticket: CrewTicketApi): SegmentRow[] {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const rows: SegmentRow[] = [];

  legs.forEach((leg) => {
    const itinerary = leg.itinerary ?? [];
    if (itinerary.length > 0) {
      itinerary.forEach((segment, index) => {
        const layover = segment.layover;
        rows.push({
          segment,
          leg,
          layoverAfter: index < itinerary.length - 1 ? layover : undefined,
        });
      });
      return;
    }

    rows.push({
      segment: {
        airlineName: leg.airlineName,
        airlineCode: leg.airlineCode,
        from: leg.from,
        to: leg.to,
        fromAirport: leg.from,
        toAirport: leg.to,
        departureTime: leg.departureTime,
        arrivalTime: leg.arrivalTime,
        duration: leg.duration,
        cabin: ticket.class,
      },
      leg,
    });
  });

  return rows;
}

export function collectTicketSegmentDisplays(ticket: CrewTicketApi): TicketSegmentDisplay[] {
  return collectSegmentRows(ticket).map(({ segment, leg, layoverAfter }) => {
    const depRaw = segment.departureTime ?? leg.departureTime;
    const arrRaw = segment.arrivalTime ?? leg.arrivalTime;
    const layoverParts: string[] = [];
    if (layoverAfter?.location?.trim()) layoverParts.push(layoverAfter.location.trim());
    if (layoverAfter?.duration?.trim()) layoverParts.push(layoverAfter.duration.trim());

    return {
      airlineName: segment.airlineName?.trim() || leg.airlineName?.trim() || ticket.flightSnapshot?.airlineName?.trim() || '—',
      flightCode: getFlightCode(segment),
      from: extractIata(segment.from),
      to: extractIata(segment.to),
      fromAirport: segment.fromAirport?.trim() || segment.from?.trim() || '—',
      toAirport: segment.toAirport?.trim() || segment.to?.trim() || '—',
      departureDate: formatFlightDate(depRaw),
      departureTime: formatFlightTime(depRaw),
      arrivalDate: formatFlightDate(arrRaw),
      arrivalTime: formatFlightTime(arrRaw),
      duration: resolveFlightDuration(segment, leg),
      cabin: segment.cabin?.replace(/_/g, ' ') || ticket.class?.replace(/_/g, ' '),
      baggage: segment.baggage?.trim() || segment.cabinBaggage?.trim(),
      layover: layoverParts.length > 0 ? layoverParts.join(' · ') : undefined,
    };
  });
}

export function getTicketTotalDuration(ticket: CrewTicketApi): string {
  const leg = ticket.flightSnapshot?.legs?.[0];
  if (leg) {
    const resolved = resolveFlightDuration(undefined, leg);
    if (resolved !== '—') return resolved;
  }

  const segments = collectTicketSegmentDisplays(ticket);
  const durations = segments.map((s) => s.duration).filter((d) => d !== '—');
  return durations.length > 0 ? durations.join(' + ') : '—';
}

export function getTicketPrimaryAirline(ticket: CrewTicketApi): string {
  const segments = collectTicketSegmentDisplays(ticket);
  if (segments[0]?.airlineName && segments[0].airlineName !== '—') return segments[0].airlineName;
  return ticket.flightSnapshot?.airlineName?.trim() || '—';
}

export function getTicketDepartureSummary(ticket: CrewTicketApi): string {
  const leg = ticket.flightSnapshot?.legs?.[0];
  const dep = leg?.itinerary?.[0]?.departureTime ?? leg?.departureTime;
  return dep ? formatFlightDateTime(dep) : '—';
}

export function getTicketArrivalSummary(ticket: CrewTicketApi): string {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const lastLeg = legs[legs.length - 1];
  const itinerary = lastLeg?.itinerary ?? [];
  const lastSeg = itinerary[itinerary.length - 1];
  const arr = lastSeg?.arrivalTime ?? lastLeg?.arrivalTime;
  return arr ? formatFlightDateTime(arr) : '—';
}
