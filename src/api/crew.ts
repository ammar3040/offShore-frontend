import { env } from '../config/env';
import type { CrewMemberFormData } from '../components/forms/CrewMemberForm';

/** Crew list API response and related types */
export interface CrewPassport {
  passport_number: string;
  issue_date: string;
  expiry_date: string;
  issuing_country: string;
  passport_document: string;
}

export interface CrewIdentity {
  identity_type: string;
  identity_number: string;
  issue_date: string;
  expiry_date: string;
  identity_document: string;
}

export interface CrewMemberApi {
  id: string;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  email: string;
  phone: string;
  alternate_phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  passport: CrewPassport;
  identity: CrewIdentity;
}

export interface GetCrewResponse {
  crew: CrewMemberApi[];
}

/** Crew login request payload */
export interface CrewLoginPayload {
  email: string;
  password: string;
}

/** Crew login API response */
export interface CrewLoginResponse {
  message: string;
  accessToken: string;
  crew: CrewMemberApi;
}

/**
 * Logs in a crew member. On success, stores accessToken in localStorage (crewTokenKey).
 * Caller should also call setCrewPanelUser({ email }) when redirecting to crew panel.
 */
export async function crewLogin(payload: CrewLoginPayload): Promise<CrewLoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ||
      (data as { error?: string }).error ||
      `Login failed (${response.status})`;
    throw new Error(message);
  }

  const accessToken = (data as { accessToken?: string }).accessToken;
  if (!accessToken) {
    throw new Error('Invalid response: missing access token');
  }

  localStorage.setItem(env.crewTokenKey, accessToken);
  return data as CrewLoginResponse;
}

function buildCrewFormData(data: CrewMemberFormData): FormData {
  const formData = new FormData();

  formData.append('firstname', data.firstName);
  formData.append('lastname', data.lastName);
  formData.append('dateOfBirth', data.dateOfBirth);
  formData.append('nationality', data.nationality);
  formData.append('gender', data.gender);
  formData.append('email', data.email);
  formData.append('phone', data.phone);
  formData.append('alternate_phone', data.alternatePhone);
  formData.append('address', data.address);
  formData.append('city', data.city);
  formData.append('country', data.country);
  formData.append('postal_code', data.postalCode);
  formData.append('passport_number', data.passportNumber);
  formData.append('passport_issue_date', data.passportIssueDate);
  formData.append('passport_expiry_date', data.passportExpiryDate);
  formData.append('passport_issuing_country', data.passportIssuingCountry);
  formData.append('identity_type', data.identityType);
  formData.append('identity_number', data.identityNumber);
  formData.append('identity_issue_date', data.identityIssueDate);
  formData.append('identity_expiry_date', data.identityExpiryDate);

  data.passportDocuments.forEach((file) => {
    formData.append('passport_document', file);
  });
  data.identityDocuments.forEach((file) => {
    formData.append('identity_document', file);
  });

  return formData;
}

function getAuthToken(): string | null {
  return localStorage.getItem(env.authTokenKey);
}

export async function getCrewList(): Promise<GetCrewResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew`, {
    method: 'GET',
    headers,
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

export interface CrewEnrolledProject {
  id: string;
  title: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface GetCrewEnrolledProjectsResponse {
  projects: CrewEnrolledProject[];
}

export interface CrewProjectInvitation {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  invitedAt?: string;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
}

export interface GetCrewProjectInvitationsResponse {
  invitations: CrewProjectInvitation[];
}

/**
 * Fetches pending project invitations for the logged-in crew member (requires crew token).
 * Calls GET /api/crew-invite/me/pending.
 * Returns empty array if no token or API not available.
 */
export async function getCrewProjectInvitations(): Promise<GetCrewProjectInvitationsResponse> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return { invitations: [] };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/api/crew-invite/me/pending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { invitations: [] };
    const data = await response.json();
    const raw = Array.isArray(data.invites) ? data.invites : [];
    const invitations: CrewProjectInvitation[] = raw.map((inv: Record<string, unknown>) => {
      const proj = (inv?.project_id ?? inv?.project) as Record<string, unknown> | undefined;
      const d = (proj?.duration ?? inv?.duration) as Record<string, unknown> | undefined;
      const startVal = proj?.startDate ?? (d && typeof d === 'object' && 'startDate' in d ? d.startDate : undefined);
      const endVal = proj?.endDate ?? (d && typeof d === 'object' && 'endDate' in d ? d.endDate : undefined);
      const projId = proj && typeof proj === 'object' && '_id' in proj ? proj._id : proj?.id;
      return {
        id: String(inv?.id ?? ''),
        projectId: String(projId ?? inv?.projectId ?? ''),
        title: String(proj?.title ?? inv?.title ?? ''),
        description: (proj?.description ?? inv?.description) != null ? String(proj?.description ?? inv?.description) : undefined,
        status: String(proj?.status ?? inv?.status ?? ''),
        startDate: startVal != null ? String(startVal) : undefined,
        endDate: endVal != null ? String(endVal) : undefined,
        invitedAt: inv?.createdAt != null ? String(inv.createdAt) : inv?.invitedAt != null ? String(inv.invitedAt) : undefined,
        invitationStatus: (inv?.acceptanceStatus ?? inv?.invitationStatus) as 'pending' | 'accepted' | 'declined' | undefined,
      };
    });
    return { invitations };
  } catch {
    clearTimeout(timeoutId);
    return { invitations: [] };
  }
}

/**
 * Accepts a project invitation (requires crew token).
 * POST /api/crew-invite/project/:project_id/accept
 */
export async function acceptCrewInvitation(projectId: string): Promise<void> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-invite/project/${encodeURIComponent(projectId)}/accept`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = (data as { message?: string }).message ?? (data as { error?: string }).error ?? `Failed to accept (${response.status})`;
    throw new Error(message);
  }
}

/**
 * Rejects a project invitation (requires crew token).
 * POST /api/crew-invite/project/:project_id/reject
 */
export async function rejectCrewInvitation(projectId: string): Promise<void> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-invite/project/${encodeURIComponent(projectId)}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = (data as { message?: string }).message ?? (data as { error?: string }).error ?? `Failed to reject (${response.status})`;
    throw new Error(message);
  }
}

/**
 * Fetches projects the logged-in crew member is enrolled in (requires crew token).
 * Returns empty array if no token or API not available.
 */
export async function getCrewEnrolledProjects(): Promise<GetCrewEnrolledProjectsResponse> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return { projects: [] };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/api/crew-invite/me/enrolled`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { projects: [] };
    const data = await response.json();
    const raw = Array.isArray(data.projects) ? data.projects : (Array.isArray(data) ? data : []);
    const projects: CrewEnrolledProject[] = raw.map((p: Record<string, unknown>) => {
      const d = (p?.duration as Record<string, unknown>) ?? {};
      return {
        id: String(p?.id ?? ''),
        title: String(p?.title ?? ''),
        description: p?.description != null ? String(p.description) : undefined,
        status: String(p?.status ?? ''),
        startDate: (p?.startDate != null ? String(p.startDate) : d?.startDate != null ? String(d.startDate) : undefined) || undefined,
        endDate: (p?.endDate != null ? String(p.endDate) : d?.endDate != null ? String(d.endDate) : undefined) || undefined,
      };
    });
    return { projects };
  } catch {
    clearTimeout(timeoutId);
    return { projects: [] };
  }
}

/**
 * Fetches the currently logged-in crew member (requires crew token).
 * Returns null if no token or API not available.
 */
export async function getCrewMe(): Promise<CrewMemberApi | null> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/api/crew/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return (data?.crew ?? null) as CrewMemberApi | null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function createCrewMember(data: CrewMemberFormData): Promise<Response> {
  const formData = buildCrewFormData(data);
  const token = getAuthToken();

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/api/crew`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
