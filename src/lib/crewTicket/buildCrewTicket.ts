import type {
  CrewTicketApi,
  CrewTicketFlightItinerarySegment,
  CrewTicketFlightLeg,
} from '../../api/ticket';
import { escapeHtml } from '../invoice/format';
import type { CrewTicketTemplateData } from './types';

const DEFAULT_MEALS = 'MEAL';
const DEFAULT_BAGGAGE = 'AS PER AIRLINE';
const DEFAULT_SUPPORT_PHONE = '+44 1772 283210';

type LayoverInfo = { location?: string; duration?: string } | null | undefined;

type SegmentRow = {
  segment: CrewTicketFlightItinerarySegment;
  leg: CrewTicketFlightLeg;
  layoverAfter?: LayoverInfo;
  /** True when this row is a single itinerary segment (always non-stop). */
  fromItinerary?: boolean;
};

function getCrewDisplayName(ticket: CrewTicketApi): string {
  const c = ticket.crew_id;
  const first = (c?.firstname ?? '').trim();
  const last = (c?.lastname ?? '').trim();
  if (last && first) return `${last.toUpperCase()} / ${first.toUpperCase()} MR`;
  return `${first} ${last}`.trim().toUpperCase() || 'PASSENGER';
}

function getRigName(ticket: CrewTicketApi): string {
  const rig = ticket.rig_id;
  if (!rig) return '—';
  if (typeof rig === 'string') return rig;
  return rig.name ?? (rig as { name?: string })?.name ?? '—';
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

function formatTicketDateUpper(value?: string): string {
  const d = parseDate(value);
  if (!d) return '—';
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
}

function formatIssueDateUpper(ticket: CrewTicketApi): string {
  const raw = ticket.approvedAt ?? ticket.createdAt;
  const d = raw ? parseDate(raw) : new Date();
  if (!d) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function extractIata(code?: string): string {
  if (!code?.trim()) return '—';
  const trimmed = code.trim();
  if (/^[A-Z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/\b([A-Z]{3})\b/i);
  return match ? match[1].toUpperCase() : trimmed.slice(0, 3).toUpperCase();
}

function formatClassLabel(value?: string): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').toUpperCase();
}

function getCabinLabel(ticket: CrewTicketApi, segment?: CrewTicketFlightItinerarySegment): string {
  const base = formatClassLabel(segment?.cabin ?? ticket.class);
  const fare = ticket.flightSnapshot?.fares?.[0];
  const indicator =
    (fare as { indicator?: string } | undefined)?.indicator?.trim() ||
    (fare?.name?.match(/\(([A-Z])\)/i)?.[1] ?? '');
  return indicator ? `${base} (${indicator.toUpperCase()})` : base;
}

function getSegmentBaggage(segment: CrewTicketFlightItinerarySegment, fallback: string): string {
  const raw = segment.baggage?.trim() || segment.cabinBaggage?.trim() || fallback;
  return raw.toUpperCase();
}

function getTicketBaggageLabel(ticket: CrewTicketApi): string {
  for (const leg of ticket.flightSnapshot?.legs ?? []) {
    for (const segment of leg.itinerary ?? []) {
      const baggage = segment.baggage?.trim() || segment.cabinBaggage?.trim();
      if (baggage) return baggage.toUpperCase();
    }
  }
  return DEFAULT_BAGGAGE;
}

function getFlightCodeDisplay(segment: CrewTicketFlightItinerarySegment): string {
  const code = segment.airlineCode?.trim().toUpperCase() ?? '';
  const number = segment.flightNumber?.trim() ?? '';
  if (code && number) return `${code} ${number}`;
  return code || number || '—';
}

function getAirlineName(segment: CrewTicketFlightItinerarySegment, leg: CrewTicketFlightLeg): string {
  return segment.airlineName?.trim() || leg.airlineName?.trim() || '—';
}

function getStopLabel(leg: CrewTicketFlightLeg): string {
  const stops = (leg as CrewTicketFlightLeg & { stops?: number }).stops;
  if (typeof stops === 'number' && stops > 0) return `${stops} STOP${stops === 1 ? '' : 'S'}`;
  const itineraryLen = leg.itinerary?.length ?? 0;
  if (itineraryLen > 1) return `${itineraryLen - 1} STOP`;
  return 'NON-STOP';
}

function collectSegmentRows(ticket: CrewTicketApi): SegmentRow[] {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const rows: SegmentRow[] = [];

  legs.forEach((leg) => {
    const itinerary = leg.itinerary ?? [];
    if (itinerary.length > 0) {
      itinerary.forEach((segment, index) => {
        const layover = (segment as CrewTicketFlightItinerarySegment & { layover?: LayoverInfo }).layover;
        rows.push({
          segment,
          leg,
          layoverAfter: index < itinerary.length - 1 ? layover : undefined,
          fromItinerary: true,
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

  if (rows.length === 0) {
    rows.push({
      segment: {
        from: ticket.from?.Name,
        to: ticket.to?.Name,
        fromAirport: ticket.from?.Name,
        toAirport: ticket.to?.Name,
        cabin: ticket.class,
      },
      leg: {},
    });
  }

  return rows;
}

function buildRoutePreview(ticket: CrewTicketApi): string {
  const segments = collectSegmentRows(ticket);
  const codes = segments.map(({ segment }) => extractIata(segment.from));
  const lastTo = segments[segments.length - 1]?.segment.to;
  if (lastTo) codes.push(extractIata(lastTo));
  const uniqueRoute = codes.filter((code, i, arr) => i === 0 || code !== arr[i - 1]);
  const route = uniqueRoute.join(' → ');
  const firstDeparture = segments[0]?.segment.departureTime;
  const datePart = firstDeparture ? formatTicketDateUpper(firstDeparture) : '—';
  const ref = ticket.bookingReference?.trim() || '—';
  return `Your flight itinerary: ${route} | ${datePart} | Booking Ref: ${ref}`;
}

/**
 * The helpers below emit the exact HTML structure that MJML compiles
 * mj-section / mj-column / mj-text into (see ticket_8XT6HB.mjml compiled),
 * with column widths inlined since the head media-query classes only cover
 * widths used by the static template.
 */

function mjSection(background: string, padding: string, columns: string, tdExtra = ''): string {
  return `<div style="background:${background};background-color:${background};margin:0px auto;max-width:600px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${background};background-color:${background};width:100%;">
        <tbody>
          <tr>
            <td style="${tdExtra}direction:ltr;font-size:0px;padding:${padding};text-align:center;">
              ${columns}
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function mjColumn(
  widthPercent: number,
  align: 'left' | 'right' | 'center',
  content: string,
  options: { textColor?: string; tdPadding?: string; tableStyleExtra?: string; tdClass?: string } = {}
): string {
  const { textColor = '#333333', tdPadding = '0', tableStyleExtra = '', tdClass = '' } = options;
  return `<div style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:${widthPercent}%;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="${tableStyleExtra}vertical-align:top;" width="100%">
                  <tbody>
                    <tr>
                      <td align="${align}"${tdClass ? ` class="${tdClass}"` : ''} style="font-size:0px;padding:${tdPadding};word-break:break-word;">
                        <div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.5;text-align:${align};color:${textColor};">${content}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>`;
}

function buildLayoverBanner(layover: LayoverInfo): string {
  if (!layover?.location && !layover?.duration) return '';

  const location = layover.location?.trim() || '—';
  const iata = extractIata(location);
  const locationLabel = iata !== '—' && !location.toUpperCase().includes(iata)
    ? `${location} (${iata})`
    : location;
  const durationPart = layover.duration?.trim()
    ? ` &nbsp;│&nbsp; STOP DURATION: ${escapeHtml(layover.duration.trim())}`
    : '';

  const content = `<span class="layover-text">■&nbsp; LAYOVER: ${escapeHtml(locationLabel)}${durationPart} &nbsp;■</span>`;

  const banner = mjSection(
    '#FFF8E8',
    '10px 30px',
    mjColumn(100, 'center', content),
    'border:1px solid #C9A84C;'
  );
  return `<div class="crew-ticket-layover">${banner}</div>`;
}

function buildFlightBlock(
  flightNumber: number,
  row: SegmentRow,
  defaultBaggage: string
): string {
  const { segment, leg } = row;
  const flightCode = getFlightCodeDisplay(segment);
  const airlineName = getAirlineName(segment, leg);
  const headerDate = formatTicketDateUpper(segment.departureTime ?? leg.departureTime);
  const fromIata = extractIata(segment.from);
  const toIata = extractIata(segment.to);
  const fromAirport = segment.fromAirport?.trim() || segment.from?.trim() || '—';
  const toAirport = segment.toAirport?.trim() || segment.to?.trim() || '—';
  const depTime = formatTime(segment.departureTime ?? leg.departureTime);
  const arrTime = formatTime(segment.arrivalTime ?? leg.arrivalTime);
  const depDate = formatTicketDateUpper(segment.departureTime ?? leg.departureTime);
  const arrDate = formatTicketDateUpper(segment.arrivalTime ?? leg.arrivalTime);
  const duration = (segment.duration ?? leg.duration)?.trim();
  const baggage = getSegmentBaggage(segment, defaultBaggage);
  const stopLabel = row.fromItinerary ? 'NON-STOP' : getStopLabel(leg);

  const header = mjSection(
    '#1A3A6B',
    '10px 30px',
    mjColumn(
      65,
      'left',
      `<span style="font-size:14px;">✈&nbsp;&nbsp;</span>
                          <span style="font-size:12px;font-weight:bold;color:#ffffff;">FLIGHT ${flightNumber}&nbsp;&nbsp;</span>
                          <span class="flight-code">${escapeHtml(flightCode)}</span>
                          <span style="font-size:12px;color:#AABBCC;">&nbsp;&nbsp;${escapeHtml(airlineName)}</span>`,
      { textColor: '#ffffff' }
    ) +
      mjColumn(
        35,
        'right',
        `<span class="flight-hdr-label">${escapeHtml(headerDate)}</span>`
      )
  );

  const route = mjSection(
    '#F5F7FA',
    '16px 30px 8px',
    mjColumn(
      30,
      'left',
      `<span class="iata">${escapeHtml(fromIata)}</span><br />
                          <span style="font-size:10px;color:#888888;">${escapeHtml(fromAirport)}</span>`
    ) +
      mjColumn(
        40,
        'center',
        `<span style="font-size:11px;color:#BBBBBB;letter-spacing:2px;">────────────────</span><br />
                          <span style="font-size:10px;color:#1A3A6B;font-weight:bold;">✈ &nbsp;${escapeHtml(stopLabel)}&nbsp; ✈</span>`
      ) +
      mjColumn(
        30,
        'right',
        `<span class="iata">${escapeHtml(toIata)}</span><br />
                          <span style="font-size:10px;color:#888888;">${escapeHtml(toAirport)}</span>`
      )
  );

  const times = mjSection(
    '#FFFFFF',
    '10px 30px',
    mjColumn(
      50,
      'left',
      `<span class="label">Departure</span><br />
                          <span class="time">${escapeHtml(depTime)}</span><br />
                          <span style="font-size:11px;color:#1A3A6B;">${escapeHtml(depDate)}</span>`,
      { tableStyleExtra: 'border-right:1px solid #DDDDDD;' }
    ) +
      mjColumn(
        50,
        'left',
        `<span class="label">Arrival</span><br />
                          <span class="time">${escapeHtml(arrTime)}</span><br />
                          <span style="font-size:11px;color:#1A3A6B;">${escapeHtml(arrDate)}</span>`,
        { tdPadding: '0 0 0 20px' }
      ),
    'border-top:1px solid #EEEEEE;'
  );

  const aircraft = segment.aircraft?.trim();
  const detailContent = [
    duration ? `DURATION: ${escapeHtml(duration)}` : null,
    aircraft ? `AIRCRAFT: ${escapeHtml(aircraft)}` : null,
    `BAGGAGE: ${escapeHtml(baggage)}`,
    'STATUS: <span class="confirmed">CONFIRMED</span>',
  ]
    .filter(Boolean)
    .join(' &nbsp;▪&nbsp; ');

  const details = mjSection(
    '#EEF2F7',
    '8px 30px',
    mjColumn(100, 'center', detailContent, { tdClass: 'detail-strip' })
  );

  return `<div class="crew-ticket-flight-block">${header}${route}${times}${details}</div>`;
}

function buildFlightSections(ticket: CrewTicketApi): string {
  const defaultBaggage = getTicketBaggageLabel(ticket);
  const rows = collectSegmentRows(ticket);

  return rows
    .map((row, index) => {
      const block = buildFlightBlock(index + 1, row, defaultBaggage);
      const layover = row.layoverAfter ? buildLayoverBanner(row.layoverAfter) : '';
      return `${block}${layover}`;
    })
    .join('\n');
}

export function buildCrewTicketTemplateData(ticket: CrewTicketApi): CrewTicketTemplateData {
  const baggage = getTicketBaggageLabel(ticket);
  const firstSegment = collectSegmentRows(ticket)[0]?.segment;

  return {
    bookingReference: escapeHtml(ticket.bookingReference?.trim() || '—'),
    previewText: escapeHtml(buildRoutePreview(ticket)),
    passengerName: escapeHtml(getCrewDisplayName(ticket)),
    vesselName: escapeHtml(getRigName(ticket)),
    cabin: escapeHtml(getCabinLabel(ticket, firstSegment)),
    meals: escapeHtml(DEFAULT_MEALS),
    baggage: escapeHtml(baggage),
    issueDate: escapeHtml(formatIssueDateUpper(ticket)),
    flightSections: buildFlightSections(ticket),
    supportPhone: escapeHtml(DEFAULT_SUPPORT_PHONE),
    footerBaggage: escapeHtml(baggage),
  };
}

export function fillCrewTicketTemplate(template: string, data: CrewTicketTemplateData): string {
  return Object.entries(data).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}
