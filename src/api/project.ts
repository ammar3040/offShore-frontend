import { env } from '../config/env';

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

  return response.json();
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
