import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Percent,
  Calendar,
  Plane,
  CheckCircle2,
} from 'lucide-react';
import { getCrewMe, getCrewEnrolledProjects } from '../api/crew';
import { getStoredCrewPanelUser, hasCrewAccessToken } from '../lib/crewPanelAuth';
import type { CrewMemberApi, CrewEnrolledProject } from '../api/crew';
import './CrewPanelDashboard.css';

function placeholderCrewProfile(email: string): CrewMemberApi {
  const name = email.split('@')[0] || 'Crew';
  const first = name.includes('.') ? name.split('.')[0] : name;
  const last = name.includes('.') ? name.split('.').slice(1).join(' ') : '';
  return {
    id: 'me',
    firstname: first.charAt(0).toUpperCase() + first.slice(1),
    lastname: last ? last.charAt(0).toUpperCase() + last.slice(1) : '',
    dateOfBirth: '',
    nationality: '',
    gender: '',
    email,
    phone: '',
    alternate_phone: '',
    address: '',
    city: '',
    country: '',
    postal_code: '',
    passport: { passport_number: '', issue_date: '', expiry_date: '', issuing_country: '', passport_document: '' },
    identity: { identity_type: '', identity_number: '', issue_date: '', expiry_date: '', identity_document: '' },
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const CrewPanelDashboard = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [enrolledProjects, setEnrolledProjects] = useState<CrewEnrolledProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    const user = getStoredCrewPanelUser();
    if (!user?.email) {
      navigate('/panel/crew/login', { replace: true });
      return;
    }

    let cancelled = false;
    Promise.all([getCrewMe(), getCrewEnrolledProjects()])
      .then(([me, { projects }]) => {
        if (cancelled) return;
        setCrew(me ?? placeholderCrewProfile(user.email));
        setEnrolledProjects(projects ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrew(placeholderCrewProfile(user.email));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="crew-panel-dashboard crew-panel-dashboard--loading">
        <div className="crew-panel-dashboard-spinner" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  const completedProjects = enrolledProjects.filter((p) => (p.status || '').toLowerCase() === 'completed');
  const currentProject = enrolledProjects.find((p) => (p.status || '').toLowerCase() === 'active') ?? enrolledProjects[0];
  const attendancePercent = 0; // TODO: wire to backend when API available

  return (
    <div className="crew-panel-dashboard">
      <header className="crew-panel-dashboard-header">
        <h1 className="crew-panel-dashboard-title">Dashboard</h1>
        <p className="crew-panel-dashboard-subtitle">Welcome back{crew ? `, ${crew.firstname}` : ''}. Here's your overview.</p>
      </header>

      <div className="crew-panel-dashboard-cards">
        <div className="crew-panel-dash-card">
          <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--blue">
            <CheckCircle2 size={24} />
          </div>
          <div className="crew-panel-dash-card-content">
            <span className="crew-panel-dash-card-value">{completedProjects.length}</span>
            <span className="crew-panel-dash-card-label">Completed Projects</span>
          </div>
        </div>

        <div className="crew-panel-dash-card">
          <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--green">
            <Percent size={24} />
          </div>
          <div className="crew-panel-dash-card-content">
            <span className="crew-panel-dash-card-value">{attendancePercent}%</span>
            <span className="crew-panel-dash-card-label">Attendance</span>
          </div>
        </div>

        <div className="crew-panel-dash-card crew-panel-dash-card--span-2">
          <div className="crew-panel-dash-card-header">
            <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--purple">
              <FolderKanban size={22} />
            </div>
            <h2 className="crew-panel-dash-card-title">Current Enrolled Project</h2>
          </div>
          <div className="crew-panel-dash-card-body">
            {currentProject ? (
              <div className="crew-panel-current-project">
                <h3 className="crew-panel-current-project-name">{currentProject.title}</h3>
                {currentProject.description && (
                  <p className="crew-panel-current-project-desc">{currentProject.description}</p>
                )}
                <div className="crew-panel-current-project-meta">
                  <span className="crew-panel-project-status crew-panel-project-status--active">
                    {currentProject.status || 'Active'}
                  </span>
                  {(currentProject.startDate || currentProject.endDate) && (
                    <span className="crew-panel-current-project-dates">
                      <Calendar size={14} />
                      {currentProject.startDate && currentProject.endDate
                        ? `${formatDate(currentProject.startDate)} – ${formatDate(currentProject.endDate)}`
                        : currentProject.startDate
                          ? formatDate(currentProject.startDate)
                          : currentProject.endDate
                            ? formatDate(currentProject.endDate)
                            : ''}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="crew-panel-dash-card-empty">No active project enrolled.</p>
            )}
          </div>
        </div>

        <div className="crew-panel-dash-card crew-panel-dash-card--span-2">
          <div className="crew-panel-dash-card-header">
            <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--teal">
              <Plane size={22} />
            </div>
            <h2 className="crew-panel-dash-card-title">Current Project Flight Ticket</h2>
          </div>
          <div className="crew-panel-dash-card-body">
            {currentProject ? (
              <div className="crew-panel-flight-details">
                <div className="crew-panel-flight-row">
                  <span className="crew-panel-flight-label">Flight</span>
                  <span className="crew-panel-flight-value">—</span>
                </div>
                <div className="crew-panel-flight-row">
                  <span className="crew-panel-flight-label">Departure</span>
                  <span className="crew-panel-flight-value">—</span>
                </div>
                <div className="crew-panel-flight-row">
                  <span className="crew-panel-flight-label">Arrival</span>
                  <span className="crew-panel-flight-value">—</span>
                </div>
                <div className="crew-panel-flight-row">
                  <span className="crew-panel-flight-label">Booking ref</span>
                  <span className="crew-panel-flight-value">—</span>
                </div>
                <p className="crew-panel-flight-hint">Flight details will appear when assigned by admin.</p>
              </div>
            ) : (
              <p className="crew-panel-dash-card-empty">No flight ticket. Enroll in a project first.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrewPanelDashboard;
