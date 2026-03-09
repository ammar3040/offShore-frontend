import { useState, useRef, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import './CrewMemberForm.css';

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

  // Crew Certificate
  certificateIssueDate: string;
  certificateExpiryDate: string;
  certificateDocuments: File[];

  // Professional & Compliance (optional)
  azerbaijanVantageNumber: string;
  norwegianDNumber: string;
  dawinciNumber: string;
  vantageNumber: string;
  organization: string;
  linkedin: string;
  visa: string;
}

interface CrewMemberFormProps {
  onSubmit: (data: CrewMemberFormData) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: CrewMemberFormData;
  submitLabel?: string;
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
  certificateIssueDate: '',
  certificateExpiryDate: '',
  certificateDocuments: [],
  azerbaijanVantageNumber: '',
  norwegianDNumber: '',
  dawinciNumber: '',
  vantageNumber: '',
  organization: '',
  linkedin: '',
  visa: '',
};

const CrewMemberForm = ({ onSubmit, onCancel, isLoading = false, initialData, submitLabel = 'Add Crew Member' }: CrewMemberFormProps) => {
  const [formData, setFormData] = useState<CrewMemberFormData>(() => initialData ?? defaultFormData);
  const hasPrefilled = useRef(false);

  // Pre-fill form when opening edit modal; sync once per mount when initialData exists
  useEffect(() => {
    if (initialData && !hasPrefilled.current) {
      setFormData(initialData);
      hasPrefilled.current = true;
    }
    return () => {
      hasPrefilled.current = false;
    };
  }, [initialData]);

  const passportFileInputRef = useRef<HTMLInputElement>(null);
  const identityFileInputRef = useRef<HTMLInputElement>(null);
  const certificateFileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passport' | 'identity' | 'certificate'
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
    } else {
      // certificate: maxCount 1, replace existing
      setFormData((prev) => ({
        ...prev,
        certificateDocuments: files.slice(0, 1),
      }));
    }
  };

  const removeFile = (index: number, type: 'passport' | 'identity' | 'certificate') => {
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
    } else {
      setFormData((prev) => ({
        ...prev,
        certificateDocuments: [],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form className="crew-member-form" onSubmit={handleSubmit}>
      <div className="form-sections">
        {/* Personal Details Section */}
        <div className="form-section">
          <h3 className="form-section-title">Personal Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="dateOfBirth">Date of Birth *</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="nationality">Nationality *</label>
              <input
                type="text"
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender *</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
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
        <div className="form-section">
          <h3 className="form-section-title">Contact Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="alternatePhone">Alternate Phone *</label>
              <input
                type="tel"
                id="alternatePhone"
                name="alternatePhone"
                value={formData.alternatePhone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="address">Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="country">Country *</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="postalCode">Postal Code *</label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Passport Information Section */}
        <div className="form-section">
          <h3 className="form-section-title">Passport Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="passportNumber">Passport Number *</label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="passportIssueDate">Issue Date *</label>
              <input
                type="date"
                id="passportIssueDate"
                name="passportIssueDate"
                value={formData.passportIssueDate}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="passportExpiryDate">Expiry Date *</label>
              <input
                type="date"
                id="passportExpiryDate"
                name="passportExpiryDate"
                value={formData.passportExpiryDate}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="passportIssuingCountry">Issuing Country *</label>
              <input
                type="text"
                id="passportIssuingCountry"
                name="passportIssuingCountry"
                value={formData.passportIssuingCountry}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          <div className="file-upload-section">
            <label className="file-upload-label">Passport Document *</label>
            <div className="file-upload-area">
              <input
                ref={passportFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e, 'passport')}
                className="file-input-hidden"
              />
              <button
                type="button"
                className="file-upload-button"
                onClick={() => passportFileInputRef.current?.click()}
              >
                <Upload size={18} />
                Upload Passport Documents
              </button>
              <p className="file-upload-hint">PDF, JPG, PNG (Max 10MB per file)</p>
            </div>
            {formData.passportDocuments.length > 0 && (
              <div className="uploaded-files">
                {formData.passportDocuments.map((file, index) => (
                  <div key={index} className="uploaded-file-item">
                    <span className="file-name">{file.name}</span>
                    <button
                      type="button"
                      className="file-remove-button"
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
        <div className="form-section">
          <h3 className="form-section-title">Identity Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="identityType">Identity Type *</label>
              <select
                id="identityType"
                name="identityType"
                value={formData.identityType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select</option>
                <option value="national_id">National ID</option>
                <option value="driving_license">Driving License</option>
                <option value="identity_number">Identity Number</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="identityNumber">Identity Number *</label>
              <input
                type="text"
                id="identityNumber"
                name="identityNumber"
                value={formData.identityNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="identityIssueDate">Issue Date *</label>
              <input
                type="date"
                id="identityIssueDate"
                name="identityIssueDate"
                value={formData.identityIssueDate}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="identityExpiryDate">Expiry Date *</label>
              <input
                type="date"
                id="identityExpiryDate"
                name="identityExpiryDate"
                value={formData.identityExpiryDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          <div className="file-upload-section">
            <label className="file-upload-label">Identity Document *</label>
            <div className="file-upload-area">
              <input
                ref={identityFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e, 'identity')}
                className="file-input-hidden"
              />
              <button
                type="button"
                className="file-upload-button"
                onClick={() => identityFileInputRef.current?.click()}
              >
                <Upload size={18} />
                Upload Identity Documents
              </button>
              <p className="file-upload-hint">PDF, JPG, PNG (Max 10MB per file)</p>
            </div>
            {formData.identityDocuments.length > 0 && (
              <div className="uploaded-files">
                {formData.identityDocuments.map((file, index) => (
                  <div key={index} className="uploaded-file-item">
                    <span className="file-name">{file.name}</span>
                    <button
                      type="button"
                      className="file-remove-button"
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

        {/* Crew Certificate Section */}
        <div className="form-section">
          <h3 className="form-section-title">Crew Certificate</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="certificateIssueDate">Issue Date *</label>
              <input
                type="date"
                id="certificateIssueDate"
                name="certificateIssueDate"
                value={formData.certificateIssueDate}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="certificateExpiryDate">Expiry Date *</label>
              <input
                type="date"
                id="certificateExpiryDate"
                name="certificateExpiryDate"
                value={formData.certificateExpiryDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="file-upload-section">
            <label className="file-upload-label">Certificate Document *</label>
            <div className="file-upload-area">
              <input
                ref={certificateFileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileUpload(e, 'certificate')}
                className="file-input-hidden"
              />
              <button
                type="button"
                className="file-upload-button"
                onClick={() => certificateFileInputRef.current?.click()}
              >
                <Upload size={18} />
                Upload Certificate Document
              </button>
              <p className="file-upload-hint">PDF, JPG, PNG (Max 10MB, one file)</p>
            </div>
            {formData.certificateDocuments.length > 0 && (
              <div className="uploaded-files">
                {formData.certificateDocuments.map((file, index) => (
                  <div key={index} className="uploaded-file-item">
                    <span className="file-name">{file.name}</span>
                    <button
                      type="button"
                      className="file-remove-button"
                      onClick={() => removeFile(index, 'certificate')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Professional & Compliance Section */}
        <div className="form-section">
          <h3 className="form-section-title">Professional & Compliance</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="azerbaijanVantageNumber">Azerbaijan Vantage Number</label>
              <input
                type="text"
                id="azerbaijanVantageNumber"
                name="azerbaijanVantageNumber"
                value={formData.azerbaijanVantageNumber}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="norwegianDNumber">Norwegian D Number</label>
              <input
                type="text"
                id="norwegianDNumber"
                name="norwegianDNumber"
                value={formData.norwegianDNumber}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dawinciNumber">DaWinci Number</label>
              <input
                type="text"
                id="dawinciNumber"
                name="dawinciNumber"
                value={formData.dawinciNumber}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="vantageNumber">Vantage Number</label>
              <input
                type="text"
                id="vantageNumber"
                name="vantageNumber"
                value={formData.vantageNumber}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="organization">Organization</label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="linkedin">LinkedIn URL</label>
              <input
                type="url"
                id="linkedin"
                name="linkedin"
                placeholder="https://linkedin.com/in/..."
                value={formData.linkedin}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="visa">Visa Info</label>
              <input
                type="text"
                id="visa"
                name="visa"
                value={formData.visa}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CrewMemberForm;
