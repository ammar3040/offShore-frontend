import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Users,
  Ticket,
  Plus,
  Calendar,
  RefreshCw,
  LayoutGrid,
  Wallet,
  TrendingUp,
  UserCog,
  Plane,
} from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { getProjects } from '../api/project';
import { getCrewList } from '../api/crew';
import {
  getCrewTickets,
  parseCrewTicketCreatedAt,
  isCrewTicketCreatedInLocalCalendarMonth,
  getCrewTicketCreatedIso,
  type CrewTicketApi,
} from '../api/ticket';
import { getAdminProfile, type AdminProfile } from '../api/admin';
import type { ProjectApi } from '../api/project';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import './CrewManagementDashboard.css';

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

function formatShortDate(iso: string): string {
  const d = parseProjectDay(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ticketCreatedListLabel(t: CrewTicketApi): string {
  const iso = getCrewTicketCreatedIso(t);
  if (!iso) return '';
  const ymd =
    iso.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(iso)
      ? iso.slice(0, 10)
      : iso;
  return ` · ${formatShortDate(ymd)}`;
}

function parseProjectDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function formatGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `£${Number(amount).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeStatus(status: string): string {
  return (status || '').trim().toLowerCase();
}

function isCompletedStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s.includes('complete') || s === 'done' || s === 'closed' || s === 'finished';
}

function crewDisplayName(crew: CrewTicketApi['crew_id']): string {
  const fn = crew.firstname?.trim() ?? '';
  const ln = crew.lastname?.trim() ?? '';
  const name = `${fn} ${ln}`.trim();
  return name || 'Crew member';
}

function airportLabel(loc: CrewTicketApi['from']): string {
  return loc?.Name?.trim() || '—';
}

const CrewManagementDashboard = () => {
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [tickets, setTickets] = useState<CrewTicketApi[] | null>(null);
  const [crewCount, setCrewCount] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((res) => {
        if (!cancelled) setProjects(res.projects ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCrewList()
      .then((res) => {
        if (!cancelled) setCrewCount((res.crew ?? []).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProfile = useCallback(() => {
    setProfileLoading(true);
    getAdminProfile()
      .then((p) => setAdminProfile(p))
      .catch(() => setAdminProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fetchTickets = useCallback(() => {
    getCrewTickets()
      .then((res) => setTickets(res.crewTickets ?? []))
      .catch((err) => {
        setTickets([]);
        toast.error('Failed to load tickets', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      });
  }, []);

  const refreshTicketsAndProfile = useCallback(() => {
    fetchTickets();
    loadProfile();
  }, [fetchTickets, loadProfile]);

  useEffect(() => {
    let cancelled = false;
    getCrewTickets()
      .then((res) => {
        if (!cancelled) setTickets(res.crewTickets ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setTickets([]);
          toast.error('Failed to load tickets', {
            description: err instanceof Error ? err.message : 'Please try again.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchTickets]);

  const creationChartData = useMemo(() => {
    const byMonth: Record<string, { month: string; projects: number; tickets: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = { month: key, projects: 0, tickets: 0 };
    }
    projects.forEach((p) => {
      const dateStr = p.createdAt ?? p.duration?.startDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth[key]) byMonth[key].projects += 1;
    });
    (tickets ?? []).forEach((t) => {
      const d = parseCrewTicketCreatedAt(t);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth[key]) byMonth[key].tickets += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [projects, tickets]);

  const creationChartConfig = {
    month: { label: 'Month' },
    projects: { label: 'Projects', color: 'hsl(var(--chart-1))' },
    tickets: { label: 'Tickets', color: 'hsl(var(--chart-2))' },
  } satisfies ChartConfig;

  const projectStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => normalizeStatus(p.status) === 'active').length;
    const completed = projects.filter((p) => isCompletedStatus(p.status)).length;
    return { total, active, completed };
  }, [projects]);

  const ticketsCreatedThisMonth = useMemo(() => {
    if (!tickets?.length) return 0;
    return tickets.filter((t) => isCrewTicketCreatedInLocalCalendarMonth(t)).length;
  }, [tickets]);

  const ticketBookingsGbp = useMemo(() => {
    if (!tickets?.length) return null;
    let sum = 0;
    let n = 0;
    tickets.forEach((t) => {
      if (typeof t.price === 'number' && !Number.isNaN(t.price)) {
        sum += t.price;
        n += 1;
      }
    });
    return n === 0 ? null : sum;
  }, [tickets]);

  const sortedRecentProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const ta = new Date(a.createdAt || a.duration?.startDate || 0).getTime();
      const tb = new Date(b.createdAt || b.duration?.startDate || 0).getTime();
      return tb - ta;
    });
  }, [projects]);

  const recentProjects = sortedRecentProjects.slice(0, 5);

  const upcomingEndDates = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return [...projects]
      .filter((p) => p.duration?.endDate)
      .map((p) => ({
        project: p,
        end: parseProjectDay(p.duration.endDate),
      }))
      .filter(({ end }) => !Number.isNaN(end.getTime()) && end >= startOfToday)
      .sort((a, b) => a.end.getTime() - b.end.getTime())
      .slice(0, 6);
  }, [projects]);

  const recentTickets = useMemo(() => {
    if (!tickets?.length) return [];
    return [...tickets]
      .filter((t) => parseCrewTicketCreatedAt(t) != null)
      .sort((a, b) => {
        const db = parseCrewTicketCreatedAt(b)!.getTime();
        const da = parseCrewTicketCreatedAt(a)!.getTime();
        return db - da;
      })
      .slice(0, 5);
  }, [tickets]);

  const greetingName = adminProfile?.firstname?.trim() || 'Admin';
  const balanceDisplay = profileLoading ? '…' : formatGbp(adminProfile?.balance);

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <div>
          <h1 className="admin-dashboard-greeting">
            {getGreeting()}, {greetingName}
          </h1>
          <p className="admin-dashboard-date">Today is {formatDate(new Date())}.</p>
          {adminProfile?.email ? (
            <p className="admin-dashboard-signed-in">{adminProfile.email}</p>
          ) : null}
        </div>
        <Link to="/projects" className="admin-dashboard-create-btn">
          <Plus size={14} />
          Create New Project
        </Link>
      </div>

      <nav className="admin-dashboard-quick-actions" aria-label="Workspace shortcuts">
        <Link to="/projects" className="admin-quick-action">
          <LayoutGrid size={16} />
          Projects
        </Link>
        <Link to="/crew" className="admin-quick-action">
          <UserCog size={16} />
          Crew
        </Link>
        <Link to="/tickets" className="admin-quick-action">
          <Plane size={16} />
          Tickets
        </Link>
      </nav>

      <div className="admin-dashboard-cards">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-blue">
            <FolderKanban size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{loadingProjects ? '…' : projectStats.active}</span>
            <span className="admin-stat-label">ACTIVE PROJECTS</span>
            <span className="admin-stat-hint">In progress</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-slate">
            <LayoutGrid size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{loadingProjects ? '…' : projectStats.total}</span>
            <span className="admin-stat-label">ALL PROJECTS</span>
            <span className="admin-stat-hint">
              {loadingProjects ? ' ' : `${projectStats.completed} completed`}
            </span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-purple">
            <Users size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{crewCount}</span>
            <span className="admin-stat-label">CREW ROSTER</span>
            <span className="admin-stat-hint">Members you manage</span>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card-tickets">
          <div className="admin-stat-icon admin-stat-icon-green">
            <Ticket size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{tickets === null ? '…' : tickets.length}</span>
            <span className="admin-stat-label">CREW TICKETS</span>
            <span className="admin-stat-hint">
              {ticketBookingsGbp != null ? `${formatGbp(ticketBookingsGbp)} booked` : 'Flight requests'}
            </span>
          </div>
          <button
            type="button"
            className="admin-stat-refresh"
            onClick={refreshTicketsAndProfile}
            title="Refresh tickets and account"
            aria-label="Refresh tickets and account"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-teal">
            <TrendingUp size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{tickets === null ? '…' : ticketsCreatedThisMonth}</span>
            <span className="admin-stat-label">NEW TICKETS (MONTH)</span>
            <span className="admin-stat-hint">Created this calendar month</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-amber">
            <Wallet size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{balanceDisplay}</span>
            <span className="admin-stat-label">ACCOUNT BALANCE</span>
            <span className="admin-stat-hint">GBP (from your profile)</span>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-panels">
        <div className="admin-dashboard-panel admin-panel-chart">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Projects &amp; Tickets Created</h2>
          </div>
          <div className="admin-panel-body admin-chart-body">
            {loadingProjects ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : creationChartData.length === 0 ? (
              <p className="admin-panel-empty">No creation data available yet.</p>
            ) : (
              <ChartContainer
                config={creationChartConfig}
                className="aspect-auto flex-1 min-h-[200px] w-full"
              >
                <BarChart accessibilityLayer data={creationChartData} margin={{ top: 4, left: 8, right: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tickFormatter={(value) => {
                      const [y, m] = value.split('-');
                      return new Date(parseInt(y, 10), parseInt(m, 10) - 1).toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      });
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) =>
                          new Date(value + '-01').toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                          })
                        }
                      />
                    }
                  />
                  <Bar dataKey="projects" fill="var(--color-projects)" radius={4} />
                  <Bar dataKey="tickets" fill="var(--color-tickets)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="admin-dashboard-panel admin-panel-cases">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Recent Projects</h2>
            <Link to="/projects" className="admin-panel-view-all">
              View All
            </Link>
          </div>
          <div className="admin-panel-body">
            {loadingProjects ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : recentProjects.length === 0 ? (
              <p className="admin-panel-empty">No projects found. Create your first project to get started.</p>
            ) : (
              <ul className="admin-cases-list">
                {recentProjects.map((p) => (
                  <li key={p.id} className="admin-case-item">
                    <span className="admin-case-title">{p.title}</span>
                    <span className="admin-case-status">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="admin-dashboard-panel admin-panel-deadlines">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Project end dates</h2>
            <Link to="/projects" className="admin-panel-view-all">
              Calendar
            </Link>
          </div>
          <div className="admin-panel-body">
            {loadingProjects ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : upcomingEndDates.length === 0 ? (
              <>
                <p className="admin-panel-empty admin-panel-empty--compact">
                  No upcoming project end dates from your schedule.
                </p>
                <Link to="/projects" className="admin-panel-calendar-btn">
                  <Calendar size={16} />
                  View projects
                </Link>
              </>
            ) : (
              <ul className="admin-list-rows">
                {upcomingEndDates.map(({ project }) => (
                  <li key={project.id} className="admin-list-row">
                    <div className="admin-list-row-main">
                      <span className="admin-list-row-title">{project.title}</span>
                      <span className="admin-case-status admin-case-status--muted">{project.status}</span>
                    </div>
                    <span className="admin-list-row-meta">Ends {formatShortDate(project.duration.endDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="admin-dashboard-panel admin-panel-tickets-feed">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Latest crew tickets</h2>
            <Link to="/tickets" className="admin-panel-view-all">
              Open tickets
            </Link>
          </div>
          <div className="admin-panel-body">
            {tickets === null ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : recentTickets.length === 0 ? (
              <>
                <p className="admin-panel-empty admin-panel-empty--compact">No crew tickets yet.</p>
                <Link to="/tickets" className="admin-panel-calendar-btn">
                  <Plane size={16} />
                  Book a ticket
                </Link>
              </>
            ) : (
              <ul className="admin-list-rows">
                {recentTickets.map((t) => (
                  <li key={t.id} className="admin-list-row">
                    <div className="admin-list-row-main">
                      <span className="admin-list-row-title">{crewDisplayName(t.crew_id)}</span>
                      <span className="admin-list-row-route" title="Route">
                        {airportLabel(t.from)} → {airportLabel(t.to)}
                      </span>
                    </div>
                    <span className="admin-list-row-meta">
                      {t.project_id?.title ?? 'Project'}
                      {ticketCreatedListLabel(t)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <footer className="admin-dashboard-footer">
        <p className="admin-footer-copy">© 2023 Offshore CRM. All rights reserved.</p>
        <nav className="admin-footer-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/security">Security Audit Logs</a>
        </nav>
        <p className="admin-footer-status">• All Systems Operational</p>
      </footer>
    </div>
  );
};

export default CrewManagementDashboard;
