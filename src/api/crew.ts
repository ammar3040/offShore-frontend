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
    return response.json();
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
