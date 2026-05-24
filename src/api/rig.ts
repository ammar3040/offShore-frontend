import { env } from '../config/env';

export interface RigApi {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

type RigApiRaw = Omit<RigApi, 'id'> & {
  id?: string;
  _id?: string;
};

export interface GetRigsResponse {
  rigs: RigApi[];
}

export interface CreateRigPayload {
  name: string;
  description?: string;
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
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

function normalizeRig(row: RigApiRaw): RigApi {
  return {
    ...row,
    id: row.id ?? row._id ?? '',
  };
}

export async function getRigs(): Promise<GetRigsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/rig`, {
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
  const raw = Array.isArray(data?.rigs)
    ? data.rigs
    : Array.isArray(data?.rig)
      ? data.rig
      : Array.isArray(data)
        ? data
        : [];
  return { rigs: raw.map((rig: RigApiRaw) => normalizeRig(rig)).filter((rig: RigApi) => rig.id) };
}

export async function createRig(payload: CreateRigPayload): Promise<RigApi> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/rig`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getErrorMessage(response, text));
  }

  const data = await response.json();
  return normalizeRig(data?.rig ?? data);
}
