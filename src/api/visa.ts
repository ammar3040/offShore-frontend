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
  visaStatus: VisaStatus;
  visaClass: string;
  visaSubclass: string;
  expiryDate: string | null;
  workEntitlements: string;
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
