import type { CrewMemberApi } from '../../api/crew';
import type { CrewTicketApi } from '../../api/ticket';
import type { AdminApi } from '../../api/superadmin';
import type { ProjectApi } from '../../api/project';

export interface InvoiceLineItem {
  projectTitle: string;
  passengerName: string;
  routeLabel: string;
  departureLabel: string;
  tripLabel: string;
  qty: number;
  unitPriceGbp: number;
  amountGbp: number;
}

export interface ProjectInvoiceBill {
  project: ProjectApi;
  admin: AdminApi | null;
  tickets: CrewTicketApi[];
  lineItems: InvoiceLineItem[];
  ticketsSubtotalGbp: number;
  marginGbp: number;
  totalGbp: number;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  crewById?: Record<string, CrewMemberApi>;
}

export interface InvoiceTemplateData {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount_due: string;
  from_name: string;
  from_address_html: string;
  from_email: string;
  to_name: string;
  to_address_html: string;
  client_fao: string;
  line_items_rows: string;
  subtotal: string;
  vat_amount: string;
  total_due: string;
  footer_note: string;
  logo_src?: string;
}
