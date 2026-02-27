import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderKanban, Ship, Ticket, Percent, Plus } from 'lucide-react';
import { getSuperadminAnalytics, updateSuperadminMarkup } from '../api/superadmin';
import { Toaster, useToast } from '../components/Toast';
import './SuperadminDashboard.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const SuperadminDashboard = () => {
  const { toasts, toast, dismiss } = useToast();
  const [markup, setMarkup] = useState<number | null>(null);
  const [showMarkupForm, setShowMarkupForm] = useState(false);
  const [markupInput, setMarkupInput] = useState('');
  const [markupSaving, setMarkupSaving] = useState(false);
  const [analytics, setAnalytics] = useState<{
    totalAdmins: number;
    activeAdmins: number;
    totalProjects: number;
    totalCrew: number;
    totalTickets: number;
    adminsByActivity?: { adminId: string; email: string; projectsCount: number; crewCount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSuperadminAnalytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
          setAnalytics({
            totalAdmins: 0,
            activeAdmins: 0,
            totalProjects: 0,
            totalCrew: 0,
            totalTickets: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    {
      icon: Users,
      label: 'TOTAL ADMINS',
      value: loading ? '…' : (analytics?.totalAdmins ?? 0),
      iconClass: 'superadmin-dash-icon--amber',
    },
    {
      icon: Users,
      label: 'ACTIVE ADMINS',
      value: loading ? '…' : (analytics?.activeAdmins ?? 0),
      iconClass: 'superadmin-dash-icon--green',
    },
    {
      icon: FolderKanban,
      label: 'TOTAL PROJECTS',
      value: loading ? '…' : (analytics?.totalProjects ?? 0),
      iconClass: 'superadmin-dash-icon--blue',
    },
    {
      icon: Ship,
      label: 'TOTAL CREW',
      value: loading ? '…' : (analytics?.totalCrew ?? 0),
      iconClass: 'superadmin-dash-icon--purple',
    },
    {
      icon: Ticket,
      label: 'TOTAL TICKETS',
      value: loading ? '…' : (analytics?.totalTickets ?? 0),
      iconClass: 'superadmin-dash-icon--orange',
    },
  ];

  const adminsByActivity = analytics?.adminsByActivity ?? [];

  const handleSaveMarkup = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(markupInput.trim());
    if (isNaN(value) || value < 0 || value > 100) {
      toast('error', 'Invalid markup', 'Please enter a number between 0 and 100.');
      return;
    }
    setMarkupSaving(true);
    try {
      const res = await updateSuperadminMarkup(value);
      setMarkup(res.superAdmin.markup);
      setShowMarkupForm(false);
      setMarkupInput('');
      toast('success', 'Markup updated', res.message);
    } catch (err) {
      toast('error', 'Update failed', err instanceof Error ? err.message : 'Failed to update markup.');
    } finally {
      setMarkupSaving(false);
    }
  };

  return (
    <div className="superadmin-dashboard">
      <Toaster toasts={toasts} dismiss={dismiss} />
      <header className="superadmin-dashboard-header">
        <div>
          <h1 className="superadmin-dashboard-greeting">{getGreeting()}, Superadmin</h1>
          <p className="superadmin-dashboard-date">Today is {formatDate(new Date())}.</p>
        </div>
      </header>

      {error && (
        <div className="superadmin-dashboard-error" role="alert">
          {error}
        </div>
      )}

      <div className="superadmin-dashboard-cards">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="superadmin-dash-card">
              <div className={`superadmin-dash-card-icon ${s.iconClass}`}>
                <Icon size={24} />
              </div>
              <div className="superadmin-dash-card-content">
                <span className="superadmin-dash-card-value">{s.value}</span>
                <span className="superadmin-dash-card-label">{s.label}</span>
              </div>
            </div>
          );
        })}
        <div className="superadmin-dash-card superadmin-dash-card-markup">
          <div className="superadmin-dash-card-icon superadmin-dash-icon--teal">
            <Percent size={24} />
          </div>
          <div className="superadmin-dash-card-content">
            {showMarkupForm ? (
              <form className="superadmin-markup-form" onSubmit={handleSaveMarkup}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={markupInput}
                  onChange={(e) => setMarkupInput(e.target.value)}
                  placeholder="e.g. 15.5"
                  className="superadmin-markup-input"
                  autoFocus
                  disabled={markupSaving}
                />
                <div className="superadmin-markup-actions">
                  <button type="submit" className="superadmin-markup-save" disabled={markupSaving}>
                    {markupSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="superadmin-markup-cancel"
                    onClick={() => { setShowMarkupForm(false); setMarkupInput(''); }}
                    disabled={markupSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span className="superadmin-dash-card-value">
                  {markup != null ? `${markup}%` : '—'}
                </span>
                <span className="superadmin-dash-card-label">MARKUP</span>
                <button
                  type="button"
                  className="superadmin-markup-add-btn"
                  onClick={() => setShowMarkupForm(true)}
                  title="Add markup"
                  aria-label="Add markup"
                >
                  <Plus size={14} />
                  Add Markup
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="superadmin-dashboard-panels">
        <div className="superadmin-dashboard-panel">
          <div className="superadmin-panel-header">
            <h2 className="superadmin-panel-title">Admins by Activity</h2>
            <Link to="/panel/superadmin/admins" className="superadmin-panel-view-all">
              View All Admins
            </Link>
          </div>
          <div className="superadmin-panel-body">
            {loading ? (
              <p className="superadmin-panel-empty">Loading…</p>
            ) : adminsByActivity.length === 0 ? (
              <p className="superadmin-panel-empty">
                No admin activity data yet. Admins will appear here as they manage projects and crew.
              </p>
            ) : (
              <ul className="superadmin-admins-list">
                {adminsByActivity.slice(0, 8).map((a) => (
                  <li key={a.adminId} className="superadmin-admin-item">
                    <span className="superadmin-admin-email">{a.email}</span>
                    <div className="superadmin-admin-stats">
                      <span className="superadmin-admin-stat">{a.projectsCount} projects</span>
                      <span className="superadmin-admin-stat">{a.crewCount} crew</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="superadmin-dashboard-panel">
          <div className="superadmin-panel-header">
            <h2 className="superadmin-panel-title">Quick Actions</h2>
          </div>
          <div className="superadmin-panel-body">
            <nav className="superadmin-quick-actions">
              <Link to="/panel/superadmin/admins" className="superadmin-quick-link">
                <Users size={20} />
                Create Admin
              </Link>
              <Link to="/panel/superadmin/tickets" className="superadmin-quick-link">
                <Ticket size={20} />
                View Crew Tickets
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminDashboard;
