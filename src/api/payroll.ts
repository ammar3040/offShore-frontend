import { env } from '../config/env';

/** API rate_type values */
export type PayRateType = 'per_hour' | 'per_project';

export interface PayrollRecord {
  id: string;
  crewId: string;
  projectId: string;
  rateType: PayRateType;
  payAmount: number;
  createdBy?: string;
}

export interface UpsertPayrollPayload {
  crewId: string;
  projectId: string;
  rateType: PayRateType;
  payAmount: number;
}

export interface GetPayrollRecordsResponse {
  payrolls: PayrollRecord[];
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function getErrorMessage(response: Response, text: string): string {
  let message = `Request failed (${response.status})`;
  if (!text) return message;
  try {
    const errorData = JSON.parse(text);
    return errorData?.message || errorData?.error || message;
  } catch {
    return text;
  }
}

function normalizeRateType(raw: unknown): PayRateType {
  const value = String(raw ?? '').toLowerCase();
  return value === 'per_project' ? 'per_project' : 'per_hour';
}

function normalizePayroll(raw: unknown): PayrollRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const crewId = String(r.crewId ?? r.crew_id ?? '').trim();
  const projectId = String(r.projectId ?? r.project_id ?? '').trim();
  const payAmount = Number(r.payAmount ?? r.pay_amount);
  const id = String(r.id ?? r._id ?? '').trim();
  if (!crewId || !projectId || !id || Number.isNaN(payAmount)) return null;
  return {
    id,
    crewId,
    projectId,
    rateType: normalizeRateType(r.rateType ?? r.rate_type),
    payAmount,
    createdBy: r.createdBy != null ? String(r.createdBy) : r.created_by != null ? String(r.created_by) : undefined,
  };
}

function extractPayrollList(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.payrolls)) return d.payrolls;
  if (Array.isArray(d.records)) return d.records;
  return Array.isArray(data) ? data : [];
}

function extractPayroll(data: unknown): PayrollRecord | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return normalizePayroll(d.payroll ?? d.record ?? d);
}

/** GET /payroll */
export async function getPayrollRecords(): Promise<GetPayrollRecordsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/payroll`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getErrorMessage(response, text));
  }

  const data = await response.json();
  const payrolls = extractPayrollList(data)
    .map(normalizePayroll)
    .filter((r): r is PayrollRecord => r != null);
  return { payrolls };
}

/** POST /payroll — create or update by crew + project */
export async function upsertPayrollRecord(payload: UpsertPayrollPayload): Promise<PayrollRecord> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/payroll`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      crew_id: payload.crewId,
      project_id: payload.projectId,
      rate_type: payload.rateType,
      pay_amount: payload.payAmount,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const text = await response.text();
  if (!response.ok) {
    throw new Error(getErrorMessage(response, text));
  }

  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  const record = extractPayroll(data);
  if (record) return record;

  return {
    id: '',
    crewId: payload.crewId,
    projectId: payload.projectId,
    rateType: payload.rateType,
    payAmount: payload.payAmount,
  };
}

/** DELETE /payroll/:id */
export async function deletePayrollRecord(payrollId: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/payroll/${encodeURIComponent(payrollId)}`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getErrorMessage(response, text));
  }
}

export function payRateTypeLabel(type: PayRateType): string {
  return type === 'per_project' ? 'Per Project' : 'Per Hour';
}
