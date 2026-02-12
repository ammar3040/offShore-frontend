import { env } from '../config/env';
import type { CrewMemberFormData } from '../components/forms/CrewMemberForm';

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
