import { env } from '../config/env';
import type { RigApi } from './rig';

export interface ProjectDuration {
  startDate: string;
  endDate: string;
}

export interface ProjectApi {
  id: string;
  title: string;
  description: string;
  duration: ProjectDuration;
  span: string;
  status: string;
  createdBy: string;
  participants: string[];
  rig_id?: string | RigApi | null;
  createdAt?: string;
}

export interface GetProjectsResponse {
  projects: ProjectApi[];
}

/** Payload for creating a project (POST /project) */
export interface CreateProjectPayload {
  title: string;
  description: string;
  duration: {
    startDate: string; // YYYY-MM-DD
    endDate: string;
  };
  span: string;
  rig_id?: string;
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  console.log("🚀 ~ getHeaders ~ token:", token)
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function getProjects(): Promise<GetProjectsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/project`, {
    method: 'GET',
    headers: getHeaders(),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  const data = await response.json();
  const raw = Array.isArray(data?.projects)
    ? data.projects
    : Array.isArray(data?.project)
      ? data.project
      : Array.isArray(data)
        ? data
        : [];
  return { projects: raw.map(normalizeProject).filter((project: ProjectApi) => project.id) };
}

function normalizeProject(raw: unknown): ProjectApi {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const duration = (p.duration && typeof p.duration === 'object' ? p.duration : {}) as Record<string, unknown>;
  const participants = Array.isArray(p.participants) ? p.participants : [];
  const rig = normalizeProjectRig(p.rig_id ?? p.rigId ?? p.rig);
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
    participants: participants.map(String),
    ...(rig !== undefined ? { rig_id: rig } : {}),
    createdAt: p.createdAt != null ? String(p.createdAt) : p.created_at != null ? String(p.created_at) : undefined,
  };
}

function normalizeProjectRig(raw: unknown): ProjectApi['rig_id'] | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw !== 'object') return undefined;

  const rig = raw as Record<string, unknown>;
  return {
    id: String(rig.id ?? rig._id ?? ''),
    name: String(rig.name ?? ''),
    address: String(rig.address ?? ''),
    description: rig.description != null ? String(rig.description) : undefined,
    createdBy: rig.createdBy != null ? String(rig.createdBy) : undefined,
    createdAt: rig.createdAt != null ? String(rig.createdAt) : undefined,
    updatedAt: rig.updatedAt != null ? String(rig.updatedAt) : undefined,
  };
}

export async function getProjectById(projectId: string): Promise<ProjectApi> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/project/${encodeURIComponent(projectId)}`, {
      method: 'GET',
      headers: getHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const raw = data?.project ?? data;
      const project = normalizeProject(raw);
      if (project.id) return project;
    }
  } catch {
    clearTimeout(timeoutId);
  }

  const { projects } = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error('Project not found');
  return project;
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectApi> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/project`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const errorData = JSON.parse(text);
        message = errorData?.message || errorData?.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
}
