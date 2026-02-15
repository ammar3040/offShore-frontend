import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { getCrewEnrolledProjects } from '../api/crew';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewTicketsPage.css';

const CrewTicketsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasProjects, setHasProjects] = useState(false);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    getCrewEnrolledProjects()
      .then(({ projects }) => {
        if (!cancelled) setHasProjects((projects ?? []).length > 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="crew-tickets-loading">
        <div className="crew-tickets-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="crew-tickets-page">
      <header className="crew-tickets-header">
        <h1 className="crew-tickets-title">Tickets</h1>
        <p className="crew-tickets-subtitle">Your flight tickets for assigned projects</p>
      </header>
      <div className="crew-tickets-placeholder">
        <Plane size={48} className="crew-tickets-icon" />
        <p>{hasProjects ? 'No flight tickets assigned yet.' : 'Enroll in a project to receive flight tickets.'}</p>
      </div>
    </div>
  );
};

export default CrewTicketsPage;
