import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewTickets, type CrewTicketApi } from '../api/ticket';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { availabilityFromCrewSignal } from '../utils/crewAvailability';
import './CrewManagementDashboard.css';

type DashboardState = {
  crew: CrewMemberApi[];
  rigs: RigApi[];
  projects: ProjectApi[];
  tickets: CrewTicketApi[];
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(value?: string): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function crewName(member: CrewMemberApi): string {
  return `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || 'Unnamed crew';
}

function ticketCrewId(ticket: CrewTicketApi): string {
  return ticket.crew_id?._id ?? '';
}

function ticketRoute(ticket?: CrewTicketApi): string {
  if (!ticket) return 'Pending';
  const from = ticket.from?.Name?.match(/\[([A-Z0-9]{3})\]/)?.[1] ?? ticket.from?.Name?.slice(0, 3).toUpperCase() ?? '---';
  const to = ticket.to?.Name?.match(/\[([A-Z0-9]{3})\]/)?.[1] ?? ticket.to?.Name?.slice(0, 3).toUpperCase() ?? '---';
  return `${from}→${to}`;
}

const CrewManagementDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardState>({ crew: [], rigs: [], projects: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getCrewList(), getRigs(), getProjects(), getCrewTickets()])
      .then(([crewRes, rigsRes, projectsRes, ticketsRes]) => {
        if (cancelled) return;
        setDashboard({
          crew: crewRes.crew ?? [],
          rigs: rigsRes.rigs ?? [],
          projects: projectsRes.projects ?? [],
          tickets: ticketsRes.crewTickets ?? [],
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onBoardCount = dashboard.crew.filter((member) => availabilityFromCrewSignal(member.signal) !== 'available').length;
  const onLeaveCount = Math.max(0, dashboard.crew.length - onBoardCount);
  const activeProjectsCount = dashboard.projects.filter((project) => (project.status || '').toLowerCase() === 'active').length;
  const expiringCrew = useMemo(() => {
    return dashboard.crew
      .map((member) => {
        const expiry = member.certificate_expiry_date || member.crew_certificate?.expiry_date;
        const days = daysUntil(expiry);
        return { member, expiry, days };
      })
      .filter((item): item is { member: CrewMemberApi; expiry: string; days: number } => item.days != null && item.days >= 0 && item.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [dashboard.crew]);

  const kpis = useMemo(() => {
    const crewTotal = dashboard.crew.length;
    const onBoardPct = crewTotal ? Math.round((onBoardCount / crewTotal) * 100) : 0;
    const leavePct = crewTotal ? Math.round((onLeaveCount / crewTotal) * 100) : 0;
    return [
      { label: 'Total Crew', value: loading ? '...' : String(crewTotal), meta: `${activeProjectsCount} active projects`, tone: 'up', bar: `${Math.min(100, crewTotal)}%`, color: 'blue', icon: true },
      { label: 'On Board', value: loading ? '...' : String(onBoardCount), meta: `Across ${dashboard.rigs.length} rigs`, tone: 'flat', bar: `${onBoardPct}%`, color: 'teal' },
      { label: 'On Leave', value: loading ? '...' : String(onLeaveCount), meta: `${leavePct}% of roster`, tone: 'flat', bar: `${leavePct}%`, color: 'amber' },
      { label: 'Cert Expiring', value: loading ? '...' : String(expiringCrew.length), meta: `${expiringCrew.filter((item) => item.days <= 7).length} critical`, tone: expiringCrew.length ? 'down' : 'flat', bar: `${Math.min(100, expiringCrew.length * 8)}%`, color: 'red' },
      { label: 'Flights Booked', value: loading ? '...' : String(dashboard.tickets.length), meta: 'Crew ticket records', tone: 'up', bar: `${Math.min(100, dashboard.tickets.length * 4)}%`, color: 'teal' },
    ];
  }, [activeProjectsCount, dashboard.crew.length, dashboard.rigs.length, dashboard.tickets.length, expiringCrew, loading, onBoardCount, onLeaveCount]);

  const fleetRows = useMemo(() => {
    return dashboard.rigs.slice(0, 5).map((rig, index) => {
      const status = index === 0 && dashboard.crew.length > 0 ? 'Active' : 'Operational';
      return {
        rig: rig.name,
        type: rig.description?.split('·')[0]?.trim() || 'Rig',
        location: rig.address || '—',
        crew: '—',
        status,
        port: rig.createdAt ? `Added ${formatDate(rig.createdAt)}` : '—',
      };
    });
  }, [dashboard.rigs, dashboard.crew.length]);

  const crewChanges = useMemo(() => {
    return dashboard.crew.slice(0, 5).map((member) => {
      const project = member.activeProjects?.[0];
      const ticket = dashboard.tickets.find((item) => ticketCrewId(item) === member.id);
      const type = availabilityFromCrewSignal(member.signal) === 'available' ? 'Available' : 'On Board';
      return {
        name: crewName(member),
        rank: member.organization || 'Crew',
        rig: project?.title || 'Unassigned',
        type,
        date: formatDate(project?.duration?.endDate),
        flight: ticketRoute(ticket),
      };
    });
  }, [dashboard.crew, dashboard.tickets]);

  const activity = useMemo(() => {
    const rows: Array<{ icon: typeof Plane; color: string; text: string; meta: string }> = [];
    const latestTicket = dashboard.tickets[0];
    if (latestTicket) {
      rows.push({
        icon: Plane,
        color: 'green',
        text: `${latestTicket.crew_id?.firstname ?? 'Crew'} ${latestTicket.crew_id?.lastname ?? ''} flight booked ${ticketRoute(latestTicket)}`.trim(),
        meta: latestTicket.project_id?.title || 'Crew flight booking',
      });
    }
    if (expiringCrew[0]) {
      rows.push({
        icon: BadgeCheck,
        color: expiringCrew[0].days <= 7 ? 'red' : 'amber',
        text: `${crewName(expiringCrew[0].member)} certificate expires in ${expiringCrew[0].days} days`,
        meta: `Renewal due by ${formatDate(expiringCrew[0].expiry)}`,
      });
    }
    rows.push({
      icon: Users,
      color: 'amber',
      text: `${onBoardCount} crew currently assigned`,
      meta: `${onLeaveCount} available / on leave`,
    });
    rows.push({
      icon: FileText,
      color: 'teal',
      text: `${dashboard.projects.length} projects loaded from backend`,
      meta: `${activeProjectsCount} active projects`,
    });
    rows.push({
      icon: CircleDollarSign,
      color: 'blue',
      text: `${dashboard.tickets.length} ticket records synced`,
      meta: 'Admin crew-ticket API',
    });
    return rows.slice(0, 5);
  }, [activeProjectsCount, dashboard.projects.length, dashboard.tickets, expiringCrew, onBoardCount, onLeaveCount]);

  const certs = expiringCrew.slice(0, 4).map(({ member, expiry, days }) => ({
    days: `${days}d`,
    color: days <= 7 ? 'red' : 'amber',
    name: `${crewName(member)} — Crew Certificate`,
    expires: formatDate(expiry),
  }));

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
            { icon: LayoutDashboard, label: 'Dashboard', path: '/', active: true },
            { icon: Users, label: 'Crew Management', path: '/crew', badge: true },
            { icon: Ship, label: 'Rigs', path: '/rig' },
            { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
            { icon: Wallet, label: 'Payroll' },
            { icon: FileText, label: 'Contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects', path: '/projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar' },
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
          <span className="subsea-sb-title">Dashboard</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search crew, rigs..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link active">
            <LayoutDashboard size={13} /> Fleet Overview <span className="subsea-sb-count">Live</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/rig')}>
            <Ship size={13} /> Rig Fleet <span className="subsea-sb-count">{loading ? '...' : dashboard.rigs.length}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Users size={13} /> Crew Roster <span className="subsea-sb-count">{loading ? '...' : dashboard.crew.length}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/tickets')}>
            <Plane size={13} /> Flight Bookings <span className="subsea-sb-count">{loading ? '...' : dashboard.tickets.length}</span>
          </button>
          <div className="subsea-sb-group">Compliance</div>
          <button type="button" className="subsea-sb-link">
            <BadgeCheck size={13} /> Certifications <span className="subsea-sb-count subsea-sb-count-red">{loading ? '...' : expiringCrew.length}</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <ShieldCheck size={13} /> Audit Logs
          </button>
          <div className="subsea-sb-group">Projects</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/projects')}>
            <Anchor size={13} /> Active Projects <span className="subsea-sb-count">{loading ? '...' : activeProjectsCount}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Dashboard</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={() => navigate('/crew')}>
              <Plus size={12} /> New
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <section className="subsea-welcome">
            <div className="subsea-wb-left">
              <div className="subsea-wb-greeting">Good morning</div>
              <div className="subsea-wb-name">Welcome back, <span>Pranav</span> 👋</div>
              <div className="subsea-wb-sub">Here's what's happening across your fleet today from the integrated backend APIs.</div>
              <div className="subsea-wb-chips">
                <span className="subsea-wb-chip subsea-wb-chip-amber"><AlertTriangle size={12} />{expiringCrew.length} certs need attention</span>
                <button type="button" className="subsea-wb-chip subsea-wb-chip-green" onClick={() => navigate('/rig')}><Ship size={12} />{dashboard.rigs.length} rigs loaded</button>
                <span className="subsea-wb-chip subsea-wb-chip-blue"><Radio size={12} />Open Command Center</span>
              </div>
            </div>
            <div className="subsea-wb-right">
              <div className="subsea-wb-date-block">
                <div className="subsea-wb-date">--:-- UTC</div>
                <div className="subsea-wb-time">Coordinated Universal Time</div>
              </div>
              <div className="subsea-wb-status-row">
                <span className="subsea-wb-status-dot" />
                <span>GMDSS Online · All systems nominal</span>
              </div>
            </div>
          </section>

          <div className="subsea-alert subsea-alert-warn">
            <AlertTriangle size={15} />
            <span>
              <strong>{error ? 'Dashboard sync warning:' : `${expiringCrew.length} items need attention:`}</strong>{' '}
              {error || `${expiringCrew.length} crew certifications expiring within 30 days · ${dashboard.rigs.length} rigs · ${dashboard.tickets.length} flight bookings.`}
            </span>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>Review</button>
          </div>

          <section className="subsea-kpi-strip">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="subsea-kpi">
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{kpi.value}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>
                  {kpi.icon && <ArrowUpRight size={11} />} {kpi.meta}
                </div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          <section className="subsea-grid-main">
            <div>
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div>
                    <div className="subsea-pane-title">Fleet Status</div>
                    <div className="subsea-pane-sub">{loading ? 'Loading rigs...' : `${dashboard.rigs.length} rigs · backend data`}</div>
                  </div>
                  <div className="subsea-pane-actions">
                    <span className="subsea-badge subsea-b-teal subsea-b-dot">All systems nominal</span>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/rig')}>View Fleet</button>
                  </div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr><th>Rig</th><th>Type</th><th>Location</th><th>Crew</th><th>Status</th><th>Next Port Call</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">Loading fleet data...</td></tr>
                      ) : fleetRows.length === 0 ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">No rigs found from backend.</td></tr>
                      ) : (
                        fleetRows.map((row, index) => (
                          <tr key={row.rig}>
                            <td className="strong"><Ship size={12} className={`subsea-table-icon subsea-tone-${index % 4}`} />{row.rig}</td>
                            <td>{row.type}</td>
                            <td className="mono">{row.location}</td>
                            <td><span className="subsea-text-green">{row.crew}</span></td>
                            <td><span className="subsea-badge subsea-b-green">{row.status}</span></td>
                            <td className="muted">{row.port}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Upcoming Crew Changes</div>
                  <div className="subsea-pane-sub">Next 14 days · sign-on / sign-off</div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr><th>Crew Member</th><th>Rank</th><th>Rig</th><th>Type</th><th>Date</th><th>Flight</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">Loading crew changes...</td></tr>
                      ) : crewChanges.length === 0 ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">No crew records found from backend.</td></tr>
                      ) : (
                        crewChanges.map((row) => (
                          <tr key={`${row.name}-${row.date}`} onClick={() => navigate('/crew')}>
                            <td className="strong">{row.name}</td>
                            <td>{row.rank}</td>
                            <td>{row.rig}</td>
                            <td><span className={`subsea-badge ${row.type === 'Available' ? 'subsea-b-amber' : 'subsea-b-green'}`}>{row.type}</span></td>
                            <td className="mono">{row.date}</td>
                            <td><span className={`subsea-badge ${row.flight === 'Pending' ? 'subsea-b-orange' : 'subsea-b-blue'}`}>{row.flight}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Live Activity</div>
                  <span className="subsea-badge subsea-b-teal subsea-b-dot">Real-time</span>
                </div>
                <div className="subsea-feed">
                  {activity.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.text}
                        type="button"
                        className="subsea-feed-item"
                        onClick={() => {
                          if (item.icon === Plane) navigate('/tickets');
                          else if (item.icon === Users || item.icon === BadgeCheck) navigate('/crew');
                          else if (item.icon === FileText) navigate('/projects');
                        }}
                      >
                        <div className={`subsea-feed-icon ${item.color}`}><Icon size={13} /></div>
                        <div>
                          <div className="subsea-feed-text">{item.text}</div>
                          <div className="subsea-feed-meta">{item.meta}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Cert Expiry Watchlist</div>
                  <span className="subsea-badge subsea-b-red">{loading ? '...' : `${expiringCrew.length} expiring`}</span>
                </div>
                <div className="subsea-cert-list">
                  {certs.length === 0 ? (
                    <div className="subsea-empty-cell">No certifications expiring in the next 30 days.</div>
                  ) : certs.map(({ days, color, name, expires }) => (
                    <button key={name} type="button" className="subsea-cert-row" onClick={() => navigate('/crew')}>
                      <span className={`subsea-badge subsea-b-${color}`}>{days}</span>
                      <span className="subsea-cert-name">{name}</span>
                      <span className="subsea-cert-expires">{expires}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default CrewManagementDashboard;
