import { env } from '../config/env';

/** Payload for POST /visa/fetch (matches backend VevoFetchInput). */
export interface VevoFetchInput {
  fullName?: string;
  dateOfBirth: string;
  grantNumber: string;
  passportNumber: string;
  country?: string;
}

export type VisaStatus = 'Active' | 'Expired' | 'Not Found' | 'Invalid Request';

export interface VevoMetadata {
  applicantName: string;
  dateOfBirth: string;
  passportNumber: string;
  grantNumber: string;
  countryOfDocument?: string;
  visaStatus: VisaStatus;
  visaClass: string;
  visaSubclass: string;
  visaStream?: string;
  grantDate?: string | null;
  expiryDate: string | null;
  workEntitlements: string;
  visaConditions?: string;
  periodOfStay?: string;
  documentUrl?: string;
  pdfStream?: string;
  verifiedAt: string;
}

export interface VevoApiResponse {
  statusCode: number;
  success: boolean;
  message: string;
  data?: VevoMetadata;
  errors?: string[];
}

export interface VevoParseResponse {
  statusCode: number;
  success: boolean;
  message: string;
  count?: number;
  records?: VevoFetchInput[];
}

export interface VevoBatchFetchResponse {
  statusCode: number;
  success: boolean;
  message: string;
  totalProcessed?: number;
  results?: Array<{
    inputPayload: VevoFetchInput;
    httpStatusCode: number;
    vevoResponse: VevoApiResponse;
  }>;
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(`Request failed (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Unexpected non-JSON response from visa API (${response.status}). Check that the backend is running at ${env.apiBaseUrl}.`
    );
  }
}

/** POST /visa/parse — extract applicant records from raw text. */
export async function parseVisaRawText(rawText: string): Promise<VevoParseResponse> {
  const response = await fetch(`${env.apiBaseUrl}/visa/parse`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ rawText }),
  });
  const data = await readJson<VevoParseResponse>(response);
  return data;
}

/** POST /visa/fetch — single VEVO entitlement / grant document lookup. */
export async function fetchVisaDetails(input: VevoFetchInput): Promise<VevoApiResponse> {
  const response = await fetch(`${env.apiBaseUrl}/visa/fetch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await readJson<VevoApiResponse>(response);
  // Backend returns business payload even on 404/400 — prefer that over generic HTTP errors
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid visa API response (${response.status})`);
  }
  if (data.statusCode == null) {
    data.statusCode = response.status;
  }
  return data;
}

/** POST /visa/batch-fetch — parse and/or verify multiple applicants. */
export async function batchFetchVisaDetails(payload: {
  rawText?: string;
  records?: VevoFetchInput[];
}): Promise<VevoBatchFetchResponse> {
  const response = await fetch(`${env.apiBaseUrl}/visa/batch-fetch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return readJson<VevoBatchFetchResponse>(response);
}

export type VisaVerdict = 'valid' | 'expiring' | 'expired' | 'unknown';

export interface VevoExpiry {
  verdict: VisaVerdict;
  daysRemaining: number | null;
  expiryDate: string | null;
}

export interface VevoProviderStatus {
  provider: string;
  configured: boolean;
  environment: string;
  mode: string;
  baseUrl: string;
  missingSettings: string[];
}

export interface LiveCheckInput extends VevoFetchInput {
  crewId?: string;
  saveToCrew?: boolean;
  /** Echoed back untouched by the batch endpoint so callers can match results to rows. */
  clientRef?: string;
}

export interface LiveCheckResponse {
  statusCode: number;
  success: boolean;
  message: string;
  code?: string;
  provider: VevoProviderStatus;
  crewId?: string | null;
  crewUpdated?: boolean;
  checkId?: string;
  resultCode?: string;
  data?: VevoMetadata;
  expiry?: VevoExpiry;
}

export interface LiveBatchResponse {
  statusCode: number;
  success: boolean;
  message: string;
  provider: VevoProviderStatus;
  summary?: { total: number; valid: number; expiring: number; expired: number; failed: number };
  results?: Array<{
    crewId: string | null;
    crewUpdated?: boolean;
    applicant: LiveCheckInput;
    success: boolean;
    code?: string;
    message?: string;
    checkId?: string;
    resultCode?: string;
    data?: VevoMetadata;
    expiry?: VevoExpiry;
  }>;
}

/** GET /visa/provider — is the live VEVO provider configured? */
export async function getVevoProviderStatus(): Promise<VevoProviderStatus> {
  const response = await fetch(`${env.apiBaseUrl}/visa/provider`, { headers: authHeaders() });
  const data = await readJson<{ provider: VevoProviderStatus }>(response);
  return data.provider;
}

/** POST /visa/check — live VEVO check for one person. */
export async function runLiveVevoCheck(input: LiveCheckInput): Promise<LiveCheckResponse> {
  const response = await fetch(`${env.apiBaseUrl}/visa/check`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await readJson<LiveCheckResponse>(response);
  if (data.statusCode == null) data.statusCode = response.status;
  return data;
}

/** POST /visa/check-batch — live VEVO checks for many people. */
export async function runLiveVevoBatch(payload: {
  records?: LiveCheckInput[];
  crewIds?: string[];
}): Promise<LiveBatchResponse> {
  const response = await fetch(`${env.apiBaseUrl}/visa/check-batch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return readJson<LiveBatchResponse>(response);
}
