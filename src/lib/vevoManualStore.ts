import type { VevoFetchInput } from '../api/visa';

export type ManualVevoStatus = 'In Effect' | 'Expired' | 'Not Found' | 'Other';

export interface ManualVevoResult {
  visaStatus: ManualVevoStatus;
  visaClass: string;
  visaSubclass: string;
  visaStream: string;
  grantDate: string;
  expiryDate: string;
  workEntitlements: string;
  visaConditions: string;
  periodOfStay: string;
  notes: string;
  verifiedAt: string;
}

export interface ManualVevoRecord {
  id: string;
  applicant: VevoFetchInput;
  result?: ManualVevoResult;
  crewId?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'offshore_vevo_manual_verifications_v1';

function readAll(): ManualVevoRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManualVevoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: ManualVevoRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listManualVevoRecords(): ManualVevoRecord[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertManualVevoRecord(
  applicant: VevoFetchInput,
  result?: ManualVevoResult,
  crewId?: string,
  existingId?: string
): ManualVevoRecord {
  const now = new Date().toISOString();
  const all = readAll();
  const id =
    existingId ||
    `${applicant.grantNumber || 'grant'}-${applicant.passportNumber || 'pass'}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  const idx = all.findIndex((r) => r.id === id);
  const next: ManualVevoRecord = {
    id,
    applicant: {
      fullName: applicant.fullName?.trim() || '',
      dateOfBirth: applicant.dateOfBirth.trim(),
      grantNumber: applicant.grantNumber.trim(),
      passportNumber: applicant.passportNumber.trim(),
      country: (applicant.country || 'GBR').trim().toUpperCase(),
    },
    result,
    crewId,
    createdAt: idx >= 0 ? all[idx]!.createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  return next;
}

export function deleteManualVevoRecord(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Two-digit years are read as past dates, since these are dates of birth. */
function expandYear(year: number): number {
  if (year > 999) return year;
  const pivot = new Date().getFullYear() % 100;
  return year > pivot ? 1900 + year : 2000 + year;
}

/** Accepts 1984-03-14, 14/03/1984, 14 Mar 84, 14 March 1984. */
export function normalizeVevoDate(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`;

  const named = raw.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s-]+(\d{2}|\d{4})$/);
  if (named) {
    const month = MONTH_NAMES[named[2]!.slice(0, 4).toLowerCase()] ?? MONTH_NAMES[named[2]!.slice(0, 3).toLowerCase()];
    if (month) return `${expandYear(Number(named[3]))}-${pad2(month)}-${pad2(Number(named[1]))}`;
  }

  const numeric = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
  if (numeric) {
    return `${expandYear(Number(numeric[3]))}-${pad2(Number(numeric[2]))}-${pad2(Number(numeric[1]))}`;
  }

  return '';
}

export interface ParsedBulkLine {
  lineNumber: number;
  raw: string;
  applicant?: VevoFetchInput;
  error?: string;
}

const KNOWN_COUNTRIES = ['GBR', 'AUS', 'USA', 'NZL', 'CAN', 'IRL', 'IND', 'PHL'];

const DATE_PATTERN = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\s-]+[A-Za-z]{3,9}\.?[\s-]+\d{2,4}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/;

function parseBulkLine(raw: string, lineNumber: number): ParsedBulkLine {
  let rest = raw;
  const take = (pattern: RegExp): string => {
    const match = rest.match(pattern);
    if (!match) return '';
    rest = rest.replace(match[0], ' ');
    return (match[1] ?? '').trim();
  };

  let grantNumber = take(/grant(?:\s*(?:no|number))?\.?\s*:?-?\s*([0-9]{6,})/i);
  let passportNumber = take(/passport(?:\s*(?:no|number))?\.?\s*:?-?\s*([A-Za-z0-9]{5,})/i);
  let dateOfBirth = normalizeVevoDate(take(new RegExp(`(?:dob\\s*:?-?\\s*)?${DATE_PATTERN.source}`, 'i')));
  let country = take(new RegExp(`\\b(${KNOWN_COUNTRIES.join('|')})\\b`, 'i')).toUpperCase();
  let fullName = rest.replace(/[,;|\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Positional fallback for delimited rows: name, dob, grant, passport, country
  if (!grantNumber || !passportNumber || !dateOfBirth) {
    const columns = raw.split(/[,;|\t]/).map((part) => part.trim()).filter(Boolean);
    if (columns.length >= 4) {
      fullName = columns[0]!;
      dateOfBirth = dateOfBirth || normalizeVevoDate(columns[1]!);
      grantNumber = grantNumber || columns[2]!.replace(/\D/g, '');
      passportNumber = passportNumber || columns[3]!.replace(/[^A-Za-z0-9]/g, '');
      country = country || (columns[4] ?? '').trim().toUpperCase();
    }
  }

  const missing: string[] = [];
  if (!dateOfBirth) missing.push('date of birth');
  if (!grantNumber) missing.push('grant number');
  if (!passportNumber) missing.push('passport number');
  if (missing.length) {
    return { lineNumber, raw, error: `Missing ${missing.join(', ')}` };
  }

  return {
    lineNumber,
    raw,
    applicant: {
      fullName,
      dateOfBirth,
      grantNumber,
      passportNumber: passportNumber.toUpperCase(),
      country: country || 'GBR',
    },
  };
}

export function parseBulkApplicants(text: string): ParsedBulkLine[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith('#'))
    .map(({ line, index }) => parseBulkLine(line.trim(), index + 1));
}

function applicantKey(applicant: VevoFetchInput): string {
  return `${applicant.grantNumber.trim()}|${applicant.passportNumber.trim().toUpperCase()}`;
}

export function addManualVevoRecords(
  applicants: Array<{ applicant: VevoFetchInput; crewId?: string }>
): { added: number; skipped: number } {
  const existing = new Set(readAll().map((record) => applicantKey(record.applicant)));
  let added = 0;
  let skipped = 0;

  applicants.forEach(({ applicant, crewId }) => {
    const key = applicantKey(applicant);
    if (existing.has(key)) {
      skipped += 1;
      return;
    }
    existing.add(key);
    upsertManualVevoRecord(applicant, undefined, crewId);
    added += 1;
  });

  return { added, skipped };
}

export function copyApplicantForVevo(applicant: VevoFetchInput): string {
  return [
    `Document type: Passport`,
    `Reference type: Visa Grant Number`,
    `Visa Grant Number: ${applicant.grantNumber}`,
    `Date of Birth: ${applicant.dateOfBirth}`,
    `Document number (Passport): ${applicant.passportNumber}`,
    `Country of document: ${applicant.country === 'GBR' ? 'UNITED KINGDOM - BRITISH CITIZEN' : applicant.country || 'GBR'}`,
  ].join('\n');
}
