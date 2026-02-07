import { Plus } from 'lucide-react';
import './WelcomeSection.css';

const WelcomeSection = () => {
  return (
    <div className="welcome-section">
      <div className="welcome-content">
        <h1 className="welcome-title">Start managing your crew!</h1>
        <p className="welcome-description">
          Create crew profiles, track certificates, manage travel tickets, and monitor crew availability.
        </p>
        <button className="welcome-button">
          <Plus size={18} />
          Add new crew member
        </button>
      </div>
    </div>
  );
};

export default WelcomeSection;
