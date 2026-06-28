import type { CrewMemberApi } from '../../api/crew';
import type { AdminApi } from '../../api/superadmin';
import type { ProjectApi } from '../../api/project';
import type { CrewTicketApi } from '../../api/ticket';
import { getTicketStatus } from '../../api/ticket';
import { escapeHtml, formatGbp, formatInvoiceDate, formatTripLabel } from './format';
import type { InvoiceLineItem, InvoiceTemplateData, TicketInvoiceBill } from './types';

/** Static issuer / recipient on every Lynq Travel invoice (see invoice_INV-014.mjml). */
const INVOICE_FROM = {
  name: 'Lynq Travel',
  addressHtml: 'United Kingdom',
  email: 'hello@lynq.click',
} as const;

const INVOICE_TO = {
  name: 'Subseaquence Ltd',
  addressHtml:
    'Unit 9A Kent House<br/>19 Bourne Road<br/>Old Bexley Business Park<br/>Bexley, Kent, DA5 1LR<br/>United Kingdom',
} as const;

function getCrewName(ticket: CrewTicketApi): string {
  const c = ticket.crew_id;
  const first = c?.firstname ?? '';
  const last = c?.lastname ?? '';
  return `${first} ${last}`.trim() || 'Passenger';
}

function getRouteLabel(ticket: CrewTicketApi): string {
  const from = ticket.from?.Name ?? '—';
  const to = ticket.to?.Name ?? '—';
  return `Flights booked — ${from} → ${to}`;
}

function parseFlightDateTime(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First segment departure from the booked flight snapshot. */
function getFirstDepartureDate(ticket: CrewTicketApi): Date | null {
  for (const leg of ticket.flightSnapshot?.legs ?? []) {
    const firstSegment = leg.itinerary?.[0];
    const fromSegment = parseFlightDateTime(firstSegment?.departureTime);
    if (fromSegment) return fromSegment;
    const fromLeg = parseFlightDateTime(leg.departureTime);
    if (fromLeg) return fromLeg;
  }
  return null;
}

function getDepartureLabel(ticket: CrewTicketApi): string {
  const d = getFirstDepartureDate(ticket);
  if (!d) return 'Departure: —';
  return `Departure: ${formatInvoiceDate(d)}`;
}

function buildLineItem(projectTitle: string, ticket: CrewTicketApi): InvoiceLineItem {
  const unitPriceGbp = Number(ticket.price ?? 0);
  return {
    projectTitle,
    passengerName: getCrewName(ticket),
    routeLabel: getRouteLabel(ticket),
    departureLabel: getDepartureLabel(ticket),
    tripLabel: formatTripLabel(ticket.trip),
    qty: 1,
    unitPriceGbp,
    amountGbp: unitPriceGbp,
  };
}

function buildInvoiceNumber(ticket: CrewTicketApi, index: number): string {
  const suffix = ticket.id.slice(-4).toUpperCase();
  return `INV-${String(index + 1).padStart(3, '0')}-${suffix}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getTicketProjectId(ticket: CrewTicketApi): string {
  return ticket.project_id?._id ?? (ticket.project_id as { id?: string })?.id ?? '';
}

function resolveProject(ticket: CrewTicketApi, projectById: Map<string, ProjectApi>): ProjectApi {
  const projectId = getTicketProjectId(ticket);
  const existing = projectById.get(projectId);
  if (existing) return existing;

  return {
    id: projectId,
    title: ticket.project_id?.title ?? 'Untitled project',
    description: ticket.project_id?.description ?? '',
    duration: { startDate: '', endDate: '' },
    span: '',
    status: ticket.project_id?.status ?? '',
    createdBy: '',
    participants: [],
  };
}

/** Builds one invoice bill per approved crew ticket. */
export function buildTicketInvoiceBills(
  projects: ProjectApi[],
  tickets: CrewTicketApi[],
  admins: AdminApi[],
  marginsByTicket: Record<string, number> = {},
  crewById: Record<string, CrewMemberApi> = {}
): TicketInvoiceBill[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const adminById = new Map(admins.map((admin) => [admin.id, admin]));
  const approvedTickets = tickets.filter((ticket) => getTicketStatus(ticket) === 'APPROVED');

  return approvedTickets.map((ticket, index) => {
    const project = resolveProject(ticket, projectById);
    const lineItem = buildLineItem(project.title, ticket);
    const marginGbp = Math.max(0, Number(marginsByTicket[ticket.id] ?? 0));
    const ticketsSubtotalGbp = lineItem.amountGbp;
    const totalGbp = ticketsSubtotalGbp + marginGbp;
    const issueDate = new Date();
    const admin = adminById.get(project.createdBy) ?? null;

    return {
      ticket,
      project,
      admin,
      lineItems: [lineItem],
      ticketsSubtotalGbp,
      marginGbp,
      totalGbp,
      invoiceNumber: buildInvoiceNumber(ticket, index),
      issueDate,
      dueDate: addDays(issueDate, 1),
      crewById,
    };
  });
}

/** @deprecated Use buildTicketInvoiceBills */
export const buildProjectInvoiceBills = buildTicketInvoiceBills;

function buildLineItemRow(item: InvoiceLineItem, lineTotalGbp: number): string {
  const description = [
    `<strong>${escapeHtml(item.projectTitle)}</strong>`,
    `Passenger: ${escapeHtml(item.passengerName)}`,
    escapeHtml(item.routeLabel),
    escapeHtml(item.departureLabel),
    escapeHtml(item.tripLabel),
  ].join('<br/>');

  return `<tr>
    <td style="font-size: 13px; color: #333333; line-height: 1.7; padding: 18px 16px 20px 16px; border: 1px solid #e0e0e0; border-top: none; border-right: none; vertical-align: top;">${description}</td>
    <td style="font-size: 13px; color: #333333; padding: 18px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; vertical-align: top;">${item.qty}</td>
    <td style="font-size: 13px; color: #333333; padding: 18px 16px; border-bottom: 1px solid #e0e0e0; text-align: right; vertical-align: top;">${formatGbp(lineTotalGbp)}</td>
    <td style="font-size: 13px; color: #333333; padding: 18px 16px; border: 1px solid #e0e0e0; border-top: none; border-left: none; text-align: right; vertical-align: top;">${formatGbp(lineTotalGbp)}</td>
  </tr>`;
}

export function buildInvoiceTemplateData(bill: TicketInvoiceBill): InvoiceTemplateData {
  const adminName = bill.admin
    ? `${bill.admin.firstname} ${bill.admin.lastname}`.trim()
    : 'Rex Makin';

  const lineCount = bill.lineItems.length || 1;
  const marginPerLine = bill.marginGbp / lineCount;
  const rows = bill.lineItems
    .map((item) => buildLineItemRow(item, item.unitPriceGbp + marginPerLine))
    .join('\n');

  const grandTotal = bill.ticketsSubtotalGbp + bill.marginGbp;

  return {
    invoice_number: bill.invoiceNumber,
    issue_date: formatInvoiceDate(bill.issueDate),
    due_date: formatInvoiceDate(bill.dueDate),
    amount_due: formatGbp(grandTotal),
    from_name: escapeHtml(INVOICE_FROM.name),
    from_address_html: INVOICE_FROM.addressHtml,
    from_email: escapeHtml(INVOICE_FROM.email),
    to_name: escapeHtml(INVOICE_TO.name),
    to_address_html: INVOICE_TO.addressHtml,
    client_fao: adminName,
    line_items_rows: rows,
    subtotal: formatGbp(grandTotal),
    vat_amount: formatGbp(0),
    total_due: formatGbp(grandTotal),
    footer_note: `Payment due by ${formatInvoiceDate(bill.dueDate)} &nbsp;|&nbsp; Please include ${bill.invoiceNumber} with your payment &nbsp;|&nbsp; hello@lynq.click`,
  };
}

export function fillInvoiceTemplate(template: string, data: InvoiceTemplateData): string {
  return Object.entries(data).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function getTicketPassengerName(ticket: CrewTicketApi): string {
  return getCrewName(ticket);
}
