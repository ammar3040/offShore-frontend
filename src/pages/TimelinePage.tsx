import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Ticket,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewTickets, getCrewTicketCreatedIso, type CrewTicketApi } from '../api/ticket';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import './RigsPage.css';
import './TimelinePage.css';

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' });

type ViewMode = 'calendar' | 'gantt';
type EventTone = 'green' | 'amber' | 'blue' | 'red' | 'teal' | 'orange' | 'gray';
type EventType = 'Sign-On' | 'Sign-Off' | 'Flight' | 'Project' | 'Certificate' | 'Fleet';

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  reference: string;
  crew: string;
  type: EventType;
  status: string;
  tone: EventTone;
  icon: typeof CalendarDays;
}

interface GanttItem {
  id: string;
  label: string;
  detail: string;
  start: Date;
  end: Date;
  tone: EventTone;
  icon: typeof CalendarDays;
  projectId: string;
  rigId: string | null;
}

interface GanttGroup {
  rigId: string;
  rigName: string;
  items: GanttItem[];
}

const UNASSIGNED_RIG_ID = 'unassigned';

interface TimelineState {
  crew: CrewMemberApi[];
  projects: ProjectApi[];
  rigs: RigApi[];
  tickets: CrewTicketApi[];
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function formatShortDate(date: Date): string {
  return SHORT_DATE_FORMAT.format(date);
}

function daysBetween(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

function crewName(member?: CrewMemberApi): string {
  if (!member) return 'Unassigned crew';
  return `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || member.email || 'Unnamed crew';
}

function ticketCrewName(ticket: CrewTicketApi): string {
  return `${ticket.crew_id?.firstname ?? ''} ${ticket.crew_id?.lastname ?? ''}`.trim() || ticket.crew_id?.email || 'Crew member';
}

function ticketRoute(ticket: CrewTicketApi): string {
  const from = ticket.from?.Name?.match(/\[([A-Z0-9]{3})\]/)?.[1] ?? ticket.from?.Name?.slice(0, 3).toUpperCase() ?? '---';
  const to = ticket.to?.Name?.match(/\[([A-Z0-9]{3})\]/)?.[1] ?? ticket.to?.Name?.slice(0, 3).toUpperCase() ?? '---';
  return `${from}->${to}`;
}

function projectTone(status?: string): EventTone {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'completed') return 'green';
  if (normalized === 'pending' || normalized === 'draft') return 'amber';
  if (normalized === 'blocked') return 'red';
  return 'orange';
}

function projectRigId(project: ProjectApi, rigs: RigApi[]): string | null {
  const rig = project.rig_id;
  if (!rig) return null;

  let candidateId: string | null = null;
  if (typeof rig === 'string') {
    candidateId = rig;
  } else {
    const obj = rig as RigApi & { _id?: string };
    candidateId = obj.id || obj._id || null;
  }

  if (!candidateId) return null;

  const matched = rigs.find(
    (item) => item.id === candidateId || (item as RigApi & { _id?: string })._id === candidateId
  );
  return matched?.id ?? candidateId;
}

function ganttBarStyle(item: GanttItem, windowStart: Date): { left: string; width: string } {
  const left = Math.max(0, Math.min(100, (daysBetween(windowStart, item.start) * DAY_MS) / (WEEK_MS * 12) * 100));
  const width = Math.max(4, Math.min(100 - left, (Math.max(1, daysBetween(item.start, item.end)) * DAY_MS) / (WEEK_MS * 12) * 100));
  return { left: `${left}%`, width: `${width}%` };
}

function badgeClass(tone: EventTone): string {
  return `subsea-b-${tone}`;
}

function eventClass(tone: EventTone): string {
  return `timeline-event timeline-event-${tone}`;
}

function getCertificateExpiries(member: CrewMemberApi): Date[] {
  const raw = member as CrewMemberApi & {
    crew_certificate?: { expiry_date?: string } | Array<{ expiry_date?: string }>;
  };
  const dates: Date[] = [];
  const legacy = parseDate(member.certificate_expiry_date);
  if (legacy) dates.push(legacy);

  const certs = Array.isArray(raw.crew_certificate)
    ? raw.crew_certificate
    : raw.crew_certificate
      ? [raw.crew_certificate]
      : [];
  certs.forEach((cert) => {
    const date = parseDate(cert.expiry_date);
    if (date) dates.push(date);
  });

  return Array.from(new Map(dates.map((date) => [dateKey(date), date])).values());
}

function buildCalendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

const TimelinePage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarDate, setCalendarDate] = useState(() => startOfMonth(new Date()));
  const [data, setData] = useState<TimelineState>({ crew: [], projects: [], rigs: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRigId, setSelectedRigId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getCrewList(), getProjects(), getRigs(), getCrewTickets()])
      .then(([crewRes, projectsRes, rigsRes, ticketsRes]) => {
        if (cancelled) return;
        setData({
          crew: crewRes.crew ?? [],
          projects: projectsRes.projects ?? [],
          rigs: rigsRes.rigs ?? [],
          tickets: ticketsRes.crewTickets ?? [],
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load timeline data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const events = useMemo<TimelineEvent[]>(() => {
    const rows: TimelineEvent[] = [];
    const today = new Date();

    data.tickets.forEach((ticket) => {
      const date = parseDate(getCrewTicketCreatedIso(ticket));
      if (!date) return;
      const crew = ticketCrewName(ticket);
      rows.push({
        id: `ticket-${ticket.id}`,
        date,
        title: `${crew} flight booking`,
        reference: `${ticketRoute(ticket)} · ${ticket.project_id?.title ?? 'Project flight'}`,
        crew,
        type: 'Flight',
        status: ticket.pdf ? 'Ticket uploaded' : 'Booked',
        tone: ticket.pdf ? 'green' : 'blue',
        icon: Plane,
      });
    });

    data.projects.forEach((project) => {
      const tone = projectTone(project.status);
      const start = parseDate(project.duration?.startDate);
      const end = parseDate(project.duration?.endDate);
      if (start) {
        rows.push({
          id: `project-start-${project.id}`,
          date: start,
          title: `${project.title} starts`,
          reference: project.description || project.span || 'Project mobilisation',
          crew: `${project.participants?.length ?? 0} participants`,
          type: 'Project',
          status: project.status || 'Active',
          tone,
          icon: FolderKanban,
        });
      }
      if (end) {
        rows.push({
          id: `project-end-${project.id}`,
          date: end,
          title: `${project.title} deadline`,
          reference: project.description || project.span || 'Project completion',
          crew: `${project.participants?.length ?? 0} participants`,
          type: 'Project',
          status: project.status || 'Due',
          tone: tone === 'green' ? 'teal' : tone,
          icon: ShieldCheck,
        });
      }
    });

    data.crew.forEach((member) => {
      getCertificateExpiries(member).forEach((date, index) => {
        const days = daysBetween(today, date);
        rows.push({
          id: `cert-${member.id}-${index}-${dateKey(date)}`,
          date,
          title: `${crewName(member)} certificate expires`,
          reference: member.organization || member.activeProjects?.[0]?.title || 'Crew compliance',
          crew: crewName(member),
          type: 'Certificate',
          status: days < 0 ? 'Expired' : days <= 30 ? 'Action needed' : 'Renewal watch',
          tone: days <= 30 ? 'red' : 'amber',
          icon: BadgeCheck,
        });
      });
    });

    data.rigs.forEach((rig) => {
      const created = parseDate(rig.createdAt);
      if (!created) return;
      rows.push({
        id: `rig-${rig.id}`,
        date: created,
        title: `${rig.name} added to fleet`,
        reference: rig.address || rig.description || 'Fleet record',
        crew: 'Fleet',
        type: 'Fleet',
        status: 'Registered',
        tone: 'teal',
        icon: Ship,
      });
    });

    return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const schedulableProjects = useMemo(
    () =>
      data.projects.filter((project) => {
        const start = parseDate(project.duration?.startDate);
        const end = parseDate(project.duration?.endDate);
        return Boolean(start && end);
      }),
    [data.projects]
  );

  const ganttProjectOptions = useMemo(() => {
    if (selectedRigId === 'all') return schedulableProjects;
    if (selectedRigId === UNASSIGNED_RIG_ID) {
      return schedulableProjects.filter((project) => !projectRigId(project, data.rigs));
    }
    return schedulableProjects.filter((project) => projectRigId(project, data.rigs) === selectedRigId);
  }, [schedulableProjects, selectedRigId, data.rigs]);

  const ganttItems = useMemo<GanttItem[]>(() => {
    let rows: GanttItem[] = schedulableProjects.map((project) => {
      const start = parseDate(project.duration?.startDate)!;
      const end = parseDate(project.duration?.endDate)!;
      return {
        id: `project-${project.id}`,
        label: project.title,
        detail: project.description || project.span || project.status || 'Project window',
        start,
        end,
        tone: projectTone(project.status),
        icon: FolderKanban,
        projectId: project.id,
        rigId: projectRigId(project, data.rigs),
      };
    });

    if (selectedRigId !== 'all') {
      rows = rows.filter((row) => {
        const rowRigId = row.rigId ?? UNASSIGNED_RIG_ID;
        return rowRigId === selectedRigId;
      });
    }

    if (selectedProjectId !== 'all') {
      rows = rows.filter((row) => row.projectId === selectedProjectId);
    }

    return rows.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [schedulableProjects, selectedProjectId, selectedRigId, data.rigs]);

  const ganttGroups = useMemo<GanttGroup[]>(() => {
    const groups = new Map<string, GanttGroup>();

    ganttItems.forEach((item) => {
      const rigId = item.rigId ?? UNASSIGNED_RIG_ID;
      const rigName =
        rigId === UNASSIGNED_RIG_ID
          ? 'Unassigned'
          : data.rigs.find((rig) => rig.id === rigId)?.name ?? 'Unknown rig';

      const group = groups.get(rigId) ?? { rigId, rigName, items: [] };
      group.items.push(item);
      groups.set(rigId, group);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => a.start.getTime() - b.start.getTime()),
      }))
      .sort((a, b) => {
        if (a.rigId === UNASSIGNED_RIG_ID) return 1;
        if (b.rigId === UNASSIGNED_RIG_ID) return -1;
        return a.rigName.localeCompare(b.rigName);
      });
  }, [ganttItems, data.rigs]);

  const rigsWithProjects = useMemo(() => {
    const rigIds = new Set(
      schedulableProjects
        .map((project) => projectRigId(project, data.rigs))
        .filter((id): id is string => Boolean(id))
    );
    return data.rigs.filter((rig) => rigIds.has(rig.id));
  }, [data.rigs, schedulableProjects]);

  const hasUnassignedProjects = useMemo(
    () => schedulableProjects.some((project) => !projectRigId(project, data.rigs)),
    [schedulableProjects, data.rigs]
  );

  const handleRigFilter = (rigId: string) => {
    setSelectedRigId(rigId);
    setSelectedProjectId('all');
  };

  const monthStart = startOfMonth(calendarDate);
  const calendarDays = useMemo(() => buildCalendarDays(monthStart), [monthStart]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    events.forEach((event) => {
      const key = dateKey(event.date);
      const dayEvents = map.get(key) ?? [];
      dayEvents.push(event);
      map.set(key, dayEvents);
    });
    return map;
  }, [events]);

  const visibleMonthEvents = useMemo(() => {
    return events.filter(
      (event) => event.date.getFullYear() === monthStart.getFullYear() && event.date.getMonth() === monthStart.getMonth()
    );
  }, [events, monthStart]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((event) => event.date >= today).slice(0, 9);
  }, [events]);

  const summary = useMemo(() => {
    return {
      signOns: data.crew.filter((member) => (member.signal || '').toUpperCase() === 'GREEN').length,
      signOffs: data.crew.filter((member) => (member.signal || '').toUpperCase() !== 'GREEN').length,
      flights: data.tickets.length,
      projects: data.projects.length,
      certs: events.filter((event) => event.type === 'Certificate' && event.tone === 'red').length,
      fleet: data.rigs.length,
    };
  }, [data, events]);

  const ganttWindowStart = monthStart;
  const ganttTicks = useMemo(() => Array.from({ length: 12 }, (_, index) => addDays(ganttWindowStart, index * 7)), [ganttWindowStart]);
  const todayKey = dateKey(new Date());

  return (
    <div className="subsea-shell">
      <nav className="subsea-nav" aria-label="Subseacore modules">
        <button type="button" className="subsea-brand" aria-label="Subseacore" onClick={() => navigate('/')}>
          <span className="subsea-mark">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17l4-8 4 4 4-6 4 10" />
              <circle cx="12" cy="5" r="2" />
            </svg>
          </span>
        </button>
        <div className="subsea-nav-items">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
            { icon: Users, label: 'Crew Management', path: '/crew', badge: true },
            { icon: Ship, label: 'Rigs', path: '/rig' },
            { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
            { icon: Wallet, label: 'Payroll', path: '/payroll' },
            { icon: FileText, label: 'Contracts', path: '/contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects', path: '/projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar', path: '/timeline', active: true },
            { divider: true },
            { icon: Bell, label: 'Notifications' },
          ].map((item, index) => {
            if ('divider' in item) return <span key={`divider-${index}`} className="subsea-nav-sep" />;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`subsea-ni${item.active ? ' active' : ''}`}
                aria-label={item.label}
                onClick={() => item.path && navigate(item.path)}
              >
                <Icon size={17} />
                {item.badge && <span className="subsea-ni-badge" />}
                <span className="subsea-ni-tip">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="subsea-nav-foot">
          <button type="button" className="subsea-ni" aria-label="Settings">
            <Settings size={17} />
            <span className="subsea-ni-tip">Settings</span>
          </button>
          <button type="button" className="subsea-ni" aria-label="Help">
            <HelpCircle size={17} />
            <span className="subsea-ni-tip">Help</span>
          </button>
          <SubseaProfileMenu />
        </div>
      </nav>

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Timeline</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter timeline">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search events..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Views</div>
          <button type="button" className={`subsea-sb-link${viewMode === 'calendar' ? ' active' : ''}`} onClick={() => setViewMode('calendar')}>
            <CalendarDays size={13} /> Calendar <span className="subsea-sb-count">{visibleMonthEvents.length}</span>
          </button>
          <button type="button" className={`subsea-sb-link${viewMode === 'gantt' ? ' active' : ''}`} onClick={() => setViewMode('gantt')}>
            <FolderKanban size={13} /> Gantt Chart <span className="subsea-sb-count">{ganttItems.length}</span>
          </button>
          {viewMode === 'gantt' && (
            <>
              <div className="subsea-sb-group">Rigs</div>
              <button
                type="button"
                className={`subsea-sb-link${selectedRigId === 'all' ? ' active' : ''}`}
                onClick={() => handleRigFilter('all')}
              >
                <Ship size={13} /> All rigs <span className="subsea-sb-count">{schedulableProjects.length}</span>
              </button>
              {rigsWithProjects.map((rig) => {
                const count = schedulableProjects.filter((project) => projectRigId(project, data.rigs) === rig.id).length;
                return (
                  <button
                    key={rig.id}
                    type="button"
                    className={`subsea-sb-link${selectedRigId === rig.id ? ' active' : ''}`}
                    onClick={() => handleRigFilter(rig.id)}
                  >
                    <Anchor size={13} /> {rig.name} <span className="subsea-sb-count">{count}</span>
                  </button>
                );
              })}
              {hasUnassignedProjects && (
                <button
                  type="button"
                  className={`subsea-sb-link${selectedRigId === UNASSIGNED_RIG_ID ? ' active' : ''}`}
                  onClick={() => handleRigFilter(UNASSIGNED_RIG_ID)}
                >
                  <Ship size={13} /> Unassigned <span className="subsea-sb-count">{schedulableProjects.filter((project) => !projectRigId(project, data.rigs)).length}</span>
                </button>
              )}
            </>
          )}
          <div className="subsea-sb-group">Event Types</div>
          <button type="button" className="subsea-sb-link">
            <Plane size={13} /> Flights <span className="subsea-sb-count">{summary.flights}</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <FolderKanban size={13} /> Projects <span className="subsea-sb-count">{summary.projects}</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <BadgeCheck size={13} /> Cert Expiries <span className="subsea-sb-count subsea-sb-count-red">{summary.certs}</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <Ship size={13} /> Fleet <span className="subsea-sb-count">{summary.fleet}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Timeline & Calendar</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />Live schedule · {events.length} events</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm">
              <Plus size={12} /> Add Event
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content timeline-page">
          <div className="subsea-page-head">
            <div>
              <h1>Timeline & Calendar</h1>
              <p>Crew movements, flight bookings, project windows, certificate renewals and fleet changes</p>
            </div>
            <div className="subsea-ph-right">
              <div className="subsea-view-toggle">
                <button type="button" className={`subsea-vt-btn${viewMode === 'calendar' ? ' active' : ''}`} onClick={() => setViewMode('calendar')}>
                  <CalendarDays size={12} /> Calendar
                </button>
                <button type="button" className={`subsea-vt-btn${viewMode === 'gantt' ? ' active' : ''}`} onClick={() => setViewMode('gantt')}>
                  <FolderKanban size={12} /> Gantt
                </button>
              </div>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
                <Filter size={12} /> Filter
              </button>
            </div>
          </div>

          <section className="subsea-kpi-strip timeline-kpi-strip">
            {[
              { label: 'Timeline Events', value: loading ? '...' : String(events.length), meta: `${visibleMonthEvents.length} this month`, tone: 'flat', bar: '76%', color: 'blue' },
              { label: 'Project Windows', value: loading ? '...' : String(summary.projects), meta: 'Active application projects', tone: 'up', bar: '64%', color: 'orange' },
              { label: 'Flight Records', value: loading ? '...' : String(summary.flights), meta: 'Crew ticket flow', tone: 'flat', bar: '52%', color: 'teal' },
              { label: 'Compliance Alerts', value: loading ? '...' : String(summary.certs), meta: 'Certificates needing action', tone: summary.certs ? 'down' : 'flat', bar: `${Math.min(100, summary.certs * 16)}%`, color: 'red' },
              { label: 'Fleet Records', value: loading ? '...' : String(summary.fleet), meta: 'Rigs in the system', tone: 'flat', bar: '48%', color: 'green' },
            ].map((kpi) => (
              <article key={kpi.label} className="subsea-kpi">
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{kpi.value}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>{kpi.meta}</div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          {loading ? (
            <div className="subsea-state">Loading timeline...</div>
          ) : error ? (
            <div className="subsea-state subsea-state-error" role="alert">{error}</div>
          ) : (
            <>
              {viewMode === 'calendar' ? (
                <>
                  <section className="timeline-calendar-header">
                    <div className="timeline-calendar-nav">
                      <button type="button" className="timeline-nav-btn" aria-label="Previous month" onClick={() => setCalendarDate((date) => addMonths(date, -1))}>
                        <ChevronLeft size={14} />
                      </button>
                      <strong>{MONTH_FORMAT.format(monthStart)}</strong>
                      <button type="button" className="timeline-nav-btn" aria-label="Next month" onClick={() => setCalendarDate((date) => addMonths(date, 1))}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="timeline-legend" aria-label="Timeline event legend">
                      {[
                        ['blue', 'Flight'],
                        ['orange', 'Project'],
                        ['red', 'Certificate'],
                        ['teal', 'Fleet'],
                        ['green', 'Complete'],
                      ].map(([tone, label]) => (
                        <span key={tone} className="timeline-legend-item">
                          <span className={`timeline-legend-dot timeline-legend-${tone}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="timeline-calendar-grid" aria-label={`${MONTH_FORMAT.format(monthStart)} timeline calendar`}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="timeline-cal-dow">{day}</div>
                    ))}
                    {calendarDays.map((day) => {
                      const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
                      const isOtherMonth = day.getMonth() !== monthStart.getMonth();
                      const isToday = dateKey(day) === todayKey;
                      return (
                        <article key={dateKey(day)} className={`timeline-cal-day${isOtherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}`}>
                          <div className="timeline-cal-day-num">{day.getDate()}</div>
                          {dayEvents.slice(0, 3).map((event) => {
                            const Icon = event.icon;
                            return (
                              <div key={event.id} className={eventClass(event.tone)} title={`${event.title} - ${event.reference}`}>
                                <Icon size={10} />
                                <span>{event.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && <div className="timeline-event-more">+{dayEvents.length - 3} more</div>}
                        </article>
                      );
                    })}
                  </section>

                  <section className="subsea-g-main timeline-lower-grid">
                    <div className="subsea-pane">
                      <div className="subsea-pane-head">
                        <div className="subsea-pane-title">Upcoming Events - {MONTH_FORMAT.format(monthStart)}</div>
                        <div className="subsea-pane-sub">Chronological view</div>
                      </div>
                      <div className="timeline-table-wrap">
                        {visibleMonthEvents.length === 0 ? (
                          <div className="timeline-empty">No events are scheduled for this month.</div>
                        ) : (
                          <table className="timeline-table">
                            <thead>
                              <tr><th>Date</th><th>Event</th><th>Reference</th><th>Crew</th><th>Type</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {visibleMonthEvents.map((event) => (
                                <tr key={event.id}>
                                  <td className="timeline-mono">{formatShortDate(event.date)}</td>
                                  <td className="timeline-strong">{event.title}</td>
                                  <td>{event.reference}</td>
                                  <td>{event.crew}</td>
                                  <td><span className={`subsea-badge ${badgeClass(event.tone)}`}>{event.type}</span></td>
                                  <td><span className={`subsea-badge ${badgeClass(event.tone)}`}>{event.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                    <div className="subsea-pane">
                      <div className="subsea-pane-head">
                        <div className="subsea-pane-title">Event Summary</div>
                      </div>
                      <div className="timeline-summary-list">
                        <div><UserCheck size={13} className="green" /><span>Available crew</span><strong>{summary.signOns}</strong></div>
                        <div><UserMinus size={13} className="amber" /><span>Assigned / unavailable</span><strong>{summary.signOffs}</strong></div>
                        <div><Ticket size={13} className="blue" /><span>Flight bookings</span><strong>{summary.flights}</strong></div>
                        <div><FolderKanban size={13} className="orange" /><span>Projects</span><strong>{summary.projects}</strong></div>
                        <div><AlertTriangle size={13} className="red" /><span>Compliance alerts</span><strong>{summary.certs}</strong></div>
                        <div><Ship size={13} className="teal" /><span>Fleet records</span><strong>{summary.fleet}</strong></div>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="subsea-pane">
                    <div className="subsea-pane-head timeline-gantt-head">
                      <div>
                        <div className="subsea-pane-title">Rig & Project Gantt - {MONTH_FORMAT.format(monthStart)}</div>
                        <div className="subsea-pane-sub">Project windows grouped by rig</div>
                      </div>
                      <div className="timeline-gantt-filters">
                        <div className="subsea-filter-wrap">
                          <span className="subsea-filter-label">Rig</span>
                          <select
                            className="subsea-filter-select"
                            value={selectedRigId}
                            onChange={(e) => handleRigFilter(e.target.value)}
                          >
                            <option value="all">All rigs</option>
                            {rigsWithProjects.map((rig) => (
                              <option key={rig.id} value={rig.id}>{rig.name}</option>
                            ))}
                            {hasUnassignedProjects && <option value={UNASSIGNED_RIG_ID}>Unassigned</option>}
                          </select>
                          <ChevronDown size={14} className="subsea-filter-chevron" />
                        </div>
                        <div className="subsea-filter-wrap">
                          <span className="subsea-filter-label">Project</span>
                          <select
                            className="subsea-filter-select"
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                          >
                            <option value="all">All projects</option>
                            {ganttProjectOptions.map((project) => (
                              <option key={project.id} value={project.id}>{project.title}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="subsea-filter-chevron" />
                        </div>
                      </div>
                    </div>
                    <div className="timeline-gantt-wrap">
                      <div className="timeline-gantt">
                        <div className="timeline-gantt-header">
                          <div className="timeline-gantt-label">Rig / Project</div>
                          <div className="timeline-gantt-dates">
                            {ganttTicks.map((tick) => (
                              <div key={dateKey(tick)} className={`timeline-gantt-date${dateKey(tick) === todayKey ? ' today-col' : ''}`}>
                                {formatShortDate(tick)}
                              </div>
                            ))}
                          </div>
                        </div>
                        {ganttGroups.length === 0 ? (
                          <div className="timeline-empty">No project windows match the selected rig or project filters.</div>
                        ) : (
                          ganttGroups.map((group) => (
                            <div key={group.rigId} className="timeline-gantt-group">
                              <div className="timeline-gantt-group-row">
                                <div className="timeline-gantt-group-label">
                                  <span className="timeline-gantt-row-icon timeline-gantt-teal"><Ship size={12} /></span>
                                  {group.rigName}
                                  <span className="timeline-gantt-group-count">{group.items.length}</span>
                                </div>
                                <div className="timeline-gantt-group-body" />
                              </div>
                              {group.items.map((item) => {
                                const Icon = item.icon;
                                const barStyle = ganttBarStyle(item, ganttWindowStart);
                                return (
                                  <div key={item.id} className="timeline-gantt-row timeline-gantt-row-nested">
                                    <div className="timeline-gantt-row-label">
                                      <span className={`timeline-gantt-row-icon timeline-gantt-${item.tone}`}><Icon size={12} /></span>
                                      {item.label}
                                    </div>
                                    <div className="timeline-gantt-row-body">
                                      <div className="timeline-gantt-grid-lines">
                                        {ganttTicks.map((tick) => (
                                          <span key={dateKey(tick)} className={dateKey(tick) === todayKey ? 'today-line' : ''} />
                                        ))}
                                      </div>
                                      <div className={`timeline-gantt-bar timeline-gantt-${item.tone}`} style={barStyle}>
                                        {item.detail}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="subsea-g-main timeline-lower-grid">
                    <div className="subsea-pane">
                      <div className="subsea-pane-head">
                        <div className="subsea-pane-title">Key Milestones</div>
                        <div className="subsea-pane-sub">Next scheduled events</div>
                      </div>
                      <div className="timeline-feed">
                        {upcomingEvents.length === 0 ? (
                          <div className="timeline-empty">No upcoming milestones.</div>
                        ) : (
                          upcomingEvents.map((event) => (
                            <div key={event.id} className="timeline-feed-item">
                              <span className={`timeline-feed-dot timeline-feed-${event.tone}`} />
                              <time>{formatShortDate(event.date)}</time>
                              <div>
                                <strong>{event.title}</strong>
                                <p>{event.reference} · {event.status}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="subsea-pane">
                      <div className="subsea-pane-head">
                        <div className="subsea-pane-title">Crew Rotation Signal</div>
                        <div className="subsea-pane-sub">Current roster status</div>
                      </div>
                      <div className="timeline-table-wrap">
                        <table className="timeline-table timeline-table-compact">
                          <thead><tr><th>Crew</th><th>Project</th><th>Status</th></tr></thead>
                          <tbody>
                            {data.crew.slice(0, 8).map((member) => {
                              const available = (member.signal || '').toUpperCase() === 'GREEN';
                              return (
                                <tr key={member.id}>
                                  <td className="timeline-strong">{crewName(member)}</td>
                                  <td>{member.activeProjects?.[0]?.title || 'Unassigned'}</td>
                                  <td><span className={`subsea-badge ${available ? 'subsea-b-green' : 'subsea-b-amber'}`}>{available ? 'Ready' : 'Assigned'}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default TimelinePage;
