import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Calendar,
  CreditCard,
  History,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plane,
  Printer,
  Settings,
  Ship,
  User,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  crewApiToFormData,
  getCrewById,
  updateCrewMember,
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
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Calendar as UiCalendar } from '../components/ui/calendar';
import { availabilityFromCrewSignal, getCrewSignal } from '../utils/crewAvailability';
import { toast } from 'sonner';
import './RigsPage.css';
import './TimelinePage.css';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildCalendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

type ProfileTab = 'overview' | 'records' | 'documents' | 'jobs' | 'visa' | 'pay' | 'availability';



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
  const activeProjects = projects ?? crew?.activeProjects ?? [];
  const availability = availabilityFromCrewSignal(crew ? getCrewSignal({ ...crew, activeProjects }) : undefined);
  if (availability === 'unavailable') return { label: 'Unavailable', className: 'subsea-b-red' };
  if (availability === 'available') return { label: 'Available', className: 'subsea-b-green' };
  if (availability === 'endingSoon') return { label: 'Sign-Off Due', className: 'subsea-b-amber' };
  return { label: 'In Project', className: 'subsea-b-blue' };
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

const formatDateToDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const CrewDetailsPage = () => {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [projects, setProjects] = useState<CrewAssignedProject[]>([]);
  const [loading, setLoading] = useState(() => Boolean(crewId));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCrew, setEditCrew] = useState<CrewMemberApi | null>(null);
  const [editPrefillLoading, setEditPrefillLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [availabilityItems, setAvailabilityItems] = useState<CrewAvailabilityItem[]>([]);
  const [loadingAvailabilities, setLoadingAvailabilities] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [newAvailFrom, setNewAvailFrom] = useState('');
  const [newAvailTo, setNewAvailTo] = useState('');
  const [addingAvail, setAddingAvail] = useState(false);

  const [calendarDate, setCalendarDate] = useState(() => startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [newAvailType, setNewAvailType] = useState<'available' | 'unavailable'>('available');

  const monthStart = startOfMonth(calendarDate);
  const calendarDays = useMemo(() => buildCalendarDays(monthStart), [monthStart]);

  useEffect(() => {
    if (rangeStart) {
      const yyyy = rangeStart.getFullYear();
      const mm = String(rangeStart.getMonth() + 1).padStart(2, '0');
      const dd = String(rangeStart.getDate()).padStart(2, '0');
      setNewAvailFrom(`${yyyy}-${mm}-${dd}`);
    } else {
      setNewAvailFrom('');
    }
    if (rangeEnd) {
      const yyyy = rangeEnd.getFullYear();
      const mm = String(rangeEnd.getMonth() + 1).padStart(2, '0');
      const dd = String(rangeEnd.getDate()).padStart(2, '0');
      setNewAvailTo(`${yyyy}-${mm}-${dd}`);
    } else {
      setNewAvailTo('');
    }
  }, [rangeStart, rangeEnd]);

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
    if (crewId) {
      void loadAvailabilities();
    }
  }, [crewId, loadAvailabilities]);

  const handleAddAvailability = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!crewId || !newAvailFrom || !newAvailTo) return;
    setAddingAvail(true);
    setAvailError(null);
    try {
      const isAvail = newAvailType === 'available';
      await addCrewAvailabilityAdmin(crewId, newAvailFrom, newAvailTo, isAvail);
      
      const startFormatted = new Date(newAvailFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const endFormatted = new Date(newAvailTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      toast.success(`Successfully added ${isAvail ? 'availability' : 'unavailability'} from ${startFormatted} to ${endFormatted}`);

      setNewAvailFrom('');
      setNewAvailTo('');
      setRangeStart(null);
      setRangeEnd(null);
      await loadAvailabilities();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add range';
      setAvailError(msg);
      toast.error(msg);
    } finally {
      setAddingAvail(false);
    }
  };

  const handleFromChange = (val: string) => {
    setNewAvailFrom(val);
    if (val) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        setRangeStart(d);
      }
    } else {
      setRangeStart(null);
    }
  };

  const handleToChange = (val: string) => {
    setNewAvailTo(val);
    if (val) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        setRangeEnd(d);
      }
    } else {
      setRangeEnd(null);
    }
  };

  const handleDateClick = (date: Date) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
    } else {
      if (date < rangeStart) {
        setRangeStart(date);
      } else {
        setRangeEnd(date);
      }
    }
  };

  const getDayAvailabilityType = (day: Date): 'available' | 'unavailable' | 'none' => {
    const dStr = dateKey(day);
    for (const item of availabilityItems) {
      if (!item.from || !item.to) continue;
      const start = dateKey(new Date(item.from));
      const end = dateKey(new Date(item.to));
      if (dStr >= start && dStr <= end) {
        return item.isAvailable !== false ? 'available' : 'unavailable';
      }
    }
    return 'none';
  };

  const isDayInSelectedRange = (day: Date): boolean => {
    if (!rangeStart) return false;
    const dTime = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
    if (!rangeEnd) {
      return dTime === startTime;
    }
    const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime();
    return dTime >= startTime && dTime <= endTime;
  };

  const handleDeleteAvailability = (availabilityId: string) => {
    setDeleteTargetId(availabilityId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAvailability = async () => {
    if (!deleteTargetId) return;
    setLoadingAvailabilities(true);
    setAvailError(null);
    try {
      await deleteCrewAvailabilityAdmin(deleteTargetId);
      toast.success('Availability window deleted successfully');
      await loadAvailabilities();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete availability';
      setAvailError(msg);
      toast.error(msg);
    } finally {
      setLoadingAvailabilities(false);
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
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
    { id: 'availability', label: 'Availability', icon: Calendar },
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
                    </div>
                  </div>
                  <div className="subsea-prof-actions">
                    <button
                      type="button"
                      className="subsea-btn subsea-btn-default subsea-btn-sm"
                      onClick={() => {
                        if (crew) {
                          const activeProjectId = projects[0]?.id || '';
                          navigate('/tickets', {
                            state: {
                              crewId: crew.id,
                              projectId: activeProjectId
                            }
                          });
                        }
                      }}
                    >
                      <Plane size={11} /> Book Flight
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

              {activeTab === 'availability' && (
                <div className="subsea-g2">
                  <style dangerouslySetInnerHTML={{
                    __html: `
                    .subsea-date-input::-webkit-calendar-picker-indicator {
                      filter: invert(0) !important;
                      cursor: pointer;
                    }
                  ` }} />
                  <div className="subsea-pane" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2" style={{ margin: 0 }}>
                        <Calendar size={14} className="text-primary" />
                        Availability Calendar
                      </h3>
                      <div className="timeline-calendar-nav" style={{ margin: 0 }}>
                        <button type="button" className="timeline-nav-btn" aria-label="Previous month" onClick={() => setCalendarDate((date) => addMonths(date, -1))}>
                          <ChevronLeft size={14} />
                        </button>
                        <strong style={{ minWidth: '120px', display: 'inline-block', textAlign: 'center' }}>{MONTH_FORMAT.format(monthStart)}</strong>
                        <button type="button" className="timeline-nav-btn" aria-label="Next month" onClick={() => setCalendarDate((date) => addMonths(date, 1))}>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="timeline-calendar-grid" style={{ width: '100%', margin: 0 }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="timeline-cal-dow">{day}</div>
                      ))}
                      {calendarDays.map((day) => {
                        const isOtherMonth = day.getMonth() !== monthStart.getMonth();
                        const isToday = dateKey(day) === dateKey(new Date());
                        const type = getDayAvailabilityType(day);
                        const isSelected = isDayInSelectedRange(day);
                        
                        let dayClass = 'timeline-cal-day';
                        if (isOtherMonth) dayClass += ' other-month';
                        if (isToday) dayClass += ' today';
                        
                        let customStyle: React.CSSProperties = {
                          cursor: 'pointer',
                          position: 'relative',
                          minHeight: '80px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '8px',
                          border: isSelected ? '2px solid var(--subsea-primary, #2563eb)' : undefined,
                          backgroundColor: isSelected 
                            ? 'rgba(37, 99, 235, 0.08)' 
                            : type === 'available' 
                              ? 'rgba(16, 185, 129, 0.08)' 
                              : type === 'unavailable' 
                                ? 'rgba(239, 68, 68, 0.08)' 
                                : undefined
                        };

                        return (
                          <article 
                            key={dateKey(day)} 
                            className={dayClass} 
                            style={customStyle}
                            onClick={() => handleDateClick(day)}
                          >
                            <div className="timeline-cal-day-num">{day.getDate()}</div>
                            
                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {type === 'available' && (
                                <span className="subsea-badge subsea-b-green" style={{ fontSize: '9px', padding: '1px 4px', width: 'fit-content' }}>
                                  Available
                                </span>
                              )}
                              {type === 'unavailable' && (
                                <span className="subsea-badge subsea-b-red" style={{ fontSize: '9px', padding: '1px 4px', width: 'fit-content' }}>
                                  Unavailable
                                </span>
                              )}
                              {isSelected && (
                                <span className="subsea-badge subsea-b-blue" style={{ fontSize: '9px', padding: '1px 4px', width: 'fit-content' }}>
                                  Selected
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--subsea-text-muted)', alignSelf: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)' }} />
                        <span>Available Range</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)' }} />
                        <span>Unavailable Range</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '2px solid var(--subsea-primary, #2563eb)' }} />
                        <span>Selected Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="subsea-pane" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Crew Availability Status</h3>
                      <p className="text-xs text-muted-foreground font-medium">
                        Currently tracking active rotation windows and custom availability/unavailability ranges for {crewName(crew)}.
                      </p>
                    </div>

                    {availError && (
                      <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200" style={{ margin: 0 }}>
                        {availError}
                      </div>
                    )}

                    {/* Add Availability Form */}
                    <form onSubmit={(e) => e.preventDefault()} className="border p-3 rounded-lg flex flex-col gap-3" style={{ borderColor: '#cbd5e1', backgroundColor: '#f1f5f9', borderWidth: '1px', borderStyle: 'solid' }}>
                      <div className="text-xs font-semibold text-slate-700">Add New Range</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">START DATE</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full text-xs p-1.5 border rounded bg-white text-slate-900 h-[30px] flex items-center justify-between border-[#cbd5e1]"
                              >
                                <span className="truncate">{newAvailFrom ? formatDateToDisplay(newAvailFrom) : 'dd/mm/yyyy'}</span>
                                <Calendar size={12} className="text-slate-400 shrink-0 ml-1" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <UiCalendar
                                mode="single"
                                selected={newAvailFrom ? new Date(newAvailFrom) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const yyyy = date.getFullYear();
                                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                                    const dd = String(date.getDate()).padStart(2, '0');
                                    handleFromChange(`${yyyy}-${mm}-${dd}`);
                                  }
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">END DATE</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full text-xs p-1.5 border rounded bg-white text-slate-900 h-[30px] flex items-center justify-between border-[#cbd5e1]"
                              >
                                <span className="truncate">{newAvailTo ? formatDateToDisplay(newAvailTo) : 'dd/mm/yyyy'}</span>
                                <Calendar size={12} className="text-slate-400 shrink-0 ml-1" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <UiCalendar
                                mode="single"
                                selected={newAvailTo ? new Date(newAvailTo) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const yyyy = date.getFullYear();
                                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                                    const dd = String(date.getDate()).padStart(2, '0');
                                    handleToChange(`${yyyy}-${mm}-${dd}`);
                                  }
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">STATUS</label>
                          <select
                            value={newAvailType}
                            onChange={(e) => setNewAvailType(e.target.value as 'available' | 'unavailable')}
                            className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                            style={{ borderColor: '#cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', height: '30px' }}
                          >
                            <option value="available">Available</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddAvailability()}
                        disabled={addingAvail}
                        className="subsea-btn subsea-btn-primary subsea-btn-xs"
                        style={{ alignSelf: 'flex-end' }}
                      >
                        {addingAvail ? 'Adding...' : 'Add Range'}
                      </button>
                    </form>

                    <div className="text-xs font-semibold mt-2 text-foreground">Active Ranges</div>

                    <div className="subsea-pane-body-flat flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '220px' }}>
                      {loadingAvailabilities && availabilityItems.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">Loading ranges...</div>
                      ) : availabilityItems.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">No custom ranges defined.</div>
                      ) : (
                        availabilityItems.map((item) => {
                          const fromStr = item.from ? new Date(item.from).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '';
                          const toStr = item.to ? new Date(item.to).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '';
                          const isAvail = item.isAvailable !== false;
                          const bg = isAvail ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                          const border = isAvail ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                          const titleColor = isAvail ? 'var(--subsea-text-success, #059669)' : 'var(--subsea-text-danger, #ef4444)';
                          const titleLabel = isAvail ? 'Available Window' : 'Unavailable Window';
                          return (
                            <div key={item.id} className="p-3 border rounded-lg flex items-center justify-between" style={{ backgroundColor: bg, borderColor: border }}>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: titleColor }}>{titleLabel}</div>
                                <div className="text-sm font-bold" style={{ color: 'var(--subsea-text)' }}>{fromStr} — {toStr}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteAvailability(item.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                                title="Delete range"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeleteTargetId(null);
        }}
        title="Confirm Deletion"
        size="small"
        variant="subsea"
      >
        <div style={{ padding: '20px 10px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            marginBottom: '16px'
          }}>
            <AlertTriangle size={28} />
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#111827',
            marginBottom: '8px',
            fontFamily: 'inherit'
          }}>
            Delete Availability Window?
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#4b5563',
            lineHeight: 1.5,
            marginBottom: '24px'
          }}>
            Are you sure you want to delete this availability window? This action cannot be undone and will immediately update the crew's availability status.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                setDeleteTargetId(null);
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              className="hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteAvailability}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              className="hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

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
    </div>
  );
};

export default CrewDetailsPage;
