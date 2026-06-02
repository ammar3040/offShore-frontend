import { env } from '../config/env';

export type PayRateType = 'PER_HOUR' | 'PER_PROJECT';

export interface PayrollRecord {
  id: string;
  crewId: string;
  projectId: string;
  payRateType: PayRateType;
  payAmount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertPayrollPayload {
  crewId: string;
  projectId: string;
  payRateType: PayRateType;
  payAmount: number;
}

export interface GetPayrollRecordsResponse {
  records: PayrollRecord[];
}

const STORAGE_KEY = 'offshore-payroll-records';

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function readLocalRecords(): PayrollRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(records: PayrollRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeRecord(raw: unknown): PayrollRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const crewId = String(r.crewId ?? r.crew_id ?? '').trim();
  const projectId = String(r.projectId ?? r.project_id ?? '').trim();
  const payRateType = (r.payRateType ?? r.pay_rate_type) as PayRateType;
  const payAmount = Number(r.payAmount ?? r.pay_amount);
  if (!crewId || !projectId || !payRateType || Number.isNaN(payAmount)) return null;
  return {
    id: String(r.id ?? `${crewId}:${projectId}`),
    crewId,
    projectId,
    payRateType: payRateType === 'PER_PROJECT' ? 'PER_PROJECT' : 'PER_HOUR',
    payAmount,
    createdAt: r.createdAt != null ? String(r.createdAt) : r.created_at != null ? String(r.created_at) : undefined,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

function upsertLocalRecord(payload: UpsertPayrollPayload): PayrollRecord {
  const records = readLocalRecords();
  const existingIndex = records.findIndex(
    (r) => r.crewId === payload.crewId && r.projectId === payload.projectId
  );
  const now = new Date().toISOString();
  const next: PayrollRecord = {
    id: existingIndex >= 0 ? records[existingIndex]!.id : crypto.randomUUID(),
    crewId: payload.crewId,
    projectId: payload.projectId,
    payRateType: payload.payRateType,
    payAmount: payload.payAmount,
    createdAt: existingIndex >= 0 ? records[existingIndex]!.createdAt : now,
    updatedAt: now,
  };
  if (existingIndex >= 0) {
    records[existingIndex] = next;
  } else {
    records.push(next);
  }
  writeLocalRecords(records);
  return next;
}

/**
 * Fetches payroll records. Uses GET /payroll when available; falls back to local storage.
 */
export async function getPayrollRecords(): Promise<GetPayrollRecordsResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/payroll`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const raw = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];
      const records = raw
        .map(normalizeRecord)
        .filter((r: PayrollRecord | null): r is PayrollRecord => r != null);
      writeLocalRecords(records);
      return { records };
    }
  } catch {
    clearTimeout(timeoutId);
  }

  return { records: readLocalRecords() };
}

/**
 * Creates or updates pay for a crew member on a project.
 * POST /payroll when available; falls back to local storage.
 */
export async function upsertPayrollRecord(payload: UpsertPayrollPayload): Promise<PayrollRecord> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/payroll`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        crewId: payload.crewId,
        projectId: payload.projectId,
        payRateType: payload.payRateType,
        payAmount: payload.payAmount,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const record = normalizeRecord(data?.record ?? data);
      if (record) {
        const records = readLocalRecords();
        const idx = records.findIndex(
          (r) => r.crewId === record.crewId && r.projectId === record.projectId
        );
        if (idx >= 0) records[idx] = record;
        else records.push(record);
        writeLocalRecords(records);
        return record;
      }
    }
  } catch {
    clearTimeout(timeoutId);
  }

  return upsertLocalRecord(payload);
}

export function payRateTypeLabel(type: PayRateType): string {
  return type === 'PER_HOUR' ? 'Per Hour' : 'Per Project';
}
