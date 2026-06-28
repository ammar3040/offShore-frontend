import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Calendar,
  CreditCard,
  FileText,
  History,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plane,
  Printer,
  RefreshCw,
  Settings,
  Ship,
  User,
  Trash2,
} from 'lucide-react';
import {
  crewApiToFormData,
  getCrewById,
  updateCrewMember,
  updateCrewAvailabilityStatus,
  getCrewAvailabilityListAdmin,
  addCrewAvailabilityAdmin,
  deleteCrewAvailabilityAdmin,
  type CrewAssignedProject,
  type CrewMemberApi,
  type CrewAvailabilityItem,
} from '../api/crew';
import ErrorAlertPopup from '../components/ErrorAlertPopup';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import CrewMemberForm, { type CrewMemberFormData } from '../components/forms/CrewMemberForm';
import { availabilityFromCrewSignal, getCrewSignal } from '../utils/crewAvailability';
import { Calendar as DayPickerCalendar } from '../components/ui/calendar';
import './RigsPage.css';

type ProfileTab = 'overview' | 'records' | 'documents' | 'jobs' | 'visa' | 'pay';



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

function statusMeta(crew?: CrewMemberApi | null, projects?: CrewAssignedProject[]): { label: string; className: string } {
  if (crew?.isAvailable === false) return { label: 'Unavailable', className: 'subsea-b-red' };
  const activeProjects = projects ?? crew?.activeProjects ?? [];
  const availability = availabilityFromCrewSignal(crew ? getCrewSignal({ ...crew, activeProjects }) : undefined);
  if (availability === 'available') return { label: 'Available', className: 'subsea-b-green' };
  if (availability === 'endingSoon') return { label: 'Sign-Off Due', className: 'subsea-b-amber' };
  return { label: 'In Proddject', className: 'subsea-b-blue' };
}

function currentAssignment(projects: CrewAssignedProject[], crew?: CrewMemberApi | null) {
  const project = projects[0] ?? crew?.activeProjects?.[0];
  return {
    rig: project?.title || '—',
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [editCrew, setEditCrew] = useState<CrewMemberApi | null>(null);
  const [editPrefillLoading, setEditPrefillLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const [availabilityItems, setAvailabilityItems] = useState<CrewAvailabilityItem[]>([]);
  const [loadingAvailabilities, setLoadingAvailabilities] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [newAvailFrom, setNewAvailFrom] = useState('');
  const [newAvailTo, setNewAvailTo] = useState('');
  const [addingAvail, setAddingAvail] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (selectedRange?.from) {
      const yyyy = selectedRange.from.getFullYear();
      const mm = String(selectedRange.from.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedRange.from.getDate()).padStart(2, '0');
      setNewAvailFrom(`${yyyy}-${mm}-${dd}`);
    } else {
      setNewAvailFrom('');
    }
    if (selectedRange?.to) {
      const yyyy = selectedRange.to.getFullYear();
      const mm = String(selectedRange.to.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedRange.to.getDate()).padStart(2, '0');
      setNewAvailTo(`${yyyy}-${mm}-${dd}`);
    } else {
      setNewAvailTo('');
    }
  }, [selectedRange]);

  const loadAvailabilities = useCallback(async () => {
    if (!crewId) return;
    setLoadingAvailabilities(true);
    setAvailError(null);
    try {
      const items = await getCrewAvailabilityListAdmin(crewId);
      setAvailabilityItems(items);
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to load availability');
    } finally {
      setLoadingAvailabilities(false);
    }
  }, [crewId]);

  useEffect(() => {
    if (isAvailabilityOpen) {
      void loadAvailabilities();
    }
  }, [isAvailabilityOpen, loadAvailabilities]);

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewId || !newAvailFrom || !newAvailTo) return;
    setAddingAvail(true);
    setAvailError(null);
    try {
      await addCrewAvailabilityAdmin(crewId, newAvailFrom, newAvailTo);
      setNewAvailFrom('');
      setNewAvailTo('');
      setSelectedRange(undefined);
      await loadAvailabilities();
      await loadCrewDetails();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to add availability');
    } finally {
      setAddingAvail(false);
    }
  };

  const handleFromChange = (val: string) => {
    setNewAvailFrom(val);
    if (val) {
      const d = new Date(val);
      setSelectedRange(prev => ({
        from: d,
        to: prev?.to && prev.to >= d ? prev.to : undefined
      }));
    } else {
      setSelectedRange(prev => ({ ...prev, from: undefined }));
    }
  };

  const handleToChange = (val: string) => {
    setNewAvailTo(val);
    if (val) {
      const d = new Date(val);
      setSelectedRange(prev => ({
        from: prev?.from && prev.from <= d ? prev.from : undefined,
        to: d
      }));
    } else {
      setSelectedRange(prev => ({ from: prev?.from, to: undefined }));
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    if (!window.confirm('Are you sure you want to delete this availability window?')) return;
    setLoadingAvailabilities(true);
    setAvailError(null);
    try {
      await deleteCrewAvailabilityAdmin(availabilityId);
      await loadAvailabilities();
      await loadCrewDetails();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to delete availability');
    } finally {
      setLoadingAvailabilities(false);
    }
  };

  const selectedDates = useMemo(() => {
    const dates: Date[] = [];
    availabilityItems.forEach(item => {
      if (!item.from || !item.to) return;
      const start = new Date(item.from);
      const end = new Date(item.to);
      const current = new Date(start);
      let limit = 0;
      while (current <= end && limit < 1000) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
        limit++;
      }
    });
    return dates;
  }, [availabilityItems]);

  const handleToggleAvailability = async () => {
    if (!crew || !crewId) return;

    const originalIsAvailable = crew.isAvailable;
    const nextState = originalIsAvailable === false;

    // 1. Optimistic Update (Immediate UI response)
    setCrew(prev => prev ? { ...prev, isAvailable: nextState } : null);

    setToggling(true);
    setError(null);
    try {
      const res = await updateCrewAvailabilityStatus(crewId, nextState);
      if (!res.ok) {
        const text = await res.text();
        let msg = `Failed to update availability (${res.status})`;
        if (text) {
          try {
            const j = JSON.parse(text);
            msg = j?.message || j?.error || msg;
          } catch {
            msg = text;
          }
        }
        throw new Error(msg);
      }
      // 2. Silent background reload to sync other computed properties (like signal)
      await loadCrewDetails(false);
    } catch (err) {
      // 3. Rollback on failure
      setCrew(prev => prev ? { ...prev, isAvailable: originalIsAvailable } : null);
      setError(err instanceof Error ? err.message : 'Failed to update availability');
    } finally {
      setToggling(false);
    }
  };

  const loadCrewDetails = useCallback(async (showSpinner = true) => {
    if (!crewId) return;

    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await getCrewById(crewId);
      setCrew(res.crew);
      setProjects(res.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew details');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [crewId]);

  useEffect(() => {
    void loadCrewDetails();
  }, [loadCrewDetails]);

  const openEditModal = async () => {
    if (!crewId) return;
    setIsEditModalOpen(true);
    setEditError(null);
    setEditPrefillLoading(true);
    try {
      const res = await getCrewById(crewId);
      setEditCrew(res.crew);
    } catch {
      if (crew) setEditCrew(crew);
    } finally {
      setEditPrefillLoading(false);
    }
  };

  const closeEditModal = () => {
    if (!editLoading) {
      setIsEditModalOpen(false);
      setEditCrew(null);
      setEditError(null);
    }
  };

  const editInitialData = useMemo(
    () => (editCrew ? crewApiToFormData(editCrew) : undefined),
    [editCrew]
  );

  const handleSubmitEdit = async (data: CrewMemberFormData) => {
    const crewIdToUpdate = editCrew?.id ?? crew?.id;
    if (!crewIdToUpdate) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await updateCrewMember(crewIdToUpdate, data);
      if (!res.ok) {
        const text = await res.text();
        let msg = `Request failed (${res.status})`;
        if (text) {
          try {
            const j = JSON.parse(text);
            msg = j?.message || j?.error || msg;
          } catch {
            msg = text;
          }
        }
        setEditError(msg);
        return;
      }
      setIsEditModalOpen(false);
      setEditError(null);
      await loadCrewDetails();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update crew member');
    } finally {
      setEditLoading(false);
    }
  };

  const status = statusMeta(crew, projects);
  const pageError = !crewId ? 'Missing crew id' : error;
  const assignment = useMemo(() => currentAssignment(projects, crew), [projects, crew]);
  const rank = crew?.organization || '—';
  const certExpiry = crew?.certificate_expiry_date || crew?.crew_certificate?.expiry_date;
  const passport = crew?.passport;
  const identity = crew?.identity;

  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof User; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'records', label: 'Records', icon: History },
    { id: 'documents', label: 'Documents', icon: BadgeCheck, badge: certExpiry ? '1' : undefined },
    { id: 'jobs', label: 'Jobs', icon: Ship },
    { id: 'visa', label: 'Visa', icon: IdCard },
    { id: 'pay', label: 'Pay', icon: Banknote },
  ];

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="crew" />

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
          <button
            type="button"
            className="subsea-btn subsea-btn-default subsea-btn-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={12} className="mr-1.5" /> Back
          </button>
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
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={() => void openEditModal()} disabled={!crewId || loading}><User size={12} /> Edit Profile</button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
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
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={() => void openEditModal()} disabled={!crewId || loading}>Edit Profile</button>
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
                      <div className="subsea-prof-role">{rank} - {assignment.rig}</div>
                      <div className="subsea-prof-meta">
                        <div className="subsea-prof-meta-item"><IdCard size={13} /><span>IMO: {field(crew.dawinci_number || crew.vantage_number)}</span></div>
                        <div className="subsea-prof-meta-item"><MapPin size={13} /><span>{field(crew.nationality || crew.country)}</span></div>
                        <div className="subsea-prof-meta-item"><Calendar size={13} /><span>DOB: {formatDate(crew.dateOfBirth)}</span></div>
                        <div className="subsea-prof-meta-item"><Phone size={13} /><span>{field(crew.phone)}</span></div>
                        <div className="subsea-prof-meta-item"><Mail size={13} /><span>{field(crew.email)}</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`subsea-badge ${status.className}`}>{status.label}</span>
                      <button
                        type="button"
                        onClick={handleToggleAvailability}
                        disabled={toggling || loading}
                        style={{
                          position: 'relative',
                          width: '40px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: crew.isAvailable !== false ? '#22c55e' : '#d1d5db',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          outline: 'none',
                        }}
                        title={crew.isAvailable !== false ? "Click to make Unavailable" : "Click to make Available"}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            transform: crew.isAvailable !== false ? 'translateX(22px)' : 'translateX(2px)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="subsea-prof-actions">
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">Sign Off</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><RefreshCw size={11} /> Find Relief</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><Plane size={11} /> Book Flight</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm"><FileText size={11} /> View Contract</button>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => setIsAvailabilityOpen(true)}>
                      <Calendar size={11} /> Check Availability
                    </button>
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
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Rig</div><div className="subsea-detail-val">{assignment.rig}</div></div>
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
                      <thead><tr><th>Rig</th><th>Rank</th><th>Company</th><th>From</th><th>To</th><th>Status</th></tr></thead>
                      <tbody>
                        {(projects.length ? projects : [{ id: 'sample', title: assignment.rig, duration: { startDate: assignment.signOn, endDate: assignment.signOff }, status: assignment.status }]).map((project) => (
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
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Rigs Served</div><div className="subsea-kpi-value">{Math.max(projects.length, 1)}</div><div className="subsea-kpi-meta flat">Current roster</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill green" style={{ width: '45%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Current Tour</div><div className="subsea-kpi-value">227d</div><div className="subsea-kpi-meta flat">of 304d contract</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill amber" style={{ width: '75%' }} /></div></div>
                  </div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Rotation Schedule</div></div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead><tr><th>Rig</th><th>Rank</th><th>Sign-On</th><th>Sign-Off</th><th>Status</th></tr></thead>
                        <tbody>
                          {(projects.length ? projects : [{ id: 'sample', title: assignment.rig, duration: { startDate: assignment.signOn, endDate: assignment.signOff }, status: assignment.status }]).map((project) => (
                            <tr key={project.id}><td className="s">{project.title}</td><td>{rank}</td><td>{formatDate(project.duration?.startDate)}</td><td>{formatDate(project.duration?.endDate)}</td><td><span className="subsea-badge subsea-b-green">{project.status || 'Active'}</span></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'visa' && (
                <div className="subsea-pane">
                  <div className="subsea-pane-head">
                    <div className="subsea-pane-title">Visa</div>
                  </div>
                  <div className="subsea-empty-cell">No visa records yet.</div>
                </div>
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

      <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="Edit Crew Member" size="xlarge" variant="subsea">
        {editError && (
          <ErrorAlertPopup message={editError} onDismiss={() => setEditError(null)} />
        )}
        {editPrefillLoading ? (
          <div className="user-mgmt-form-suspense" role="status" aria-busy="true" aria-label="Loading crew profile">
            <Loader2 size={32} className="user-mgmt-form-suspense-spinner" />
            <p>Loading profile…</p>
          </div>
        ) : editCrew && editInitialData ? (
            <CrewMemberForm
              key={editCrew.id}
              mode="edit"
              onSubmit={handleSubmitEdit}
              onCancel={closeEditModal}
              isLoading={editLoading}
              initialData={editInitialData}
              submitLabel="Save Changes"
              theme="subsea"
            />
        ) : null}
      </Modal>

      <Modal
        isOpen={isAvailabilityOpen}
        onClose={() => setIsAvailabilityOpen(false)}
        title="Check Availability"
        size="large"
        variant="subsea"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              Availability Calendar
            </h3>
            <div className="border rounded-xl p-4 bg-muted/40 shadow-sm w-full flex justify-center">
              <DayPickerCalendar
                mode="range"
                selected={selectedRange}
                onSelect={setSelectedRange}
                modifiers={{
                  available: selectedDates
                }}
                modifiersClassNames={{
                  available: "bg-emerald-600! text-white! font-semibold hover:bg-emerald-700!"
                }}
                className="rounded-md border shadow-sm bg-background"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground self-start">
              <span className="inline-block w-3.5 h-3.5 bg-emerald-500 rounded" />
              <span>Highlighted dates indicate crew availability.</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-2">
            <div>
              <h3 className="text-sm font-semibold mb-2">Crew Availability Status</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Currently tracking active rotation windows and custom availability ranges for {crewName(crew)}.
              </p>
            </div>

            {availError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {availError}
              </div>
            )}

            {/* Add Availability Form */}
            <form onSubmit={handleAddAvailability} className="border p-3 rounded-lg bg-muted/20 flex flex-col gap-3">
              <div className="text-xs font-semibold text-foreground">Add New Availability Window</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1 font-semibold">START DATE</label>
                  <input
                    type="date"
                    required
                    value={newAvailFrom}
                    onChange={(e) => handleFromChange(e.target.value)}
                    className="w-full text-xs p-1.5 border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1 font-semibold">END DATE</label>
                  <input
                    type="date"
                    required
                    value={newAvailTo}
                    onChange={(e) => handleToChange(e.target.value)}
                    className="w-full text-xs p-1.5 border rounded bg-background"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={addingAvail}
                className="subsea-btn subsea-btn-primary subsea-btn-xs self-end"
              >
                {addingAvail ? 'Adding...' : 'Add Range'}
              </button>
            </form>

            <div className="text-xs font-semibold mt-2 text-foreground">Active Availability Ranges</div>
            
            <div className="subsea-pane-body-flat flex flex-col gap-3 overflow-y-auto max-h-[220px]">
              {loadingAvailabilities && availabilityItems.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Loading ranges...</div>
              ) : availabilityItems.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No custom availability ranges defined.</div>
              ) : (
                availabilityItems.map((item) => {
                  const fromStr = item.from ? new Date(item.from).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '';
                  const toStr = item.to ? new Date(item.to).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '';
                  return (
                    <div key={item.id} className="p-3 border rounded-lg bg-emerald-50/60 border-emerald-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-emerald-800">Available Window</div>
                        <div className="text-sm font-bold text-emerald-950">{fromStr} — {toStr}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAvailability(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete availability range"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t pt-3 mt-auto">
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  onClick={() => setIsAvailabilityOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CrewDetailsPage;
