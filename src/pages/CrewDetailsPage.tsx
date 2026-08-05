import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Calendar,
  CreditCard,
  ExternalLink,
  History,
  IdCard,
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
  getCrewById,
  getCrewAvailabilityListAdmin,
  addCrewAvailabilityAdmin,
  deleteCrewAvailabilityAdmin,
  type CrewAssignedProject,
  type CrewMemberApi,
  type CrewAvailabilityAdminItem,
} from '../api/crew';
import {
  getCrewTicketsByCrewId,
  getTicketStatus,
  getTicketStatusLabel,
  type CrewTicketApi,
} from '../api/ticket';
import { fetchVisaDetails, type VevoApiResponse, type VevoMetadata } from '../api/visa';
import { EMPLOYER_OPTIONS } from '../constants/employers';
import { VEVO_DEFAULT_APPLICANT } from '../constants/vevoDefaults';
import { downloadPdfFromDataUri } from '../lib/downloadPdf';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Calendar as UiCalendar } from '../components/ui/calendar';
import { availabilityFromCrewSignal, getCrewSignal, CREW_STATUS_TIER_OPTIONS, type CrewStatusTier, crewStatusTierLabel, crewStatusTierBadgeClass, resolveAvailabilityItemStatus } from '../utils/crewAvailability';
import { toast } from 'sonner';
import './RigsPage.css';
import './TimelinePage.css';
import './VevoVisaPage.css';

const VEVO_PORTAL_URL = 'https://online.immi.gov.au/evo/firstParty?actionType=query';

function toIsoDateInput(value?: string | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toISOString().slice(0, 10);
}

function visaStatusBadgeClass(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'subsea-b-green';
  if (s === 'expired') return 'subsea-b-red';
  if (s === 'not found' || s === 'invalid request') return 'subsea-b-amber';
  return 'subsea-b-gray';
}

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

/** Prefer YYYY-MM-DD from ISO / value so travel days match calendar cells across timezones. */
function calendarDayKey(value: string | Date): string {
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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

function getCalendarDayStyle(status: string | undefined): React.CSSProperties {
  if (!status) return {};
  switch (status) {
    case 'Available':
      return { backgroundColor: 'rgba(34, 197, 94, 0.08)' };
    case 'Offered':
      return { backgroundColor: 'rgba(234, 179, 8, 0.08)' };
    case 'Confirmed':
      return { backgroundColor: 'rgba(59, 130, 246, 0.08)' };
    case 'In Flight':
      return { backgroundColor: 'rgba(6, 182, 212, 0.08)' };
    case 'In Project':
      return { backgroundColor: 'rgba(139, 92, 246, 0.08)' };
    case 'On assignment for us':
      return { backgroundColor: 'rgba(168, 85, 247, 0.08)' };
    case 'Offshore (Competitor)':
      return { backgroundColor: 'rgba(239, 68, 68, 0.08)' };
    case 'Holiday / Not Available':
      return { backgroundColor: 'rgba(249, 115, 22, 0.08)' };
    case 'Unknown / Inactive':
      return { backgroundColor: 'rgba(156, 163, 175, 0.08)' };
    default:
      return {};
  }
}

const CrewDetailsPage = () => {
  const { crewId } = useParams<{ crewId: string }>();
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [projects, setProjects] = useState<CrewAssignedProject[]>([]);
  const [crewTickets, setCrewTickets] = useState<CrewTicketApi[]>([]);
  const [loading, setLoading] = useState(() => Boolean(crewId));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');


  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [availabilityItems, setAvailabilityItems] = useState<CrewAvailabilityAdminItem[]>([]);
  const [loadingAvailabilities, setLoadingAvailabilities] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [newAvailFrom, setNewAvailFrom] = useState('');
  const [newAvailTo, setNewAvailTo] = useState('');
  const [addingAvail, setAddingAvail] = useState(false);
  const [newAvailEmployer, setNewAvailEmployer] = useState('');
  const [newAvailEmployerOther, setNewAvailEmployerOther] = useState('');
  const [newAvailClient, setNewAvailClient] = useState('');
  const [newAvailRigVessel, setNewAvailRigVessel] = useState('');
  const [newAvailCountry, setNewAvailCountry] = useState('');
  const [newAvailNotes, setNewAvailNotes] = useState('');

  const [calendarDate, setCalendarDate] = useState(() => startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [newAvailType, setNewAvailType] = useState<CrewStatusTier>('Available');

  const [vevoGrantNumber, setVevoGrantNumber] = useState(VEVO_DEFAULT_APPLICANT.grantNumber);
  const [vevoPassportNumber, setVevoPassportNumber] = useState(VEVO_DEFAULT_APPLICANT.passportNumber);
  const [vevoDateOfBirth, setVevoDateOfBirth] = useState(VEVO_DEFAULT_APPLICANT.dateOfBirth);
  const [vevoCountry, setVevoCountry] = useState(VEVO_DEFAULT_APPLICANT.country);
  const [vevoFetching, setVevoFetching] = useState(false);
  const [vevoResult, setVevoResult] = useState<VevoApiResponse | null>(null);

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
      const isAvail = newAvailType === 'Available';
      const showAssignmentFields =
        newAvailType === 'Offshore (Competitor)' || newAvailType === 'On assignment for us';
      const assignment = showAssignmentFields
        ? {
            ...(newAvailType === 'Offshore (Competitor)' && newAvailEmployer
              ? { employer: newAvailEmployer }
              : {}),
            ...(newAvailType === 'Offshore (Competitor)' &&
            newAvailEmployer === 'Other' &&
            newAvailEmployerOther.trim()
              ? { employer_other: newAvailEmployerOther.trim() }
              : {}),
            ...(newAvailClient.trim() ? { client: newAvailClient.trim() } : {}),
            ...(newAvailRigVessel.trim() ? { rig_vessel: newAvailRigVessel.trim() } : {}),
            ...(newAvailCountry.trim() ? { country: newAvailCountry.trim() } : {}),
            ...(newAvailNotes.trim() ? { notes: newAvailNotes.trim() } : {}),
          }
        : undefined;
      await addCrewAvailabilityAdmin(crewId, newAvailFrom, newAvailTo, isAvail, assignment, newAvailType);
      
      const startFormatted = new Date(newAvailFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const endFormatted = new Date(newAvailTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      toast.success(`Successfully added range with status "${crewStatusTierLabel(newAvailType)}" from ${startFormatted} to ${endFormatted}`);

      setNewAvailFrom('');
      setNewAvailTo('');
      setNewAvailEmployer('');
      setNewAvailEmployerOther('');
      setNewAvailClient('');
      setNewAvailRigVessel('');
      setNewAvailCountry('');
      setNewAvailNotes('');
      setRangeStart(null);
      setRangeEnd(null);
      await Promise.all([loadAvailabilities(), loadCrewDetails(false)]);
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

  const getDayAvailabilityStatus = (day: Date): CrewStatusTier | 'none' => {
    const dStr = dateKey(day);
    for (const item of availabilityItems) {
      if (!item.from || !item.to) continue;
      const start = calendarDayKey(item.from);
      const end = calendarDayKey(item.to);
      if (start && end && dStr >= start && dStr <= end) {
        return resolveAvailabilityItemStatus(item);
      }
    }
    // No explicit record → treat as Available by default
    return 'Available';
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
      await Promise.all([loadAvailabilities(), loadCrewDetails(false)]);
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
      const [res, ticketsRes] = await Promise.all([
        getCrewById(crewId),
        getCrewTicketsByCrewId(crewId).catch(() => ({ crewTickets: [] as CrewTicketApi[] })),
      ]);
      setCrew(res.crew);
      setProjects(res.projects ?? []);
      setCrewTickets(ticketsRes.crewTickets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew details');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [crewId]);

  useEffect(() => {
    void loadCrewDetails();
  }, [loadCrewDetails]);

  useEffect(() => {
    if (!crew) return;
    setVevoGrantNumber(crew.visa_details?.vevo_reference_number?.trim() || VEVO_DEFAULT_APPLICANT.grantNumber);
    setVevoPassportNumber(crew.passport?.passport_number?.trim() || VEVO_DEFAULT_APPLICANT.passportNumber);
    setVevoDateOfBirth(toIsoDateInput(crew.dateOfBirth) || VEVO_DEFAULT_APPLICANT.dateOfBirth);
    const issuing = (crew.passport?.issuing_country ?? '').trim().toUpperCase();
    setVevoCountry(
      issuing === 'AUSTRALIA' || issuing === 'AU'
        ? 'AUS'
        : issuing.slice(0, 3) || VEVO_DEFAULT_APPLICANT.country
    );
    setVevoResult(null);
  }, [crew]);

  const handleVevoFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vevoGrantNumber.trim() || !vevoPassportNumber.trim() || !vevoDateOfBirth.trim()) {
      toast.error('Grant number, passport number, and date of birth are required');
      return;
    }
    setVevoFetching(true);
    setVevoResult(null);
    try {
      const fullName = crew ? `${crew.firstname ?? ''} ${crew.lastname ?? ''}`.trim() : '';
      const response = await fetchVisaDetails({
        fullName: fullName || undefined,
        dateOfBirth: vevoDateOfBirth.trim(),
        grantNumber: vevoGrantNumber.trim(),
        passportNumber: vevoPassportNumber.trim(),
        country: vevoCountry.trim() || 'AUS',
      });
      setVevoResult(response);
      if (response.success && response.data) {
        toast.success(response.message || 'VEVO verification succeeded');
      } else {
        toast.error(response.message || 'VEVO verification failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'VEVO fetch failed';
      toast.error(msg);
    } finally {
      setVevoFetching(false);
    }
  };

  const openEditModal = () => {
    if (crewId) {
      navigate(`/crew/edit/${crewId}`);
    }
  };

  const vevoData: VevoMetadata | undefined = vevoResult?.data;

  const status = statusMeta(crew, projects);
  const pageError = !crewId ? 'Missing crew id' : error;
  const assignment = useMemo(() => currentAssignment(projects, crew), [projects, crew]);
  const rank = crew?.organization || '—';
  const certExpiry = crew?.certificate_expiry_date || crew?.crew_certificate?.expiry_date;
  const passport = crew?.passport;
  const identity = crew?.identity;

  const activeBookingBlocks = useMemo(
    () =>
      crewTickets.filter((t) => {
        const st = getTicketStatus(t);
        return st === 'APPROVED' || st === 'UNAPPROVED';
      }),
    [crewTickets]
  );

  const bookingWindowLabel = (ticket: CrewTicketApi) => {
    const snap = ticket.flightSnapshot?.legs?.[0];
    const start = ticket.travelStart || snap?.departureTime;
    const legs = ticket.flightSnapshot?.legs ?? [];
    const last = legs[legs.length - 1];
    const end = ticket.travelEnd || last?.arrivalTime || snap?.arrivalTime;
    const fmt = (v?: string) => {
      if (!v) return '—';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    };
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const travelDirectionLabel = (ticket: CrewTicketApi) => {
    if (ticket.travelDirection === 'RIG_TO_HOME') return 'Off signer';
    if (ticket.travelDirection === 'HOME_TO_RIG') return 'On signer';
    return '—';
  };

  const ticketRigLabel = (ticket: CrewTicketApi) => {
    if (ticket.travelDirection === 'RIG_TO_HOME') return 'Home airport';
    const rig = ticket.rig_id;
    if (rig && typeof rig === 'object' && 'name' in rig && rig.name) return String(rig.name);
    return ticket.project_id?.title ?? '—';
  };

  const calendarSignalForTicket = (ticket: CrewTicketApi) => {
    const st = getTicketStatus(ticket);
    if (st === 'CANCELLED') return 'Available';
    if (st === 'APPROVED') return 'On assignment for us';
    return 'Confirmed';
  };

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
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Home Airport</div><div className="subsea-detail-val">{field(crew.city || crew.country)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Address</div><div className="subsea-detail-val">{field(crew.address)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Gender</div><div className="subsea-detail-val">{field(crew.gender)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Visa</div><div className="subsea-detail-val">{field(crew.visa || crew.visa_country)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Preferred Rating</div><div className="subsea-detail-val">{field(crew.preferred_rating)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Primary BOP OEM</div><div className="subsea-detail-val">{field(crew.primary_bop_oem)}</div></div>
                    </div>
                  </div>

                  <div>
                    <div className="subsea-pane subsea-mb-12">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Status & Availability Details</div></div>
                      <div className="subsea-detail-grid">
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Personnel Status</div>
                          <div className="subsea-detail-val">
                            <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(crew.current_status)}`}>
                              {crewStatusTierLabel(crew.current_status)}
                            </span>
                          </div>
                        </div>
                        {crew.current_status === 'Offshore (Competitor)' && (
                          <div className="subsea-detail-row">
                            <div className="subsea-detail-label">Current Employer</div>
                            <div className="subsea-detail-val">
                              {field(
                                crew.currentAssignment?.employer === 'Other'
                                  ? crew.currentAssignment?.employer_other
                                  : crew.currentAssignment?.employer
                              )}
                            </div>
                          </div>
                        )}
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Client</div>
                          <div className="subsea-detail-val">{field(crew.currentAssignment?.client)}</div>
                        </div>
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Rig / Vessel</div>
                          <div className="subsea-detail-val">
                            {crew.currentAssignment?.travelDirection === 'RIG_TO_HOME'
                              ? 'Home airport'
                              : field(crew.currentAssignment?.rig_vessel)}
                          </div>
                        </div>
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Travel direction</div>
                          <div className="subsea-detail-val">
                            {crew.currentAssignment?.travelDirection === 'RIG_TO_HOME'
                              ? 'Off signer'
                              : crew.currentAssignment?.travelDirection === 'HOME_TO_RIG'
                                ? 'On signer'
                                : '—'}
                          </div>
                        </div>
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Available From</div>
                          <div className="subsea-detail-val">
                            {crew.currentAssignment?.available_from
                              ? new Date(crew.currentAssignment.available_from).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </div>
                        </div>
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Country</div>
                          <div className="subsea-detail-val">{field(crew.currentAssignment?.country)}</div>
                        </div>
                        <div className="subsea-detail-row">
                          <div className="subsea-detail-label">Notes</div>
                          <div className="subsea-detail-val">{field(crew.currentAssignment?.notes)}</div>
                        </div>
                      </div>
                    </div>

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
                <>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Employment History</div>
                      <div className="subsea-pane-sub">{projects.length} assigned projects</div>
                    </div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead><tr><th>Rig / Project</th><th>Rank</th><th>Company</th><th>From</th><th>To</th><th>Status</th></tr></thead>
                        <tbody>
                          {projects.length === 0 ? (
                            <tr><td colSpan={6} className="subsea-empty-cell">No project employment records yet.</td></tr>
                          ) : (
                            projects.map((project) => (
                              <tr key={project.id}>
                                <td className="s">{project.title}</td>
                                <td>{rank}</td>
                                <td>Subseacore Ltd.</td>
                                <td>{formatDate(project.duration?.startDate)}</td>
                                <td>{formatDate(project.duration?.endDate)}</td>
                                <td><span className="subsea-badge subsea-b-gray">{project.status || 'Active'}</span></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="subsea-pane" style={{ marginTop: 16 }}>
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Flight / travel records</div>
                      <div className="subsea-pane-sub">{crewTickets.length} ticket{crewTickets.length === 1 ? '' : 's'} · mirrors availability calendar</div>
                    </div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead>
                          <tr>
                            <th>Travel dates</th>
                            <th>Direction</th>
                            <th>Rig</th>
                            <th>Route</th>
                            <th>Project</th>
                            <th>Ticket</th>
                            <th>Calendar status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crewTickets.length === 0 ? (
                            <tr><td colSpan={7} className="subsea-empty-cell">No flight bookings recorded for this crew.</td></tr>
                          ) : (
                            crewTickets.map((ticket) => {
                              const signal = calendarSignalForTicket(ticket);
                              const st = getTicketStatus(ticket);
                              return (
                                <tr key={`rec-${ticket.id}`}>
                                  <td>{bookingWindowLabel(ticket)}</td>
                                  <td>{travelDirectionLabel(ticket)}</td>
                                  <td className="s">{ticketRigLabel(ticket)}</td>
                                  <td>{ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}</td>
                                  <td>{ticket.project_id?.title ?? '—'}</td>
                                  <td>
                                    <span className={`subsea-badge ${st === 'APPROVED' ? 'subsea-b-green' : st === 'CANCELLED' ? 'subsea-b-red' : 'subsea-b-orange'}`}>
                                      {getTicketStatusLabel(ticket)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(signal)}`}>
                                      {crewStatusTierLabel(signal)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
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
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Total Rotations</div><div className="subsea-kpi-value">{Math.max(projects.length, 0)}</div><div className="subsea-kpi-meta flat">Assigned projects</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill blue" style={{ width: '70%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Active Bookings</div><div className="subsea-kpi-value">{activeBookingBlocks.length}</div><div className="subsea-kpi-meta flat">Pending + approved tickets</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill teal" style={{ width: `${Math.min(100, activeBookingBlocks.length * 20)}%` }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Rigs Served</div><div className="subsea-kpi-value">{Math.max(projects.length, 0)}</div><div className="subsea-kpi-meta flat">Current roster</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill green" style={{ width: '45%' }} /></div></div>
                    <div className="subsea-kpi"><div className="subsea-kpi-label">Cancelled</div><div className="subsea-kpi-value">{crewTickets.filter((t) => getTicketStatus(t) === 'CANCELLED').length}</div><div className="subsea-kpi-meta flat">Freed calendar days</div><div className="subsea-kpi-bar"><div className="subsea-kpi-fill amber" style={{ width: '35%' }} /></div></div>
                  </div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Flight bookings / occupied windows</div></div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead>
                          <tr>
                            <th>Route</th>
                            <th>Travel dates</th>
                            <th>Direction</th>
                            <th>Rig</th>
                            <th>Project</th>
                            <th>Status</th>
                            <th>Calendar signal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crewTickets.length === 0 ? (
                            <tr><td colSpan={7} className="subsea-empty-cell">No flight bookings for this crew yet.</td></tr>
                          ) : (
                            crewTickets.map((ticket) => {
                              const st = getTicketStatus(ticket);
                              const signal = calendarSignalForTicket(ticket);
                              return (
                                <tr key={ticket.id}>
                                  <td className="s">{ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}</td>
                                  <td>{bookingWindowLabel(ticket)}</td>
                                  <td>{travelDirectionLabel(ticket)}</td>
                                  <td>{ticketRigLabel(ticket)}</td>
                                  <td>{ticket.project_id?.title ?? '—'}</td>
                                  <td>
                                    <span className={`subsea-badge ${st === 'APPROVED' ? 'subsea-b-green' : st === 'CANCELLED' ? 'subsea-b-red' : 'subsea-b-orange'}`}>
                                      {getTicketStatusLabel(ticket)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(signal)}`}>
                                      {crewStatusTierLabel(signal)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="subsea-pane" style={{ marginTop: 16 }}>
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Rotation Schedule</div></div>
                    <div className="subsea-table-wrap">
                      <table className="subsea-table">
                        <thead><tr><th>Rig</th><th>Rank</th><th>Sign-On</th><th>Sign-Off</th><th>Status</th></tr></thead>
                        <tbody>
                          {projects.length === 0 ? (
                            <tr><td colSpan={5} className="subsea-empty-cell">No project rotations assigned.</td></tr>
                          ) : (
                            projects.map((project) => (
                              <tr key={project.id}><td className="s">{project.title}</td><td>{rank}</td><td>{formatDate(project.duration?.startDate)}</td><td>{formatDate(project.duration?.endDate)}</td><td><span className="subsea-badge subsea-b-green">{project.status || 'Active'}</span></td></tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'visa' && (
                <div className="subsea-g2 vevo-page">
                  <div className="subsea-pane">
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">VEVO grant check</div>
                      <a
                        href={VEVO_PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="subsea-btn subsea-btn-default subsea-btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        <ExternalLink size={12} /> VEVO portal
                      </a>
                    </div>
                    <div className="subsea-pane-body-flat">
                      <p className="vevo-inline-note">
                        Enter grant number, passport, and date of birth to fetch entitlement status and certificate.
                      </p>
                      <form onSubmit={(e) => void handleVevoFetch(e)} className="vevo-inline-form">
                        <div className="vevo-field">
                          <label>Grant number *</label>
                          <div className="vevo-input-wrap">
                            <input
                              value={vevoGrantNumber}
                              onChange={(e) => setVevoGrantNumber(e.target.value)}
                              placeholder="Visa grant number"
                              autoComplete="off"
                              style={{ paddingLeft: 12 }}
                            />
                          </div>
                        </div>
                        <div className="vevo-field">
                          <label>Passport number *</label>
                          <div className="vevo-input-wrap">
                            <input
                              value={vevoPassportNumber}
                              onChange={(e) => setVevoPassportNumber(e.target.value)}
                              placeholder="Document number"
                              autoComplete="off"
                              style={{ paddingLeft: 12 }}
                            />
                          </div>
                        </div>
                        <div className="vevo-field">
                          <label>Date of birth *</label>
                          <div className="vevo-input-wrap">
                            <input
                              type="date"
                              value={vevoDateOfBirth}
                              onChange={(e) => setVevoDateOfBirth(e.target.value)}
                              style={{ paddingLeft: 12 }}
                            />
                          </div>
                        </div>
                        <div className="vevo-field">
                          <label>Country</label>
                          <div className="vevo-input-wrap">
                            <input
                              value={vevoCountry}
                              onChange={(e) => setVevoCountry(e.target.value.toUpperCase())}
                              placeholder="AUS"
                              maxLength={3}
                              style={{ paddingLeft: 12 }}
                            />
                          </div>
                        </div>
                        <div className="vevo-field full">
                          <button type="submit" className="vevo-btn vevo-btn-primary" disabled={vevoFetching}>
                            {vevoFetching ? 'Checking…' : 'Fetch VEVO details'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="subsea-pane vevo-result">
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Verification result</div>
                      {vevoData?.visaStatus && (
                        <span className={`subsea-badge ${visaStatusBadgeClass(vevoData.visaStatus)}`}>
                          {vevoData.visaStatus}
                        </span>
                      )}
                    </div>
                    {!vevoResult ? (
                      <div className="vevo-result-empty" style={{ minHeight: 220 }}>
                        <div>
                          <div className="vevo-result-empty-icon">—</div>
                          <strong>No check yet</strong>
                          <p>Submit the form to load entitlement status.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="subsea-pane-body-flat">
                        <div className="vevo-metrics" style={{ padding: 0, marginBottom: 12 }}>
                          <div className="vevo-metric">
                            <label>Applicant</label>
                            <strong>{field(vevoData?.applicantName)}</strong>
                          </div>
                          <div className="vevo-metric">
                            <label>Subclass</label>
                            <strong>{field(vevoData?.visaSubclass)}</strong>
                          </div>
                          <div className="vevo-metric">
                            <label>Expiry</label>
                            <strong>{formatDate(vevoData?.expiryDate ?? undefined)}</strong>
                          </div>
                          <div className="vevo-metric">
                            <label>Class</label>
                            <strong>{field(vevoData?.visaClass)}</strong>
                          </div>
                        </div>
                        <div className="vevo-rights" style={{ margin: '0 0 12px' }}>
                          <label>Work entitlements</label>
                          <p>{field(vevoData?.workEntitlements)}</p>
                        </div>
                        {vevoData?.pdfStream && (
                          <button
                            type="button"
                            className="vevo-btn vevo-btn-primary"
                            onClick={() => {
                              try {
                                downloadPdfFromDataUri(
                                  vevoData.pdfStream!,
                                  `vevo-${vevoData.grantNumber || 'certificate'}.pdf`
                                );
                                toast.success('PDF downloaded');
                              } catch {
                                toast.error('Could not download PDF');
                              }
                            }}
                          >
                            Download entitlement PDF
                          </button>
                        )}
                        {vevoResult.errors?.length ? (
                          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--danger, #b91c1c)' }}>
                            {vevoResult.errors.join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="subsea-pane" style={{ gridColumn: '1 / -1' }}>
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Entitlements on file</div>
                      <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => void openEditModal()}>
                        Edit Profile
                      </button>
                    </div>
                    <div className="subsea-pane-body-flat" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="subsea-detail-row">
                        <div className="subsea-detail-label">Reference on file</div>
                        <div className="subsea-detail-val">{field(crew.visa_details?.vevo_reference_number)}</div>
                      </div>
                      <div className="subsea-detail-row">
                        <div className="subsea-detail-label">Visa subclass</div>
                        <div className="subsea-detail-val">{field(crew.visa_details?.visa_subclass)}</div>
                      </div>
                      <div className="subsea-detail-row">
                        <div className="subsea-detail-label">Expiry on file</div>
                        <div className="subsea-detail-val">
                          {formatDate(crew.visa_details?.visa_expiry_date || crew.visa_expiry_date)}
                        </div>
                      </div>
                      <div className="subsea-detail-row">
                        <div className="subsea-detail-label">Conditions</div>
                        <div className="subsea-detail-val" style={{ whiteSpace: 'pre-wrap' }}>
                          {field(crew.visa_details?.visa_conditions)}
                        </div>
                      </div>
                    </div>
                  </div>
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
                        const statusStr = getDayAvailabilityStatus(day);
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
                            : statusStr !== 'none'
                              ? getCalendarDayStyle(statusStr).backgroundColor
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
                              {statusStr !== 'none' && (
                                <span 
                                  className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(statusStr)}`} 
                                  style={{ fontSize: '9px', padding: '1px 4px', width: 'fit-content' }}
                                >
                                  {crewStatusTierLabel(statusStr)}
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
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: 'var(--subsea-text-muted)', alignSelf: 'flex-start', marginTop: '12px' }}>
                      {CREW_STATUS_TIER_OPTIONS.map((tier) => {
                        const styleVal = getCalendarDayStyle(tier);
                        return (
                          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '3px', 
                              backgroundColor: styleVal.backgroundColor || 'rgba(0,0,0,0.05)',
                              border: `1px solid ${styleVal.backgroundColor ? (styleVal.backgroundColor as string).replace('0.08', '0.4') : 'rgba(0,0,0,0.1)'}`
                            }} />
                            <span>{crewStatusTierLabel(tier)}</span>
                          </div>
                        );
                      })}
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
                            onChange={(e) => {
                              const next = e.target.value as CrewStatusTier;
                              setNewAvailType(next);
                              if (next !== 'Offshore (Competitor)') {
                                setNewAvailEmployer('');
                                setNewAvailEmployerOther('');
                              }
                            }}
                            className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                            style={{ borderColor: '#cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', height: '30px' }}
                          >
                            {CREW_STATUS_TIER_OPTIONS.map((statusTier) => (
                              <option key={statusTier} value={statusTier}>
                                {crewStatusTierLabel(statusTier)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {(newAvailType === 'Offshore (Competitor)' || newAvailType === 'On assignment for us') && (
                        <div className="grid grid-cols-2 gap-2">
                          {/* Current Employer is Offshore (Competitor) only */}
                          {newAvailType === 'Offshore (Competitor)' && (
                            <>
                              <div className="dev-new-field" data-dev-tag="NEW">
                                <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">CURRENT EMPLOYER</label>
                                <select
                                  value={newAvailEmployer}
                                  onChange={(e) => setNewAvailEmployer(e.target.value)}
                                  className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                                  style={{ borderColor: '#cbd5e1', height: '30px' }}
                                >
                                  <option value="">Select employer</option>
                                  {EMPLOYER_OPTIONS.map((emp) => (
                                    <option key={emp} value={emp}>{emp}</option>
                                  ))}
                                </select>
                              </div>
                              {newAvailEmployer === 'Other' && (
                                <div className="dev-new-field" data-dev-tag="NEW">
                                  <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">EMPLOYER (OTHER)</label>
                                  <input
                                    type="text"
                                    value={newAvailEmployerOther}
                                    onChange={(e) => setNewAvailEmployerOther(e.target.value)}
                                    className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                                    style={{ borderColor: '#cbd5e1', height: '30px' }}
                                    placeholder="Free text"
                                  />
                                </div>
                              )}
                            </>
                          )}
                          <div className="dev-new-field" data-dev-tag="NEW">
                            <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">CLIENT / OPERATOR</label>
                            <input
                              type="text"
                              value={newAvailClient}
                              onChange={(e) => setNewAvailClient(e.target.value)}
                              className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                              style={{ borderColor: '#cbd5e1', height: '30px' }}
                              placeholder="e.g. Transocean"
                            />
                          </div>
                          <div className="dev-new-field" data-dev-tag="NEW">
                            <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">RIG / VESSEL</label>
                            <input
                              type="text"
                              value={newAvailRigVessel}
                              onChange={(e) => setNewAvailRigVessel(e.target.value)}
                              className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                              style={{ borderColor: '#cbd5e1', height: '30px' }}
                              placeholder="e.g. Deepwater Atlas"
                            />
                          </div>
                          <div className="dev-new-field" data-dev-tag="NEW">
                            <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">COUNTRY</label>
                            <input
                              type="text"
                              value={newAvailCountry}
                              onChange={(e) => setNewAvailCountry(e.target.value)}
                              className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                              style={{ borderColor: '#cbd5e1', height: '30px' }}
                            />
                          </div>
                          <div className="col-span-full dev-new-field" data-dev-tag="NEW">
                            <label className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase">NOTES</label>
                            <input
                              type="text"
                              value={newAvailNotes}
                              onChange={(e) => setNewAvailNotes(e.target.value)}
                              className="w-full text-xs p-1.5 border rounded bg-white text-slate-900"
                              style={{ borderColor: '#cbd5e1', height: '30px' }}
                              placeholder="e.g. Working 3-week rotation"
                            />
                          </div>
                        </div>
                      )}
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
                          const resolvedStatus = resolveAvailabilityItemStatus(item);
                          const isAvail = resolvedStatus === 'Available';
                          const themeMap: Record<CrewStatusTier, { bg: string; border: string; text: string }> = {
                            Available: {
                              bg: 'rgba(34, 197, 94, 0.05)',
                              border: 'rgba(34, 197, 94, 0.2)',
                              text: 'var(--subsea-text-success, #059669)',
                            },
                            Offered: {
                              bg: 'rgba(234, 179, 8, 0.05)',
                              border: 'rgba(234, 179, 8, 0.2)',
                              text: '#d97706',
                            },
                            Confirmed: {
                              bg: 'rgba(59, 130, 246, 0.05)',
                              border: 'rgba(59, 130, 246, 0.2)',
                              text: '#2563eb',
                            },
                            'In Flight': {
                              bg: 'rgba(6, 182, 212, 0.05)',
                              border: 'rgba(6, 182, 212, 0.2)',
                              text: '#0891b2',
                            },
                            'In Project': {
                              bg: 'rgba(139, 92, 246, 0.05)',
                              border: 'rgba(139, 92, 246, 0.2)',
                              text: '#7c3aed',
                            },
                            'On assignment for us': {
                              bg: 'rgba(168, 85, 247, 0.05)',
                              border: 'rgba(168, 85, 247, 0.2)',
                              text: '#9333ea',
                            },
                            'Offshore (Competitor)': {
                              bg: 'rgba(239, 68, 68, 0.05)',
                              border: 'rgba(239, 68, 68, 0.2)',
                              text: '#dc2626',
                            },
                            'Holiday / Not Available': {
                              bg: 'rgba(249, 115, 22, 0.05)',
                              border: 'rgba(249, 115, 22, 0.2)',
                              text: '#ea580c',
                            },
                            'Unknown / Inactive': {
                              bg: 'rgba(156, 163, 175, 0.05)',
                              border: 'rgba(156, 163, 175, 0.2)',
                              text: '#4b5563',
                            },
                          };
                          const theme = themeMap[resolvedStatus] ?? themeMap.Available;
                          const bg = theme.bg;
                          const border = theme.border;
                          const titleColor = theme.text;
                          const titleLabel = resolvedStatus === 'Available'
                            ? 'Available Window'
                            : resolvedStatus === 'Holiday / Not Available'
                              ? 'Unavailable Window'
                              : `${crewStatusTierLabel(resolvedStatus)} Window`;
                          return (
                            <div key={item.id} className="p-3 border rounded-lg flex items-center justify-between" style={{ backgroundColor: bg, borderColor: border }}>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: titleColor }}>{titleLabel}</div>
                                <div className="text-sm font-bold" style={{ color: 'var(--subsea-text)' }}>{fromStr} — {toStr}</div>
                                {!isAvail && (item.employer || item.client || item.rig_vessel || item.country || item.notes) && (
                                  <div className="text-[10px] text-muted-foreground mt-1 dev-new-field" data-dev-tag="NEW">
                                    {[
                                      item.employer === 'Other' ? item.employer_other : item.employer,
                                      item.client,
                                      item.rig_vessel,
                                      item.country,
                                      item.notes,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                    {item.available_from && (
                                      <span> · Available from {new Date(item.available_from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    )}
                                  </div>
                                )}
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


    </div>
  );
};

export default CrewDetailsPage;
