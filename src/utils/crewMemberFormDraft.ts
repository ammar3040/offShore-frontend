import type { CrewMemberFormData } from '../components/forms/CrewMemberForm';

const STORAGE_PREFIX = 'offshore-crew-form-draft:v1:';

export interface CrewMemberFormDraft {
  version: 1;
  currentStep: number;
  completedSteps: number[];
  formData: SerializableFormData;
  phoneDialCode: string;
  phoneNumber: string;
  altPhoneDialCode: string;
  altPhoneNumber: string;
  selectedCountryCode: string;
  updatedAt: number;
}

type SerializableFormData = Omit<
  CrewMemberFormData,
  'passportDocuments' | 'identityDocuments' | 'certificates'
> & {
  certificates: Array<{
    certificateName: string;
    issueDate: string;
    expiryDate: string;
  }>;
};

function storageKey(persistenceId: string): string {
  return `${STORAGE_PREFIX}${persistenceId}`;
}

function toSerializable(data: CrewMemberFormData): SerializableFormData {
  const {
    passportDocuments: _p,
    identityDocuments: _i,
    certificates,
    ...rest
  } = data;
  return {
    ...rest,
    certificates: certificates.map((c) => ({
      certificateName: c.certificateName,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
    })),
  };
}

function fromSerializable(
  saved: SerializableFormData,
  base: CrewMemberFormData
): CrewMemberFormData {
  return {
    ...base,
    ...saved,
    passportDocuments: base.passportDocuments,
    identityDocuments: base.identityDocuments,
    certificates: saved.certificates.length
      ? saved.certificates.map((c) => ({
          certificateName: c.certificateName,
          issueDate: c.issueDate,
          expiryDate: c.expiryDate,
          document: null,
        }))
      : base.certificates,
  };
}

export function loadCrewMemberFormDraft(persistenceId: string): CrewMemberFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(persistenceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrewMemberFormDraft;
    if (parsed?.version !== 1 || typeof parsed.currentStep !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCrewMemberFormDraft(
  persistenceId: string,
  draft: Omit<CrewMemberFormDraft, 'version' | 'updatedAt'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CrewMemberFormDraft = {
      version: 1,
      ...draft,
      updatedAt: Date.now(),
    };
    localStorage.setItem(storageKey(persistenceId), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearCrewMemberFormDraft(persistenceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(persistenceId));
  } catch {
    // ignore
  }
}

export function mergeDraftIntoFormData(
  draft: CrewMemberFormDraft,
  base: CrewMemberFormData
): CrewMemberFormData {
  return fromSerializable(draft.formData, base);
}

export function buildDraftFromFormState(input: {
  currentStep: number;
  completedSteps: number[];
  formData: CrewMemberFormData;
  phoneDialCode: string;
  phoneNumber: string;
  altPhoneDialCode: string;
  altPhoneNumber: string;
  selectedCountryCode: string;
}): Omit<CrewMemberFormDraft, 'version' | 'updatedAt'> {
  return {
    currentStep: input.currentStep,
    completedSteps: input.completedSteps,
    formData: toSerializable(input.formData),
    phoneDialCode: input.phoneDialCode,
    phoneNumber: input.phoneNumber,
    altPhoneDialCode: input.altPhoneDialCode,
    altPhoneNumber: input.altPhoneNumber,
    selectedCountryCode: input.selectedCountryCode,
  };
}
