import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import './CrewMemberForm.css';

interface CrewMemberFormData {
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
  
  // Role Details
  role: string;
  department: string;
  employeeId: string;
  hireDate: string;
  status: string;
  
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
  
  // Availability & Notes
  availabilityStatus: string;
  availabilityStartDate: string;
  availabilityEndDate: string;
  notes: string;
}

interface CrewMemberFormProps {
  onSubmit: (data: CrewMemberFormData) => void;
  onCancel: () => void;
}

const CrewMemberForm = ({ onSubmit, onCancel }: CrewMemberFormProps) => {
  const [formData, setFormData] = useState<CrewMemberFormData>({
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
    role: '',
    department: '',
    employeeId: '',
    hireDate: '',
    status: 'active',
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
    availabilityStatus: 'available',
    availabilityStartDate: '',
    availabilityEndDate: '',
    notes: '',
  });

  const passportFileInputRef = useRef<HTMLInputElement>(null);
  const identityFileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passport' | 'identity'
  ) => {
    const files = Array.from(e.target.files || []);
    if (type === 'passport') {
      setFormData((prev) => ({
        ...prev,
        passportDocuments: [...prev.passportDocuments, ...files],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        identityDocuments: [...prev.identityDocuments, ...files],
      }));
    }
  };

  const removeFile = (index: number, type: 'passport' | 'identity') => {
    if (type === 'passport') {
      setFormData((prev) => ({
        ...prev,
        passportDocuments: prev.passportDocuments.filter((_, i) => i !== index),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        identityDocuments: prev.identityDocuments.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
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
              <label htmlFor="alternatePhone">Alternate Phone</label>
              <input
                type="tel"
                id="alternatePhone"
                name="alternatePhone"
                value={formData.alternatePhone}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="postalCode">Postal Code</label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Role Details Section */}
        <div className="form-section">
          <h3 className="form-section-title">Role Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="role">Role/Position *</label>
              <input
                type="text"
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                placeholder="e.g., Marine Engineer, Safety Officer"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="employeeId">Employee ID</label>
              <input
                type="text"
                id="employeeId"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="hireDate">Hire Date</label>
              <input
                type="date"
                id="hireDate"
                name="hireDate"
                value={formData.hireDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status *</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
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
              <label htmlFor="passportIssueDate">Issue Date</label>
              <input
                type="date"
                id="passportIssueDate"
                name="passportIssueDate"
                value={formData.passportIssueDate}
                onChange={handleInputChange}
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
              <label htmlFor="passportIssuingCountry">Issuing Country</label>
              <input
                type="text"
                id="passportIssuingCountry"
                name="passportIssuingCountry"
                value={formData.passportIssuingCountry}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <div className="file-upload-section">
            <label className="file-upload-label">Passport Documents</label>
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
              <label htmlFor="identityType">Identity Type</label>
              <select
                id="identityType"
                name="identityType"
                value={formData.identityType}
                onChange={handleInputChange}
              >
                <option value="">Select</option>
                <option value="national-id">National ID</option>
                <option value="driving-license">Driving License</option>
                <option value="seaman-book">Seaman Book</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="identityNumber">Identity Number</label>
              <input
                type="text"
                id="identityNumber"
                name="identityNumber"
                value={formData.identityNumber}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="identityIssueDate">Issue Date</label>
              <input
                type="date"
                id="identityIssueDate"
                name="identityIssueDate"
                value={formData.identityIssueDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="identityExpiryDate">Expiry Date</label>
              <input
                type="date"
                id="identityExpiryDate"
                name="identityExpiryDate"
                value={formData.identityExpiryDate}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <div className="file-upload-section">
            <label className="file-upload-label">Identity Documents</label>
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

        {/* Availability & Notes Section */}
        <div className="form-section">
          <h3 className="form-section-title">Availability & Notes</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="availabilityStatus">Availability Status *</label>
              <select
                id="availabilityStatus"
                name="availabilityStatus"
                value={formData.availabilityStatus}
                onChange={handleInputChange}
                required
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="on-assignment">On Assignment</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="availabilityStartDate">Available From</label>
              <input
                type="date"
                id="availabilityStartDate"
                name="availabilityStartDate"
                value={formData.availabilityStartDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="availabilityEndDate">Available Until</label>
              <input
                type="date"
                id="availabilityEndDate"
                name="availabilityEndDate"
                value={formData.availabilityEndDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Additional notes about the crew member..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary">
          Add Crew Member
        </button>
      </div>
    </form>
  );
};

export default CrewMemberForm;
