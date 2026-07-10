/**
 * Generate a crew ticket PDF using jsPDF directly (vector text, no html2canvas).
 * This produces a clean, sharp PDF matching the LYNQ TRAVEL example ticket layout.
 */
import { jsPDF } from 'jspdf';
import type { CrewTicketApi, CrewTicketFlightLeg, CrewTicketFlightItinerarySegment } from '../../api/ticket';
import { getCrewTicketPdfFilename } from '../../api/ticket';
import crewTicketTemplate from '../../assets/flight-ticket-email.html?raw';
import { buildCrewTicketTemplateData, fillCrewTicketTemplate } from './buildCrewTicket';
import { resolveFlightDuration } from './flightDuration';

/* ── Color palette (matches the MJML template) ── */
const C = {
  navy: '#0A1F44',
  navyLight: '#1A3A6B',
  gold: '#C9A84C',
  white: '#FFFFFF',
  headerMuted: '#AABBCC',
  labelGrey: '#8899AA',
  valueText: '#0A1F44',
  bodyBg: '#EAEEF4',
  panelBg: '#DDE6F2',
  routeBg: '#F5F7FA',
  detailBg: '#EEF2F7',
  divider: '#DDDDDD',
  green: '#1A8A3A',
  metaGrey: '#888888',
  layoverBg: '#FFF8E8',
  layoverBorder: '#C9A84C',
  layoverText: '#8B6A00',
  detailText: '#666666',
  footerBlue: '#5577AA',
} as const;

const PAGE_W = 210; // A4 width mm
const MARGIN_L = 20;
const MARGIN_R = 20;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const DEFAULT_SUPPORT_PHONE = '+44 1772 283210';
const DEFAULT_BAGGAGE = 'AS PER AIRLINE';

/* ── Utility helpers ── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
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

function formatTicketDate(value?: string): string {
  const d = parseDate(value);
  if (!d) return '—';
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
}

function formatIssueDate(ticket: CrewTicketApi): string {
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

function getClassLabel(ticket: CrewTicketApi, segment?: CrewTicketFlightItinerarySegment): string {
  const base = (segment?.cabin ?? ticket.class ?? '—').replace(/_/g, ' ').toUpperCase();
  const fare = ticket.flightSnapshot?.fares?.[0];
  const indicator = (fare as { indicator?: string } | undefined)?.indicator?.trim()
    || (fare?.name?.match(/\(([A-Z])\)/i)?.[1] ?? '');
  return indicator ? `${base} (${indicator.toUpperCase()})` : base;
}

function getTicketBaggage(ticket: CrewTicketApi): string {
  for (const leg of ticket.flightSnapshot?.legs ?? []) {
    for (const segment of leg.itinerary ?? []) {
      const baggage = segment.baggage?.trim() || segment.cabinBaggage?.trim();
      if (baggage) return baggage.toUpperCase();
    }
  }
  return DEFAULT_BAGGAGE;
}

type LayoverInfo = { location?: string; duration?: string } | null | undefined;
type SegmentRow = {
  segment: CrewTicketFlightItinerarySegment;
  leg: CrewTicketFlightLeg;
  layoverAfter?: LayoverInfo;
  fromItinerary?: boolean;
};

function collectSegmentRows(ticket: CrewTicketApi): SegmentRow[] {
  const legs = ticket.flightSnapshot?.legs ?? [];
  const rows: SegmentRow[] = [];

  legs.forEach((leg) => {
    const itinerary = leg.itinerary ?? [];
    if (itinerary.length > 0) {
      itinerary.forEach((segment, index) => {
        const layover = (segment as CrewTicketFlightItinerarySegment & { layover?: LayoverInfo }).layover;
        rows.push({ segment, leg, layoverAfter: index < itinerary.length - 1 ? layover : undefined, fromItinerary: true });
      });
      return;
    }
    rows.push({
      segment: {
        airlineName: leg.airlineName, airlineCode: leg.airlineCode,
        from: leg.from, to: leg.to, fromAirport: leg.from, toAirport: leg.to,
        departureTime: leg.departureTime, arrivalTime: leg.arrivalTime,
        duration: leg.duration, cabin: ticket.class,
      },
      leg,
    });
  });

  if (rows.length === 0) {
    rows.push({
      segment: { from: ticket.from?.Name, to: ticket.to?.Name, fromAirport: ticket.from?.Name, toAirport: ticket.to?.Name, cabin: ticket.class },
      leg: {},
    });
  }
  return rows;
}

function getFlightCode(segment: CrewTicketFlightItinerarySegment): string {
  const code = segment.airlineCode?.trim().toUpperCase() ?? '';
  const num = segment.flightNumber?.trim() ?? '';
  if (code && num) return `${code} ${num}`;
  return code || num || '—';
}

function getAirlineName(segment: CrewTicketFlightItinerarySegment, leg: CrewTicketFlightLeg): string {
  return segment.airlineName?.trim() || leg.airlineName?.trim() || '—';
}

function getStopLabel(leg: CrewTicketFlightLeg, fromItinerary?: boolean): string {
  if (fromItinerary) return 'NON-STOP';
  const stops = (leg as CrewTicketFlightLeg & { stops?: number }).stops;
  if (typeof stops === 'number' && stops > 0) return `${stops} STOP${stops === 1 ? '' : 'S'}`;
  const itLen = leg.itinerary?.length ?? 0;
  if (itLen > 1) return `${itLen - 1} STOP`;
  return 'NON-STOP';
}

/* ── PDF Drawing helpers ── */

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function setFillColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setDrawColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: string) {
  setFillColor(doc, color);
  doc.rect(x, y, w, h, 'F');
}

function drawText(
  doc: jsPDF, text: string, x: number, y: number,
  opts: { size?: number; style?: string; color?: string; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}
) {
  const { size = 10, style = 'normal', color = C.navy, align = 'left', maxWidth } = opts;
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
  setColor(doc, color);
  doc.text(text, x, y, { align, maxWidth });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    drawRect(doc, 0, 0, PAGE_W, 297, C.bodyBg);
    return 15;
  }
  return y;
}

/* ── Main PDF generator ── */

export async function generateCrewTicketPdfBlob(ticket: CrewTicketApi): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const bookingRef = ticket.bookingReference?.trim() || '—';
  const passengerName = getCrewDisplayName(ticket);
  const vesselName = getRigName(ticket);
  const segments = collectSegmentRows(ticket);
  const firstSeg = segments[0]?.segment;
  const cabin = getClassLabel(ticket, firstSeg);
  const baggage = getTicketBaggage(ticket);
  const issueDate = formatIssueDate(ticket);

  // ── Page background ──
  drawRect(doc, 0, 0, PAGE_W, 297, C.bodyBg);

  let y = 0;

  // ═══════════════════════════════════════
  // HEADER — Dark navy band
  // ═══════════════════════════════════════
  const headerH = 22;
  drawRect(doc, MARGIN_L, y + 12, CONTENT_W, headerH, C.navy);

  // LYNQ TRAVEL
  drawText(doc, 'LYNQ', MARGIN_L + 8, y + 22, { size: 18, style: 'bold', color: C.white });
  drawText(doc, 'TRAVEL', MARGIN_L + 38, y + 22, { size: 14, color: C.gold });
  drawText(doc, 'FLIGHT ITINERARY', MARGIN_L + 8, y + 28, { size: 7, color: C.headerMuted });

  // BOOKING REF
  drawText(doc, 'BOOKING REF', PAGE_W - MARGIN_R - 8, y + 19, { size: 7, color: C.headerMuted, align: 'right' });
  drawText(doc, bookingRef, PAGE_W - MARGIN_R - 8, y + 28, { size: 14, style: 'bold', color: C.gold, align: 'right' });

  y += 12 + headerH;

  // ═══════════════════════════════════════
  // PASSENGER / VESSEL panel
  // ═══════════════════════════════════════
  const passengerH = 16;
  drawRect(doc, MARGIN_L, y, CONTENT_W, passengerH, C.panelBg);

  drawText(doc, 'PASSENGER', MARGIN_L + 8, y + 5, { size: 7, color: C.labelGrey });
  drawText(doc, passengerName, MARGIN_L + 8, y + 11, { size: 11, style: 'bold', color: C.navy, maxWidth: 100 });

  drawText(doc, 'VESSEL', PAGE_W - MARGIN_R - 8, y + 5, { size: 7, color: C.labelGrey, align: 'right' });
  drawText(doc, vesselName, PAGE_W - MARGIN_R - 8, y + 11, { size: 10, style: 'bold', color: C.navy, align: 'right' });

  y += passengerH;

  // ═══════════════════════════════════════
  // CLASS / MEALS / BAGGAGE / ISSUED strip
  // ═══════════════════════════════════════
  const stripH = 13;
  drawRect(doc, MARGIN_L, y, CONTENT_W, stripH, C.routeBg);
  setDrawColor(doc, C.divider);
  doc.line(MARGIN_L, y + stripH, MARGIN_L + CONTENT_W, y + stripH);

  const colW = CONTENT_W / 4;
  const stripItems = [
    { label: 'CLASS', value: cabin },
    { label: 'MEALS', value: 'AS PER SEGMENT' },
    { label: 'BAGGAGE', value: baggage },
    { label: 'ISSUED', value: issueDate },
  ];

  stripItems.forEach((item, i) => {
    const cx = MARGIN_L + colW * i + colW / 2;
    drawText(doc, item.label, cx, y + 4.5, { size: 7, color: C.labelGrey, align: 'center' });
    drawText(doc, item.value, cx, y + 10, { size: 9, style: 'bold', color: C.navy, align: 'center' });
  });

  y += stripH + 4;

  // ═══════════════════════════════════════
  // FLIGHT SEGMENTS
  // ═══════════════════════════════════════

  segments.forEach((row, idx) => {
    const { segment, leg } = row;
    const flightNum = idx + 1;
    const flightCode = getFlightCode(segment);
    const airlineName = getAirlineName(segment, leg);
    const headerDate = formatTicketDate(segment.departureTime ?? leg.departureTime);
    const fromIata = extractIata(segment.from);
    const toIata = extractIata(segment.to);
    const fromAirport = segment.fromAirport?.trim() || segment.from?.trim() || '—';
    const toAirport = segment.toAirport?.trim() || segment.to?.trim() || '—';
    const depTime = formatTime(segment.departureTime ?? leg.departureTime);
    const arrTime = formatTime(segment.arrivalTime ?? leg.arrivalTime);
    const depDate = formatTicketDate(segment.departureTime ?? leg.departureTime);
    const arrDate = formatTicketDate(segment.arrivalTime ?? leg.arrivalTime);
    const duration = resolveFlightDuration(segment, leg);
    const segBaggage = (segment.baggage?.trim() || segment.cabinBaggage?.trim() || baggage).toUpperCase();
    const stopLabel = getStopLabel(leg, row.fromItinerary);
    const aircraft = segment.aircraft?.trim();

    // Check if we need a page break (~55mm per flight segment)
    y = checkPageBreak(doc, y, 58);

    // ── Flight header bar ──
    const fHeaderH = 9;
    drawRect(doc, MARGIN_L, y, CONTENT_W, fHeaderH, C.navyLight);

    drawText(doc, `FLIGHT ${flightNum}`, MARGIN_L + 6, y + 5.8, { size: 8, style: 'bold', color: C.white });
    drawText(doc, flightCode, MARGIN_L + 28, y + 5.8, { size: 10, style: 'bold', color: C.gold });

    // Airline name - check if it includes operator info
    const operatedBy = airlineName;
    const codeWidth = doc.getTextWidth(flightCode);
    drawText(doc, operatedBy, MARGIN_L + 30 + codeWidth, y + 5.8, { size: 7.5, color: C.headerMuted, maxWidth: 60 });

    drawText(doc, headerDate, PAGE_W - MARGIN_R - 5, y + 5.8, { size: 7, color: C.headerMuted, align: 'right' });

    y += fHeaderH;

    // ── Route section (IATA codes + airports) ──
    const routeH = 16;
    drawRect(doc, MARGIN_L, y, CONTENT_W, routeH, C.routeBg);

    // From IATA
    drawText(doc, fromIata, MARGIN_L + 10, y + 8, { size: 20, style: 'bold', color: C.navy });
    // From airport name
    drawText(doc, fromAirport, MARGIN_L + 5, y + 13.5, { size: 6.5, color: C.metaGrey, maxWidth: 55 });

    // Center dashed line + stop label
    const cx = MARGIN_L + CONTENT_W / 2;
    setDrawColor(doc, C.divider);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(cx - 25, y + 7, cx + 25, y + 7);
    doc.setLineDashPattern([], 0);
    drawText(doc, stopLabel, cx, y + 12.5, { size: 7, style: 'bold', color: C.navyLight, align: 'center' });

    // To IATA
    drawText(doc, toIata, PAGE_W - MARGIN_R - 10, y + 8, { size: 20, style: 'bold', color: C.navy, align: 'right' });
    drawText(doc, toAirport, PAGE_W - MARGIN_R - 5, y + 13.5, { size: 6.5, color: C.metaGrey, align: 'right', maxWidth: 55 });

    y += routeH;

    // ── Departure / Arrival times ──
    const timesH = 18;
    drawRect(doc, MARGIN_L, y, CONTENT_W, timesH, C.white);
    setDrawColor(doc, '#EEEEEE');
    doc.line(MARGIN_L, y, MARGIN_L + CONTENT_W, y);

    // Divider in the middle
    const midX = MARGIN_L + CONTENT_W / 2;
    setDrawColor(doc, C.divider);
    doc.line(midX, y + 2, midX, y + timesH - 2);

    // Departure
    drawText(doc, 'DEPARTURE', MARGIN_L + 8, y + 5, { size: 7, color: C.labelGrey });
    drawText(doc, depTime, MARGIN_L + 8, y + 12, { size: 15, style: 'bold', color: C.navy });
    drawText(doc, depDate, MARGIN_L + 8, y + 16.5, { size: 7, color: C.navyLight });

    // Arrival
    drawText(doc, 'ARRIVAL', PAGE_W - MARGIN_R - 8, y + 5, { size: 7, color: C.labelGrey, align: 'right' });
    drawText(doc, arrTime, PAGE_W - MARGIN_R - 8, y + 12, { size: 15, style: 'bold', color: C.navy, align: 'right' });
    drawText(doc, arrDate, PAGE_W - MARGIN_R - 8, y + 16.5, { size: 7, color: C.navyLight, align: 'right' });

    y += timesH;

    // ── Detail strip ──
    const detailH = 7;
    drawRect(doc, MARGIN_L, y, CONTENT_W, detailH, C.detailBg);

    const details: string[] = [];
    if (duration && duration !== '—') details.push(`DURATION: ${duration.toUpperCase()}`);
    if (aircraft) details.push(`AIRCRAFT: ${aircraft.toUpperCase()}`);
    details.push(`BAGGAGE: ${segBaggage}`);

    const separator = ' | ';
    const detailsPart = details.join(separator);
    const statusPart = 'STATUS: ';
    const confirmedPart = 'CONFIRMED';

    // Calculate total text width to center the entire line
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const detailsWidth = doc.getTextWidth(detailsPart + separator + statusPart);
    doc.setFont('helvetica', 'bold');
    const confirmedWidth = doc.getTextWidth(confirmedPart);

    const totalWidth = detailsWidth + confirmedWidth;
    const startX = cx - totalWidth / 2;

    // Draw the details + status prefix in normal grey/navy text
    doc.setFont('helvetica', 'normal');
    setColor(doc, C.detailText);
    doc.text(detailsPart + separator + statusPart, startX, y + 4.5);

    // Draw the CONFIRMED word in bold green text
    doc.setFont('helvetica', 'bold');
    setColor(doc, C.green);
    doc.text(confirmedPart, startX + detailsWidth, y + 4.5);

    y += detailH;

    // ── Layover banner (if applicable) ──
    if (row.layoverAfter?.location || row.layoverAfter?.duration) {
      y = checkPageBreak(doc, y, 10);

      const layH = 8;
      drawRect(doc, MARGIN_L, y, CONTENT_W, layH, C.layoverBg);
      setDrawColor(doc, C.layoverBorder);
      doc.rect(MARGIN_L, y, CONTENT_W, layH, 'S');

      const locText = row.layoverAfter.location?.trim() || '—';
      const iata = extractIata(locText);
      const locationLabel = iata !== '—' && !locText.toUpperCase().includes(iata) ? `${locText} (${iata})` : locText;
      let layoverStr = `LAYOVER: ${locationLabel}`;
      if (row.layoverAfter.duration?.trim()) {
        layoverStr += `  |  STOP DURATION: ${row.layoverAfter.duration.trim()}`;
      }

      drawText(doc, layoverStr, cx, y + 5, { size: 8, style: 'bold', color: C.layoverText, align: 'center' });
      y += layH;
    }

    y += 3; // spacing between segments
  });

  // ═══════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════
  y = checkPageBreak(doc, y, 25);
  y += 2;

  const footerH = 22;
  drawRect(doc, MARGIN_L, y, CONTENT_W, footerH, C.panelBg);

  const footerCx = MARGIN_L + CONTENT_W / 2;

  // Support line
  drawText(doc, `For 24x7 support please call: ${DEFAULT_SUPPORT_PHONE}`, footerCx, y + 6, {
    size: 8, style: 'bold', color: C.navyLight, align: 'center',
  });

  // LYNQ TRAVEL summary
  const summaryText = `LYNQ TRAVEL  |  All reservations confirmed  |  Meals included  |  ${baggage} baggage`;
  drawText(doc, summaryText, footerCx, y + 12.5, {
    size: 7, style: 'normal', color: C.footerBlue, align: 'center',
  });

  // Issued by line
  drawText(doc, `ISSUED BY LYNQ TRAVEL  |  ${issueDate}`, footerCx, y + 18, {
    size: 7, color: C.footerBlue, align: 'center',
  });

  return doc.output('blob');
}

export async function generateCrewTicketPdfFile(ticket: CrewTicketApi): Promise<File> {
  const blob = await generateCrewTicketPdfBlob(ticket);
  return new File([blob], getCrewTicketPdfFilename(ticket), { type: 'application/pdf' });
}

/** Generate HTML preview for browser display (legacy compatibility) */
export function previewCrewTicketHtml(ticket: CrewTicketApi): string {
  const templateData = buildCrewTicketTemplateData(ticket);
  return fillCrewTicketTemplate(crewTicketTemplate, templateData);
}
