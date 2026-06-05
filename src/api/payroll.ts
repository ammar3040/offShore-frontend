import { env } from '../config/env';

/** API rate_type values */
export type PayRateType = 'per_hour' | 'per_project' | 'per_day';

const PAY_RATE_TYPES: PayRateType[] = ['per_hour', 'per_project', 'per_day'];

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
  return PAY_RATE_TYPES.includes(value as PayRateType) ? (value as PayRateType) : 'per_hour';
}

function extractRefId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.$oid === 'string') return o.$oid.trim();
    const nested = o._id ?? o.id;
    if (nested != null && nested !== value) {
      const extracted = extractRefId(nested);
      if (extracted) return extracted;
    }
    if (typeof o.id === 'string') return o.id.trim();
    if (typeof o._id === 'string') return o._id.trim();
  }
  return '';
}

function extractPayAmount(value: unknown): number {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isNaN(n) ? NaN : n;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (o.$numberDecimal != null) return extractPayAmount(o.$numberDecimal);
  }
  const n = Number(value);
  return Number.isNaN(n) ? NaN : n;
}

function normalizePayroll(raw: unknown): PayrollRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const crewId = extractRefId(r.crewId ?? r.crew_id);
  const projectId = extractRefId(r.projectId ?? r.project_id);
  const payAmount = extractPayAmount(r.payAmount ?? r.pay_amount);
  const id = extractRefId(r.id ?? r._id);
  if (!crewId || !projectId || Number.isNaN(payAmount)) return null;
  return {
    id: id || `${crewId}:${projectId}`,
    crewId,
    projectId,
    rateType: normalizeRateType(r.rateType ?? r.rate_type),
    payAmount,
    createdBy:
      r.createdBy != null
        ? extractRefId(r.createdBy) || String(r.createdBy)
        : r.created_by != null
          ? extractRefId(r.created_by) || String(r.created_by)
          : undefined,
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
  switch (type) {
    case 'per_project':
      return 'Per Project';
    case 'per_day':
      return 'Per Day';
    default:
      return 'Per Hour';
  }
}

export function payRateTypeUnitLabel(type: PayRateType): string {
  switch (type) {
    case 'per_project':
      return 'per project';
    case 'per_day':
      return 'per day';
    default:
      return 'per hour';
  }
}

export function payRateTypeBadgeClass(type: PayRateType): string {
  switch (type) {
    case 'per_project':
      return 'per-project';
    case 'per_day':
      return 'per-day';
    default:
      return '';
  }
}
