import { env } from '../config/env';

export type AdminInvoiceStatus = 'DRAFT' | 'GENERATED' | 'SENT';

export interface AdminInvoiceApi {
  id?: string;
  projectId: string;
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
  return { adminInvoices: Array.isArray(data?.adminInvoices) ? data.adminInvoices : [] };
}

/** Upload admin invoice PDF - POST /superadmin/admin-invoice/:projectId/upload */
export async function uploadSuperadminAdminInvoicePdf(
  projectId: string,
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
    `${env.apiBaseUrl}/superadmin/admin-invoice/${encodeURIComponent(projectId)}/upload`,
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

  return data as { adminInvoice?: AdminInvoiceApi; message?: string };
}

/** Send admin invoice email - POST /superadmin/admin-invoice/:projectId/send */
export async function sendSuperadminAdminInvoice(
  projectId: string,
  payload?: { margin?: number; invoiceNumber?: string }
): Promise<{ adminInvoice?: AdminInvoiceApi; message?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/superadmin/admin-invoice/${encodeURIComponent(projectId)}/send`,
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

  return data as { adminInvoice?: AdminInvoiceApi; message?: string };
}
