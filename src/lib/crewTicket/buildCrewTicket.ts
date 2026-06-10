import type {
  CrewTicketApi,
  CrewTicketFlightItinerarySegment,
  CrewTicketFlightLeg,
} from '../../api/ticket';
import { escapeHtml, formatGbp, formatInvoiceDate, formatTripLabel } from '../invoice/format';
import type { CrewTicketTemplateData } from './types';

function getCrewName(ticket: CrewTicketApi): string {
  const c = ticket.crew_id;
  const first = c?.firstname ?? '';
  const last = c?.lastname ?? '';
  return `${first} ${last}`.trim() || 'Passenger';
}

function getProjectTitle(ticket: CrewTicketApi): string {
  const p = ticket.project_id;
  return p?.title ?? (p as { title?: string })?.title ?? '—';
}

function getRigName(ticket: CrewTicketApi): string {
  const rig = ticket.rig_id;
  if (!rig) return '—';
  if (typeof rig === 'string') return rig;
  return rig.name ?? (rig as { name?: string })?.name ?? '—';
}

function formatFlightDateTime(value?: string): string {
  if (!value?.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPassengers(ticket: CrewTicketApi): string {
  const parts = [
    ticket.adult ? `${ticket.adult} adult${ticket.adult === 1 ? '' : 's'}` : null,
    ticket.children ? `${ticket.children} child${ticket.children === 1 ? '' : 'ren'}` : null,
    ticket.infants ? `${ticket.infants} infant${ticket.infants === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

function formatClassLabel(value?: string): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSegmentRow(segment: CrewTicketFlightItinerarySegment): string {
  const airline = [segment.airlineName, segment.airlineCode].filter(Boolean).join(' ');
  const flight = segment.flightNumber ? ` · ${segment.flightNumber}` : '';
  const route = `${segment.from ?? '—'} → ${segment.to ?? '—'}`;
  const airports = [segment.fromAirport, segment.toAirport].filter(Boolean).join(' → ');
  const times = `${formatFlightDateTime(segment.departureTime)} → ${formatFlightDateTime(segment.arrivalTime)}`;
  const cabin = segment.cabin ? `Cabin: ${segment.cabin}` : '';
  const baggage = [segment.cabinBaggage, segment.baggage].filter(Boolean).join(' · ');

  const details = [airline + flight, route, airports, times, cabin, baggage]
    .filter((line) => line && line !== ' · ')
    .map((line) => escapeHtml(line))
    .join('<br/>');

  return `<tr>
    <td style="font-size: 13px; color: #333333; line-height: 1.7; padding: 16px; border: 1px solid #e0e0e0; border-top: none; vertical-align: top;">${details}</td>
  </tr>`;
}

function buildLegRow(leg: CrewTicketFlightLeg, legIndex: number): string {
  const segments = leg.itinerary ?? [];
  if (segments.length > 0) {
    return segments.map((segment) => buildSegmentRow(segment)).join('\n');
  }

  const airline = [leg.airlineName, leg.airlineCode].filter(Boolean).join(' ');
  const route = `${leg.from ?? '—'} → ${leg.to ?? '—'}`;
  const times = `${formatFlightDateTime(leg.departureTime)} → ${formatFlightDateTime(leg.arrivalTime)}`;
  const duration = leg.duration ? `Duration: ${leg.duration}` : '';
  const details = [`Leg ${legIndex + 1}`, airline, route, times, duration]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join('<br/>');

  return `<tr>
    <td style="font-size: 13px; color: #333333; line-height: 1.7; padding: 16px; border: 1px solid #e0e0e0; border-top: none; vertical-align: top;">${details}</td>
  </tr>`;
}

function buildFlightLegsRows(ticket: CrewTicketApi): string {
  const legs = ticket.flightSnapshot?.legs ?? [];
  if (legs.length === 0) {
    const from = ticket.from?.Name ?? '—';
    const to = ticket.to?.Name ?? '—';
    return `<tr>
      <td style="font-size: 13px; color: #333333; line-height: 1.7; padding: 16px; border: 1px solid #e0e0e0; border-top: none; vertical-align: top;">
        ${escapeHtml(`${from} → ${to}`)}<br/>
        ${escapeHtml(formatTripLabel(ticket.trip))} · ${escapeHtml(formatClassLabel(ticket.class))}
      </td>
    </tr>`;
  }

  return legs.map((leg, index) => buildLegRow(leg, index)).join('\n');
}

export function buildCrewTicketTemplateData(ticket: CrewTicketApi): CrewTicketTemplateData {
  const from = ticket.from?.Name ?? '—';
  const to = ticket.to?.Name ?? '—';
  const approvedDate = ticket.approvedAt ? new Date(ticket.approvedAt) : new Date();
  const fare =
    ticket.price != null
      ? formatGbp(Number(ticket.price))
      : ticket.flightSnapshot?.fares?.[0]?.totalFare != null
        ? formatGbp(Number(ticket.flightSnapshot.fares[0].totalFare))
        : '—';

  return {
    booking_reference: escapeHtml(ticket.bookingReference?.trim() || '—'),
    passenger_name: escapeHtml(getCrewName(ticket)),
    passenger_email: escapeHtml(ticket.crew_id?.email?.trim() || '—'),
    route_summary: escapeHtml(`${from} → ${to}`),
    from_label: escapeHtml(from),
    to_label: escapeHtml(to),
    trip_label: escapeHtml(formatTripLabel(ticket.trip)),
    class_label: escapeHtml(formatClassLabel(ticket.class)),
    passengers_label: escapeHtml(formatPassengers(ticket)),
    project_label: escapeHtml(getProjectTitle(ticket)),
    rig_label: escapeHtml(getRigName(ticket)),
    approved_date: escapeHtml(
      Number.isNaN(approvedDate.getTime()) ? '—' : formatInvoiceDate(approvedDate)
    ),
    fare_label: escapeHtml(fare),
    flight_legs_rows: buildFlightLegsRows(ticket),
    footer_note:
      'This is an electronic ticket receipt. Present your booking reference at check-in. &nbsp;|&nbsp; hello@lynq.click',
    logo_src: '',
  };
}

export function fillCrewTicketTemplate(template: string, data: CrewTicketTemplateData): string {
  return Object.entries(data).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}
