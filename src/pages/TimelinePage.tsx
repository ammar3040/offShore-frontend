import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  FolderKanban,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  Ship,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { getCrewList, getCrewAvailabilityListAdmin, type CrewMemberApi, type CrewAvailabilityItem } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import {
  getCrewTickets,
  getCrewTicketCreatedIso,
  ticketHasStoredPdf,
  type CrewTicketApi,
} from '../api/ticket';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import {
  availabilityFromCrewSignal,
  crewAvailabilityDotClass,
  getCrewAvailabilityLabel,
  type CrewAvailability,
} from '../utils/crewAvailability';
import './RigsPage.css';
import './TimelinePage.css';

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' });

type ViewMode = 'calendar' | 'gantt';
type EventTone = 'green' | 'amber' | 'blue' | 'red' | 'teal' | 'orange' | 'gray';
type EventType = 'Sign-On' | 'Sign-Off' | 'Flight' | 'Project' | 'Certificate' | 'Fleet';
type TimelineEventKind = 'Sign-On' | 'Sign-Off' | 'Flight' | 'Project' | 'Certificate' | 'Fleet';
type EventTypeFilter = 'all' | TimelineEventKind;

interface CrewRosterRow {
  id: string;
  name: string;
  organization: string;
  project: string;
  nationality: string;
  email: string;
  availability: CrewAvailability;
  availabilityLabel: string;
  certLabel: string;
  certTone: EventTone;
  nextEvent?: string;
}

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
  kind: TimelineEventKind;
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
  return 'blue';
}

function ticketProjectId(ticket: CrewTicketApi): string | null {
  const project = ticket.project_id;
  if (!project) return null;
  return project._id || (project as { id?: string }).id || null;
}

function ticketRigId(ticket: CrewTicketApi, rigs: RigApi[]): string | null {
  const rig = ticket.rig_id;
  if (!rig) return null;

  let candidateId: string | null = null;
  if (typeof rig === 'string') {
    candidateId = rig;
  } else {
    const obj = rig as { id?: string; _id?: string };
    candidateId = obj.id || obj._id || null;
  }

  if (!candidateId) return null;

  const matched = rigs.find(
    (item) => item.id === candidateId || (item as RigApi & { _id?: string })._id === candidateId
  );
  return matched?.id ?? candidateId;
}

function crewRigId(member: CrewMemberApi, projects: ProjectApi[], rigs: RigApi[]): string | null {
  const activeTitle = member.activeProjects?.[0]?.title;
  if (!activeTitle) return null;
  const project = projects.find((item) => item.title === activeTitle);
  return project ? projectRigId(project, rigs) : null;
}

function certStatus(member: CrewMemberApi): { label: string; tone: EventTone } {
  const expiry = getCertificateExpiries(member)[0];
  if (!expiry) return { label: '—', tone: 'gray' };
  const days = daysBetween(new Date(), expiry);
  if (days < 0) return { label: 'Expired', tone: 'red' };
  if (days <= 7) return { label: `Expires in ${days}d`, tone: 'red' };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'amber' };
  return { label: formatShortDate(expiry), tone: 'green' };
}

function availabilityBadgeClass(kind: CrewAvailability): string {
  if (kind === 'available') return 'subsea-b-green';
  if (kind === 'endingSoon') return 'subsea-b-amber';
  return 'subsea-b-blue';
}

function availabilityBadgeLabel(kind: CrewAvailability): string {
  if (kind === 'available') return 'Available';
  if (kind === 'endingSoon') return 'Sign-off due';
  return 'On project';
}

function crewMatchesSearch(member: CrewMemberApi, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = crewName(member).toLowerCase();
  const project = member.activeProjects?.[0]?.title?.toLowerCase() ?? '';
  return (
    name.includes(q) ||
    (member.email ?? '').toLowerCase().includes(q) ||
    (member.organization ?? '').toLowerCase().includes(q) ||
    (member.nationality ?? '').toLowerCase().includes(q) ||
    project.includes(q)
  );
}

function ganttKindLabel(kind: EventTypeFilter): string {
  if (kind === 'all') return 'All events';
  if (kind === 'Sign-On') return 'Sign-ons';
  if (kind === 'Sign-Off') return 'Sign-offs';
  if (kind === 'Flight') return 'Flights';
  if (kind === 'Project') return 'Projects';
  if (kind === 'Certificate') return 'Certificate renewals';
  return 'Fleet';
}

function projectParticipants(project: ProjectApi, crew: CrewMemberApi[]): CrewMemberApi[] {
  const ids = new Set((project.participants ?? []).map((id) => String(id)));
  if (ids.size === 0) return [];
  return crew.filter((member) => ids.has(String(member.id)));
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedRigId, setSelectedRigId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<EventTypeFilter>('all');
  const [selectedCrewAvailabilities, setSelectedCrewAvailabilities] = useState<CrewAvailabilityItem[]>([]);

  useEffect(() => {
    if (selectedCrewId === 'all') {
      setSelectedCrewAvailabilities([]);
      return;
    }

    let active = true;
    getCrewAvailabilityListAdmin(selectedCrewId)
      .then(items => {
        if (active) setSelectedCrewAvailabilities(items);
      })
      .catch(err => {
        console.error('Failed to load selected crew availability:', err);
      });

    return () => {
      active = false;
    };
  }, [selectedCrewId]);

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
        status: ticketHasStoredPdf(ticket) ? 'Ticket uploaded' : 'Booked',
        tone: ticketHasStoredPdf(ticket) ? 'green' : 'blue',
        icon: Plane,
      });
    });

    data.projects.forEach((project) => {
      const tone = projectTone(project.status);
      const start = parseDate(project.duration?.startDate);
      const end = parseDate(project.duration?.endDate);
      const participants = projectParticipants(project, data.crew);

      if (start) {
        rows.push({
          id: `project-start-${project.id}`,
          date: start,
          title: `${project.title} starts`,
          reference: project.description || project.span || 'Project mobilisation',
          crew: participants.length > 0
            ? participants.map((member) => crewName(member)).join(', ')
            : `${project.participants?.length ?? 0} participants`,
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
          crew: participants.length > 0
            ? participants.map((member) => crewName(member)).join(', ')
            : `${project.participants?.length ?? 0} participants`,
          type: 'Project',
          status: project.status || 'Due',
          tone: tone === 'green' ? 'teal' : tone,
          icon: ShieldCheck,
        });
      }

      participants.forEach((member) => {
        const name = crewName(member);
        if (start) {
          rows.push({
            id: `sign-on-${project.id}-${member.id}`,
            date: start,
            title: `${name} sign-on`,
            reference: `${project.title} · ${member.organization || 'Crew mobilisation'}`,
            crew: name,
            type: 'Sign-On',
            status: 'Scheduled',
            tone: 'green',
            icon: UserCheck,
          });
        }
        if (end) {
          rows.push({
            id: `sign-off-${project.id}-${member.id}`,
            date: end,
            title: `${name} sign-off`,
            reference: `${project.title} · ${member.organization || 'Crew demobilisation'}`,
            crew: name,
            type: 'Sign-Off',
            status: 'Scheduled',
            tone: 'amber',
            icon: UserMinus,
          });
        }
      });
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

    const selectedCrewMember = data.crew.find(c => c.id === selectedCrewId);
    const selectedCrewName = selectedCrewMember ? crewName(selectedCrewMember) : '';

    if (selectedCrewId !== 'all' && selectedCrewName) {
      selectedCrewAvailabilities.forEach((avail) => {
        const start = parseDate(avail.from);
        const end = parseDate(avail.to);
        if (start && end) {
          rows.push({
            id: `crew-avail-${avail.id}`,
            date: start,
            title: `${selectedCrewName} Available`,
            reference: `Available from ${formatShortDate(start)} to ${formatShortDate(end)}`,
            crew: selectedCrewName,
            type: 'Sign-On',
            status: 'Available',
            tone: 'green',
            icon: UserCheck,
          });
        }
      });
    }

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
  }, [data, selectedCrewId, selectedCrewAvailabilities]);

  const sidebarCrewOptions = useMemo(() => {
    return [...data.crew]
      .filter((member) => crewMatchesSearch(member, searchQuery))
      .sort((a, b) => crewName(a).localeCompare(crewName(b)))
      .map((member) => ({
        id: member.id,
        name: crewName(member),
        availability: availabilityFromCrewSignal(member.signal),
      }));
  }, [data.crew, searchQuery]);

  const crewRosterRows = useMemo<CrewRosterRow[]>(() => {
    return [...data.crew]
      .filter((member) => crewMatchesSearch(member, searchQuery))
      .filter((member) => selectedCrewId === 'all' || member.id === selectedCrewId)
      .sort((a, b) => crewName(a).localeCompare(crewName(b)))
      .map((member) => {
        const project = member.activeProjects?.[0];
        const availability = availabilityFromCrewSignal(member.signal);
        const cert = certStatus(member);
        const nextDate =
          project?.duration?.endDate && availability !== 'available'
            ? `Sign-off ${formatShortDate(parseDate(project.duration.endDate) ?? new Date())}`
            : project?.duration?.startDate && availability === 'available'
              ? `Starts ${formatShortDate(parseDate(project.duration.startDate) ?? new Date())}`
              : undefined;
        return {
          id: member.id,
          name: crewName(member),
          organization: member.organization || '—',
          project: project?.title || 'Unassigned',
          nationality: member.nationality || '—',
          email: member.email || '—',
          availability,
          availabilityLabel: getCrewAvailabilityLabel(availability),
          certLabel: cert.label,
          certTone: cert.tone,
          nextEvent: nextDate,
        };
      });
  }, [data.crew, searchQuery, selectedCrewId]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = events;

    if (selectedEventType !== 'all') {
      rows = rows.filter((event) => event.type === selectedEventType);
    }

    if (selectedCrewId !== 'all') {
      const member = data.crew.find((item) => item.id === selectedCrewId);
      const name = member ? crewName(member).toLowerCase() : '';
      rows = rows.filter(
        (event) =>
          event.crew.toLowerCase().includes(name) ||
          event.title.toLowerCase().includes(name) ||
          event.reference.toLowerCase().includes(name)
      );
    }

    if (q) {
      rows = rows.filter(
        (event) =>
          event.title.toLowerCase().includes(q) ||
          event.reference.toLowerCase().includes(q) ||
          event.crew.toLowerCase().includes(q) ||
          event.type.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [events, selectedEventType, selectedCrewId, searchQuery, data.crew]);

  const eventTypeCounts = useMemo(
    () => ({
      signOns: events.filter((event) => event.type === 'Sign-On').length,
      signOffs: events.filter((event) => event.type === 'Sign-Off').length,
      flights: events.filter((event) => event.type === 'Flight').length,
      projects: events.filter((event) => event.type === 'Project').length,
      certs: events.filter((event) => event.type === 'Certificate').length,
      fleet: events.filter((event) => event.type === 'Fleet').length,
    }),
    [events]
  );

  const schedulableProjects = useMemo(
    () =>
      data.projects.filter((project) => {
        const start = parseDate(project.duration?.startDate);
        const end = parseDate(project.duration?.endDate);
        return Boolean(start && end);
      }),
    [data.projects]
  );

  const allGanttItems = useMemo<GanttItem[]>(() => {
    const rows: GanttItem[] = [];

    schedulableProjects.forEach((project) => {
      const start = parseDate(project.duration?.startDate);
      const end = parseDate(project.duration?.endDate);
      if (!start || !end) return;
      rows.push({
        id: `project-${project.id}`,
        label: project.title,
        detail: project.description || project.span || project.status || 'Project window',
        start,
        end,
        tone: projectTone(project.status),
        icon: FolderKanban,
        projectId: project.id,
        rigId: projectRigId(project, data.rigs),
        kind: 'Project',
      });
    });

    data.tickets.forEach((ticket) => {
      const date = parseDate(getCrewTicketCreatedIso(ticket));
      if (!date) return;
      rows.push({
        id: `flight-${ticket.id}`,
        label: `${ticketCrewName(ticket)} · ${ticketRoute(ticket)}`,
        detail: ticket.project_id?.title ?? 'Flight booking',
        start: date,
        end: addDays(date, 1),
        tone: ticketHasStoredPdf(ticket) ? 'green' : 'blue',
        icon: Plane,
        projectId: ticketProjectId(ticket) ?? '',
        rigId: ticketRigId(ticket, data.rigs),
        kind: 'Flight',
      });
    });

    data.projects.forEach((project) => {
      const start = parseDate(project.duration?.startDate);
      const end = parseDate(project.duration?.endDate);
      if (!start || !end) return;
      projectParticipants(project, data.crew).forEach((member) => {
        rows.push({
          id: `crew-window-${project.id}-${member.id}`,
          label: `${crewName(member)} · ${project.title}`,
          detail: member.organization || 'Crew assignment',
          start,
          end,
          tone: availabilityFromCrewSignal(member.signal) === 'endingSoon' ? 'amber' : 'green',
          icon: UserCheck,
          projectId: project.id,
          rigId: projectRigId(project, data.rigs),
          kind: 'Sign-On',
        });
      });
    });

    data.crew.forEach((member) => {
      const expiry = getCertificateExpiries(member)[0];
      if (!expiry) return;
      rows.push({
        id: `cert-track-${member.id}`,
        label: `${crewName(member)} cert renewal`,
        detail: member.organization || 'Compliance watch',
        start: addDays(expiry, -30),
        end: expiry,
        tone: daysBetween(new Date(), expiry) <= 30 ? 'red' : 'amber',
        icon: BadgeCheck,
        projectId: '',
        rigId: crewRigId(member, data.projects, data.rigs),
        kind: 'Certificate',
      });
    });

    data.rigs.forEach((rig) => {
      const created = parseDate(rig.createdAt);
      if (!created) return;
      rows.push({
        id: `fleet-${rig.id}`,
        label: rig.name,
        detail: rig.address || rig.description || 'Fleet registration',
        start: created,
        end: addDays(created, 7),
        tone: 'teal',
        icon: Ship,
        projectId: '',
        rigId: rig.id,
        kind: 'Fleet',
      });
    });

    return rows;
  }, [data.crew, data.projects, data.rigs, data.tickets, schedulableProjects]);

  const ganttItems = useMemo<GanttItem[]>(() => {
    let rows = allGanttItems;

    if (selectedEventType !== 'all') {
      rows = rows.filter((row) => row.kind === selectedEventType);
    }

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
  }, [allGanttItems, selectedEventType, selectedProjectId, selectedRigId]);

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
    const scopedItems =
      selectedEventType === 'all'
        ? allGanttItems
        : allGanttItems.filter((item) => item.kind === selectedEventType);
    const rigIds = new Set(
      scopedItems.map((item) => item.rigId).filter((id): id is string => Boolean(id))
    );
    return data.rigs.filter((rig) => rigIds.has(rig.id));
  }, [allGanttItems, data.rigs, selectedEventType]);

  const ganttRigScopeItems = useMemo(
    () =>
      selectedEventType === 'all'
        ? allGanttItems
        : allGanttItems.filter((item) => item.kind === selectedEventType),
    [allGanttItems, selectedEventType]
  );

  const hasUnassignedProjects = useMemo(
    () => ganttRigScopeItems.some((item) => !item.rigId),
    [ganttRigScopeItems]
  );

  const ganttProjectOptions = useMemo(() => {
    const projectIds = new Set(
      ganttRigScopeItems
        .filter((item) => item.projectId && (item.kind === 'Project' || item.kind === 'Flight'))
        .map((item) => item.projectId)
    );
    const options = schedulableProjects.filter((project) => projectIds.has(project.id));

    if (selectedRigId === 'all') return options;
    if (selectedRigId === UNASSIGNED_RIG_ID) {
      return options.filter((project) => !projectRigId(project, data.rigs));
    }
    return options.filter((project) => projectRigId(project, data.rigs) === selectedRigId);
  }, [ganttRigScopeItems, schedulableProjects, selectedRigId, data.rigs]);

  const showProjectGanttFilter =
    selectedEventType === 'all' || selectedEventType === 'Project' || selectedEventType === 'Flight';

  const handleRigFilter = (rigId: string) => {
    setSelectedRigId(rigId);
    setSelectedProjectId('all');
  };

  const handleEventTypeFilter = (type: EventTypeFilter) => {
    setSelectedEventType(type);
    if (type !== 'Project' && type !== 'Flight' && type !== 'all') {
      setSelectedProjectId('all');
    }
  };

  const monthStart = startOfMonth(calendarDate);
  const calendarDays = useMemo(() => buildCalendarDays(monthStart), [monthStart]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach((event) => {
      const key = dateKey(event.date);
      const dayEvents = map.get(key) ?? [];
      dayEvents.push(event);
      map.set(key, dayEvents);
    });
    return map;
  }, [filteredEvents]);

  const isDayAvailable = useMemo(() => {
    if (selectedCrewId === 'all') return () => true;
    
    if (selectedCrewAvailabilities.length === 0) {
      return () => true;
    }
    
    return (day: Date) => {
      const d = new Date(day);
      d.setHours(0,0,0,0);
      return selectedCrewAvailabilities.some(avail => {
        const start = new Date(avail.from);
        start.setHours(0,0,0,0);
        const end = new Date(avail.to);
        end.setHours(23,59,59,999);
        return d >= start && d <= end;
      });
    };
  }, [selectedCrewId, selectedCrewAvailabilities]);

  const visibleMonthEvents = useMemo(() => {
    return filteredEvents.filter(
      (event) => event.date.getFullYear() === monthStart.getFullYear() && event.date.getMonth() === monthStart.getMonth()
    );
  }, [filteredEvents, monthStart]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredEvents.filter((event) => event.date >= today).slice(0, 9);
  }, [filteredEvents]);

  const summary = useMemo(() => {
    const available = data.crew.filter(
      (member) => availabilityFromCrewSignal(member.signal) === 'available'
    ).length;
    const assigned = data.crew.length - available;
    return {
      crewTotal: data.crew.length,
      available,
      assigned,
      signOns: events.filter((event) => event.type === 'Sign-On').length,
      signOffs: events.filter((event) => event.type === 'Sign-Off').length,
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
      <SubseaNavRail activeModule="timeline" />

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
            <input
              type="text"
              placeholder="Search crew, events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                <Ship size={13} /> All rigs <span className="subsea-sb-count">{ganttRigScopeItems.length}</span>
              </button>
              {rigsWithProjects.map((rig) => {
                const count = ganttRigScopeItems.filter((item) => item.rigId === rig.id).length;
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
                  <Ship size={13} /> Unassigned <span className="subsea-sb-count">{ganttRigScopeItems.filter((item) => !item.rigId).length}</span>
                </button>
              )}
            </>
          )}
          <div className="subsea-sb-group">Crew</div>
          <button
            type="button"
            className={`subsea-sb-link${selectedCrewId === 'all' ? ' active' : ''}`}
            onClick={() => setSelectedCrewId('all')}
          >
            <Users size={13} /> All crew <span className="subsea-sb-count">{data.crew.length}</span>
          </button>
          <div className="timeline-crew-list-container">
            {sidebarCrewOptions.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`subsea-sb-link timeline-crew-link${selectedCrewId === row.id ? ' active' : ''}`}
                onClick={() => setSelectedCrewId(row.id)}
              >
                <span className={`${crewAvailabilityDotClass(row.availability)} timeline-crew-link-dot`} />
                <span className="timeline-crew-link-name">{row.name}</span>
              </button>
            ))}
          </div>
          <div className="subsea-sb-group">Event Types</div>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'all' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('all')}
          >
            <CalendarDays size={13} /> All events <span className="subsea-sb-count">{events.length}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Sign-On' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Sign-On')}
          >
            <UserCheck size={13} /> Sign-ons <span className="subsea-sb-count">{eventTypeCounts.signOns}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Sign-Off' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Sign-Off')}
          >
            <UserMinus size={13} /> Sign-offs <span className="subsea-sb-count">{eventTypeCounts.signOffs}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Flight' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Flight')}
          >
            <Plane size={13} /> Flights <span className="subsea-sb-count">{eventTypeCounts.flights}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Project' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Project')}
          >
            <FolderKanban size={13} /> Projects <span className="subsea-sb-count">{eventTypeCounts.projects}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Certificate' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Certificate')}
          >
            <BadgeCheck size={13} /> Cert Expiries <span className="subsea-sb-count subsea-sb-count-red">{eventTypeCounts.certs}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${selectedEventType === 'Fleet' ? ' active' : ''}`}
            onClick={() => handleEventTypeFilter('Fleet')}
          >
            <Ship size={13} /> Fleet <span className="subsea-sb-count">{eventTypeCounts.fleet}</span>
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
            <span className="subsea-crumb-active">Timeline & Calendar</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />Live schedule · {filteredEvents.length} events</div>
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
              { label: 'Crew Roster', value: loading ? '...' : String(summary.crewTotal), meta: `${summary.available} available · ${summary.assigned} assigned`, tone: 'flat', bar: `${summary.crewTotal ? Math.round((summary.available / summary.crewTotal) * 100) : 0}%`, color: 'green' },
              { label: 'Sign-Ons', value: loading ? '...' : String(summary.signOns), meta: 'Scheduled mobilisations', tone: 'up', bar: `${Math.min(100, summary.signOns * 8)}%`, color: 'green' },
              { label: 'Sign-Offs', value: loading ? '...' : String(summary.signOffs), meta: 'Scheduled demob dates', tone: 'flat', bar: `${Math.min(100, summary.signOffs * 8)}%`, color: 'amber' },
              { label: 'Flight Records', value: loading ? '...' : String(summary.flights), meta: 'Crew ticket flow', tone: 'flat', bar: '52%', color: 'teal' },
              { label: 'Compliance Alerts', value: loading ? '...' : String(summary.certs), meta: 'Certificates needing action', tone: summary.certs ? 'down' : 'flat', bar: `${Math.min(100, summary.certs * 16)}%`, color: 'red' },
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
                        ['green', 'Sign-On'],
                        ['amber', 'Sign-Off'],
                        ['blue', 'Flight'],
                        ['blue', 'Project'],
                        ['red', 'Certificate'],
                        ['teal', 'Fleet'],
                      ].map(([tone, label], index) => (
                        <span key={`${tone}-${label}-${index}`} className="timeline-legend-item">
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
                      const isUnavailable = !isDayAvailable(day);
                      return (
                        <article key={dateKey(day)} className={`timeline-cal-day${isOtherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}${isUnavailable ? ' unavailable' : ''}`}>
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
                          <div className="timeline-empty">
                            {selectedEventType === 'all'
                              ? 'No events are scheduled for this month.'
                              : `No ${ganttKindLabel(selectedEventType).toLowerCase()} are scheduled for this month.`}
                          </div>
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
                        <div>
                          <div className="subsea-pane-title">Crew Roster</div>
                          <div className="subsea-pane-sub">
                            {loading ? 'Loading crew...' : `${crewRosterRows.length} crew member${crewRosterRows.length === 1 ? '' : 's'}`}
                          </div>
                        </div>
                        <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>
                          View all
                        </button>
                      </div>
                      <div className="timeline-table-wrap">
                        {crewRosterRows.length === 0 ? (
                          <div className="timeline-empty">No crew members match your filters.</div>
                        ) : (
                          <table className="timeline-table timeline-table-compact">
                            <thead>
                              <tr>
                                <th>Crew</th>
                                <th>Role</th>
                                <th>Project</th>
                                <th>Status</th>
                                <th>Cert</th>
                              </tr>
                            </thead>
                            <tbody>
                              {crewRosterRows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="timeline-crew-row"
                                  onClick={() => navigate(`/crew/${row.id}`)}
                                >
                                  <td className="timeline-strong">
                                    <div className="subsea-roster-name">
                                      <span
                                        className={crewAvailabilityDotClass(row.availability)}
                                        title={row.availabilityLabel}
                                        aria-label={row.availabilityLabel}
                                      />
                                      <span>{row.name}</span>
                                    </div>
                                  </td>
                                  <td>{row.organization}</td>
                                  <td>{row.project}</td>
                                  <td>
                                    <span className={`subsea-badge ${availabilityBadgeClass(row.availability)}`}>
                                      {availabilityBadgeLabel(row.availability)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`subsea-badge ${badgeClass(row.certTone)}`}>{row.certLabel}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="subsea-pane timeline-crew-detail-pane">
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Crew Details</div>
                      <div className="subsea-pane-sub">Contact, nationality and next rotation</div>
                    </div>
                    <div className="timeline-table-wrap">
                      {crewRosterRows.length === 0 ? (
                        <div className="timeline-empty">No crew details to display.</div>
                      ) : (
                        <table className="timeline-table">
                          <thead>
                            <tr>
                              <th>Crew Member</th>
                              <th>Email</th>
                              <th>Nationality</th>
                              <th>Current Project</th>
                              <th>Next Event</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crewRosterRows.map((row) => (
                              <tr
                                key={`detail-${row.id}`}
                                className="timeline-crew-row"
                                onClick={() => navigate(`/crew/${row.id}`)}
                              >
                                <td className="timeline-strong">{row.name}</td>
                                <td>{row.email}</td>
                                <td>{row.nationality}</td>
                                <td>{row.project}</td>
                                <td>{row.nextEvent || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="subsea-pane">
                    <div className="subsea-pane-head timeline-gantt-head">
                      <div>
                        <div className="subsea-pane-title">{ganttKindLabel(selectedEventType)} Gantt - {MONTH_FORMAT.format(monthStart)}</div>
                        <div className="subsea-pane-sub">Grouped by rig · {ganttItems.length} items</div>
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
                        {showProjectGanttFilter && (
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
                        )}
                      </div>
                    </div>
                    <div className="timeline-gantt-wrap">
                      <div className="timeline-gantt">
                        <div className="timeline-gantt-header">
                          <div className="timeline-gantt-label">Rig / {selectedEventType === 'Flight' ? 'Flight' : selectedEventType === 'Certificate' ? 'Renewal' : selectedEventType === 'Fleet' ? 'Fleet' : 'Project'}</div>
                          <div className="timeline-gantt-dates">
                            {ganttTicks.map((tick) => (
                              <div key={dateKey(tick)} className={`timeline-gantt-date${dateKey(tick) === todayKey ? ' today-col' : ''}`}>
                                {formatShortDate(tick)}
                              </div>
                            ))}
                          </div>
                        </div>
                        {ganttGroups.length === 0 ? (
                          <div className="timeline-empty">
                            {selectedEventType === 'all'
                              ? 'No timeline items match the selected filters.'
                              : `No ${ganttKindLabel(selectedEventType).toLowerCase()} match the selected filters.`}
                          </div>
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
                        <div>
                          <div className="subsea-pane-title">Crew Rotation Signal</div>
                          <div className="subsea-pane-sub">
                            {loading ? 'Loading crew...' : `${summary.available} available · ${summary.assigned} on project`}
                          </div>
                        </div>
                        <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>
                          View all
                        </button>
                      </div>
                      <div className="timeline-table-wrap">
                        {crewRosterRows.length === 0 ? (
                          <div className="timeline-empty">No crew members match your filters.</div>
                        ) : (
                          <table className="timeline-table timeline-table-compact">
                            <thead>
                              <tr>
                                <th>Crew</th>
                                <th>Role</th>
                                <th>Project</th>
                                <th>Status</th>
                                <th>Cert</th>
                              </tr>
                            </thead>
                            <tbody>
                              {crewRosterRows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="timeline-crew-row"
                                  onClick={() => navigate(`/crew/${row.id}`)}
                                >
                                  <td className="timeline-strong">
                                    <div className="subsea-roster-name">
                                      <span
                                        className={crewAvailabilityDotClass(row.availability)}
                                        title={row.availabilityLabel}
                                        aria-label={row.availabilityLabel}
                                      />
                                      <span>{row.name}</span>
                                    </div>
                                  </td>
                                  <td>{row.organization}</td>
                                  <td>{row.project}</td>
                                  <td>
                                    <span className={`subsea-badge ${availabilityBadgeClass(row.availability)}`}>
                                      {availabilityBadgeLabel(row.availability)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`subsea-badge ${badgeClass(row.certTone)}`}>{row.certLabel}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
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
