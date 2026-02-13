import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearCrewPanelUser } from '../lib/crewPanelAuth';
import './CrewPanelLayout.css';

interface CrewPanelLayoutProps {
  children: ReactNode;
}

const CrewPanelLayout = ({ children }: CrewPanelLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearCrewPanelUser();
    navigate('/panel/crew/login');
  };

  return (
    <div className="crew-panel-layout">
      <header className="crew-panel-header">
        <div className="crew-panel-logo">
          <div className="crew-panel-logo-icon">O</div>
          <span className="crew-panel-logo-text">Offshore CRM</span>
          <span className="crew-panel-badge">Crew</span>
        </div>
        <button
          type="button"
          className="crew-panel-logout"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </header>
      <main className="crew-panel-main">{children}</main>
    </div>
  );
};

export default CrewPanelLayout;
