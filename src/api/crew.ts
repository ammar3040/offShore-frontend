import { env } from '../config/env';
import type { CrewMemberFormData } from '../components/forms/CrewMemberForm';

/** Single certificate from API (array or legacy single object) */
type CrewCertApi = { certificate_name?: string; issue_date?: string; expiry_date?: string; certificate_document?: string };

/** Converts crew API response to CrewMemberFormData for edit form pre-fill. Handles both camelCase and snake_case. */
export function crewApiToFormData(crew: CrewMemberApi): CrewMemberFormData {
  const raw = crew as Record<string, unknown> & CrewMemberApi;
  const p = crew.passport ?? raw.passport;
  const i = crew.identity ?? raw.identity;
  const passport = typeof p === 'object' && p !== null ? (p as unknown as Record<string, unknown>) : {};
  const identity = typeof i === 'object' && i !== null ? (i as unknown as Record<string, unknown>) : {};
  const certRaw = raw.crew_certificate;
  const certs: CrewCertApi[] = Array.isArray(certRaw)
    ? certRaw
    : certRaw && typeof certRaw === 'object'
      ? [certRaw as CrewCertApi]
      : [];

  const certificates = certs.length > 0
    ? certs.map((c) => ({
        certificateName: String(c.certificate_name ?? 'Certificate').trim(),
        issueDate: String(c.issue_date ?? '').trim(),
        expiryDate: String(c.expiry_date ?? '').trim(),
        document: null as File | null,
      }))
    : [{ certificateName: '', issueDate: '', expiryDate: '', document: null }];

  return {
    firstName: String(crew.firstname ?? raw.firstname ?? '').trim(),
    lastName: String(crew.lastname ?? raw.lastname ?? '').trim(),
    dateOfBirth: String(crew.dateOfBirth ?? raw.date_of_birth ?? '').trim(),
    nationality: String(crew.nationality ?? raw.nationality ?? '').trim(),
    gender: String(crew.gender ?? raw.gender ?? '').trim(),
    email: String(crew.email ?? raw.email ?? '').trim(),
    phone: String(crew.phone ?? raw.phone ?? '').trim(),
    alternatePhone: String(crew.alternate_phone ?? raw.alternate_phone ?? '').trim(),
    address: String(crew.address ?? raw.address ?? '').trim(),
    city: String(crew.city ?? raw.city ?? '').trim(),
    country: String(crew.country ?? raw.country ?? '').trim(),
    postalCode: String(crew.postal_code ?? raw.postal_code ?? '').trim(),
    passportNumber: String(passport.passport_number ?? '').trim(),
    passportIssueDate: String(passport.issue_date ?? '').trim(),
    passportExpiryDate: String(passport.expiry_date ?? '').trim(),
    passportIssuingCountry: String(passport.issuing_country ?? '').trim(),
    passportDocuments: [],
    identityType: String(identity.identity_type ?? '').trim(),
    identityNumber: String(identity.identity_number ?? '').trim(),
    identityIssueDate: String(identity.issue_date ?? '').trim(),
    identityExpiryDate: String(identity.expiry_date ?? '').trim(),
    identityDocuments: [],
    certificates,
    azerbaijanVantageNumber: String(crew.azerbaijan_vantage_number ?? raw.azerbaijan_vantage_number ?? '').trim(),
    norwegianDNumber: String(crew.norwegian_d_number ?? raw.norwegian_d_number ?? '').trim(),
    dawinciNumber: String(crew.dawinci_number ?? raw.dawinci_number ?? '').trim(),
    vantageNumber: String(crew.vantage_number ?? raw.vantage_number ?? '').trim(),
    organization: String(crew.organization ?? raw.organization ?? '').trim(),
    linkedin: String(crew.linkedin ?? raw.linkedin ?? '').trim(),
    visa: String(crew.visa ?? raw.visa ?? '').trim(),
  };
}

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
  passport?: CrewPassport | null;
  identity?: CrewIdentity | null;
  /** Optional fields the API may return */
  azerbaijan_vantage_number?: string;
  norwegian_d_number?: string;
  dawinci_number?: string;
  vantage_number?: string;
  organization?: string;
  linkedin?: string;
  visa?: string;
  certificate_issue_date?: string;
  certificate_expiry_date?: string;
  crew_certificate?: { issue_date?: string; expiry_date?: string };
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

/** Payload to change crew password (requires current password) */
export interface CrewChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Resets the logged-in crew member's password (requires crew token).
 * PATCH /api/crew/reset-password
 */
export async function crewChangePassword(payload: CrewChangePasswordPayload): Promise<void> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew/reset-password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      oldPassword: payload.oldPassword,
      newPassword: payload.newPassword,
      confirmPassword: payload.confirmPassword,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      `Failed to change password (${response.status})`;
    throw new Error(message);
  }
}

/**
 * Requests a password reset link for crew (by email). No auth required.
 * POST /api/crew/forgot-password
 */
export async function crewForgotPassword(email: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      `Request failed (${response.status})`;
    throw new Error(message);
  }
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

  const validCerts = data.certificates.filter(
    (c) => c.certificateName?.trim() && c.issueDate && c.expiryDate && c.document
  );
  if (validCerts.length === 1) {
    const cert = validCerts[0]!;
    formData.append('certificate_name', cert.certificateName.trim());
    formData.append('certificate_issue_date', cert.issueDate);
    formData.append('certificate_expiry_date', cert.expiryDate);
    formData.append('certificate_document', cert.document!);
  } else if (validCerts.length > 1) {
    formData.append(
      'certificates',
      JSON.stringify(
        validCerts.map((c) => ({
          certificate_name: c.certificateName.trim(),
          issue_date: c.issueDate,
          expiry_date: c.expiryDate,
        }))
      )
    );
    validCerts.forEach((c) => formData.append('certificate_document', c.document!));
  }

  if (data.azerbaijanVantageNumber?.trim()) {
    formData.append('azerbaijan_vantage_number', data.azerbaijanVantageNumber.trim());
  }
  if (data.norwegianDNumber?.trim()) {
    formData.append('norwegian_d_number', data.norwegianDNumber.trim());
  }
  if (data.dawinciNumber?.trim()) {
    formData.append('dawinci_number', data.dawinciNumber.trim());
  }
  if (data.vantageNumber?.trim()) {
    formData.append('vantage_number', data.vantageNumber.trim());
  }
  if (data.organization?.trim()) {
    formData.append('organization', data.organization.trim());
  }
  if (data.linkedin?.trim()) {
    formData.append('linkedin', data.linkedin.trim());
  }
  if (data.visa?.trim()) {
    formData.append('visa', data.visa.trim());
  }

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

/** Project from GET /api/crew/:crew_id response (assigned projects) */
export interface CrewAssignedProject {
  id: string;
  title: string;
  description?: string;
  duration?: { startDate?: string; endDate?: string };
  span?: string;
  status?: string;
  participants?: unknown[];
}

/** Response from GET /api/crew/:crew_id - crew details and assigned projects */
export interface GetCrewByIdResponse {
  crew: CrewMemberApi;
  projects: CrewAssignedProject[];
}

/**
 * Fetches a crew member by ID with their assigned projects (admin).
 * GET /api/crew/:crew_id
 */
export async function getCrewById(crewId: string): Promise<GetCrewByIdResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew/${encodeURIComponent(crewId)}`, {
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

  const data = await response.json();
  const crewData = data?.crew ?? data;
  const projectsList = Array.isArray(data?.projects) ? data.projects : [];
  return { crew: crewData, projects: projectsList };
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

/**
 * Fetches crews whose availability aligns with the project's duration.
 * GET /api/crew/project/:project_id/available
 * Requires admin auth token.
 */
export async function getCrewAvailableForProject(projectId: string): Promise<GetCrewResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/api/crew/project/${encodeURIComponent(projectId)}/available`,
    {
      method: 'GET',
      headers,
      signal: controller.signal,
    }
  );
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
  const crewList = Array.isArray(data?.crew) ? data.crew : (Array.isArray(data) ? data : []);
  return { crew: crewList };
}

/**
 * Fetches crew members enrolled/accepted in a project (admin).
 * GET /api/project/:project_id/crew
 * Falls back to empty array if endpoint not available.
 */
export async function getCrewEnrolledInProject(projectId: string): Promise<GetCrewResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(
      `${env.apiBaseUrl}/api/project/${encodeURIComponent(projectId)}/crew`,
      { method: 'GET', headers, signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return { crew: [] };
    const data = await response.json();
    const crewList = Array.isArray(data?.crew) ? data.crew : (Array.isArray(data) ? data : []);
    return { crew: crewList };
  } catch {
    clearTimeout(timeoutId);
    return { crew: [] };
  }
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

/** Single timesheet entry from GET /api/timesheet/me/project/:project_id */
export interface CrewTimesheetEntry {
  date: string; // ISO date or datetime
  status: string; // e.g. "PRESENT" | "ABSENT" | "LEAVE"
}

/** Project duration nested in timesheet response */
export interface CrewTimesheetProjectDuration {
  startDate: string;
  endDate: string;
}

/** Project nested in timesheet response */
export interface CrewTimesheetProjectRef {
  _id: string;
  title?: string;
  duration?: CrewTimesheetProjectDuration;
}

/** Full timesheet response for one project */
export interface CrewTimesheetResponse {
  id: string;
  crew_id?: unknown;
  project_id?: CrewTimesheetProjectRef;
  entries: CrewTimesheetEntry[];
}

export interface GetCrewTimesheetForProjectResponse {
  timesheet: CrewTimesheetResponse;
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
 * Fetches timesheet for the logged-in crew member for a specific project.
 * GET /api/timesheet/me/project/:project_id
 * Returns null if no token, 404, or API error.
 */
export async function getCrewTimesheetForProject(projectId: string): Promise<GetCrewTimesheetForProjectResponse | null> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(
      `${env.apiBaseUrl}/api/timesheet/me/project/${encodeURIComponent(projectId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    const raw = data?.timesheet ?? data;
    if (!raw || typeof raw !== 'object') return null;
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    const projectIdRef = raw.project_id && typeof raw.project_id === 'object' ? raw.project_id : undefined;
    return {
      timesheet: {
        id: String(raw.id ?? ''),
        crew_id: raw.crew_id,
        project_id: projectIdRef,
        entries: entries.map((e: Record<string, unknown>) => ({
          date: String(e?.date ?? ''),
          status: String(e?.status ?? ''),
        })),
      },
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/** Payload to mark/update attendance for a single date */
export interface UpdateCrewTimesheetEntryPayload {
  date: string; // "YYYY-MM-DD"
  status: string; // "PRESENT" | "ABSENT" | "LEAVE"
}

/** Response from PATCH/POST timesheet entry */
export interface UpdateCrewTimesheetEntryResponse {
  message: string;
  timesheet: CrewTimesheetResponse;
}

/**
 * Marks attendance for a specific date on a project timesheet.
 * POST (or PATCH) /api/timesheet/me/project/:project_id/entry
 * Body: { date: "YYYY-MM-DD", status: "PRESENT" | "ABSENT" | "LEAVE" }
 */
export async function updateCrewTimesheetEntry(
  projectId: string,
  payload: UpdateCrewTimesheetEntryPayload
): Promise<GetCrewTimesheetForProjectResponse> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/api/timesheet/me/project/${encodeURIComponent(projectId)}/entry`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: payload.date,
        status: payload.status.toUpperCase(),
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      `Failed to update attendance (${response.status})`;
    throw new Error(message);
  }

  const raw = data?.timesheet ?? data;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid response: missing timesheet');
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const projectIdRef = raw.project_id && typeof raw.project_id === 'object' ? raw.project_id : undefined;
  return {
    timesheet: {
      id: String(raw.id ?? ''),
      crew_id: raw.crew_id,
      project_id: projectIdRef,
      entries: entries.map((e: Record<string, unknown>) => ({
        date: String(e?.date ?? ''),
        status: String(e?.status ?? ''),
      })),
    },
  };
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

/** Raw availability item from GET /api/crew/me (availability array) */
export interface CrewAvailabilityItem {
  id: string;
  from: string;
  to: string;
}

/** Response from GET /api/crew/me when used for dashboard (crew + availability + enrolledProjects) */
export interface CrewMeDashboardResponse {
  crew: CrewMemberApi | null;
  availability: CrewAvailability;
  enrolledProjects: CrewEnrolledProject[];
}

/**
 * Fetches dashboard data for the logged-in crew: profile, availability, and enrolled projects.
 * Single GET /api/crew/me call returning { crew, availability[], enrolledProjects[] }.
 */
export async function getCrewMeDashboard(): Promise<CrewMeDashboardResponse> {
  const token = localStorage.getItem(env.crewTokenKey);
  const empty: CrewMeDashboardResponse = {
    crew: null,
    availability: { availableFrom: null, availableTo: null },
    enrolledProjects: [],
  };
  if (!token) return empty;

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
    if (!response.ok) return empty;
    const data = await response.json();

    const crew = (data?.crew ?? null) as CrewMemberApi | null;

    const availList = Array.isArray(data?.availability) ? data.availability : [];
    const first = availList[0];
    const availability: CrewAvailability = {
      availableFrom: first?.from != null ? String(first.from) : null,
      availableTo: first?.to != null ? String(first.to) : null,
    };

    const rawProjects = Array.isArray(data?.enrolledProjects) ? data.enrolledProjects : [];
    const enrolledProjects: CrewEnrolledProject[] = rawProjects.map((p: Record<string, unknown>) => {
      const d = (p?.duration as Record<string, unknown>) ?? {};
      return {
        id: String(p?.id ?? ''),
        title: String(p?.title ?? ''),
        description: p?.description != null ? String(p.description) : undefined,
        status: String(p?.status ?? ''),
        startDate: (d?.startDate != null ? String(d.startDate) : undefined) || undefined,
        endDate: (d?.endDate != null ? String(d.endDate) : undefined) || undefined,
      };
    });

    return { crew, availability, enrolledProjects };
  } catch {
    clearTimeout(timeoutId);
    return empty;
  }
}

/** Crew availability (signed-in crew): from date – to date */
export interface CrewAvailability {
  availableFrom: string | null;
  availableTo: string | null;
}

/**
 * Fetches the logged-in crew member's availability (requires crew token).
 * GET /api/crew-availability — returns { availabilities: [ { id, crew_id, from, to }, ... ] }.
 * Uses the first item in the array. Pass crew_id in req.query when available.
 */
export async function getCrewAvailability(options?: { crewId?: string }): Promise<CrewAvailability> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) return { availableFrom: null, availableTo: null };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const query = new URLSearchParams();
  if (options?.crewId) query.set('crew_id', options.crewId);
  const queryString = query.toString();
  const url = `${env.apiBaseUrl}/api/crew-availability${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { availableFrom: null, availableTo: null };
    const data = await response.json();
    // API returns { availabilities: [ { id, crew_id, from, to }, ... ] }
    const list = Array.isArray(data?.availabilities) ? data.availabilities : [];
    const first = list[0];
    const from = first?.from ?? null;
    const to = first?.to ?? null;
    return {
      availableFrom: from != null ? String(from) : null,
      availableTo: to != null ? String(to) : null,
    };
  } catch {
    clearTimeout(timeoutId);
    return { availableFrom: null, availableTo: null };
  }
}

/**
 * Adds/updates the logged-in crew member's availability (requires crew token).
 * POST /api/crew-availability
 * Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
 * Response: { message, availability: { id, crew_id, from, to } }
 */
export async function updateCrewAvailability(payload: {
  availableFrom: string;
  availableTo: string;
}): Promise<CrewAvailability> {
  const token = localStorage.getItem(env.crewTokenKey);
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      from: payload.availableFrom,
      to: payload.availableTo,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      `Failed to update availability (${response.status})`;
    throw new Error(message);
  }

  const avail = (data as { availability?: { from?: string; to?: string } }).availability;
  const from = avail?.from ?? payload.availableFrom;
  const to = avail?.to ?? payload.availableTo;
  return {
    availableFrom: from != null ? String(from) : null,
    availableTo: to != null ? String(to) : null,
  };
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

/**
 * Updates a crew member. PATCH /api/crew/:id
 */
export async function updateCrewMember(id: string, data: CrewMemberFormData): Promise<Response> {
  const formData = buildCrewFormData(data);
  const token = getAuthToken();

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  try {
    const response = await fetch(`${env.apiBaseUrl}/api/crew/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: formData,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deletes a crew member. DELETE /api/crew/:id
 */
export async function deleteCrewMember(id: string): Promise<void> {
  const token = getAuthToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(`${env.apiBaseUrl}/api/crew/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const j = JSON.parse(text);
        message = (j?.message ?? j?.error) || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
}

/** Response from inviting crew to a project (POST /api/crew-invite/project/:project_id) */
export interface CrewInviteToProjectItem {
  id: string;
  crew_id: string;
  project_id: string;
  acceptanceStatus: 'pending' | 'accepted' | 'declined';
}

export interface InviteCrewToProjectResponse {
  message: string;
  invites: CrewInviteToProjectItem[];
}

/**
 * Invites crew members to a project (admin). Requires admin auth token.
 * POST /api/crew-invite/project/:project_id
 * Body: { crew_ids: string[] }
 */
export async function inviteCrewToProject(
  projectId: string,
  crewIds: string[]
): Promise<InviteCrewToProjectResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/api/crew-invite/project/${encodeURIComponent(projectId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ crew_ids: crewIds }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      `Failed to invite (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Removes/unassigns a crew member from a project (admin).
 * DELETE /api/crew/:crew_id/project/:project_id
 */
export async function removeCrewFromProject(projectId: string, crewId: string): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

  const response = await fetch(
    `${env.apiBaseUrl}/api/crew/${encodeURIComponent(crewId)}/project/${encodeURIComponent(projectId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        const j = JSON.parse(text);
        message = (j?.message ?? j?.error) || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
}
