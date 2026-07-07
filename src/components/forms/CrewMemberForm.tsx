import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Plus, AlertTriangle } from 'lucide-react';
import { Country, City } from 'country-state-city';
import type { ICountry, ICity } from 'country-state-city';
import { countries as phoneCountries } from 'country-codes-flags-phone-codes';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SUBSEA_OVERLAY_LIGHT_CLASS } from '@/lib/subseaTheme';
import { BOP_OEM_OPTIONS, CREW_STATUS_TIER_OPTIONS, PREFERRED_RATING_OPTIONS } from '@/utils/crewAvailability';
import {
  buildDraftFromFormState,
  loadCrewMemberFormDraft,
  mergeDraftIntoFormData,
  saveCrewMemberFormDraft,
} from '@/utils/crewMemberFormDraft';
import './CrewMemberForm.css';

/**
 * Required fields aligned with backend `REQUIRED_FLAT_FIELDS` + passport_expiry_date + passport_document.
 * Personal details (DOB, nationality) are required for operations; contact address fields and
 * certificates / identity / alt phone remain optional unless partially started.
 */
const BACKEND_REQUIRED_CONTACT_KEYS = ['email', 'phone'] as const;
const BACKEND_REQUIRED_PERSONAL_KEYS = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'gender'] as const;
const BACKEND_REQUIRED_PASSPORT_KEYS = ['passportNumber', 'passportExpiryDate'] as const;

const stepsConfig = [
  { label: 'Personal', depth: '00m', title: 'Personal Information', sub: 'Basic identity details for the crew record' },
  { label: 'Contact', depth: '15m', title: 'Contact Information', sub: 'How to reach this crew member' },
  { label: 'Passport', depth: '30m', title: 'Passport', sub: 'Travel document details and scanned copy' },
  { label: 'Identity', depth: '45m', title: 'Identity Documents', sub: 'Government identity verification' },
  { label: 'Certificates', depth: '60m', title: 'Certificates', sub: 'Offshore survival and technical competency certificates' },
  { label: 'Professional', depth: '75m', title: 'Professional Details', sub: 'Role, rank, and vessel experience' },
  { label: 'Mobilization', depth: '90m', title: 'Mobilization', sub: 'Deployment readiness and availability' },
  { label: 'Visa', depth: '105m', title: 'Visa Details', sub: 'Work authorization details' },
];

function parsePhoneValue(value: string): { dialCode: string; number: string } {
  const trimmed = (value || '').trim();
  if (!trimmed) return { dialCode: '+1', number: '' };
  if (!trimmed.startsWith('+')) return { dialCode: '+1', number: trimmed.replace(/\D/g, '') };
  const sorted = [...phoneCountries].sort((a, b) => (b.dialCode?.length ?? 0) - (a.dialCode?.length ?? 0));
  for (const c of sorted) {
    const dc = c.dialCode ?? '';
    if (dc && trimmed.startsWith(dc)) {
      const rest = trimmed.slice(dc.length).replace(/\D/g, '');
      return { dialCode: dc, number: rest };
    }
  }
  return { dialCode: '+1', number: trimmed.replace(/\D/g, '') };
}

export interface CrewMemberFormData {
  // Personal Details
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  
  // Contact Details
  email: string;
  phone: string;
  alternatePhone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  
  // Passport & Identity
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingCountry: string;
  passportDocuments: File[];
  
  // Identity Documents
  identityType: string;
  identityNumber: string;
  identityIssueDate: string;
  identityExpiryDate: string;
  identityDocuments: File[];

  // Crew Certificates (multiple)
  certificates: Array<{
    certificateName: string;
    issueDate: string;
    expiryDate: string;
    document: File | null;
  }>;

  // Professional & Compliance (optional)
  azerbaijanVantageNumber: string;
  norwegianDNumber: string;
  dawinciNumber: string;
  vantageNumber: string;
  organization: string;
  linkedin: string;
  visa: string;
  visaCountry: string;
  visaIssueDate: string;
  visaExpiryDate: string;

  // Contractor profile fields
  preferredRating: string;
  primaryBopOem: string;
  secondarySkills: string;
  currentStatus: string;
  lastWorked: string;
}

interface CrewMemberFormProps {
  onSubmit: (data: CrewMemberFormData) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: CrewMemberFormData;
  submitLabel?: string;
  theme?: 'default' | 'subsea';
  mode?: 'create' | 'edit';
  /** localStorage key suffix for draft autosave (e.g. create, edit-abc123) */
  persistenceId?: string;
}

const defaultFormData: CrewMemberFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  nationality: '',
  gender: '',
  email: '',
  phone: '',
  alternatePhone: '',
  address: '',
  city: '',
  country: '',
  postalCode: '',
  passportNumber: '',
  passportIssueDate: '',
  passportExpiryDate: '',
  passportIssuingCountry: '',
  passportDocuments: [],
  identityType: '',
  identityNumber: '',
  identityIssueDate: '',
  identityExpiryDate: '',
  identityDocuments: [],
  certificates: [{ certificateName: '', issueDate: '', expiryDate: '', document: null }],
  azerbaijanVantageNumber: '',
  norwegianDNumber: '',
  dawinciNumber: '',
  vantageNumber: '',
  organization: '',
  linkedin: '',
  visa: '',
  visaCountry: '',
  visaIssueDate: '',
  visaExpiryDate: '',
  preferredRating: 'None',
  primaryBopOem: 'Other',
  secondarySkills: '',
  currentStatus: 'Available',
  lastWorked: '',
};

const ALL_COUNTRIES = Country.getAllCountries();

const CrewMemberForm = ({ onSubmit, onCancel, isLoading = false, initialData, submitLabel = 'Add Crew Member', theme = 'default', mode = 'create', persistenceId }: CrewMemberFormProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [formData, setFormData] = useState<CrewMemberFormData>(() => initialData ?? defaultFormData);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [phoneDialCode, setPhoneDialCode] = useState(() => parsePhoneValue(initialData?.phone ?? '').dialCode);
  const [phoneNumber, setPhoneNumber] = useState(() => parsePhoneValue(initialData?.phone ?? '').number);
  const [altPhoneDialCode, setAltPhoneDialCode] = useState(() => parsePhoneValue(initialData?.alternatePhone ?? '').dialCode);
  const [altPhoneNumber, setAltPhoneNumber] = useState(() => parsePhoneValue(initialData?.alternatePhone ?? '').number);
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const [altPhoneCountryOpen, setAltPhoneCountryOpen] = useState(false);
  const [phoneCountryQuery, setPhoneCountryQuery] = useState('');
  const [altPhoneCountryQuery, setAltPhoneCountryQuery] = useState('');
  
  const phoneCountryWrapRef = useRef<HTMLDivElement>(null);
  const altPhoneCountryWrapRef = useRef<HTMLDivElement>(null);
  const countryWrapRef = useRef<HTMLDivElement>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);
  const visaCountryInputRef = useRef<HTMLInputElement>(null);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  
  const [visaCountryOpen, setVisaCountryOpen] = useState(false);
  const [visaCountryQuery, setVisaCountryQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const hasPrefilled = useRef(false);

  const dropdownListClass = 'subsea-combobox-dropdown absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-[5px] border border-[#dde1e8] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#cbd5e1]';
  const dropdownItemClass = 'cursor-pointer px-3 py-2 text-xs text-[#111827] hover:bg-[#f7f8fa]';
  const dropdownItemSelectedClass = 'bg-[#ebf0ff] text-[#1a56db]';
  const dropdownEmptyClass = 'px-3 py-2 text-xs text-[#9ca3af]';

  const filteredPhoneCountries = useMemo(() => {
    const q = phoneCountryQuery.trim().toLowerCase();
    if (!q) return phoneCountries.slice(0, 30);
    return phoneCountries.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.dialCode || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [phoneCountryQuery]);

  const filteredAltPhoneCountries = useMemo(() => {
    const q = altPhoneCountryQuery.trim().toLowerCase();
    if (!q) return phoneCountries.slice(0, 30);
    return phoneCountries.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.dialCode || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [altPhoneCountryQuery]);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES.slice(0, 50);
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [countryQuery]);

  const cities = useMemo(() => {
    if (!selectedCountryCode) return [];
    return City.getCitiesOfCountry(selectedCountryCode) ?? [];
  }, [selectedCountryCode]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 50);
    return cities.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [cities, cityQuery]);

  const filteredVisaCountries = useMemo(() => {
    const q = visaCountryQuery.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES.slice(0, 50);
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [visaCountryQuery]);

  const toDateInputValue = (value?: string) => {
    if (!value?.trim()) return '';
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return trimmed;
    return date.toISOString().slice(0, 10);
  };

  const normalizeInitialData = (source: CrewMemberFormData): CrewMemberFormData => {
    const data = { ...source };
    data.dateOfBirth = toDateInputValue(data.dateOfBirth);
    data.passportIssueDate = toDateInputValue(data.passportIssueDate);
    data.passportExpiryDate = toDateInputValue(data.passportExpiryDate);
    data.identityIssueDate = toDateInputValue(data.identityIssueDate);
    data.identityExpiryDate = toDateInputValue(data.identityExpiryDate);
    data.visaIssueDate = toDateInputValue(data.visaIssueDate);
    data.visaExpiryDate = toDateInputValue(data.visaExpiryDate);
    data.lastWorked = toDateInputValue(data.lastWorked);
    if (!data.certificates?.length && (source as unknown as Record<string, unknown>).certificateIssueDate != null) {
      const leg = source as typeof source & { certificateIssueDate?: string; certificateExpiryDate?: string; certificateDocuments?: File[] };
      data.certificates = [{
        certificateName: 'Certificate',
        issueDate: toDateInputValue(leg.certificateIssueDate ?? ''),
        expiryDate: toDateInputValue(leg.certificateExpiryDate ?? ''),
        document: leg.certificateDocuments?.[0] ?? null,
      }];
    } else if (!data.certificates?.length) {
      data.certificates = [{ certificateName: '', issueDate: '', expiryDate: '', document: null }];
    } else {
      data.certificates = data.certificates.map((cert) => ({
        ...cert,
        issueDate: toDateInputValue(cert.issueDate),
        expiryDate: toDateInputValue(cert.expiryDate),
      }));
    }
    return data;
  };

  const persistDraft = (stepOverride?: number, completedOverride?: number[]) => {
    if (!persistenceId) return;
    saveCrewMemberFormDraft(
      persistenceId,
      buildDraftFromFormState({
        currentStep: stepOverride ?? currentStep,
        completedSteps: completedOverride ?? completedSteps,
        formData,
        phoneDialCode,
        phoneNumber,
        altPhoneDialCode,
        altPhoneNumber,
        selectedCountryCode,
      })
    );
  };

  useEffect(() => {
    if (!persistenceId) return;
    if (mode === 'edit' && !initialData) return;
    if (hasPrefilled.current) return;

    const draft = loadCrewMemberFormDraft(persistenceId);
    if (draft) {
      const base = initialData ? normalizeInitialData(initialData) : defaultFormData;
      const merged = mergeDraftIntoFormData(draft, base);
      setFormData(merged);
      setCurrentStep(Math.min(draft.currentStep, stepsConfig.length - 1));
      setCompletedSteps(draft.completedSteps ?? []);
      setPhoneDialCode(draft.phoneDialCode || '+1');
      setPhoneNumber(draft.phoneNumber || '');
      setAltPhoneDialCode(draft.altPhoneDialCode || '+1');
      setAltPhoneNumber(draft.altPhoneNumber || '');
      if (draft.selectedCountryCode) setSelectedCountryCode(draft.selectedCountryCode);
      else if (merged.country) {
        const match = ALL_COUNTRIES.find(
          (c) =>
            c.name.toLowerCase() === merged.country.toLowerCase() ||
            c.name.toLowerCase().includes(merged.country.toLowerCase())
        );
        if (match) setSelectedCountryCode(match.isoCode);
      }
      setDraftRestored(true);
      hasPrefilled.current = true;
      return;
    }

    if (initialData) {
      const data = normalizeInitialData(initialData);
      setFormData(data);
      if (initialData.country) {
        const match = ALL_COUNTRIES.find(
          (c) =>
            c.name.toLowerCase() === initialData.country.toLowerCase() ||
            c.name.toLowerCase().includes(initialData.country.toLowerCase())
        );
        if (match) setSelectedCountryCode(match.isoCode);
      }
      const phoneParsed = parsePhoneValue(initialData.phone ?? '');
      setPhoneDialCode(phoneParsed.dialCode);
      setPhoneNumber(phoneParsed.number);
      const altParsed = parsePhoneValue(initialData.alternatePhone ?? '');
      setAltPhoneDialCode(altParsed.dialCode);
      setAltPhoneNumber(altParsed.number);
      hasPrefilled.current = true;
    }
  }, [initialData, mode, persistenceId]);

  useEffect(() => {
    if (!persistenceId || !hasPrefilled.current) return;
    const timer = window.setTimeout(() => persistDraft(), 700);
    return () => window.clearTimeout(timer);
  }, [formData, currentStep, completedSteps, phoneDialCode, phoneNumber, altPhoneDialCode, altPhoneNumber, selectedCountryCode, persistenceId]);

  useEffect(() => {
    const full = phoneNumber ? `${phoneDialCode}${phoneNumber}` : '';
    setFormData((prev) => (prev.phone !== full ? { ...prev, phone: full } : prev));
  }, [phoneDialCode, phoneNumber]);

  useEffect(() => {
    const full = altPhoneNumber ? `${altPhoneDialCode}${altPhoneNumber}` : '';
    setFormData((prev) => (prev.alternatePhone !== full ? { ...prev, alternatePhone: full } : prev));
  }, [altPhoneDialCode, altPhoneNumber]);

  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => {
      if (countryWrapRef.current && !countryWrapRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  useEffect(() => {
    if (!cityOpen) return;
    const handler = (e: MouseEvent) => {
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cityOpen]);

  useEffect(() => {
    if (!phoneCountryOpen) return;
    const handler = (e: MouseEvent) => {
      if (phoneCountryWrapRef.current && !phoneCountryWrapRef.current.contains(e.target as Node)) {
        setPhoneCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [phoneCountryOpen]);

  useEffect(() => {
    if (!altPhoneCountryOpen) return;
    const handler = (e: MouseEvent) => {
      if (altPhoneCountryWrapRef.current && !altPhoneCountryWrapRef.current.contains(e.target as Node)) {
        setAltPhoneCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [altPhoneCountryOpen]);

  useEffect(() => {
    if (panelBodyRef.current) {
      panelBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const handleCountrySelect = (country: ICountry) => {
    setFormData((prev) => ({ ...prev, country: country.name, city: '' }));
    setSelectedCountryCode(country.isoCode);
    setCountryOpen(false);
    setCountryQuery('');
  };

  const handleCitySelect = (city: ICity) => {
    setFormData((prev) => ({ ...prev, city: city.name }));
    setCityOpen(false);
    setCityQuery('');
  };

  const handleVisaCountrySelect = (country: ICountry) => {
    setFormData((prev) => ({ ...prev, visaCountry: country.name }));
    setVisaCountryOpen(false);
    setVisaCountryQuery('');
  };

  const passportFileInputRef = useRef<HTMLInputElement>(null);
  const identityFileInputRef = useRef<HTMLInputElement>(null);
  const certificateFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passport' | 'identity' | 'certificate',
    certIndex?: number
  ) => {
    const files = Array.from(e.target.files || []);
    if (type === 'passport') {
      setFormData((prev) => ({
        ...prev,
        passportDocuments: [...prev.passportDocuments, ...files],
      }));
    } else if (type === 'identity') {
      setFormData((prev) => ({
        ...prev,
        identityDocuments: [...prev.identityDocuments, ...files],
      }));
    } else if (type === 'certificate' && certIndex !== undefined) {
      const file = files[0] ?? null;
      setFormData((prev) => ({
        ...prev,
        certificates: prev.certificates.map((cert, i) =>
          i === certIndex ? { ...cert, document: file } : cert
        ),
      }));
    }
  };

  const removeFile = (index: number, type: 'passport' | 'identity' | 'certificate', certIndex?: number) => {
    if (type === 'passport') {
      setFormData((prev) => ({
        ...prev,
        passportDocuments: prev.passportDocuments.filter((_, i) => i !== index),
      }));
    } else if (type === 'identity') {
      setFormData((prev) => ({
        ...prev,
        identityDocuments: prev.identityDocuments.filter((_, i) => i !== index),
      }));
    } else if (type === 'certificate' && certIndex !== undefined) {
      setFormData((prev) => ({
        ...prev,
        certificates: prev.certificates.map((cert, i) =>
          i === certIndex ? { ...cert, document: null } : cert
        ),
      }));
    }
  };

  const updateCertificate = (index: number, field: 'certificateName' | 'issueDate' | 'expiryDate', value: string) => {
    setFormData((prev) => ({
      ...prev,
      certificates: prev.certificates.map((cert, i) =>
        i === index ? { ...cert, [field]: value } : cert
      ),
    }));
  };

  const addCertificate = () => {
    setFormData((prev) => ({
      ...prev,
      certificates: [...prev.certificates, { certificateName: '', issueDate: '', expiryDate: '', document: null }],
    }));
  };

  const removeCertificate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index),
    }));
  };

  const isStepRequiredMissing = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      return (
        !formData.firstName.trim() ||
        !formData.lastName.trim() ||
        !formData.dateOfBirth ||
        !formData.nationality.trim() ||
        !formData.gender
      );
    }
    if (stepIndex === 1) {
      return !formData.email.trim() || !phoneNumber.trim();
    }
    if (stepIndex === 2) {
      return (
        !formData.passportNumber.trim() ||
        !formData.passportExpiryDate ||
        (mode === 'create' && formData.passportDocuments.length === 0)
      );
    }
    return false;
  };

  const collectPartialSectionErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    const hasIdentityInput =
      Boolean(formData.identityType) ||
      Boolean(formData.identityNumber.trim()) ||
      Boolean(formData.identityIssueDate) ||
      Boolean(formData.identityExpiryDate) ||
      formData.identityDocuments.length > 0;

    if (hasIdentityInput) {
      if (!formData.identityType) errors.identityType = 'Identity type is required when adding identity details';
      if (!formData.identityNumber.trim()) errors.identityNumber = 'Identity number is required when adding identity details';
      if (!formData.identityIssueDate) errors.identityIssueDate = 'Issue date is required when adding identity details';
      if (!formData.identityExpiryDate) errors.identityExpiryDate = 'Expiry date is required when adding identity details';
      if (mode === 'create' && formData.identityDocuments.length === 0) {
        errors.identityDocuments = 'Identity document is required when adding identity details';
      }
    }

    let incompleteCert = false;
    for (const cert of formData.certificates) {
      const hasAny = Boolean(
        cert.certificateName?.trim() || cert.issueDate || cert.expiryDate || cert.document
      );
      if (!hasAny) continue;
      if (!cert.certificateName?.trim() || !cert.issueDate || !cert.expiryDate || !cert.document) {
        incompleteCert = true;
        break;
      }
    }
    if (incompleteCert) {
      errors.certificates = 'Complete every field for each certificate you started, or remove the row';
    }

    return errors;
  };

  const validateStep = (stepIndex: number): boolean => {
    const errors: Record<string, string> = {};
    
    if (stepIndex === 0) {
      if (!formData.firstName.trim()) errors.firstName = 'First name is required';
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
      if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
      if (!formData.nationality.trim()) errors.nationality = 'Nationality is required';
      if (!formData.gender) errors.gender = 'Gender is required';
    }
    
    if (stepIndex === 1) {
      if (!formData.email.trim()) errors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errors.email = 'Enter a valid email address';
      }
      if (!phoneNumber.trim()) errors.phone = 'Phone number is required';
    }
    
    if (stepIndex === 2) {
      if (!formData.passportNumber.trim()) errors.passportNumber = 'Passport number is required';
      if (!formData.passportExpiryDate) errors.passportExpiryDate = 'Passport expiry date is required';
      if (mode === 'create' && formData.passportDocuments.length === 0) {
        errors.passportDocuments = 'Passport document is required';
      }
    }
    
    setValidationErrors((prev) => {
      const cleared = { ...prev };
      if (stepIndex === 0) {
        BACKEND_REQUIRED_PERSONAL_KEYS.forEach((k) => delete cleared[k]);
      } else if (stepIndex === 1) {
        BACKEND_REQUIRED_CONTACT_KEYS.forEach((k) => delete cleared[k]);
      } else if (stepIndex === 2) {
        [...BACKEND_REQUIRED_PASSPORT_KEYS, 'passportDocuments'].forEach((k) => delete cleared[k]);
      }
      return { ...cleared, ...errors };
    });
    
    return Object.keys(errors).length === 0;
  };

  const validateAllRequiredForSubmit = (): number | null => {
    for (let i = 0; i <= 2; i++) {
      if (!validateStep(i)) return i;
    }

    const partialErrors = collectPartialSectionErrors();
    if (Object.keys(partialErrors).length > 0) {
      setValidationErrors((prev) => ({ ...prev, ...partialErrors }));
      if (partialErrors.identityType || partialErrors.identityNumber || partialErrors.identityIssueDate || partialErrors.identityExpiryDate || partialErrors.identityDocuments) {
        return 3;
      }
      if (partialErrors.certificates) return 4;
    }

    return null;
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex === currentStep) return;
    
    if (stepIndex > currentStep) {
      if (!validateStep(currentStep)) return;
      
      for (let i = currentStep + 1; i < stepIndex; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);
          return;
        }
      }
    }
    
    setCurrentStep(stepIndex);
  };

  const handleContinue = () => {
    if (currentStep < 7) {
      if (!validateStep(currentStep)) return;
      const nextCompleted = Array.from(new Set([...completedSteps, currentStep])).sort((a, b) => a - b);
      const nextStep = currentStep + 1;
      setCompletedSteps(nextCompleted);
      setCurrentStep(nextStep);
      persistDraft(nextStep, nextCompleted);
      return;
    }

    const failedStep = validateAllRequiredForSubmit();
    if (failedStep !== null) {
      setCurrentStep(failedStep);
      return;
    }

    void onSubmit(formData);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancelBtn = () => {
    if (confirm('Discard changes and leave this crew member form?')) {
      onCancel();
    }
  };

  return (
    <div className="crew-member-form">
      {/* Depth gauge navigation */}
      <nav className="gauge" aria-label="Form progress">
        <div className="gauge-head">
          <div className="label">Crew Onboarding</div>
          <div className="title">{mode === 'edit' ? 'Edit Crew Profile' : 'Add Crew Profile'}</div>
        </div>
        <div className="gauge-progress">
          <div
            className="gauge-progress-fill"
            style={{ width: `${((currentStep + 1) / stepsConfig.length) * 100}%` }}
          />
        </div>
        <div className="gauge-steps">
          <div className="gauge-rule"></div>
          {stepsConfig.map((s, index) => {
            const isActive = index === currentStep;
            const isDone = completedSteps.includes(index) || index < currentStep;
            const hasError = (() => {
              if (index === 0) {
                return ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'gender'].some(k => validationErrors[k]);
              }
              if (index === 1) {
                return ['email', 'phone'].some(k => validationErrors[k]);
              }
              if (index === 2) {
                return ['passportNumber', 'passportExpiryDate', 'passportDocuments'].some(k => validationErrors[k]);
              }
              if (index === 3) {
                return ['identityType', 'identityNumber', 'identityIssueDate', 'identityExpiryDate', 'identityDocuments'].some(k => validationErrors[k]);
              }
              if (index === 4) {
                return Boolean(validationErrors.certificates);
              }
              return false;
            })();
            const isMissing = isStepRequiredMissing(index);
            
            return (
              <button
                key={index}
                type="button"
                className={cn(
                  'gstep',
                  isActive && 'active',
                  isDone && 'done',
                  hasError && 'has-error',
                  isMissing && !hasError && 'required-missing'
                )}
                onClick={() => handleStepClick(index)}
              >
                <div className="node"></div>
                <div className="meta">
                  <div className="depth">{s.depth}</div>
                  <div className="name">{s.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main panel */}
      <form className="panel" onSubmit={(e) => { e.preventDefault(); handleContinue(); }}>
        <div className="panel-top">
          <div>
            <h1>{stepsConfig[currentStep].title}</h1>
            <div className="sub">{stepsConfig[currentStep].sub}</div>
            {draftRestored && (
              <div className="draft-restored-note" role="status">
                Draft restored — your progress was saved. Re-upload any document files if needed.
              </div>
            )}
          </div>
          <div className="step-count">
            STEP {currentStep + 1} / {stepsConfig.length}
          </div>
        </div>

        <div className="panel-body" ref={panelBodyRef}>
          {currentStep === 0 && (
            <>
              <div className="section-title">Personal Details</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={cn(validationErrors.firstName && 'border-red-500')}
                    placeholder="e.g. James"
                  />
                  {validationErrors.firstName && <span className="text-xs text-red-500">{validationErrors.firstName}</span>}
                </div>

                <div className="field">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={cn(validationErrors.lastName && 'border-red-500')}
                    placeholder="e.g. Okafor"
                  />
                  {validationErrors.lastName && <span className="text-xs text-red-500">{validationErrors.lastName}</span>}
                </div>

                <div className="field">
                  <label htmlFor="dateOfBirth">Date of Birth *</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className={cn(validationErrors.dateOfBirth && 'border-red-500')}
                  />
                  {validationErrors.dateOfBirth && <span className="text-xs text-red-500">{validationErrors.dateOfBirth}</span>}
                </div>

                <div className="field">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={cn(validationErrors.gender && 'border-red-500')}
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                  {validationErrors.gender && <span className="text-xs text-red-500">{validationErrors.gender}</span>}
                </div>

                <div className="field">
                  <label htmlFor="nationality">Nationality *</label>
                  <input
                    type="text"
                    id="nationality"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleInputChange}
                    className={cn(validationErrors.nationality && 'border-red-500')}
                    placeholder="e.g. Nigerian"
                  />
                  {validationErrors.nationality && <span className="text-xs text-red-500">{validationErrors.nationality}</span>}
                </div>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div className="section-title">Contact Information</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={cn(validationErrors.email && 'border-red-500')}
                    placeholder="name@example.com"
                  />
                  {validationErrors.email && <span className="text-xs text-red-500">{validationErrors.email}</span>}
                </div>

                <div className="field">
                  <label htmlFor="phone">Phone Number *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="relative shrink-0 w-[98px]" ref={phoneCountryWrapRef}>
                      <div
                        className="flex items-center justify-between gap-1 min-h-[40px] w-full cursor-pointer rounded-lg border border-[#e3e9ee] bg-white px-3 py-2 text-sm text-[#152233] hover:border-[#0e6fa4]/50"
                        onClick={() => {
                          setPhoneCountryOpen(!phoneCountryOpen);
                          if (phoneCountryOpen) setPhoneCountryQuery('');
                        }}
                        style={{ height: '40px' }}
                        aria-expanded={phoneCountryOpen}
                      >
                        {(() => {
                          const sel = phoneCountries.find((c) => c.dialCode === phoneDialCode);
                          return phoneCountryOpen ? (
                            <input
                              type="text"
                              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[#152233] placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-transparent focus:box-shadow-none"
                              style={{ height: '100%', border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
                              value={phoneCountryQuery}
                              onChange={(e) => {
                                setPhoneCountryQuery(e.target.value);
                                if (!phoneCountryOpen) setPhoneCountryOpen(true);
                              }}
                              onFocus={() => setPhoneCountryOpen(true)}
                              placeholder="Search..."
                              autoComplete="off"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span>{sel ? `${sel.flag} ${sel.dialCode}` : phoneDialCode}</span>
                          );
                        })()}
                      </div>
                      {phoneCountryOpen && (
                        <ul className={dropdownListClass} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100 }}>
                          {filteredPhoneCountries.map((c) => (
                            <li
                              key={c.code}
                              className={cn(
                                dropdownItemClass,
                                c.dialCode === phoneDialCode && dropdownItemSelectedClass
                              )}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setPhoneDialCode(c.dialCode);
                                setPhoneCountryOpen(false);
                                setPhoneCountryQuery('');
                              }}
                            >
                              {c.flag} {c.dialCode} {c.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="5551234567"
                      autoComplete="tel-national"
                      className={cn(validationErrors.phone && 'border-red-500', 'flex-1 min-w-0')}
                      style={{ height: '40px' }}
                    />
                  </div>
                  {validationErrors.phone && <span className="text-xs text-red-500">{validationErrors.phone}</span>}
                </div>

                <div className="field">
                  <label htmlFor="alternatePhone">Alternate Phone Number</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="relative shrink-0 w-[98px]" ref={altPhoneCountryWrapRef}>
                      <div
                        className="flex items-center justify-between gap-1 min-h-[40px] w-full cursor-pointer rounded-lg border border-[#e3e9ee] bg-white px-3 py-2 text-sm text-[#152233] hover:border-[#0e6fa4]/50"
                        onClick={() => {
                          setAltPhoneCountryOpen(!altPhoneCountryOpen);
                          if (altPhoneCountryOpen) setAltPhoneCountryQuery('');
                        }}
                        style={{ height: '40px' }}
                        aria-expanded={altPhoneCountryOpen}
                      >
                        {(() => {
                          const sel = phoneCountries.find((c) => c.dialCode === altPhoneDialCode);
                          return altPhoneCountryOpen ? (
                            <input
                              type="text"
                              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[#152233] placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-transparent focus:box-shadow-none"
                              style={{ height: '100%', border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
                              value={altPhoneCountryQuery}
                              onChange={(e) => {
                                setAltPhoneCountryQuery(e.target.value);
                                if (!altPhoneCountryOpen) setAltPhoneCountryOpen(true);
                              }}
                              onFocus={() => setAltPhoneCountryOpen(true)}
                              placeholder="Search..."
                              autoComplete="off"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span>{sel ? `${sel.flag} ${sel.dialCode}` : altPhoneDialCode}</span>
                          );
                        })()}
                      </div>
                      {altPhoneCountryOpen && (
                        <ul className={dropdownListClass} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100 }}>
                          {filteredAltPhoneCountries.map((c) => (
                            <li
                              key={c.code}
                              className={cn(
                                dropdownItemClass,
                                c.dialCode === altPhoneDialCode && dropdownItemSelectedClass
                              )}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setAltPhoneDialCode(c.dialCode);
                                setAltPhoneCountryOpen(false);
                                setAltPhoneCountryQuery('');
                              }}
                            >
                              {c.flag} {c.dialCode} {c.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <input
                      type="tel"
                      id="alternatePhone"
                      name="alternatePhone"
                      value={altPhoneNumber}
                      onChange={(e) => setAltPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="5551234567"
                      autoComplete="tel-national"
                      className={cn(validationErrors.alternatePhone && 'border-red-500', 'flex-1 min-w-0')}
                      style={{ height: '40px' }}
                    />
                  </div>
                  {validationErrors.alternatePhone && <span className="text-xs text-red-500">{validationErrors.alternatePhone}</span>}
                </div>

                <div className="field full">
                  <label htmlFor="address">Home Address</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={cn(validationErrors.address && 'border-red-500')}
                    placeholder="Street, city, country"
                  />
                  {validationErrors.address && <span className="text-xs text-red-500">{validationErrors.address}</span>}
                </div>

                <div className="field">
                  <label htmlFor="country">Country</label>
                  <div className="relative" ref={countryWrapRef}>
                    <input
                      id="country"
                      type="text"
                      value={countryOpen ? countryQuery : formData.country}
                      onChange={(e) => {
                        setCountryQuery(e.target.value);
                        if (!countryOpen) setCountryOpen(true);
                        if (formData.country || selectedCountryCode) {
                          setFormData((prev) => ({ ...prev, country: '', city: '' }));
                          setSelectedCountryCode('');
                        }
                      }}
                      onFocus={() => {
                        setCountryOpen(true);
                        if (formData.country) setCountryQuery('');
                      }}
                      placeholder="Type to search country…"
                      autoComplete="off"
                      className={cn(validationErrors.country && 'border-red-500')}
                    />
                    {countryOpen && (
                      <ul className={dropdownListClass}>
                        {filteredCountries.length === 0 ? (
                          <li className={dropdownEmptyClass}>No countries found</li>
                        ) : (
                          filteredCountries.map((c) => (
                            <li
                              key={c.isoCode}
                              className={dropdownItemClass}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleCountrySelect(c)}
                            >
                              {c.name}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {validationErrors.country && <span className="text-xs text-red-500">{validationErrors.country}</span>}
                </div>

                <div className="field">
                  <label htmlFor="city">City</label>
                  <div className="relative" ref={cityWrapRef}>
                    <input
                      id="city"
                      type="text"
                      value={cityOpen ? cityQuery : formData.city}
                      onChange={(e) => {
                        setCityQuery(e.target.value);
                        if (!cityOpen) setCityOpen(true);
                        if (formData.city) setFormData((prev) => ({ ...prev, city: '' }));
                      }}
                      onFocus={() => {
                        setCityOpen(true);
                        if (formData.city) setCityQuery('');
                      }}
                      placeholder={selectedCountryCode ? 'Type to search city…' : 'Select country first'}
                      autoComplete="off"
                      disabled={!selectedCountryCode}
                      className={cn(validationErrors.city && 'border-red-500')}
                    />
                    {cityOpen && selectedCountryCode && (
                      <ul className={dropdownListClass}>
                        {filteredCities.length === 0 ? (
                          <li className={dropdownEmptyClass}>No cities found</li>
                        ) : (
                          filteredCities.map((c) => (
                            <li
                              key={`${c.countryCode}-${c.stateCode}-${c.name}`}
                              className={dropdownItemClass}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleCitySelect(c)}
                            >
                              {c.name}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {validationErrors.city && <span className="text-xs text-red-500">{validationErrors.city}</span>}
                </div>

                <div className="field">
                  <label htmlFor="postalCode">Postal Code</label>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    className={cn(validationErrors.postalCode && 'border-red-500')}
                  />
                  {validationErrors.postalCode && <span className="text-xs text-red-500">{validationErrors.postalCode}</span>}
                </div>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="section-title">Passport Details</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="passportNumber">Passport Number *</label>
                  <input
                    type="text"
                    id="passportNumber"
                    name="passportNumber"
                    value={formData.passportNumber}
                    onChange={handleInputChange}
                    className={cn(validationErrors.passportNumber && 'border-red-500')}
                  />
                  {validationErrors.passportNumber && <span className="text-xs text-red-500">{validationErrors.passportNumber}</span>}
                </div>

                <div className="field">
                  <label htmlFor="passportIssuingCountry">Issuing Country</label>
                  <input
                    type="text"
                    id="passportIssuingCountry"
                    name="passportIssuingCountry"
                    value={formData.passportIssuingCountry}
                    onChange={handleInputChange}
                    className={cn(validationErrors.passportIssuingCountry && 'border-red-500')}
                  />
                  {validationErrors.passportIssuingCountry && <span className="text-xs text-red-500">{validationErrors.passportIssuingCountry}</span>}
                </div>

                <div className="field">
                  <label htmlFor="passportIssueDate">Issue Date</label>
                  <input
                    type="date"
                    id="passportIssueDate"
                    name="passportIssueDate"
                    value={formData.passportIssueDate}
                    onChange={handleInputChange}
                    className={cn(validationErrors.passportIssueDate && 'border-red-500')}
                  />
                  {validationErrors.passportIssueDate && <span className="text-xs text-red-500">{validationErrors.passportIssueDate}</span>}
                </div>

                <div className="field">
                  <label htmlFor="passportExpiryDate">Expiry Date *</label>
                  <input
                    type="date"
                    id="passportExpiryDate"
                    name="passportExpiryDate"
                    value={formData.passportExpiryDate}
                    onChange={handleInputChange}
                    className={cn(validationErrors.passportExpiryDate && 'border-red-500')}
                  />
                  {validationErrors.passportExpiryDate && <span className="text-xs text-red-500">{validationErrors.passportExpiryDate}</span>}
                </div>

                <div className="field full">
                  <label>Passport Document{mode === 'create' ? ' *' : ''}</label>
                  <input
                    ref={passportFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(e, 'passport')}
                    className="sr-only"
                  />
                  <div
                    className={cn('upload', formData.passportDocuments.length > 0 && 'has-file')}
                    onClick={() => passportFileInputRef.current?.click()}
                  >
                    <div className="left">
                      <div className="icon">⇧</div>
                      <div className="txt">
                        <div className="t1">Upload Passport Documents</div>
                        <div className="t2">PDF, JPG, PNG · Max 10MB</div>
                      </div>
                    </div>
                    <div className="btn-mini">Browse</div>
                  </div>
                  {validationErrors.passportDocuments && <span className="text-xs text-red-500 mt-1">{validationErrors.passportDocuments}</span>}
                  
                  {formData.passportDocuments.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {formData.passportDocuments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-[#dde1e8] bg-[#f8fafc] px-3 py-2">
                          <span className="text-xs text-[#111827] truncate font-medium">{file.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-[#e4eff4] hover:text-[#c2453d]"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx, 'passport');
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="section-title">Identity Verification</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="identityType">Identity Type</label>
                  <select
                    id="identityType"
                    name="identityType"
                    value={formData.identityType}
                    onChange={handleInputChange}
                    className={cn(validationErrors.identityType && 'border-red-500')}
                  >
                    <option value="">Select…</option>
                    <option value="national_id">National ID</option>
                    <option value="driving_license">Driving License</option>
                    <option value="identity_number">Identity Number</option>
                    <option value="other">Other</option>
                  </select>
                  {validationErrors.identityType && <span className="text-xs text-red-500">{validationErrors.identityType}</span>}
                </div>

                <div className="field">
                  <label htmlFor="identityNumber">Identity Number</label>
                  <input
                    type="text"
                    id="identityNumber"
                    name="identityNumber"
                    value={formData.identityNumber}
                    onChange={handleInputChange}
                    className={cn(validationErrors.identityNumber && 'border-red-500')}
                  />
                  {validationErrors.identityNumber && <span className="text-xs text-red-500">{validationErrors.identityNumber}</span>}
                </div>

                <div className="field">
                  <label htmlFor="identityIssueDate">Issue Date</label>
                  <input
                    type="date"
                    id="identityIssueDate"
                    name="identityIssueDate"
                    value={formData.identityIssueDate}
                    onChange={handleInputChange}
                    className={cn(validationErrors.identityIssueDate && 'border-red-500')}
                  />
                  {validationErrors.identityIssueDate && <span className="text-xs text-red-500">{validationErrors.identityIssueDate}</span>}
                </div>

                <div className="field">
                  <label htmlFor="identityExpiryDate">Expiry Date <span className="opt">(optional)</span></label>
                  <input
                    type="date"
                    id="identityExpiryDate"
                    name="identityExpiryDate"
                    value={formData.identityExpiryDate}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field full">
                  <label>Identity Document</label>
                  <input
                    ref={identityFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(e, 'identity')}
                    className="sr-only"
                  />
                  <div
                    className={cn('upload', formData.identityDocuments.length > 0 && 'has-file')}
                    onClick={() => identityFileInputRef.current?.click()}
                  >
                    <div className="left">
                      <div className="icon">⇧</div>
                      <div className="txt">
                        <div className="t1">Upload Identity Documents</div>
                        <div className="t2">PDF, JPG, PNG · Max 10MB</div>
                      </div>
                    </div>
                    <div className="btn-mini">Browse</div>
                  </div>
                  {validationErrors.identityDocuments && <span className="text-xs text-red-500 mt-1">{validationErrors.identityDocuments}</span>}

                  {formData.identityDocuments.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {formData.identityDocuments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-[#dde1e8] bg-[#f8fafc] px-3 py-2">
                          <span className="text-xs text-[#111827] truncate font-medium">{file.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-[#e4eff4] hover:text-[#c2453d]"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx, 'identity');
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="cert-card-head mb-4">
                <div className="section-title" style={{ margin: 0 }}>Offshore survival and competency certificates</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-mini"
                  onClick={addCertificate}
                  style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                >
                  <Plus size={14} /> Add certificate
                </button>
              </div>

              {validationErrors.certificates && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-500 border border-red-200" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} />
                  <span>{validationErrors.certificates}</span>
                </div>
              )}

              {formData.certificates.map((cert, certIndex) => (
                <div key={certIndex} className="cert-card">
                  <div className="cert-card-head">
                    <span className="text-xs font-semibold text-foreground">
                      Certificate {certIndex + 1}
                    </span>
                    {formData.certificates.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-cert"
                        onClick={() => removeCertificate(certIndex)}
                      >
                        <X size={14} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="grid">
                    <div className="field full">
                      <label>Certificate Name</label>
                      <input
                        type="text"
                        value={cert.certificateName}
                        onChange={(e) => updateCertificate(certIndex, 'certificateName', e.target.value)}
                        placeholder="e.g. BOSIET, STCW Basic Safety"
                      />
                    </div>
                    <div className="field">
                      <label>Issue Date</label>
                      <input
                        type="date"
                        value={cert.issueDate}
                        onChange={(e) => updateCertificate(certIndex, 'issueDate', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Expiry Date</label>
                      <input
                        type="date"
                        value={cert.expiryDate}
                        onChange={(e) => updateCertificate(certIndex, 'expiryDate', e.target.value)}
                      />
                    </div>
                    <div className="field full">
                      <label>Certificate Document</label>
                      <input
                        ref={(el) => {
                          certificateFileInputRefs.current[certIndex] = el;
                        }}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, 'certificate', certIndex)}
                        className="sr-only"
                      />
                      <div
                        className={cn('upload', cert.document && 'has-file')}
                        onClick={() => certificateFileInputRefs.current[certIndex]?.click()}
                      >
                        <div className="left">
                          <div className="icon">⇧</div>
                          <div className="txt">
                            <div className="t1">Upload certificate file</div>
                            <div className="t2">PDF, JPG, PNG · Max 10MB</div>
                          </div>
                        </div>
                        <div className="btn-mini">Browse</div>
                      </div>
                      {cert.document && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#dde1e8] bg-[#f8fafc] px-3 py-2 mt-2">
                          <span className="text-xs text-[#111827] truncate font-medium">{cert.document.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-[#e4eff4] hover:text-[#c2453d]"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(0, 'certificate', certIndex);
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="section-title">Professional Details</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="dawinciNumber">DaWinci Number <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="dawinciNumber"
                    name="dawinciNumber"
                    value={formData.dawinciNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="vantageNumber">Vantage Number <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="vantageNumber"
                    name="vantageNumber"
                    value={formData.vantageNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="azerbaijanVantageNumber">Azerbaijan Vantage Number <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="azerbaijanVantageNumber"
                    name="azerbaijanVantageNumber"
                    value={formData.azerbaijanVantageNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="norwegianDNumber">Norwegian D Number <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="norwegianDNumber"
                    name="norwegianDNumber"
                    value={formData.norwegianDNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="organization">Organization <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleInputChange}
                    placeholder="e.g. Subseacore Ltd."
                  />
                </div>

                <div className="field full">
                  <label htmlFor="linkedin">LinkedIn URL <span className="opt">(optional)</span></label>
                  <input
                    type="url"
                    id="linkedin"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleInputChange}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </div>
            </>
          )}

          {currentStep === 6 && (
            <>
              <div className="section-title">Mobilization readiness and availability</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="preferredRating">Preferred Rating</label>
                  <select
                    id="preferredRating"
                    name="preferredRating"
                    value={formData.preferredRating}
                    onChange={handleInputChange}
                  >
                    {PREFERRED_RATING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="primaryBopOem">Primary BOP OEM</label>
                  <select
                    id="primaryBopOem"
                    name="primaryBopOem"
                    value={formData.primaryBopOem}
                    onChange={handleInputChange}
                  >
                    {BOP_OEM_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="field full">
                  <label htmlFor="secondarySkills">Secondary Skills <span className="opt">(optional)</span></label>
                  <input
                    type="text"
                    id="secondarySkills"
                    name="secondarySkills"
                    value={formData.secondarySkills}
                    onChange={handleInputChange}
                    placeholder="e.g. Tubing, Controls (comma-separated)"
                  />
                </div>

                <div className="field">
                  <label htmlFor="currentStatus">Current Status</label>
                  <select
                    id="currentStatus"
                    name="currentStatus"
                    value={formData.currentStatus}
                    onChange={handleInputChange}
                  >
                    {CREW_STATUS_TIER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="lastWorked">Last Worked (Subseaquence)</label>
                  <input
                    type="date"
                    id="lastWorked"
                    name="lastWorked"
                    value={formData.lastWorked}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </>
          )}

          {currentStep === 7 && (
            <>
              <div className="section-title">Visa Details</div>
              <div className="grid">
                <div className="field">
                  <label htmlFor="visaCountry">Visa Country <span className="opt">(optional)</span></label>
                  <Popover open={visaCountryOpen} onOpenChange={setVisaCountryOpen} modal={false}>
                    <PopoverAnchor asChild>
                      <input
                        ref={visaCountryInputRef}
                        id="visaCountry"
                        type="text"
                        value={visaCountryOpen ? visaCountryQuery : formData.visaCountry}
                        onChange={(e) => {
                          setVisaCountryQuery(e.target.value);
                          setVisaCountryOpen(true);
                          if (formData.visaCountry) {
                            setFormData((prev) => ({ ...prev, visaCountry: '' }));
                          }
                        }}
                        onFocus={() => {
                          setVisaCountryOpen(true);
                          if (formData.visaCountry) setVisaCountryQuery('');
                        }}
                        placeholder="Type to search country…"
                        autoComplete="off"
                      />
                    </PopoverAnchor>
                    <PopoverContent
                      className={cn(
                        'z-[1100] w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-[200px] overflow-y-auto p-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
                        theme === 'subsea' && SUBSEA_OVERLAY_LIGHT_CLASS
                      )}
                      align="start"
                      sideOffset={4}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onPointerDownOutside={(e) => {
                        if (visaCountryInputRef.current?.contains(e.target as Node)) {
                          e.preventDefault();
                        }
                      }}
                      onFocusOutside={(e) => {
                        if (visaCountryInputRef.current?.contains(e.target as Node)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <ul className="py-1">
                        {filteredVisaCountries.length === 0 ? (
                          <li className={dropdownEmptyClass}>No countries found</li>
                        ) : (
                          filteredVisaCountries.map((c) => (
                            <li
                              key={c.isoCode}
                              className={dropdownItemClass}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleVisaCountrySelect(c)}
                            >
                              {c.name}
                            </li>
                          ))
                        )}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="field">
                  <label htmlFor="visaIssueDate">Visa Issue Date <span className="opt">(optional)</span></label>
                  <input
                    type="date"
                    id="visaIssueDate"
                    name="visaIssueDate"
                    value={formData.visaIssueDate}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="visaExpiryDate">Visa Expiry Date <span className="opt">(optional)</span></label>
                  <input
                    type="date"
                    id="visaExpiryDate"
                    name="visaExpiryDate"
                    value={formData.visaExpiryDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="panel-footer">
          <div className="footer-left">
            <button className="btn btn-ghost" type="button" onClick={handleCancelBtn} disabled={isLoading}>
              Cancel
            </button>
            {currentStep > 0 && (
              <button className="btn btn-ghost" type="button" onClick={handleBack} disabled={isLoading}>
                Back
              </button>
            )}
          </div>
          <button
            className={cn('btn', currentStep === stepsConfig.length - 1 ? 'btn-final' : 'btn-primary')}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : currentStep === stepsConfig.length - 1 ? submitLabel : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CrewMemberForm;
