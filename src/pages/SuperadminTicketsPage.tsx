import { useState, useEffect, useMemo } from 'react';
import { Ticket, ChevronDown } from 'lucide-react';
import { getSuperadminCrewTickets, getSuperadminProjects } from '../api/superadmin';
import type { CrewTicketApi } from '../api/ticket';
import './SuperadminTicketsPage.css';

const SuperadminTicketsPage = () => {
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getSuperadminCrewTickets(), getSuperadminProjects()])
      .then(([ticketsRes, projectsRes]) => {
        if (!cancelled) {
          setTickets(ticketsRes.crewTickets ?? []);
          setProjects(projectsRes.projects ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tickets');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredTickets = useMemo(() => {
    if (projectFilter === 'all') return tickets;
    return tickets.filter((t) => {
      const pid = t.project_id?._id ?? (t.project_id as { id?: string })?.id;
      return pid === projectFilter;
    });
  }, [tickets, projectFilter]);

  const uniqueProjectsFromTickets = useMemo(() => {
    const seen = new Set<string>();
    return tickets
      .map((t) => {
        const p = t.project_id;
        const id = p?._id ?? (p as { id?: string })?.id ?? '';
        const title = p?.title ?? (p as { title?: string })?.title ?? '';
        return { id, title };
      })
      .filter((p) => p.id && !seen.has(p.id) && (seen.add(p.id), true));
  }, [tickets]);

  const projectOptions = projects.length > 0 ? projects : uniqueProjectsFromTickets;

  const getCrewName = (t: CrewTicketApi) => {
    const c = t.crew_id;
    const first = c?.firstname ?? (c as { firstname?: string })?.firstname ?? '';
    const last = c?.lastname ?? (c as { lastname?: string })?.lastname ?? '';
    return `${first} ${last}`.trim() || '—';
  };

  const getProjectTitle = (t: CrewTicketApi) => {
    const p = t.project_id;
    return p?.title ?? (p as { title?: string })?.title ?? '—';
  };

  const getRoute = (t: CrewTicketApi) => {
    const from = t.from?.Name ?? (t.from as { Name?: string })?.Name ?? '—';
    const to = t.to?.Name ?? (t.to as { Name?: string })?.Name ?? '—';
    return `${from} → ${to}`;
  };

  return (
    <div className="superadmin-tickets-page">
      <header className="superadmin-tickets-header">
        <div>
          <h1 className="superadmin-tickets-title">Crew Tickets</h1>
          <p className="superadmin-tickets-subtitle">
            View all crew flight tickets across projects.
          </p>
        </div>
        <div className="superadmin-tickets-filter">
          <label htmlFor="sa-tickets-project">Filter by project</label>
          <div className="superadmin-tickets-select-wrap">
            <select
              id="sa-tickets-project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="superadmin-tickets-select"
            >
              <option value="all">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="superadmin-tickets-select-chevron" />
          </div>
        </div>
      </header>

      {error && (
        <div className="superadmin-tickets-error" role="alert">
          {error}
        </div>
      )}

      <div className="superadmin-tickets-content">
        {loading ? (
          <p className="superadmin-tickets-empty">Loading…</p>
        ) : filteredTickets.length === 0 ? (
          <p className="superadmin-tickets-empty">No crew tickets found.</p>
        ) : (
          <div className="superadmin-tickets-list">
            {filteredTickets.map((t) => (
              <div key={t.id} className="superadmin-ticket-card">
                <div className="superadmin-ticket-icon">
                  <Ticket size={20} />
                </div>
                <div className="superadmin-ticket-main">
                  <div className="superadmin-ticket-route">{getRoute(t)}</div>
                  <div className="superadmin-ticket-meta">
                    <span className="superadmin-ticket-crew">{getCrewName(t)}</span>
                    <span className="superadmin-ticket-sep">·</span>
                    <span className="superadmin-ticket-project">{getProjectTitle(t)}</span>
                  </div>
                </div>
                <div className="superadmin-ticket-badges">
                  <span className="superadmin-ticket-class">{t.class}</span>
                  <span className="superadmin-ticket-trip">{t.trip}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminTicketsPage;
