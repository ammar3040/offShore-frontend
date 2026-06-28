import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  LayoutDashboard,
  Plane,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Ship,
  UserPlus,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewTickets, type CrewTicketApi } from '../api/ticket';
import { useCommandPaletteOpen } from '../components/CommandPalette';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { availabilityFromCrewSignal, crewAvailabilityDotClass, getCrewAvailabilityLabel } from '../utils/crewAvailability';
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
  const openCommandPalette = useCommandPaletteOpen();
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

  const readyForMobilizationCount = dashboard.crew.filter(
    (member) => availabilityFromCrewSignal(member.signal) === 'available'
  ).length;
  const assignedToProjectCount = dashboard.crew.filter(
    (member) => availabilityFromCrewSignal(member.signal) !== 'available'
  ).length;
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
    const mobilizationPct = crewTotal ? Math.round((readyForMobilizationCount / crewTotal) * 100) : 0;
    const assignedPct = crewTotal ? Math.round((assignedToProjectCount / crewTotal) * 100) : 0;
    return [
      { label: 'Total Crew', value: loading ? '...' : String(crewTotal), meta: `${activeProjectsCount} active projects`, tone: 'up', bar: `${Math.min(100, crewTotal)}%`, color: 'blue', icon: true },
      { label: 'Ready for Mobilization', value: loading ? '...' : String(readyForMobilizationCount), meta: 'Available and mobilized', tone: 'flat', bar: `${mobilizationPct}%`, color: 'green' },
      { label: 'Mobilized', value: loading ? '...' : String(assignedToProjectCount), meta: `${assignedPct}% of roster`, tone: 'flat', bar: `${assignedPct}%`, color: 'teal' },
      { label: 'Cert Expiring', value: loading ? '...' : String(expiringCrew.length), meta: `${expiringCrew.filter((item) => item.days <= 7).length} critical`, tone: expiringCrew.length ? 'down' : 'flat', bar: `${Math.min(100, expiringCrew.length * 8)}%`, color: 'red' },
      { label: 'Flights Booked', value: loading ? '...' : String(dashboard.tickets.length), meta: 'Crew ticket records', tone: 'up', bar: `${Math.min(100, dashboard.tickets.length * 4)}%`, color: 'teal' },
    ];
  }, [activeProjectsCount, assignedToProjectCount, dashboard.crew.length, dashboard.tickets.length, expiringCrew, loading, readyForMobilizationCount]);

  const crewMobilizationRows = useMemo(() => {
    return [...dashboard.crew]
      .sort((a, b) => {
        const aAvailable = availabilityFromCrewSignal(a.signal) === 'available' ? 0 : 1;
        const bAvailable = availabilityFromCrewSignal(b.signal) === 'available' ? 0 : 1;
        return aAvailable - bAvailable;
      })
      .slice(0, 8)
      .map((member) => {
        const project = member.activeProjects?.[0];
        const kind = availabilityFromCrewSignal(member.signal);
        const status =
          kind === 'available' ? 'Available' : kind === 'endingSoon' ? 'Sign-Off Due' : 'In Project';
        const statusClass =
          kind === 'available' ? 'subsea-b-green' : kind === 'endingSoon' ? 'subsea-b-amber' : 'subsea-b-blue';
        const certExpiry = member.certificate_expiry_date || member.crew_certificate?.expiry_date;
        const certDays = daysUntil(certExpiry);
        const certs =
          certDays != null && certDays >= 0 && certDays <= 30
            ? `Expires in ${certDays}d`
            : certExpiry
              ? 'Valid'
              : '—';
        const certClass =
          certDays != null && certDays >= 0 && certDays <= 7
            ? 'subsea-b-red'
            : certDays != null && certDays <= 30
              ? 'subsea-b-amber'
              : 'subsea-b-green';
        return {
          id: member.id,
          name: crewName(member),
          kind,
          rank: member.organization || '—',
          rig: project?.title || '—',
          status,
          statusClass,
          certs,
          certClass,
          mobilization: kind === 'available' ? 'Ready for Mobilization' : 'Assigned',
        };
      });
  }, [dashboard.crew]);

  const crewChanges = useMemo(() => {
    return dashboard.crew.slice(0, 5).map((member) => {
      const project = member.activeProjects?.[0];
      const ticket = dashboard.tickets.find((item) => ticketCrewId(item) === member.id);
      const kind = availabilityFromCrewSignal(member.signal);
      const type = kind === 'available' ? 'Ready for Mobilization' : 'Assigned';
      return {
        name: crewName(member),
        kind,
        rank: member.organization || '—',
        rig: project?.title || '—',
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
      color: 'teal',
      text: `${assignedToProjectCount} crew assigned to projects`,
      meta: `${readyForMobilizationCount} ready for mobilization`,
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
  }, [activeProjectsCount, assignedToProjectCount, dashboard.projects.length, dashboard.tickets, expiringCrew, readyForMobilizationCount]);

  const certs = expiringCrew.slice(0, 4).map(({ member, expiry, days }) => ({
    days: `${days}d`,
    color: days <= 7 ? 'red' : 'amber',
    name: `${crewName(member)} — Crew Certificate`,
    expires: formatDate(expiry),
  }));

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="dashboard" />

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
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <UserPlus size={13} /> Ready for Mobilization <span className="subsea-sb-count">{loading ? '...' : readyForMobilizationCount}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Users size={13} /> Assigned to Project <span className="subsea-sb-count">{loading ? '...' : assignedToProjectCount}</span>
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
                <button type="button" className="subsea-wb-chip subsea-wb-chip-green" onClick={() => navigate('/crew')}><UserPlus size={12} />{loading ? '...' : readyForMobilizationCount} ready for mobilization</button>
                <button type="button" className="subsea-wb-chip subsea-wb-chip-blue" onClick={() => navigate('/crew')}><Users size={12} />{loading ? '...' : assignedToProjectCount} assigned to projects</button>
                <button type="button" className="subsea-wb-chip subsea-wb-chip-green" onClick={() => navigate('/rig')}><Ship size={12} />{dashboard.rigs.length} rigs loaded</button>
                <button type="button" className="subsea-wb-chip subsea-wb-chip-blue" onClick={openCommandPalette}><Radio size={12} />Open Command Center</button>
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
                    <div className="subsea-pane-title">Crew Mobilization</div>
                    <div className="subsea-pane-sub">
                      {loading ? 'Loading crew...' : `${readyForMobilizationCount} available · ${assignedToProjectCount} in project`}
                    </div>
                  </div>
                  <div className="subsea-pane-actions">
                    <span className="subsea-badge subsea-b-green subsea-b-dot">{loading ? '...' : `${readyForMobilizationCount} ready`}</span>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/crew')}>View Crew</button>
                  </div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr><th>Crew Member</th><th>Rank</th><th>Assignment</th><th>Status</th><th>Mobilization</th><th>Certs</th></tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">Loading crew data...</td></tr>
                      ) : crewMobilizationRows.length === 0 ? (
                        <tr><td colSpan={6} className="subsea-empty-cell">No crew members found from backend.</td></tr>
                      ) : (
                        crewMobilizationRows.map((row) => (
                          <tr key={row.id} onClick={() => navigate('/crew')}>
                            <td className="strong">
                              <div className="subsea-roster-name">
                                <span
                                  className={crewAvailabilityDotClass(row.kind)}
                                  title={getCrewAvailabilityLabel(row.kind)}
                                  aria-label={getCrewAvailabilityLabel(row.kind)}
                                />
                                <span>{row.name}</span>
                              </div>
                            </td>
                            <td>{row.rank}</td>
                            <td>{row.rig}</td>
                            <td><span className={`subsea-badge ${row.statusClass}`}>{row.status}</span></td>
                            <td>
                              <span className={`subsea-badge ${row.mobilization === 'Ready for Mobilization' ? 'subsea-b-green' : 'subsea-b-teal'}`}>
                                {row.mobilization}
                              </span>
                            </td>
                            <td><span className={`subsea-badge ${row.certClass}`}>{row.certs}</span></td>
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
                            <td className="strong">
                              <div className="subsea-roster-name">
                                <span
                                  className={crewAvailabilityDotClass(row.kind)}
                                  title={getCrewAvailabilityLabel(row.kind)}
                                  aria-label={getCrewAvailabilityLabel(row.kind)}
                                />
                                <span>{row.name}</span>
                              </div>
                            </td>
                            <td>{row.rank}</td>
                            <td>{row.rig}</td>
                            <td><span className={`subsea-badge ${row.type === 'Ready for Mobilization' ? 'subsea-b-green' : 'subsea-b-teal'}`}>{row.type}</span></td>
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
