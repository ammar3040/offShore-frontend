import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../Modal';
import CrewMemberForm from '../forms/CrewMemberForm';
import './WelcomeSection.css';

interface CrewMemberFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  email: string;
  phone: string;
  alternatePhone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  role: string;
  department: string;
  employeeId: string;
  hireDate: string;
  status: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingCountry: string;
  passportDocuments: File[];
  identityType: string;
  identityNumber: string;
  identityIssueDate: string;
  identityExpiryDate: string;
  identityDocuments: File[];
  availabilityStatus: string;
  availabilityStartDate: string;
  availabilityEndDate: string;
  notes: string;
}

const WelcomeSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddCrewMember = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmitCrewMember = (data: CrewMemberFormData) => {
    // TODO: Implement API call to save crew member
    console.log('Crew Member Data:', data);
    
    // For now, just show an alert and close the modal
    alert(`Crew member ${data.firstName} ${data.lastName} added successfully!`);
    setIsModalOpen(false);
    
    // In a real application, you would:
    // 1. Upload files to a server
    // 2. Save crew member data via API
    // 3. Refresh the crew list
    // 4. Show success/error notifications
  };

  return (
    <>
      <div className="welcome-section">
        <div className="welcome-content">
          <h1 className="welcome-title">Start managing your crew!</h1>
          <p className="welcome-description">
            Create crew profiles, track certificates, manage travel tickets, and monitor crew availability.
          </p>
          <button className="welcome-button" onClick={handleAddCrewMember}>
            <Plus size={18} />
            Add new crew member
          </button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add New Crew Member"
        size="xlarge"
      >
        <CrewMemberForm
          onSubmit={handleSubmitCrewMember}
          onCancel={handleCloseModal}
        />
      </Modal>
    </>
  );
};

export default WelcomeSection;
