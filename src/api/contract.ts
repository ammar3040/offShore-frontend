import { env } from '../config/env';

export interface SignedProjectContract {
  id: string;
  crewId: string;
  crewName: string;
  projectId: string;
  projectTitle: string;
  contractEndDate: string;
  signedAt: string;
}

export interface GetSignedContractsResponse {
  contracts: SignedProjectContract[];
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

function normalizeSignedContract(raw: Record<string, unknown>): SignedProjectContract {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    crewId: String(raw.crew_id ?? raw.crewId ?? ''),
    crewName: String(raw.crew_name ?? raw.crewName ?? ''),
    projectId: String(raw.project_id ?? raw.projectId ?? ''),
    projectTitle: String(raw.project_title ?? raw.projectTitle ?? ''),
    contractEndDate: String(raw.contract_end_date ?? raw.contractEndDate ?? ''),
    signedAt: String(raw.signed_at ?? raw.signedAt ?? ''),
  };
}

/**
 * Fetches signed project contracts (admin / superadmin).
 * GET /contracts/signed
 */
export async function getSignedContracts(): Promise<GetSignedContractsResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/contracts/signed`, {
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
    const raw = Array.isArray(data.contracts) ? data.contracts : [];
    const contracts = raw.map((item: Record<string, unknown>) => normalizeSignedContract(item));
    return { contracts };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
