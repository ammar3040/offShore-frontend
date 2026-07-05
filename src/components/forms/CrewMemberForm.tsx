import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, Plus } from 'lucide-react';
import { Country, City } from 'country-state-city';
import type { ICountry, ICity } from 'country-state-city';
import { countries as phoneCountries } from 'country-codes-flags-phone-codes';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SUBSEA_OVERLAY_LIGHT_CLASS } from '@/lib/subseaTheme';
import { BOP_OEM_OPTIONS, CREW_STATUS_TIER_OPTIONS, PREFERRED_RATING_OPTIONS } from '@/utils/crewAvailability';
import './CrewMemberForm.css';

const FORM_SECTIONS = [
  { id: 'crew-form-personal', label: 'Personal' },
  { id: 'crew-form-contact', label: 'Contact' },
  { id: 'crew-form-passport', label: 'Passport' },
  { id: 'crew-form-identity', label: 'Identity' },
  { id: 'crew-form-certificates', label: 'Certificates' },
  { id: 'crew-form-professional', label: 'Professional' },
  { id: 'crew-form-mobilization', label: 'Mobilization' },
  { id: 'crew-form-visa', label: 'Visa' },
] as const;

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

  // MD Section 3.1 — extended contractor profile fields
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
  /** Relaxes certificate file requirement when editing an existing crew member */
  mode?: 'create' | 'edit';
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

const defaultInputClass =
  'border border-input rounded-lg px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-muted';

const subseaInputClass =
  'border border-[#dde1e8] rounded-[5px] px-3 py-2 text-xs text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(26,86,219,0.12)] focus:border-[#1a56db] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[#f7f8fa]';

const defaultDropdownListClass =
  'absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30';

const subseaDropdownListClass =
  'subsea-combobox-dropdown absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-[5px] border border-[#dde1e8] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#cbd5e1]';

const defaultDropdownItemClass = 'cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-muted';
const subseaDropdownItemClass = 'cursor-pointer px-3 py-2 text-xs text-[#111827] hover:bg-[#f7f8fa]';

const defaultDropdownItemSelectedClass = 'bg-muted';
const subseaDropdownItemSelectedClass = 'bg-[#ebf0ff] text-[#1a56db]';

const defaultDropdownEmptyClass = 'px-3 py-2 text-sm text-muted-foreground';
const subseaDropdownEmptyClass = 'px-3 py-2 text-xs text-[#9ca3af]';

const CrewMemberForm = ({ onSubmit, onCancel, isLoading = false, initialData, submitLabel = 'Add Crew Member', theme = 'default', mode = 'create' }: CrewMemberFormProps) => {
  const inputClass = theme === 'subsea' ? subseaInputClass : defaultInputClass;
  const dropdownListClass = theme === 'subsea' ? subseaDropdownListClass : defaultDropdownListClass;
  const dropdownItemClass = theme === 'subsea' ? subseaDropdownItemClass : defaultDropdownItemClass;
  const dropdownItemSelectedClass = theme === 'subsea' ? subseaDropdownItemSelectedClass : defaultDropdownItemSelectedClass;
  const dropdownEmptyClass = theme === 'subsea' ? subseaDropdownEmptyClass : defaultDropdownEmptyClass;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasPrefilled = useRef(false);

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
  const countryWrapRef = useRef<HTMLDivElement>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);
  const visaCountryInputRef = useRef<HTMLInputElement>(null);
  const [visaCountryOpen, setVisaCountryOpen] = useState(false);
  const [visaCountryQuery, setVisaCountryQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>(FORM_SECTIONS[0].id);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const container = scrollContainerRef.current;
    const section = document.getElementById(sectionId);
    if (!container || !section) return;

    const containerRect = container.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const offset = sectionRect.top - containerRect.top + container.scrollTop - 4;

    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActiveSection(id);
      },
      { root: container, rootMargin: '-8% 0px -72% 0px', threshold: [0, 0.15, 0.4] }
    );

    FORM_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

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

  // Pre-fill form when opening edit modal; sync once per mount when initialData exists
  useEffect(() => {
    if (initialData && !hasPrefilled.current) {
      // Normalize legacy single-certificate shape to certificates array
      const data = { ...initialData };
      data.dateOfBirth = toDateInputValue(data.dateOfBirth);
      data.passportIssueDate = toDateInputValue(data.passportIssueDate);
      data.passportExpiryDate = toDateInputValue(data.passportExpiryDate);
      data.identityIssueDate = toDateInputValue(data.identityIssueDate);
      data.identityExpiryDate = toDateInputValue(data.identityExpiryDate);
      data.visaIssueDate = toDateInputValue(data.visaIssueDate);
      data.visaExpiryDate = toDateInputValue(data.visaExpiryDate);
      data.lastWorked = toDateInputValue(data.lastWorked);
      if (!data.certificates?.length && (initialData as unknown as Record<string, unknown>).certificateIssueDate != null) {
        const leg = initialData as typeof initialData & { certificateIssueDate?: string; certificateExpiryDate?: string; certificateDocuments?: File[] };
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
    return () => {
      hasPrefilled.current = false;
    };
  }, [initialData]);

  // Sync phone values into formData
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = 'First Name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last Name is required';
    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of Birth is required';
    if (!formData.nationality.trim()) errors.nationality = 'Nationality is required';
    if (!formData.gender) errors.gender = 'Gender is required';
    
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!phoneNumber.trim()) errors.phone = 'Phone number is required';
    if (!altPhoneNumber.trim()) errors.alternatePhone = 'Alternate Phone is required';
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!formData.country.trim()) errors.country = 'Country is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.postalCode.trim()) errors.postalCode = 'Postal Code is required';
    
    if (!formData.passportNumber.trim()) errors.passportNumber = 'Passport Number is required';
    if (!formData.passportIssueDate) errors.passportIssueDate = 'Passport Issue Date is required';
    if (!formData.passportExpiryDate) errors.passportExpiryDate = 'Passport Expiry Date is required';
    if (!formData.passportIssuingCountry.trim()) errors.passportIssuingCountry = 'Passport Issuing Country is required';
    if (mode === 'create' && formData.passportDocuments.length === 0) {
      errors.passportDocuments = 'Passport document upload is required';
    }
    
    if (!formData.identityType) errors.identityType = 'Identity Type is required';
    if (!formData.identityNumber.trim()) errors.identityNumber = 'Identity Number is required';
    if (!formData.identityIssueDate) errors.identityIssueDate = 'Identity Issue Date is required';
    if (!formData.identityExpiryDate) errors.identityExpiryDate = 'Identity Expiry Date is required';
    if (mode === 'create' && formData.identityDocuments.length === 0) {
      errors.identityDocuments = 'Identity document upload is required';
    }
    
    if (mode === 'create') {
      const validCerts = formData.certificates.filter(
        (c) => c.certificateName?.trim() && c.issueDate && c.expiryDate && c.document
      );
      if (validCerts.length === 0) {
        errors.certificates = 'At least one complete certificate is required';
      }
    }
    
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      if (errors.firstName || errors.lastName || errors.dateOfBirth || errors.nationality || errors.gender) {
        scrollToSection('crew-form-personal');
      } else if (errors.email || errors.phone || errors.alternatePhone || errors.address || errors.country || errors.city || errors.postalCode) {
        scrollToSection('crew-form-contact');
      } else if (errors.passportNumber || errors.passportIssueDate || errors.passportExpiryDate || errors.passportIssuingCountry || errors.passportDocuments) {
        scrollToSection('crew-form-passport');
      } else if (errors.identityType || errors.identityNumber || errors.identityIssueDate || errors.identityExpiryDate || errors.identityDocuments) {
        scrollToSection('crew-form-identity');
      } else if (errors.certificates) {
        scrollToSection('crew-form-certificates');
      }
      return;
    }
    
    await onSubmit(formData);
  };

  return (
    <form className="crew-member-form" onSubmit={handleSubmit}>
      <nav className="crew-member-form__nav" aria-label="Form sections">
        {FORM_SECTIONS.map((section) => {
          const hasError = (() => {
            if (section.id === 'crew-form-personal') {
              return ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'gender'].some(k => validationErrors[k]);
            }
            if (section.id === 'crew-form-contact') {
              return ['email', 'phone', 'alternatePhone', 'address', 'country', 'city', 'postalCode'].some(k => validationErrors[k]);
            }
            if (section.id === 'crew-form-passport') {
              return ['passportNumber', 'passportIssueDate', 'passportExpiryDate', 'passportIssuingCountry', 'passportDocuments'].some(k => validationErrors[k]);
            }
            if (section.id === 'crew-form-identity') {
              return ['identityType', 'identityNumber', 'identityIssueDate', 'identityExpiryDate', 'identityDocuments'].some(k => validationErrors[k]);
            }
            if (section.id === 'crew-form-certificates') {
              return ['certificates'].some(k => validationErrors[k]);
            }
            return false;
          })();
          return (
            <button
              key={section.id}
              type="button"
              className={`crew-member-form__nav-btn${activeSection === section.id ? ' is-active' : ''}${hasError ? ' has-error' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              {section.label} {hasError && '⚠️'}
            </button>
          );
        })}
      </nav>

      <div className="crew-member-form__scroll" ref={scrollContainerRef}>
        {/* Personal Details Section */}
        <section id="crew-form-personal" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Personal Details</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-sm font-semibold text-foreground">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.firstName && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.firstName && <span className="text-xs text-red-500">{validationErrors.firstName}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-sm font-semibold text-foreground">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.lastName && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.lastName && <span className="text-xs text-red-500">{validationErrors.lastName}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="dateOfBirth" className="text-sm font-semibold text-foreground">Date of Birth *</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.dateOfBirth && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.dateOfBirth && <span className="text-xs text-red-500">{validationErrors.dateOfBirth}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="nationality" className="text-sm font-semibold text-foreground">Nationality *</label>
              <input
                type="text"
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.nationality && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.nationality && <span className="text-xs text-red-500">{validationErrors.nationality}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="gender" className="text-sm font-semibold text-foreground">Gender *</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.gender && 'border-red-500 focus:ring-red-200')}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              {validationErrors.gender && <span className="text-xs text-red-500">{validationErrors.gender}</span>}
            </div>
          </div>
        </section>

        {/* Contact Details Section */}
        <section id="crew-form-contact" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Contact Details</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-foreground">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.email && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.email && <span className="text-xs text-red-500">{validationErrors.email}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-semibold text-foreground">Phone *</label>
              <div className="flex gap-2 items-center">
                <div className="relative shrink-0 w-[98px]" ref={phoneCountryWrapRef}>
                  <div
                    className="flex items-center justify-between gap-1 min-h-[42px] w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground hover:border-ring/50"
                    onClick={() => {
                      setPhoneCountryOpen(!phoneCountryOpen);
                      if (phoneCountryOpen) setPhoneCountryQuery('');
                    }}
                    aria-expanded={phoneCountryOpen}
                  >
                    {(() => {
                      const sel = phoneCountries.find((c) => c.dialCode === phoneDialCode);
                      return phoneCountryOpen ? (
                        <input
                          type="text"
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
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
                    <ul className={dropdownListClass}>
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
                  className={cn(inputClass, 'flex-1 min-w-0', validationErrors.phone && 'border-red-500 focus:ring-red-200')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="5551234567"
                  autoComplete="tel-national"
                />
              </div>
              {validationErrors.phone && <span className="text-xs text-red-500">{validationErrors.phone}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="alternatePhone" className="text-sm font-semibold text-foreground">Alternate Phone *</label>
              <div className="flex gap-2 items-center">
                <div className="relative shrink-0 w-[98px]" ref={altPhoneCountryWrapRef}>
                  <div
                    className="flex items-center justify-between gap-1 min-h-[42px] w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground hover:border-ring/50"
                    onClick={() => {
                      setAltPhoneCountryOpen(!altPhoneCountryOpen);
                      if (altPhoneCountryOpen) setAltPhoneCountryQuery('');
                    }}
                    aria-expanded={altPhoneCountryOpen}
                  >
                    {(() => {
                      const sel = phoneCountries.find((c) => c.dialCode === altPhoneDialCode);
                      return altPhoneCountryOpen ? (
                        <input
                          type="text"
                          className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
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
                    <ul className={dropdownListClass}>
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
                  className={cn(inputClass, 'flex-1 min-w-0', validationErrors.alternatePhone && 'border-red-500 focus:ring-red-200')}
                  value={altPhoneNumber}
                  onChange={(e) => setAltPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="5551234567"
                  autoComplete="tel-national"
                />
              </div>
              {validationErrors.alternatePhone && <span className="text-xs text-red-500">{validationErrors.alternatePhone}</span>}
            </div>
            <div className="flex flex-col gap-2 crew-member-form__field--full">
              <label htmlFor="address" className="text-sm font-semibold text-foreground">Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.address && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.address && <span className="text-xs text-red-500">{validationErrors.address}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="country" className="text-sm font-semibold text-foreground">Country *</label>
              <div className="relative" ref={countryWrapRef}>
                <input
                  id="country"
                  type="text"
                  className={cn(inputClass, 'w-full', validationErrors.country && 'border-red-500 focus:ring-red-200')}
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
            <div className="flex flex-col gap-2">
              <label htmlFor="city" className="text-sm font-semibold text-foreground">City *</label>
              <div className="relative" ref={cityWrapRef}>
                <input
                  id="city"
                  type="text"
                  className={cn(inputClass, 'w-full', validationErrors.city && 'border-red-500 focus:ring-red-200')}
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
            <div className="flex flex-col gap-2">
              <label htmlFor="postalCode" className="text-sm font-semibold text-foreground">Postal Code *</label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.postalCode && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.postalCode && <span className="text-xs text-red-500">{validationErrors.postalCode}</span>}
            </div>
          </div>
        </section>

        {/* Passport Information Section */}
        <section id="crew-form-passport" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Passport Information</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2">
              <label htmlFor="passportNumber" className="text-sm font-semibold text-foreground">Passport Number *</label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.passportNumber && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.passportNumber && <span className="text-xs text-red-500">{validationErrors.passportNumber}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportIssueDate" className="text-sm font-semibold text-foreground">Issue Date *</label>
              <input
                type="date"
                id="passportIssueDate"
                name="passportIssueDate"
                value={formData.passportIssueDate}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.passportIssueDate && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.passportIssueDate && <span className="text-xs text-red-500">{validationErrors.passportIssueDate}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportExpiryDate" className="text-sm font-semibold text-foreground">Expiry Date *</label>
              <input
                type="date"
                id="passportExpiryDate"
                name="passportExpiryDate"
                value={formData.passportExpiryDate}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.passportExpiryDate && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.passportExpiryDate && <span className="text-xs text-red-500">{validationErrors.passportExpiryDate}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportIssuingCountry" className="text-sm font-semibold text-foreground">Issuing Country *</label>
              <input
                type="text"
                id="passportIssuingCountry"
                name="passportIssuingCountry"
                value={formData.passportIssuingCountry}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.passportIssuingCountry && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.passportIssuingCountry && <span className="text-xs text-red-500">{validationErrors.passportIssuingCountry}</span>}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-4 crew-member-form__field--full">
            <label className="text-sm font-semibold text-foreground">Passport Document *</label>
            <div className={cn('crew-member-form__upload-zone', validationErrors.passportDocuments && 'border-red-500 bg-red-50/10')}>
              <input
                ref={passportFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e, 'passport')}
                className="sr-only"
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={() => passportFileInputRef.current?.click()}
              >
                <Upload size={18} />
                Upload Passport Documents
              </button>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 10MB per file)</p>
            </div>
            {validationErrors.passportDocuments && <span className="text-xs text-red-500 mt-1">{validationErrors.passportDocuments}</span>}
            {formData.passportDocuments.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {formData.passportDocuments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm text-foreground truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => removeFile(index, 'passport')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Identity Information Section */}
        <section id="crew-form-identity" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Identity Information</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2">
              <label htmlFor="identityType" className="text-sm font-semibold text-foreground">Identity Type *</label>
              <select
                id="identityType"
                name="identityType"
                value={formData.identityType}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.identityType && 'border-red-500 focus:ring-red-200')}
              >
                <option value="">Select</option>
                <option value="national_id">National ID</option>
                <option value="driving_license">Driving License</option>
                <option value="identity_number">Identity Number</option>
                <option value="other">Other</option>
              </select>
              {validationErrors.identityType && <span className="text-xs text-red-500">{validationErrors.identityType}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityNumber" className="text-sm font-semibold text-foreground">Identity Number *</label>
              <input
                type="text"
                id="identityNumber"
                name="identityNumber"
                value={formData.identityNumber}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.identityNumber && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.identityNumber && <span className="text-xs text-red-500">{validationErrors.identityNumber}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityIssueDate" className="text-sm font-semibold text-foreground">Issue Date *</label>
              <input
                type="date"
                id="identityIssueDate"
                name="identityIssueDate"
                value={formData.identityIssueDate}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.identityIssueDate && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.identityIssueDate && <span className="text-xs text-red-500">{validationErrors.identityIssueDate}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityExpiryDate" className="text-sm font-semibold text-foreground">Expiry Date *</label>
              <input
                type="date"
                id="identityExpiryDate"
                name="identityExpiryDate"
                value={formData.identityExpiryDate}
                onChange={handleInputChange}
                className={cn(inputClass, validationErrors.identityExpiryDate && 'border-red-500 focus:ring-red-200')}
              />
              {validationErrors.identityExpiryDate && <span className="text-xs text-red-500">{validationErrors.identityExpiryDate}</span>}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-4 crew-member-form__field--full">
            <label className="text-sm font-semibold text-foreground">Identity Document *</label>
            <div className={cn('crew-member-form__upload-zone', validationErrors.identityDocuments && 'border-red-500 bg-red-50/10')}>
              <input
                ref={identityFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e, 'identity')}
                className="sr-only"
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={() => identityFileInputRef.current?.click()}
              >
                <Upload size={18} />
                Upload Identity Documents
              </button>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 10MB per file)</p>
            </div>
            {validationErrors.identityDocuments && <span className="text-xs text-red-500 mt-1">{validationErrors.identityDocuments}</span>}
            {formData.identityDocuments.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {formData.identityDocuments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-sm text-foreground truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => removeFile(index, 'identity')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Crew Certificates Section */}
        <section id="crew-form-certificates" className="crew-member-form__section">
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#e5e7eb]">
            <h3 className="crew-member-form__section-title" style={{ margin: 0, padding: 0, border: 'none' }}>Crew Certificates</h3>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              onClick={addCertificate}
            >
              <Plus size={16} />
              Add certificate
            </button>
          </div>
          {validationErrors.certificates && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-500 border border-red-200">
              {validationErrors.certificates}
            </div>
          )}
          <div className="flex flex-col gap-4">
            {formData.certificates.map((cert, certIndex) => (
              <div
                key={certIndex}
                className="crew-member-form__cert-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Certificate {certIndex + 1}
                  </span>
                  {formData.certificates.length > 1 && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={() => removeCertificate(certIndex)}
                      aria-label={`Remove certificate ${certIndex + 1}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="crew-member-form__grid crew-member-form__grid--dense">
                  <div className="flex flex-col gap-2 crew-member-form__field--full">
                    <label className="text-sm font-semibold text-foreground">Certificate Name *</label>
                    <input
                      type="text"
                      value={cert.certificateName}
                      onChange={(e) => updateCertificate(certIndex, 'certificateName', e.target.value)}
                      placeholder="e.g. STCW Basic Safety"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">Issue Date *</label>
                    <input
                      type="date"
                      value={cert.issueDate}
                      onChange={(e) => updateCertificate(certIndex, 'issueDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">Expiry Date *</label>
                    <input
                      type="date"
                      value={cert.expiryDate}
                      onChange={(e) => updateCertificate(certIndex, 'expiryDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 crew-member-form__field--full">
                  <label className="text-sm font-semibold text-foreground">Certificate Document *</label>
                  <div className="crew-member-form__upload-zone">
                    <input
                      ref={(el) => {
                        certificateFileInputRefs.current[certIndex] = el;
                      }}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'certificate', certIndex)}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      onClick={() => certificateFileInputRefs.current[certIndex]?.click()}
                    >
                      <Upload size={18} />
                      Upload Certificate Document
                    </button>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 10MB)</p>
                  </div>
                  {cert.document && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 mt-2">
                      <span className="text-sm text-foreground truncate">{cert.document.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => removeFile(0, 'certificate', certIndex)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Professional & Compliance Section */}
        <section id="crew-form-professional" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Professional & Compliance</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2">
              <label htmlFor="azerbaijanVantageNumber" className="text-sm font-semibold text-foreground">Azerbaijan Vantage Number</label>
              <input
                type="text"
                id="azerbaijanVantageNumber"
                name="azerbaijanVantageNumber"
                value={formData.azerbaijanVantageNumber}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="norwegianDNumber" className="text-sm font-semibold text-foreground">Norwegian D Number</label>
              <input
                type="text"
                id="norwegianDNumber"
                name="norwegianDNumber"
                value={formData.norwegianDNumber}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="dawinciNumber" className="text-sm font-semibold text-foreground">DaWinci Number</label>
              <input
                type="text"
                id="dawinciNumber"
                name="dawinciNumber"
                value={formData.dawinciNumber}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="vantageNumber" className="text-sm font-semibold text-foreground">Vantage Number</label>
              <input
                type="text"
                id="vantageNumber"
                name="vantageNumber"
                value={formData.vantageNumber}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="organization" className="text-sm font-semibold text-foreground">Organization</label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2 crew-member-form__field--full">
              <label htmlFor="linkedin" className="text-sm font-semibold text-foreground">LinkedIn URL</label>
              <input
                type="url"
                id="linkedin"
                name="linkedin"
                placeholder="https://linkedin.com/in/..."
                value={formData.linkedin}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* MD Section 3.1 — Mobilization Profile */}
        <section id="crew-form-mobilization" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Mobilization Profile</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            {/* MD Section 3.1 — Preferred Rating */}
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="NEW">
              <label htmlFor="preferredRating" className="text-sm font-semibold text-foreground">Preferred Rating</label>
              <select
                id="preferredRating"
                name="preferredRating"
                value={formData.preferredRating}
                onChange={handleInputChange}
                className={inputClass}
              >
                {PREFERRED_RATING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {/* MD Section 3.1 — Primary BOP OEM */}
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="NEW">
              <label htmlFor="primaryBopOem" className="text-sm font-semibold text-foreground">Primary BOP OEM</label>
              <select
                id="primaryBopOem"
                name="primaryBopOem"
                value={formData.primaryBopOem}
                onChange={handleInputChange}
                className={inputClass}
              >
                {BOP_OEM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {/* MD Section 3.1 — Secondary Skills */}
            <div className="flex flex-col gap-2 crew-member-form__field--full dev-new-field" data-dev-tag="NEW">
              <label htmlFor="secondarySkills" className="text-sm font-semibold text-foreground">Secondary Skills</label>
              <input
                type="text"
                id="secondarySkills"
                name="secondarySkills"
                value={formData.secondarySkills}
                onChange={handleInputChange}
                placeholder="e.g. Tubing, Controls (comma-separated)"
                className={inputClass}
              />
            </div>
            {/* MD Section 3.2 — 7-tier current status */}
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="NEW">
              <label htmlFor="currentStatus" className="text-sm font-semibold text-foreground">Current Status</label>
              <select
                id="currentStatus"
                name="currentStatus"
                value={formData.currentStatus}
                onChange={handleInputChange}
                className={inputClass}
              >
                {CREW_STATUS_TIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {/* MD Section 3.1 — Last Worked */}
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="NEW">
              <label htmlFor="lastWorked" className="text-sm font-semibold text-foreground">Last Worked (Subseaquence)</label>
              <input
                type="date"
                id="lastWorked"
                name="lastWorked"
                value={formData.lastWorked}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Visa Details Section */}
        <section id="crew-form-visa" className="crew-member-form__section">
          <h3 className="crew-member-form__section-title">Visa Details</h3>
          <div className="crew-member-form__grid crew-member-form__grid--dense">
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="UPDATED">
              <label htmlFor="visaCountry" className="text-sm font-semibold text-foreground">Visa Country</label>
              <Popover open={visaCountryOpen} onOpenChange={setVisaCountryOpen} modal={false}>
                <PopoverAnchor asChild>
                  <input
                    ref={visaCountryInputRef}
                    id="visaCountry"
                    type="text"
                    className={inputClass}
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
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="UPDATED">
              <label htmlFor="visaIssueDate" className="text-sm font-semibold text-foreground">Visa Issue Date</label>
              <input
                type="date"
                id="visaIssueDate"
                name="visaIssueDate"
                value={formData.visaIssueDate}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2 dev-new-field" data-dev-tag="UPDATED">
              <label htmlFor="visaExpiryDate" className="text-sm font-semibold text-foreground">Visa Expiry Date</label>
              <input
                type="date"
                id="visaExpiryDate"
                name="visaExpiryDate"
                value={formData.visaExpiryDate}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="crew-member-form__actions">
        <button type="button" className="crew-member-form__btn crew-member-form__btn--cancel" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="crew-member-form__btn crew-member-form__btn--submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CrewMemberForm;
