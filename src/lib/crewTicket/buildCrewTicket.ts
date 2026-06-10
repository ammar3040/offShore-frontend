import type {
  CrewTicketApi,
  CrewTicketFlightItinerarySegment,
  CrewTicketFlightLeg,
} from '../../api/ticket';
import { escapeHtml, formatInvoiceDate } from '../invoice/format';
import type { CrewTicketTemplateData } from './types';

const DEFAULT_MEALS = 'Included';
const DEFAULT_BAGGAGE = 'As per airline';
const DEFAULT_SUPPORT_PHONE = '+44 (0)20 7946 0958';

function getCrewName(ticket: CrewTicketApi): string {
  const c = ticket.crew_id;
  const first = c?.firstname ?? '';
  const last = c?.lastname ?? '';
  return `${first} ${last}`.trim() || 'Passenger';
}

function getRigName(ticket: CrewTicketApi): string {
  const rig = ticket.rig_id;
  if (!rig) return '—';
  if (typeof rig === 'string') return rig;
  return rig.name ?? (rig as { name?: string })?.name ?? '—';
}

function formatClassLabel(value?: string): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(value?: string): string {
  const d = parseDate(value);
  if (!d) return value?.trim() || '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatLegDate(value?: string): string {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function extractIata(code?: string): string {
  if (!code?.trim()) return '—';
  const trimmed = code.trim();
  if (/^[A-Z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/\b([A-Z]{3})\b/i);
  return match ? match[1].toUpperCase() : trimmed.slice(0, 3).toUpperCase();
}

function getLegLabel(ticket: CrewTicketApi, legIndex: number, totalLegs: number): string {
  const trip = ticket.trip?.toUpperCase() ?? '';
  if (trip.includes('ROUND') && totalLegs >= 2) {
    return legIndex === 0 ? 'OUTBOUND' : legIndex === 1 ? 'RETURN' : `LEG ${legIndex + 1}`;
  }
  if (totalLegs === 1) return 'DEPARTURE';
  return `LEG ${legIndex + 1}`;
}

function collectSegments(ticket: CrewTicketApi): Array<{
  segment: CrewTicketFlightItinerarySegment;
  leg: CrewTicketFlightLeg;
  legIndex: number;
  segmentIndex: number;
}> {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const collected: Array<{
    segment: CrewTicketFlightItinerarySegment;
    leg: CrewTicketFlightLeg;
    legIndex: number;
    segmentIndex: number;
  }> = [];

  legs.forEach((leg, legIndex) => {
    const itinerary = leg.itinerary ?? [];
    if (itinerary.length > 0) {
      itinerary.forEach((segment, segmentIndex) => {
        collected.push({ segment, leg, legIndex, segmentIndex });
      });
      return;
    }

    collected.push({
      segment: {
        airlineName: leg.airlineName,
        airlineCode: leg.airlineCode,
        from: leg.from,
        to: leg.to,
        departureTime: leg.departureTime,
        arrivalTime: leg.arrivalTime,
        cabin: ticket.class,
      },
      leg,
      legIndex,
      segmentIndex: 0,
    });
  });

  if (collected.length === 0) {
    collected.push({
      segment: {
        from: ticket.from?.Name,
        to: ticket.to?.Name,
        fromAirport: ticket.from?.COUNTRYNAME,
        toAirport: ticket.to?.COUNTRYNAME,
        cabin: ticket.class,
      },
      leg: {},
      legIndex: 0,
      segmentIndex: 0,
    });
  }

  return collected;
}

function getTicketBaggageLabel(ticket: CrewTicketApi): string {
  for (const leg of ticket.flightSnapshot?.legs ?? []) {
    for (const segment of leg.itinerary ?? []) {
      const baggage = segment.baggage?.trim() || segment.cabinBaggage?.trim();
      if (baggage) return baggage;
    }
  }
  return DEFAULT_BAGGAGE;
}

function buildFlightCode(segment: CrewTicketFlightItinerarySegment): string {
  const airline = [segment.airlineName, segment.airlineCode].filter(Boolean).join(' ').trim();
  const flightNumber = segment.flightNumber?.trim() ?? '';
  if (airline && flightNumber) return `${airline} ${flightNumber}`;
  return airline || flightNumber || '—';
}

function buildLayoverHtml(segment: CrewTicketFlightItinerarySegment): string {
  const layover = (segment as CrewTicketFlightItinerarySegment & {
    layover?: { location?: string; duration?: string } | null;
  }).layover;
  if (!layover?.location && !layover?.duration) return '';

  const text = ['Layover', layover.location, layover.duration ? `· ${layover.duration}` : '']
    .filter(Boolean)
    .join(' ');

  return `<div style="background:#FFF3D6;margin:0 auto;max-width:600px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;">
      <tr>
        <td style="padding:12px 30px;text-align:center;">
          <span class="layover-text">${escapeHtml(text)}</span>
        </td>
      </tr>
    </table>
  </div>`;
}

function buildSegmentCard(
  ticket: CrewTicketApi,
  segment: CrewTicketFlightItinerarySegment,
  leg: CrewTicketFlightLeg,
  legIndex: number,
  totalLegs: number
): string {
  const legLabel = getLegLabel(ticket, legIndex, totalLegs);
  const headerDate = formatLegDate(segment.departureTime ?? leg.departureTime);
  const fromIata = extractIata(segment.from);
  const toIata = extractIata(segment.to);
  const fromAirport = segment.fromAirport?.trim() || segment.from?.trim() || '—';
  const toAirport = segment.toAirport?.trim() || segment.to?.trim() || '—';
  const duration = segment.duration?.trim() || leg.duration?.trim();
  const cabin = segment.cabin?.trim() || formatClassLabel(ticket.class);
  const baggage = segment.baggage?.trim() || segment.cabinBaggage?.trim() || getTicketBaggageLabel(ticket);
  const details = [
    duration ? `Duration: ${duration}` : null,
    cabin ? `Cabin: ${cabin}` : null,
    baggage ? `Baggage: ${baggage}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<div style="background:#FFFFFF;margin:0 auto;max-width:600px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;width:100%;max-width:600px;">
      <tr>
        <td style="padding:16px 30px 8px;font-family:Arial,Helvetica,sans-serif;">
          <span class="flight-hdr-label">${escapeHtml(legLabel)} · ${escapeHtml(headerDate)}</span>
          <span class="confirmed"> &nbsp; CONFIRMED</span>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 30px 8px;">
          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="40%" align="left" style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
                <span class="iata">${escapeHtml(fromIata)}</span><br/>
                <span class="time">${escapeHtml(formatTime(segment.departureTime))}</span><br/>
                <span class="detail-strip">${escapeHtml(fromAirport)}</span>
              </td>
              <td width="20%" align="center" style="color:#C9A84C;font-size:22px;vertical-align:middle;">→</td>
              <td width="40%" align="right" style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;">
                <span class="iata">${escapeHtml(toIata)}</span><br/>
                <span class="time">${escapeHtml(formatTime(segment.arrivalTime))}</span><br/>
                <span class="detail-strip">${escapeHtml(toAirport)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 30px 8px;font-family:Arial,Helvetica,sans-serif;">
          <span class="flight-code">${escapeHtml(buildFlightCode(segment))}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:0 30px 18px;border-bottom:3px solid #0A1F44;font-family:Arial,Helvetica,sans-serif;">
          <span class="detail-strip">${escapeHtml(details || '—')}</span>
        </td>
      </tr>
    </table>
  </div>`;
}

function buildFlightSections(ticket: CrewTicketApi): string {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const totalLegs = Math.max(legs.length, 1);
  const segments = collectSegments(ticket);

  return segments
    .map(({ segment, leg, legIndex }) => {
      const layover = buildLayoverHtml(segment);
      const card = buildSegmentCard(ticket, segment, leg, legIndex, totalLegs);
      return layover ? `${layover}${card}` : card;
    })
    .join('\n');
}

function getIssueDate(ticket: CrewTicketApi): string {
  const approved = ticket.approvedAt ? new Date(ticket.approvedAt) : null;
  if (approved && !Number.isNaN(approved.getTime())) return formatInvoiceDate(approved);
  const created = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
  return Number.isNaN(created.getTime()) ? formatInvoiceDate(new Date()) : formatInvoiceDate(created);
}

export function buildCrewTicketTemplateData(ticket: CrewTicketApi): CrewTicketTemplateData {
  const from = ticket.from?.Name ?? '—';
  const to = ticket.to?.Name ?? '—';
  const baggage = getTicketBaggageLabel(ticket);

  return {
    bookingReference: escapeHtml(ticket.bookingReference?.trim() || '—'),
    routePreview: escapeHtml(`${from} → ${to}`),
    passengerName: escapeHtml(getCrewName(ticket)),
    vesselName: escapeHtml(getRigName(ticket)),
    cabin: escapeHtml(formatClassLabel(ticket.class)),
    meals: escapeHtml(DEFAULT_MEALS),
    baggage: escapeHtml(baggage),
    issueDate: escapeHtml(getIssueDate(ticket)),
    flightSections: buildFlightSections(ticket),
    pdfLinkHtml: '',
    supportPhone: escapeHtml(DEFAULT_SUPPORT_PHONE),
  };
}

export function fillCrewTicketTemplate(template: string, data: CrewTicketTemplateData): string {
  return Object.entries(data).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}
