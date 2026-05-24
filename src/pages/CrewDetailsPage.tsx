import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Anchor,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Bell,
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  IdCard,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plane,
  Printer,
  Radio,
  RefreshCw,
  Settings,
  Ship,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { getCrewById, type CrewAssignedProject, type CrewMemberApi } from '../api/crew';
import { availabilityFromCrewSignal } from '../utils/crewAvailability';
import './RigsPage.css';

type ProfileTab = 'overview' | 'records' | 'documents' | 'jobs' | 'pay';

const SAMPLE_RANKS = ['Master', 'Chief Officer', '2nd Engineer', 'DP Operator', 'Chief Engineer', 'Radio Officer'];
const SAMPLE_VESSELS = ['MV Deepwater Alpha', 'MV Nordic Surveyor', 'MV Poseidon Rex', 'MV Atlantic Pioneer'];

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fullDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(crew?: CrewMemberApi | null): string {
  if (!crew) return '??';
  return `${crew.firstname?.[0] ?? ''}${crew.lastname?.[0] ?? ''}`.toUpperCase() || '??';
}

function crewName(crew?: CrewMemberApi | null): string {
  if (!crew) return 'Crew Profile';
  return `${crew.firstname ?? ''} ${crew.lastname ?? ''}`.trim() || 'Crew Profile';
}

function field(value?: string | null): string {
  return value?.trim() || '-';
}

function statusMeta(crew?: CrewMemberApi | null): { label: string; className: string } {
  const availability = availabilityFromCrewSignal(crew?.signal);
  if (availability === 'available') return { label: 'Available', className: 'subsea-b-green' };
  if (availability === 'endingSoon') return { label: 'Sign-Off Due', className: 'subsea-b-amber' };
  return { label: 'On Board', className: 'subsea-b-blue' };
}

function currentAssignment(projects: CrewAssignedProject[], crew?: CrewMemberApi | null) {
  const project = projects[0] ?? crew?.activeProjects?.[0];
  return {
    vessel: project?.title || SAMPLE_VESSELS[0],
    signOn: project?.duration?.startDate,
    signOff: project?.duration?.endDate,
    status: project?.status || 'Active',
  };
}

const CrewDetailsPage = () => {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [projects, setProjects] = useState<CrewAssignedProject[]>([]);
  const [loading, setLoading] = useState(() => Boolean(crewId));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  useEffect(() => {
    if (!crewId) {
      return;
    }

    let cancelled = false;
    getCrewById(crewId)
      .then((res) => {
        if (cancelled) return;
        setCrew(res.crew);
        setProjects(res.projects ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load crew details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [crewId]);

  const status = statusMeta(crew);
  const pageError = !crewId ? 'Missing crew id' : error;
  const assignment = useMemo(() => currentAssignment(projects, crew), [projects, crew]);
  const rank = crew?.organization || SAMPLE_RANKS[0];
  const certExpiry = crew?.certificate_expiry_date || crew?.crew_certificate?.expiry_date;
  const passport = crew?.passport;
  const identity = crew?.identity;

  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof User; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'records', label: 'Records', icon: History },
    { id: 'documents', label: 'Documents', icon: BadgeCheck, badge: certExpiry ? '1' : undefined },
    { id: 'jobs', label: 'Jobs', icon: Ship },
    { id: 'pay', label: 'Pay', icon: Banknote },
  ];

  return (
    <div className="subsea-shell">
      <nav className="subsea-nav" aria-label="Subseacore modules">
        <button type="button" className="subsea-brand" aria-label="Subseacore">
          <span className="subsea-mark">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17l4-8 4 4 4-6 4 10" />
              <circle cx="12" cy="5" r="2" />
            </svg>
          </span>
        </button>
        <div className="subsea-nav-items">
          {[
            { icon: LayoutDashboard, label: 'Dashboard' },
            { icon: Users, label: 'Crew Management', active: true, badge: true },
            { icon: Ship, label: 'Vessels' },
            { icon: Plane, label: 'Flight Bookings' },
            { icon: Wallet, label: 'Payroll' },
            { icon: FileText, label: 'Contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar' },
            { divider: true },
            { icon: Bell, label: 'Notifications' },
          ].map((item, index) => {
            if ('divider' in item) return <span key={`divider-${index}`} className="subsea-nav-sep" />;
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" className={`subsea-ni${item.active ? ' active' : ''}`} aria-label={item.label}>
                <Icon size={17} />
                {item.badge && <span className="subsea-ni-badge" />}
                <span className="subsea-ni-tip">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="subsea-nav-foot">
          <button type="button" className="subsea-ni" aria-label="Settings"><Settings size={17} /><span className="subsea-ni-tip">Settings</span></button>
          <button type="button" className="subsea-ni" aria-label="Help"><HelpCircle size={17} /><span className="subsea-ni-tip">Help</span></button>
          <div className="subsea-avatar">SK</div>
        </div>
      </nav>

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Crew Profile</span>
          <button type="button" className="subsea-sb-btn" aria-label="Profile settings">
            <Settings size={13} />
          </button>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Profile</div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`subsea-sb-link${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} /> {tab.label}
                {tab.badge && <span className="subsea-sb-count subsea-sb-count-red">{tab.badge}</span>}
              </button>
            );
          })}
          <div className="subsea-sb-group">Actions</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <ArrowLeft size={13} /> Back to Crew
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span>Crew Management</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Crew Profile</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><Printer size={12} /> Print</button>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><MessageSquare size={12} /> Message</button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm"><User size={12} /> Edit Profile</button>
            <span className="subsea-vr" />
            <div className="subsea-avatar subsea-avatar-sm">SK</div>
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div className="subsea-profile-head-left">
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>
                <ArrowLeft size={11} /> Back
              </button>
              <div>
                <h1>Crew Profile</h1>
                <p>{crew ? `${crewName(crew)} details` : 'Crew member details'}</p>
              </div>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><Printer size={11} /> Print</button>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><MessageSquare size={11} /> Message</button>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm">Edit Profile</button>
            </div>
          </div>

          {loading ? (
            <div className="subsea-state" role="status">Loading crew profile...</div>
          ) : pageError ? (
            <div className="subsea-empty-panel" role="alert">
              <User size={34} />
              <h3>Unable to load crew profile</h3>
              <p>{pageError}</p>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>Back to Crew</button>
            </div>
          ) : crew ? (
            <>
              <section className="subsea-prof-hero">
                <div className="subsea-prof-cover">
                  <div className="subsea-prof-av-wrap">
                    <div className="subsea-prof-av">{initials(crew)}</div>
                  </div>
                </div>
                <div className="subsea-prof-info">
                  <div className="subsea-prof-info-top">
                    <div>
                      <div className="subsea-prof-name">{crewName(crew)}</div>
                      <div className="subsea-prof-role">{rank} - {assignment.vessel}</div>
                      <div className="subsea-prof-meta">
                        <div className="subsea-prof-meta-item"><IdCard size={13} /><span>IMO: {field(crew.dawinci_number || crew.vantage_number)}</span></div>
                        <div className="subsea-prof-meta-item"><MapPin size={13} /><span>{field(crew.nationality || crew.country)}</span></div>
                        <div className="subsea-prof-meta-item"><Calendar size={13} /><span>DOB: {formatDate(crew.dateOfBirth)}</span></div>
                        <div className="subsea-prof-meta-item"><Phone size={13} /><span>{field(crew.phone)}</span></div>
                        <div className="subsea-prof-meta-item"><Mail size={13} /><span>{field(crew.email)}</span></div>
                      </div>
                    </div>
                    <span className={`subsea-badge ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="subsea-prof-actions">
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">Sign Off</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><RefreshCw size={11} /> Find Relief</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><Plane size={11} /> Book Flight</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><FileText size={11} /> View Contract</button>
                  </div>
                </div>
              </section>

              <div className="subsea-prof-tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      type="button"
                      key={tab.id}
                      className={`subsea-prof-tab${activeTab === tab.id ? ' active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon size={13} /> {tab.label}
                      {tab.badge && <span className="subsea-badge subsea-b-red">{tab.badge}</span>}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'overview' && (
                <div className="subsea-g2">
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Personal Details</div></div>
                    <div className="subsea-detail-grid">
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Full Name</div><div className="subsea-detail-val">{crewName(crew)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Date of Birth</div><div className="subsea-detail-val">{fullDate(crew.dateOfBirth)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Nationality</div><div className="subsea-detail-val">{field(crew.nationality)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Passport No.</div><div className="subsea-detail-val">{field(passport?.passport_number)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Identity No.</div><div className="subsea-detail-val">{field(identity?.identity_number)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Vantage No.</div><div className="subsea-detail-val">{field(crew.vantage_number || crew.azerbaijan_vantage_number)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Home Port</div><div className="subsea-detail-val">{field(crew.city || crew.country)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Address</div><div className="subsea-detail-val">{field(crew.address)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Gender</div><div className="subsea-detail-val">{field(crew.gender)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Visa</div><div className="subsea-detail-val">{field(crew.visa || crew.visa_country)}</div></div>
                    </div>
                  </div>

                  <div>
                    <div className="subsea-pane subsea-mb-12">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Current Assignment</div></div>
                      <div className="subsea-detail-grid">
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Vessel</div><div className="subsea-detail-val">{assignment.vessel}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Rank</div><div className="subsea-detail-val">{rank}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Sign-On</div><div className="subsea-detail-val">{formatDate(assignment.signOn)}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Sign-Off</div><div className="subsea-detail-val">{formatDate(assignment.signOff)}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Status</div><div className="subsea-detail-val">{assignment.status}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Project Count</div><div className="subsea-detail-val">{projects.length}</div></div>
                      </div>
                    </div>
                    <div className="subsea-pane">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Cert Summary</div><span className={`subsea-badge ${certExpiry ? 'subsea-b-amber' : 'subsea-b-green'}`}>{certExpiry ? '1 expiring' : 'Valid'}</span></div>
                      <div className="subsea-pane-body-flat">
                        <div className="subsea-cert-row"><span className="subsea-badge subsea-b-green">Valid</span><span className="subsea-cert-name">STCW Basic Safety Training</span><span className="subsea-cert-expires">Mar 2027</span></div>
                        <div className="subsea-cert-row"><span className="subsea-badge subsea-b-green">Valid</span><span className="subsea-cert-name">Medical Fitness Certificate</span><span className="subsea-cert-expires">Sep 2025</span></div>
                        {certExpiry && <div className="subsea-cert-row"><span className="subsea-badge subsea-b-amber">Expiring</span><span className="subsea-cert-name">Crew certificate</span><span className="subsea-cert-expires">{formatDate(certExpiry)}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div className="subsea-pane">
                  <div className="subsea-pane-head"><div className="subsea-pane-title">Employment History</div><div className="subsea-pane-sub">{projects.length || 1} assigned projects</div></div>
                  <div className="subsea-table-wrap">
                    <table className="subsea-table">
                      <thead><tr><th>Vessel</th><th>Rank</th><th>Company</th><th>From</th><th>To</th><th>Status</th></tr></thead>
                      <tbody>
                        {(projects.length ? projects : [{ id: 'sample', title: assignment.vessel, duration: { startDate: assignment.signOn, endDate: assignment.signOff }, status: assignment.status }]).map((project) => (
                          <tr key={project.id}><td className="s">{project.title}</td><td>{rank}</td><td>Subseacore Ltd.</td><td>{formatDate(project.duration?.startDate)}</td><td>{formatDate(project.duration?.endDate)}</td><td><span className="subsea-badge subsea-b-gray">{project.status || 'Active'}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="subsea-pane">
                  <div className="subsea-pane-head"><div className="subsea-pane-title">Certificates & Licences</div></div>
                  <div className="subsea-table-wrap">
                    <table className="subsea-table">
                      <thead><tr><th>Document</th><th>Type</th><th>Issue Date</th><th>Expiry</th><th>Status</th></tr></thead>
                      <tbody>
                        <tr><td className="s">Passport</td><td>Identity</td><td>{formatDate(passport?.issue_date)}</td><td>{formatDate(passport?.expiry_date)}</td><td><span className="subsea-badge subsea-b-green">Valid</span></td></tr>
                        <tr><td className="s">Identity Document</td><td><CreditCard size={12} /> Identity</td><td>{formatDate(identity?.issue_date)}</td><td>{formatDate(identity?.expiry_date)}</td><td><span className="subsea-badge subsea-b-green">Valid</span></td></tr>
                        <tr><td className="s">Crew Certificate</td><td>STCW</td><td>{formatDate(crew.certificate_issue_date || crew.crew_certificate?.issue_date)}</td><td>{formatDate(certExpiry)}</td><td><span className={`subsea-badge ${certExpiry ? 'subsea-b-amber' : 'subsea-b-green'}`}>{certExpiry ? 'Expiring' : 'Valid'}</span></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'jobs' && (
                <>
                  <div className="subsea-kpi-strip subsea-kpi-strip-4">
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Total Rotations</div><div className="subsea-kpi-value">{Math.max(projects.length, 1)}</div><div className="subsea-kpi-meta flat">Assigned projects</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill blue" style={{ width: '70%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Sea Days</div><div className="subsea-kpi-value">3,840</div><div className="subsea-kpi-meta flat">~10.5 years</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill teal" style={{ width: '85%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Vessels Served</div><div className="subsea-kpi-value">{Math.max(projects.length, 1)}</div><div className="subsea-kpi-meta flat">Current roster</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill green" style={{ width: '45%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Current Tour</div><div className="subsea-kpi-value">227d</div><div className="subsea-kpi-meta flat">of 304d contract</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill amber" style={{ width: '75%' }} /></div></div>
                  </div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Rotation Schedule</div></div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead><tr><th>Vessel</th><th>Rank</th><th>Sign-On</th><th>Sign-Off</th><th>Status</th></tr></thead>
                        <tbody>
                          {(projects.length ? projects : [{ id: 'sample', title: assignment.vessel, duration: { startDate: assignment.signOn, endDate: assignment.signOff }, status: assignment.status }]).map((project) => (
                            <tr key={project.id}><td className="s">{project.title}</td><td>{rank}</td><td>{formatDate(project.duration?.startDate)}</td><td>{formatDate(project.duration?.endDate)}</td><td><span className="subsea-badge subsea-b-green">{project.status || 'Active'}</span></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'pay' && (
                <div className="subsea-g2">
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Payment History</div></div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead><tr><th>Period</th><th>Basic Pay</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
                        <tbody>
                          {['May 2025', 'Apr 2025', 'Mar 2025', 'Feb 2025'].map((period) => (
                            <tr key={period}><td>{period}</td><td>$12,400</td><td>$800</td><td>-$620</td><td className="strong">$12,580</td><td><span className="subsea-badge subsea-b-green">Paid</span></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Pay Breakdown - May 2025</div></div>
                    <div className="subsea-pane-body-flat">
                      <div className="subsea-metric-row"><span className="subsea-metric-label">Basic Salary</span><span className="subsea-metric-val">$12,400</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label">Danger Zone Allowance</span><span className="subsea-metric-val">$500</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label">Meal Allowance</span><span className="subsea-metric-val">$200</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label">Deductions</span><span className="subsea-metric-val danger">-$620</span></div>
                      <div className="subsea-metric-row strong"><span className="subsea-metric-label">Net Pay</span><span className="subsea-metric-val">$12,580</span></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default CrewDetailsPage;
