import { env } from '../config/env';

export type AdminInvoiceStatus = 'DRAFT' | 'GENERATED' | 'SENT';

export interface AdminInvoiceApi {
  id?: string;
  /** Crew ticket this invoice belongs to (primary key for upload/send/pdf). */
  ticketId: string;
  /** Project context for display; optional when populated from ticket. */
  projectId?: string;
  projectTitle?: string;
  passengerName?: string;
  invoiceNumber?: string;
  margin?: number | null;
  total?: number | null;
  pdf?: string | null;
  status?: AdminInvoiceStatus | string;
  sentAt?: string | null;
  createdAt?: string | null;
}

function getStoredTokenKey(): string {
  return env.superadminTokenKey;
}

function getHeaders(): HeadersInit {
  const token = localStorage.getItem(getStoredTokenKey());
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function getAdminHeaders(): HeadersInit {
  const token = localStorage.getItem(env.authTokenKey);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function getAdminAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(env.authTokenKey);
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function extractRefId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const id = obj.id ?? obj._id;
    if (typeof id === 'string') return id;
  }
  return '';
}

function normalizeAdminInvoice(raw: Record<string, unknown>): AdminInvoiceApi {
  const project =
    raw.project && typeof raw.project === 'object' ? (raw.project as Record<string, unknown>) : null;
  const ticketRef =
    raw.crewTicket && typeof raw.crewTicket === 'object'
      ? (raw.crewTicket as Record<string, unknown>)
      : raw.crew_ticket && typeof raw.crew_ticket === 'object'
        ? (raw.crew_ticket as Record<string, unknown>)
        : raw.ticket && typeof raw.ticket === 'object'
          ? (raw.ticket as Record<string, unknown>)
          : null;
  const crewRef =
    ticketRef?.crew_id && typeof ticketRef.crew_id === 'object'
      ? (ticketRef.crew_id as Record<string, unknown>)
      : null;

  const ticketId =
    extractRefId(raw.ticketId ?? raw.ticket_id) ||
    extractRefId(ticketRef) ||
    extractRefId(raw.projectId ?? raw.project_id);

  const projectId =
    extractRefId(raw.projectId ?? raw.project_id) ||
    extractRefId(ticketRef?.project_id ?? ticketRef?.projectId) ||
    extractRefId(project);

  const passengerFirst = typeof crewRef?.firstname === 'string' ? crewRef.firstname : '';
  const passengerLast = typeof crewRef?.lastname === 'string' ? crewRef.lastname : '';
  const passengerFromCrew = `${passengerFirst} ${passengerLast}`.trim();

  return {
    id: raw.id != null ? String(raw.id) : raw._id != null ? String(raw._id) : undefined,
    ticketId,
    projectId: projectId || undefined,
    projectTitle:
      typeof raw.projectTitle === 'string'
        ? raw.projectTitle
        : project && typeof project.title === 'string'
          ? project.title
          : ticketRef && typeof ticketRef.project_id === 'object'
            ? String((ticketRef.project_id as Record<string, unknown>).title ?? '')
            : undefined,
    passengerName:
      typeof raw.passengerName === 'string'
        ? raw.passengerName
        : passengerFromCrew || undefined,
    invoiceNumber: typeof raw.invoiceNumber === 'string' ? raw.invoiceNumber : undefined,
    margin: typeof raw.margin === 'number' ? raw.margin : raw.margin != null ? Number(raw.margin) : null,
    total: typeof raw.total === 'number' ? raw.total : raw.total != null ? Number(raw.total) : null,
    pdf: typeof raw.pdf === 'string' ? raw.pdf : null,
    status: typeof raw.status === 'string' ? (raw.status as AdminInvoiceStatus) : undefined,
    sentAt: typeof raw.sentAt === 'string' ? raw.sentAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
  };
}

/** Primary lookup key for invoice records (ticket-scoped). */
export function getAdminInvoiceKey(invoice: AdminInvoiceApi): string {
  return invoice.ticketId;
}

function getErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const msg =
    typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : typeof data?.detail === 'string'
          ? data.detail
          : Array.isArray(data?.detail)
            ? (data.detail as string[]).join('. ')
            : typeof data?.msg === 'string'
              ? data.msg
              : null;
  return msg ?? fallback;
}

/** List admin invoices - GET /superadmin/admin-invoices */
export async function getSuperadminAdminInvoices(): Promise<{ adminInvoices: AdminInvoiceApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/superadmin/admin-invoices`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text);
        msg = err?.message || err?.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const list = Array.isArray(data?.adminInvoices) ? data.adminInvoices : [];
  return {
    adminInvoices: (list as Record<string, unknown>[]).map(normalizeAdminInvoice),
  };
}

/** Upload admin invoice PDF - POST /superadmin/admin-invoice/:ticketId/upload */
export async function uploadSuperadminAdminInvoicePdf(
  ticketId: string,
  file: File,
  margin?: number
): Promise<{ adminInvoice?: AdminInvoiceApi; message?: string }> {
  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are allowed');
  }

  const formData = new FormData();
  formData.append('pdf', file);
  if (margin != null && !Number.isNaN(margin)) {
    formData.append('margin', String(margin));
  }

  const token = localStorage.getItem(getStoredTokenKey());
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/superadmin/admin-invoice/${encodeURIComponent(ticketId)}/upload`,
    {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `Request failed (${response.status})`));
  }

  const adminInvoice = data.adminInvoice
    ? normalizeAdminInvoice(data.adminInvoice as Record<string, unknown>)
    : undefined;

  return { adminInvoice, message: typeof data.message === 'string' ? data.message : undefined };
}

/** List invoices (bills) for the logged-in admin - GET /admin/admin-invoices */
export async function getAdminInvoices(): Promise<{ adminInvoices: AdminInvoiceApi[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/admin/admin-invoices`, {
    method: 'GET',
    headers: getAdminHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `Request failed (${response.status})`));
  }

  const list =
    (Array.isArray(data?.adminInvoices) && data.adminInvoices) ||
    (Array.isArray(data?.invoices) && data.invoices) ||
    (Array.isArray(data?.bills) && data.bills) ||
    (Array.isArray(data) && data) ||
    [];

  return {
    adminInvoices: (list as Record<string, unknown>[]).map(normalizeAdminInvoice),
  };
}

/** Fetch invoice PDF via authenticated backend stream (Cloudinary URLs may block direct browser access). */
export async function fetchAdminInvoicePdfBlob(ticketId: string): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/admin/admin-invoice/${encodeURIComponent(ticketId)}/pdf`,
    {
      method: 'GET',
      headers: getAdminAuthHeaders(),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let msg = `Request failed (${response.status})`;
    if (text) {
      try {
        const err = JSON.parse(text) as Record<string, unknown>;
        msg = getErrorMessage(err, msg);
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }

  return response.blob();
}

/** Send admin invoice email - POST /superadmin/admin-invoice/:ticketId/send */
export async function sendSuperadminAdminInvoice(
  ticketId: string,
  payload?: { margin?: number; invoiceNumber?: string }
): Promise<{ adminInvoice?: AdminInvoiceApi; message?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/superadmin/admin-invoice/${encodeURIComponent(ticketId)}/send`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, `Request failed (${response.status})`));
  }

  const adminInvoice = data.adminInvoice
    ? normalizeAdminInvoice(data.adminInvoice as Record<string, unknown>)
    : undefined;

  return { adminInvoice, message: typeof data.message === 'string' ? data.message : undefined };
}
