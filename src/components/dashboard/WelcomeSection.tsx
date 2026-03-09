import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../Modal';
import ErrorAlertPopup from '../ErrorAlertPopup';
import CrewMemberForm, { type CrewMemberFormData } from '../forms/CrewMemberForm';
import { createCrewMember } from '../../api/crew';
import './WelcomeSection.css';

const WelcomeSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const handleAddCrewMember = () => {
    setIsModalOpen(true);
    setError(null);
  };

  const handleCloseModal = () => {
    if (!isLoading) {
      setIsModalOpen(false);
      setError(null);
    }
  };

  const handleSubmitCrewMember = async (data: CrewMemberFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await createCrewMember(data);

      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        const text = await response.text();
        if (text) {
          try {
            const errorData = JSON.parse(text);
            message = errorData?.message || errorData?.error || message;
          } catch {
            message = text;
          }
        }
        setError(message);
        return;
      }

      setIsModalOpen(false);
      if (response.status === 201) {
        setShowSuccessBanner(true);
      }
      // TODO: Refresh crew list if needed
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add crew member';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showSuccessBanner && (
        <div className="success-banner" role="status">
          <span className="success-banner-message">
            Crew added successfully and login credentials have been mailed to the email.
          </span>
          <button
            type="button"
            className="success-banner-dismiss"
            onClick={() => setShowSuccessBanner(false)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
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
        {error && (
          <ErrorAlertPopup message={error} onDismiss={() => setError(null)} />
        )}
        <CrewMemberForm
          onSubmit={handleSubmitCrewMember}
          onCancel={handleCloseModal}
          isLoading={isLoading}
        />
      </Modal>
    </>
  );
};

export default WelcomeSection;
