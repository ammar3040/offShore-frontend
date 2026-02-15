import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Settings } from 'lucide-react';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewSettingsPage.css';

const CrewSettingsPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="crew-settings-page">
      <header className="crew-settings-header">
        <h1 className="crew-settings-title">Settings</h1>
        <p className="crew-settings-subtitle">Manage your account preferences</p>
      </header>
      <div className="crew-settings-placeholder">
        <Settings size={48} className="crew-settings-icon" />
        <p>Settings coming soon.</p>
      </div>
    </div>
  );
};

export default CrewSettingsPage;
