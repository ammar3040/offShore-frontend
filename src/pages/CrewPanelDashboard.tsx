import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Percent,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  ArrowRight,
} from 'lucide-react';
import { getCrewMeDashboard } from '../api/crew';
import { getStoredCrewPanelUser, hasCrewAccessToken } from '../lib/crewPanelAuth';
import type { CrewMemberApi, CrewEnrolledProject, CrewAvailability } from '../api/crew';
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
  const [availability, setAvailability] = useState<CrewAvailability | null>(null);
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
    getCrewMeDashboard()
      .then((res) => {
        if (cancelled) return;
        setCrew(res.crew ?? placeholderCrewProfile(user.email));
        setEnrolledProjects(res.enrolledProjects ?? []);
        setAvailability(res.availability ?? null);
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
  const activeProjects = enrolledProjects.filter((p) => (p.status || '').toLowerCase() === 'active');
  const totalEnrolled = enrolledProjects.length;
  const attendancePercent = 0; // TODO: wire to backend when API available

  return (
    <div className="crew-panel-dashboard">
      <header className="crew-panel-dashboard-header">
        <h1 className="crew-panel-dashboard-title">Dashboard</h1>
        <p className="crew-panel-dashboard-subtitle">Welcome back{crew ? `, ${crew.firstname}` : ''}. Here's your overview.</p>
      </header>

      <div className="crew-panel-dashboard-cards">
        <div className="crew-panel-dash-card">
          <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--purple">
            <FolderKanban size={24} />
          </div>
          <div className="crew-panel-dash-card-content">
            <span className="crew-panel-dash-card-value">{totalEnrolled}</span>
            <span className="crew-panel-dash-card-label">Enrolled Projects</span>
            <Link to="/panel/crew/enrolled-projects" className="crew-panel-dash-availability-link">
              View all
            </Link>
          </div>
        </div>

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

        <div className="crew-panel-dash-card">
          <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--amber">
            <CalendarRange size={24} />
          </div>
          <div className="crew-panel-dash-card-content">
            <span className="crew-panel-dash-card-label">Availability</span>
            {availability?.availableFrom && availability?.availableTo ? (
              <span className="crew-panel-dash-card-value crew-panel-dash-card-value--small">
                {formatDate(availability.availableFrom)} – {formatDate(availability.availableTo)}
              </span>
            ) : (
              <span className="crew-panel-dash-card-value crew-panel-dash-card-value--small crew-panel-dash-card-value--muted">
                Not set
              </span>
            )}
            <Link to="/panel/crew/availability" className="crew-panel-dash-availability-link">
              {availability?.availableFrom && availability?.availableTo ? 'Update' : 'Set'} availability
            </Link>
          </div>
        </div>

        <div className="crew-panel-dash-card crew-panel-dash-card--span-2 crew-panel-dash-card--overview">
          <div className="crew-panel-dash-card-header crew-panel-dash-card-header--overview">
            <div className="crew-panel-dash-card-icon crew-panel-dash-card-icon--purple">
              <FolderKanban size={22} />
            </div>
            <div className="crew-panel-dash-card-header-text">
              <h2 className="crew-panel-dash-card-title">Enrolled projects overview</h2>
              <p className="crew-panel-dash-card-subtitle">Summary of your project assignments</p>
            </div>
          </div>
          <div className="crew-panel-dash-card-body crew-panel-dash-card-body--overview">
            <div className="crew-panel-enrolled-stats">
              <div className="crew-panel-enrolled-stat">
                <div className="crew-panel-enrolled-stat-icon crew-panel-enrolled-stat-icon--purple">
                  <FolderKanban size={20} />
                </div>
                <div className="crew-panel-enrolled-stat-content">
                  <span className="crew-panel-enrolled-stat-value">{totalEnrolled}</span>
                  <span className="crew-panel-enrolled-stat-label">Total enrolled</span>
                </div>
              </div>
              <div className="crew-panel-enrolled-stat">
                <div className="crew-panel-enrolled-stat-icon crew-panel-enrolled-stat-icon--green">
                  <CircleDot size={20} />
                </div>
                <div className="crew-panel-enrolled-stat-content">
                  <span className="crew-panel-enrolled-stat-value">{activeProjects.length}</span>
                  <span className="crew-panel-enrolled-stat-label">Active</span>
                </div>
              </div>
              <div className="crew-panel-enrolled-stat">
                <div className="crew-panel-enrolled-stat-icon crew-panel-enrolled-stat-icon--blue">
                  <CheckCircle2 size={20} />
                </div>
                <div className="crew-panel-enrolled-stat-content">
                  <span className="crew-panel-enrolled-stat-value">{completedProjects.length}</span>
                  <span className="crew-panel-enrolled-stat-label">Completed</span>
                </div>
              </div>
            </div>
            <Link to="/panel/crew/enrolled-projects" className="crew-panel-enrolled-cta">
              <span>View all enrolled projects</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrewPanelDashboard;
