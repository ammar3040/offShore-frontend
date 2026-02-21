import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plane, ChevronLeft, Plus, ChevronDown } from 'lucide-react';
import Modal from '../components/Modal';
import { getProjects, type ProjectApi } from '../api/project';
import { getCrewEnrolledInProject, type CrewMemberApi } from '../api/crew';
import { getCrewTickets, createFlightTicket, type CreateFlightTicketPayload, type AirportLocation, type CrewTicketApi } from '../api/ticket';
import './AdminTicketsPage.css';

type ModalStep = 'project' | 'crew' | 'form';

const TRIP_OPTIONS: Array<{ value: CreateFlightTicketPayload['trip']; label: string }> = [
  { value: 'ONE_WAY', label: 'One way' },
  { value: 'ROUND_TRIP', label: 'Round trip' },
];

const CLASS_OPTIONS: Array<{ value: CreateFlightTicketPayload['class']; label: string }> = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const AdminTicketsPage = () => {
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectApi | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>('');
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [modalStep, setModalStep] = useState<ModalStep>('project');

  const [formData, setFormData] = useState({
    fromName: '',
    fromCountry: '',
    fromCountryName: '',
    toName: '',
    toCountry: '',
    toCountryName: '',
    class: 'ECONOMY' as CreateFlightTicketPayload['class'],
    adult: 1,
    children: 0,
    infants: 0,
    trip: 'ONE_WAY' as CreateFlightTicketPayload['trip'],
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchTickets = useCallback(() => {
    setTicketsLoading(true);
    getCrewTickets()
      .then((res) => setTickets(res.crewTickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getCrewTickets(), getProjects()])
      .then(([ticketsRes, projectsRes]) => {
        if (!cancelled) {
          setTickets(ticketsRes.crewTickets ?? []);
          setProjects(projectsRes.projects ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
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

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
    setModalStep('project');
    setSelectedProject(null);
    setCreateProjectId('');
    setSelectedCrewIds([]);
    setCrew([]);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  const handleProjectSelectAndContinue = useCallback(() => {
    const project = projects.find((p) => p.id === createProjectId);
    if (!project) return;
    setSelectedProject(project);
    setModalStep('crew');
    setSelectedCrewIds([]);
    setCrewLoading(true);
    getCrewEnrolledInProject(project.id)
      .then((res) => setCrew(res.crew ?? []))
      .catch(() => setCrew([]))
      .finally(() => setCrewLoading(false));
  }, [createProjectId, projects]);

  const closeCreateModal = useCallback(() => {
    if (!submitLoading) {
      setIsCreateModalOpen(false);
      setSelectedProject(null);
      setCreateProjectId('');
      setSelectedCrewIds([]);
      setModalStep('project');
      setSubmitError(null);
      setSubmitSuccess(false);
    }
  }, [submitLoading]);

  const toggleCrewSelection = useCallback((crewId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  }, []);

  const selectAllCrew = useCallback(() => {
    setSelectedCrewIds(crew.map((c) => c.id));
  }, [crew]);

  const deselectAllCrew = useCallback(() => {
    setSelectedCrewIds([]);
  }, []);

  const goToForm = useCallback(() => {
    if (selectedCrewIds.length > 0) {
      setModalStep('form');
      setSubmitError(null);
      setFormData({
        fromName: 'Mumbai [BOM] - Chhatrapati Shivaji Maharaj International Airport, India',
        fromCountry: 'IN',
        fromCountryName: 'India',
        toName: 'Delhi NCR [DEL] - Indira Gandhi International Airport, India',
        toCountry: 'IN',
        toCountryName: 'India',
        class: 'ECONOMY',
        adult: 1,
        children: 0,
        infants: 0,
        trip: 'ONE_WAY',
      });
    }
  }, [selectedCrewIds.length]);

  const goBackToCrew = useCallback(() => {
    setModalStep('crew');
    setSubmitError(null);
  }, []);

  const handleSubmitTickets = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject || selectedCrewIds.length === 0) return;

    const from: AirportLocation = {
      Name: formData.fromName.trim(),
      COUNTRY: formData.fromCountry.trim(),
      COUNTRYNAME: formData.fromCountryName.trim(),
    };
    const to: AirportLocation = {
      Name: formData.toName.trim(),
      COUNTRY: formData.toCountry.trim(),
      COUNTRYNAME: formData.toCountryName.trim(),
    };

    if (!from.Name || !to.Name) {
      setSubmitError('From and To airport names are required');
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      for (const crewId of selectedCrewIds) {
        const payload: CreateFlightTicketPayload = {
          crew_id: crewId,
          project_id: selectedProject.id,
          from,
          to,
          class: formData.class,
          adult: formData.adult,
          children: formData.children,
          infants: formData.infants,
          trip: formData.trip,
        };
        await createFlightTicket(payload);
      }
      setSubmitSuccess(true);
      fetchTickets();
      setTimeout(closeCreateModal, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create tickets');
    } finally {
      setSubmitLoading(false);
    }
  };

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

  const formatProjectDuration = (p: CrewTicketApi['project_id']) => {
    const d = (p as { duration?: { startDate?: string; endDate?: string } })?.duration;
    if (!d?.startDate || !d?.endDate) return '—';
    try {
      const start = new Date(d.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const end = new Date(d.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} – ${end}`;
    } catch {
      return '—';
    }
  };

  return (
    <div className="admin-tickets-page">
      <div className="admin-tickets-header">
        <div>
          <h1 className="admin-tickets-title">Flight Tickets</h1>
          <p className="admin-tickets-subtitle">
            View and manage flight tickets for crew on projects.
          </p>
        </div>
        <button type="button" className="admin-tickets-create-btn" onClick={openCreateModal}>
          <Plus size={18} />
          Create ticket
        </button>
      </div>

      <div className="admin-tickets-toolbar">
        <div className="admin-tickets-filter-wrap">
          <label htmlFor="tickets-project-filter" className="admin-tickets-filter-label">
            Filter by project
          </label>
          <select
            id="tickets-project-filter"
            className="admin-tickets-filter-select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {uniqueProjectsFromTickets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <ChevronDown size={18} className="admin-tickets-filter-chevron" />
        </div>
      </div>

      {loading ? (
        <div className="admin-tickets-loading" role="status">
          <div className="admin-tickets-spinner" />
          <p>Loading…</p>
        </div>
      ) : error ? (
        <div className="admin-tickets-error" role="alert">{error}</div>
      ) : ticketsLoading && tickets.length === 0 ? (
        <div className="admin-tickets-loading" role="status">
          <div className="admin-tickets-spinner" />
          <p>Loading tickets…</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="admin-tickets-empty">
          <Plane size={48} className="admin-tickets-empty-icon" />
          <p>{projectFilter === 'all' ? 'No tickets yet.' : 'No tickets for this project.'}</p>
          <p className="admin-tickets-empty-hint">
            {projectFilter === 'all'
              ? 'Create tickets for crew on your projects.'
              : 'Try selecting "All projects" or create new tickets.'}
          </p>
          {projectFilter === 'all' && (
            <button type="button" className="admin-tickets-create-inline" onClick={openCreateModal}>
              <Plus size={18} />
              Create ticket
            </button>
          )}
        </div>
      ) : (
        <div className="admin-tickets-table-wrap">
          <table className="admin-tickets-table">
            <thead>
              <tr>
                <th>Crew</th>
                <th>Project</th>
                <th>From → To</th>
                <th>Class</th>
                <th>Trip</th>
                <th>Passengers</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="admin-tickets-row-clickable"
                  onClick={() => setSelectedTicket(ticket)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTicket(ticket);
                    }
                  }}
                >
                  <td>
                    <span className="admin-tickets-cell-crew">{getCrewName(ticket)}</span>
                  </td>
                  <td>
                    <span className="admin-tickets-cell-project">{getProjectTitle(ticket)}</span>
                  </td>
                  <td>
                    <span className="admin-tickets-cell-route" title={`${ticket.from?.Name ?? ''} → ${ticket.to?.Name ?? ''}`}>
                      {ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}
                    </span>
                  </td>
                  <td>{ticket.class ?? '—'}</td>
                  <td>{ticket.trip?.replace('_', ' ') ?? '—'}</td>
                  <td>
                    {[ticket.adult, ticket.children, ticket.infants]
                      .filter((n) => n != null && n > 0)
                      .join(' / ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title="Ticket details"
        size="medium"
      >
        {selectedTicket && (
          <div className="admin-tickets-detail-card">
            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Flight details</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>From</dt>
                  <dd>{selectedTicket.from?.Name ?? '—'}</dd>
                  <dd className="admin-tickets-detail-meta">
                    {selectedTicket.from?.COUNTRYNAME ?? ''} ({selectedTicket.from?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>To</dt>
                  <dd>{selectedTicket.to?.Name ?? '—'}</dd>
                  <dd className="admin-tickets-detail-meta">
                    {selectedTicket.to?.COUNTRYNAME ?? ''} ({selectedTicket.to?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Class</dt>
                  <dd>{selectedTicket.class ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Trip</dt>
                  <dd>{selectedTicket.trip?.replace('_', ' ') ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Passengers</dt>
                  <dd>
                    {[selectedTicket.adult && `${selectedTicket.adult} adult(s)`, selectedTicket.children ? `${selectedTicket.children} child(ren)` : null, selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Crew</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Name</dt>
                  <dd>{getCrewName(selectedTicket)}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Email</dt>
                  <dd>{(selectedTicket.crew_id as { email?: string })?.email ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Phone</dt>
                  <dd>{(selectedTicket.crew_id as { phone?: string })?.phone ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Nationality</dt>
                  <dd>{(selectedTicket.crew_id as { nationality?: string })?.nationality ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Project</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Title</dt>
                  <dd>{getProjectTitle(selectedTicket)}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Status</dt>
                  <dd>{selectedTicket.project_id?.status ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Duration</dt>
                  <dd>{formatProjectDuration(selectedTicket.project_id)}</dd>
                </div>
                {(selectedTicket.project_id as { description?: string })?.description && (
                  <div className="admin-tickets-detail-item">
                    <dt>Description</dt>
                    <dd>{(selectedTicket.project_id as { description?: string }).description}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={
          modalStep === 'project'
            ? 'Create ticket — Select project'
            : modalStep === 'crew'
              ? `Select crew — ${selectedProject?.title ?? ''}`
              : 'Create flight tickets'
        }
        size="medium"
      >
        <div className="admin-tickets-modal">
          {submitSuccess ? (
            <div className="admin-tickets-success" role="status">
              Tickets created successfully for {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}.
            </div>
          ) : modalStep === 'project' ? (
            <>
              <p className="admin-tickets-modal-intro">
                Select a project to create flight tickets for enrolled crew.
              </p>
              <div className="admin-tickets-form-field">
                <label htmlFor="create-ticket-project">Project</label>
                <select
                  id="create-ticket-project"
                  value={createProjectId}
                  onChange={(e) => setCreateProjectId(e.target.value)}
                  className="admin-tickets-project-select"
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {projects.length === 0 && (
                <p className="admin-tickets-crew-empty">No projects available.</p>
              )}
              <div className="admin-tickets-modal-actions">
                <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-tickets-btn admin-tickets-btn-primary"
                  onClick={handleProjectSelectAndContinue}
                  disabled={!createProjectId}
                >
                  Continue
                </button>
              </div>
            </>
          ) : modalStep === 'crew' ? (
              <>
                <p className="admin-tickets-modal-intro">
                  Select crew members from <strong>{selectedProject?.title ?? ''}</strong> to create flight tickets.
                </p>
                {crewLoading ? (
                  <p className="admin-tickets-crew-loading">Loading crew…</p>
                ) : crew.length === 0 ? (
                  <p className="admin-tickets-crew-empty">No crew enrolled in this project yet.</p>
                ) : (
                  <>
                    <div className="admin-tickets-crew-actions">
                      <button type="button" className="admin-tickets-select-link" onClick={selectAllCrew}>
                        Select all
                      </button>
                      <span className="admin-tickets-select-sep">·</span>
                      <button type="button" className="admin-tickets-select-link" onClick={deselectAllCrew}>
                        Deselect all
                      </button>
                    </div>
                    <div className="admin-tickets-crew-list" role="group">
                      {crew.map((c) => (
                        <label key={c.id} className="admin-tickets-crew-item">
                          <input
                            type="checkbox"
                            checked={selectedCrewIds.includes(c.id)}
                            onChange={() => toggleCrewSelection(c.id)}
                            className="admin-tickets-crew-checkbox"
                          />
                          <span className="admin-tickets-crew-name">
                            {c.firstname} {c.lastname}
                          </span>
                          <span className="admin-tickets-crew-email">{c.email}</span>
                        </label>
                      ))}
                    </div>
                    {selectedCrewIds.length > 0 && (
                      <p className="admin-tickets-selected-count">
                        {selectedCrewIds.length} member{selectedCrewIds.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </>
                )}
                <div className="admin-tickets-modal-actions">
                  <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-tickets-btn admin-tickets-btn-primary"
                    onClick={goToForm}
                    disabled={crewLoading || crew.length === 0 || selectedCrewIds.length === 0}
                  >
                    Continue to flight details
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="admin-tickets-back" onClick={goBackToCrew}>
                  <ChevronLeft size={16} />
                  Back to crew selection
                </button>

                {submitError && (
                  <div className="admin-tickets-form-error" role="alert">
                    {submitError}
                  </div>
                )}

                <form className="admin-tickets-form" onSubmit={handleSubmitTickets}>
                  <fieldset className="admin-tickets-fieldset">
                    <legend>From</legend>
                    <div className="admin-tickets-form-row">
                      <div className="admin-tickets-form-field admin-tickets-form-field-full">
                        <label htmlFor="from-name">Airport name</label>
                        <input
                          id="from-name"
                          type="text"
                          value={formData.fromName}
                          onChange={(e) => setFormData((d) => ({ ...d, fromName: e.target.value }))}
                          placeholder="e.g. Mumbai [BOM] - Chhatrapati Shivaji Maharaj International Airport, India"
                          required
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                    <div className="admin-tickets-form-row admin-tickets-form-row-2">
                      <div className="admin-tickets-form-field">
                        <label htmlFor="from-country">Country code</label>
                        <input
                          id="from-country"
                          type="text"
                          value={formData.fromCountry}
                          onChange={(e) => setFormData((d) => ({ ...d, fromCountry: e.target.value }))}
                          placeholder="e.g. IN"
                          maxLength={4}
                          disabled={submitLoading}
                        />
                      </div>
                      <div className="admin-tickets-form-field">
                        <label htmlFor="from-country-name">Country name</label>
                        <input
                          id="from-country-name"
                          type="text"
                          value={formData.fromCountryName}
                          onChange={(e) => setFormData((d) => ({ ...d, fromCountryName: e.target.value }))}
                          placeholder="e.g. India"
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="admin-tickets-fieldset">
                    <legend>To</legend>
                    <div className="admin-tickets-form-row">
                      <div className="admin-tickets-form-field admin-tickets-form-field-full">
                        <label htmlFor="to-name">Airport name</label>
                        <input
                          id="to-name"
                          type="text"
                          value={formData.toName}
                          onChange={(e) => setFormData((d) => ({ ...d, toName: e.target.value }))}
                          placeholder="e.g. Delhi NCR [DEL] - Indira Gandhi International Airport, India"
                          required
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                    <div className="admin-tickets-form-row admin-tickets-form-row-2">
                      <div className="admin-tickets-form-field">
                        <label htmlFor="to-country">Country code</label>
                        <input
                          id="to-country"
                          type="text"
                          value={formData.toCountry}
                          onChange={(e) => setFormData((d) => ({ ...d, toCountry: e.target.value }))}
                          placeholder="e.g. IN"
                          maxLength={4}
                          disabled={submitLoading}
                        />
                      </div>
                      <div className="admin-tickets-form-field">
                        <label htmlFor="to-country-name">Country name</label>
                        <input
                          id="to-country-name"
                          type="text"
                          value={formData.toCountryName}
                          onChange={(e) => setFormData((d) => ({ ...d, toCountryName: e.target.value }))}
                          placeholder="e.g. India"
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <div className="admin-tickets-form-row admin-tickets-form-row-2">
                    <div className="admin-tickets-form-field">
                      <label htmlFor="trip">Trip type</label>
                      <select
                        id="trip"
                        value={formData.trip}
                        onChange={(e) => setFormData((d) => ({ ...d, trip: e.target.value as CreateFlightTicketPayload['trip'] }))}
                        disabled={submitLoading}
                      >
                        {TRIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="class">Class</label>
                      <select
                        id="class"
                        value={formData.class}
                        onChange={(e) => setFormData((d) => ({ ...d, class: e.target.value as CreateFlightTicketPayload['class'] }))}
                        disabled={submitLoading}
                      >
                        {CLASS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="admin-tickets-form-row admin-tickets-form-row-3">
                    <div className="admin-tickets-form-field">
                      <label htmlFor="adult">Adults</label>
                      <input
                        id="adult"
                        type="number"
                        min={0}
                        value={formData.adult}
                        onChange={(e) => setFormData((d) => ({ ...d, adult: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="children">Children</label>
                      <input
                        id="children"
                        type="number"
                        min={0}
                        value={formData.children}
                        onChange={(e) => setFormData((d) => ({ ...d, children: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="infants">Infants</label>
                      <input
                        id="infants"
                        type="number"
                        min={0}
                        value={formData.infants}
                        onChange={(e) => setFormData((d) => ({ ...d, infants: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                  </div>

                  <p className="admin-tickets-form-hint">
                    Creating tickets for {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}
                  </p>

                  <div className="admin-tickets-modal-actions">
                    <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal} disabled={submitLoading}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-tickets-btn admin-tickets-btn-primary"
                      disabled={submitLoading}
                    >
                      {submitLoading ? 'Creating…' : `Create ${selectedCrewIds.length} ticket${selectedCrewIds.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
      </Modal>
    </div>
  );
};

export default AdminTicketsPage;
