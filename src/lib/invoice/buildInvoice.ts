import type { AdminApi } from '../../api/superadmin';
import type { ProjectApi } from '../../api/project';
import type { CrewTicketApi } from '../../api/ticket';
import { getTicketStatus } from '../../api/ticket';
import { escapeHtml, formatGbp, formatInvoiceDate, formatTripLabel } from './format';
import type { InvoiceLineItem, InvoiceTemplateData, ProjectInvoiceBill } from './types';

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

function getDepartureLabel(ticket: CrewTicketApi): string {
  const created = ticket.createdAt ?? ticket.approvedAt;
  if (!created) return 'Departure: —';
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return 'Departure: —';
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

function buildInvoiceNumber(project: ProjectApi, index: number): string {
  const suffix = project.id.slice(-4).toUpperCase();
  return `INV-${String(index + 1).padStart(3, '0')}-${suffix}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildProjectInvoiceBills(
  projects: ProjectApi[],
  tickets: CrewTicketApi[],
  admins: AdminApi[],
  marginsByProject: Record<string, number> = {}
): ProjectInvoiceBill[] {
  const adminById = new Map(admins.map((admin) => [admin.id, admin]));
  const approvedTickets = tickets.filter((ticket) => getTicketStatus(ticket) === 'APPROVED');

  return projects
    .map((project, index) => {
      const projectTickets = approvedTickets.filter((ticket) => {
        const pid = ticket.project_id?._id ?? (ticket.project_id as { id?: string })?.id ?? '';
        return pid === project.id;
      });

      if (projectTickets.length === 0) return null;

      const lineItems = projectTickets.map((ticket) => buildLineItem(project.title, ticket));
      const ticketsSubtotalGbp = lineItems.reduce((sum, item) => sum + item.amountGbp, 0);
      const marginGbp = Math.max(0, Number(marginsByProject[project.id] ?? 0));
      const totalGbp = ticketsSubtotalGbp + marginGbp;
      const issueDate = new Date();
      const admin = adminById.get(project.createdBy) ?? null;

      return {
        project,
        admin,
        tickets: projectTickets,
        lineItems,
        ticketsSubtotalGbp,
        marginGbp,
        totalGbp,
        invoiceNumber: buildInvoiceNumber(project, index),
        issueDate,
        dueDate: addDays(issueDate, 1),
      } satisfies ProjectInvoiceBill;
    })
    .filter((bill): bill is ProjectInvoiceBill => bill != null);
}

function buildLineItemRow(item: InvoiceLineItem, amountGbp: number): string {
  const description = [
    `<strong>${escapeHtml(item.projectTitle)}</strong>`,
    `Passenger: ${escapeHtml(item.passengerName)}`,
    escapeHtml(item.routeLabel),
    escapeHtml(item.departureLabel),
    escapeHtml(item.tripLabel),
  ].join('<br/>');

  return `<tr>
    <td style="font-size: 13px; color: #111111; padding: 16px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">${description}</td>
    <td style="font-size: 13px; color: #333333; padding: 16px 14px; border-bottom: 1px solid #f0f0f0; text-align: center; vertical-align: top;">${item.qty}</td>
    <td style="font-size: 13px; color: #333333; padding: 16px 14px; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top;">${formatGbp(item.unitPriceGbp)}</td>
    <td style="font-size: 13px; color: #333333; padding: 16px 14px; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top;">${formatGbp(amountGbp)}</td>
  </tr>`;
}

function buildClientAddressHtml(admin: AdminApi | null): string {
  if (!admin) return 'United Kingdom';
  const lines = [admin.email].filter(Boolean);
  if (lines.length === 0) return 'United Kingdom';
  return lines.map((line) => escapeHtml(line)).join('<br/>');
}

export function buildInvoiceTemplateData(bill: ProjectInvoiceBill): InvoiceTemplateData {
  const adminName = bill.admin
    ? `${bill.admin.firstname} ${bill.admin.lastname}`.trim()
    : 'Account Administrator';

  // Margin is folded into the Amount column: amount = unit price + margin share.
  // With no margin, amount stays equal to the unit price.
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
    client_company_name: bill.admin ? `${bill.admin.firstname} ${bill.admin.lastname}`.trim() : bill.project.title,
    client_address_html: buildClientAddressHtml(bill.admin),
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
