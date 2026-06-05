import { env } from '../config/env';
import type { ProjectApi } from './project';

export interface RigApi {
  id: string;
  name: string;
  address: string;
  description?: string;
  createdBy?: string | RigCreatedByAdmin;
  createdAt?: string;
  updatedAt?: string;
}

export interface RigCreatedByAdmin {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

type RigApiRaw = Omit<RigApi, 'id'> & {
  id?: string;
  _id?: string;
};

export interface GetRigsResponse {
  rigs: RigApi[];
}

export interface GetRigByIdResponse {
  rig: RigApi;
  projects: ProjectApi[];
}

export interface CreateRigPayload {
  name: string;
  address: string;
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
  const createdByRaw = row.createdBy;
  let createdBy: RigApi['createdBy'];
  if (createdByRaw != null && typeof createdByRaw === 'object') {
    const admin = createdByRaw as unknown as Record<string, unknown>;
    createdBy = {
      id: String(admin.id ?? admin._id ?? ''),
      firstname: String(admin.firstname ?? ''),
      lastname: String(admin.lastname ?? ''),
      email: String(admin.email ?? ''),
    };
  } else if (createdByRaw != null) {
    createdBy = String(createdByRaw);
  }

  return {
    ...row,
    id: row.id ?? row._id ?? '',
    ...(createdBy !== undefined ? { createdBy } : {}),
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined,
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

function normalizeRigProject(raw: unknown): ProjectApi {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const duration = (p.duration && typeof p.duration === 'object' ? p.duration : {}) as Record<string, unknown>;
  const participants = Array.isArray(p.participants) ? p.participants : [];
  return {
    id: String(p.id ?? p._id ?? ''),
    title: String(p.title ?? ''),
    description: String(p.description ?? ''),
    duration: {
      startDate: String(duration.startDate ?? duration.start_date ?? ''),
      endDate: String(duration.endDate ?? duration.end_date ?? ''),
    },
    span: String(p.span ?? ''),
    status: String(p.status ?? ''),
    createdBy: String(p.createdBy ?? p.created_by ?? ''),
    participants: participants.map((item) => {
      if (item && typeof item === 'object') {
        const crew = item as Record<string, unknown>;
        return String(crew.id ?? crew._id ?? '');
      }
      return String(item);
    }),
    createdAt: p.createdAt != null ? String(p.createdAt) : p.created_at != null ? String(p.created_at) : undefined,
  };
}

export async function getRigById(rigId: string): Promise<GetRigByIdResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/rig/${encodeURIComponent(rigId)}`, {
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
  const rawProjects = Array.isArray(data?.projects) ? data.projects : [];
  return {
    rig: normalizeRig(data?.rig ?? data),
    projects: rawProjects.map(normalizeRigProject).filter((project: ProjectApi) => project.id),
  };
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
