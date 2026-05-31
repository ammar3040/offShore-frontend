import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, Plus } from 'lucide-react';
import { Country, City } from 'country-state-city';
import type { ICountry, ICity } from 'country-state-city';
import { countries as phoneCountries } from 'country-codes-flags-phone-codes';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SUBSEA_OVERLAY_LIGHT_CLASS } from '@/lib/subseaTheme';

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
}

interface CrewMemberFormProps {
  onSubmit: (data: CrewMemberFormData) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: CrewMemberFormData;
  submitLabel?: string;
  theme?: 'default' | 'subsea';
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

const CrewMemberForm = ({ onSubmit, onCancel, isLoading = false, initialData, submitLabel = 'Add Crew Member', theme = 'default' }: CrewMemberFormProps) => {
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

  // Pre-fill form when opening edit modal; sync once per mount when initialData exists
  useEffect(() => {
    if (initialData && !hasPrefilled.current) {
      // Normalize legacy single-certificate shape to certificates array
      const data = { ...initialData };
      if (!data.certificates?.length && (initialData as unknown as Record<string, unknown>).certificateIssueDate != null) {
        const leg = initialData as typeof initialData & { certificateIssueDate?: string; certificateExpiryDate?: string; certificateDocuments?: File[] };
        data.certificates = [{
          certificateName: 'Certificate',
          issueDate: leg.certificateIssueDate ?? '',
          expiryDate: leg.certificateExpiryDate ?? '',
          document: leg.certificateDocuments?.[0] ?? null,
        }];
      } else if (!data.certificates?.length) {
        data.certificates = [{ certificateName: '', issueDate: '', expiryDate: '', document: null }];
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
    if (!formData.country?.trim()) return;
    if (!formData.city?.trim()) return;
    const validCerts = formData.certificates.filter(
      (c) => c.certificateName?.trim() && c.issueDate && c.expiryDate && c.document
    );
    if (validCerts.length === 0) return;
    await onSubmit(formData);
  };

  return (
    <form className="flex flex-col gap-0" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-8 max-h-[calc(90vh-200px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50">
        {/* Personal Details Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Personal Details</h3>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-sm font-semibold text-foreground">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-sm font-semibold text-foreground">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="dateOfBirth" className="text-sm font-semibold text-foreground">Date of Birth *</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="nationality" className="text-sm font-semibold text-foreground">Nationality *</label>
              <input
                type="text"
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="gender" className="text-sm font-semibold text-foreground">Gender *</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
                className={inputClass}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Details Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Contact Details</h3>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-foreground">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
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
                  className={cn(inputClass, 'flex-1 min-w-0')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="5551234567"
                  autoComplete="tel-national"
                  required
                />
              </div>
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
                  className={cn(inputClass, 'flex-1 min-w-0')}
                  value={altPhoneNumber}
                  onChange={(e) => setAltPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="5551234567"
                  autoComplete="tel-national"
                  required
                />
              </div>
            </div>
            <div className={cn("flex flex-col gap-2", "col-span-full")}>
              <label htmlFor="address" className="text-sm font-semibold text-foreground">Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="country" className="text-sm font-semibold text-foreground">Country *</label>
              <div className="relative" ref={countryWrapRef}>
                <input
                  id="country"
                  type="text"
                  className={inputClass}
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
                  required={!formData.country}
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
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="city" className="text-sm font-semibold text-foreground">City *</label>
              <div className="relative" ref={cityWrapRef}>
                <input
                  id="city"
                  type="text"
                  className={inputClass}
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
                  required={!formData.city}
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
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="postalCode" className="text-sm font-semibold text-foreground">Postal Code *</label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Passport Information Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Passport Information</h3>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="passportNumber" className="text-sm font-semibold text-foreground">Passport Number *</label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportIssueDate" className="text-sm font-semibold text-foreground">Issue Date *</label>
              <input
                type="date"
                id="passportIssueDate"
                name="passportIssueDate"
                value={formData.passportIssueDate}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportExpiryDate" className="text-sm font-semibold text-foreground">Expiry Date *</label>
              <input
                type="date"
                id="passportExpiryDate"
                name="passportExpiryDate"
                value={formData.passportExpiryDate}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passportIssuingCountry" className="text-sm font-semibold text-foreground">Issuing Country *</label>
              <input
                type="text"
                id="passportIssuingCountry"
                name="passportIssuingCountry"
                value={formData.passportIssuingCountry}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground">Passport Document *</label>
            <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 hover:border-muted-foreground/50">
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
        </div>

        {/* Identity Information Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Identity Information</h3>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="identityType" className="text-sm font-semibold text-foreground">Identity Type *</label>
              <select
                id="identityType"
                name="identityType"
                value={formData.identityType}
                onChange={handleInputChange}
                required
                className={inputClass}
              >
                <option value="">Select</option>
                <option value="national_id">National ID</option>
                <option value="driving_license">Driving License</option>
                <option value="identity_number">Identity Number</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityNumber" className="text-sm font-semibold text-foreground">Identity Number *</label>
              <input
                type="text"
                id="identityNumber"
                name="identityNumber"
                value={formData.identityNumber}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityIssueDate" className="text-sm font-semibold text-foreground">Issue Date *</label>
              <input
                type="date"
                id="identityIssueDate"
                name="identityIssueDate"
                value={formData.identityIssueDate}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="identityExpiryDate" className="text-sm font-semibold text-foreground">Expiry Date *</label>
              <input
                type="date"
                id="identityExpiryDate"
                name="identityExpiryDate"
                value={formData.identityExpiryDate}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground">Identity Document *</label>
            <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 hover:border-muted-foreground/50">
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
        </div>

        {/* Crew Certificates Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-muted">
            <h3 className="text-lg font-bold text-foreground">Crew Certificates</h3>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              onClick={addCertificate}
            >
              <Plus size={16} />
              Add certificate
            </button>
          </div>
          <div className="flex flex-col gap-6">
            {formData.certificates.map((cert, certIndex) => (
              <div
                key={certIndex}
                className="rounded-lg border border-border bg-muted/20 p-4 space-y-4"
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
                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2 col-span-full">
                    <label className="text-sm font-semibold text-foreground">Certificate Name *</label>
                    <input
                      type="text"
                      value={cert.certificateName}
                      onChange={(e) => updateCertificate(certIndex, 'certificateName', e.target.value)}
                      placeholder="e.g. STCW Basic Safety"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">Issue Date *</label>
                    <input
                      type="date"
                      value={cert.issueDate}
                      onChange={(e) => updateCertificate(certIndex, 'issueDate', e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-foreground">Expiry Date *</label>
                    <input
                      type="date"
                      value={cert.expiryDate}
                      onChange={(e) => updateCertificate(certIndex, 'expiryDate', e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-foreground">Certificate Document *</label>
                  <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted bg-muted/30 p-4 hover:border-muted-foreground/50">
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
        </div>

        {/* Professional & Compliance Section */}
        <div className="border-b border-border pb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Professional & Compliance</h3>
          <div className="grid grid-cols-2 gap-5">
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
            <div className={cn("flex flex-col gap-2", "col-span-full")}>
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
        </div>

        {/* Visa Details Section */}
        <div className="border-b border-border pb-6 mb-6 last:border-b-0 last:pb-0">
          <h3 className="text-lg font-bold text-foreground mb-5 pb-3 border-b-2 border-muted">Visa Details</h3>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
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
            <div className="flex flex-col gap-2">
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
            <div className="flex flex-col gap-2">
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
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button type="button" className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CrewMemberForm;
