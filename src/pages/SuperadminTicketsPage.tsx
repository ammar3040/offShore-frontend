import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, FileText, FileCheck, Send } from 'lucide-react';
import { getSuperadminCrewTickets, getSuperadminProjects, uploadSuperadminCrewTicketPdf, sendSuperadminCrewTicketEmail } from '../api/superadmin';
import type { CrewTicketApi } from '../api/ticket';
import Modal from '../components/Modal';
import { Toaster, useToast } from '../components/Toast';
import './SuperadminTicketsPage.css';

const SuperadminTicketsPage = () => {
  const { toasts, toast, dismiss } = useToast();
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [uploadingTicketId, setUploadingTicketId] = useState<string | null>(null);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets, selectedTicket?.id]);

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

  const pendingUploadRef = useRef<string | null>(null);

  const handleUploadClick = (ticketId: string) => {
    setUploadError(null);
    pendingUploadRef.current = ticketId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ticketId = pendingUploadRef.current;
    pendingUploadRef.current = null;
    e.target.value = '';
    if (!file || !ticketId) return;
    if (!file.type.includes('pdf')) {
      setUploadError('Only PDF files are allowed');
      return;
    }
    setUploadingTicketId(ticketId);
    setUploadError(null);
    try {
      const res = await uploadSuperadminCrewTicketPdf(ticketId, file) as { crewTicket?: CrewTicketApi };
      if (res?.crewTicket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, pdf: res.crewTicket!.pdf } : t))
        );
      }
      toast('success', 'PDF uploaded', 'Ticket PDF uploaded successfully.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingTicketId(null);
    }
  };

  const handleSendTicketClick = async (ticketId: string) => {
    setSendingTicketId(ticketId);
    try {
      await sendSuperadminCrewTicketEmail(ticketId);
      toast('success', 'Ticket sent', 'Ticket email sent to crew member successfully.');
    } catch (err) {
      toast('error', 'Send failed', err instanceof Error ? err.message : 'Failed to send ticket email.');
    } finally {
      setSendingTicketId(null);
    }
  };

  return (
    <div className="superadmin-tickets-page">
      <Toaster toasts={toasts} dismiss={dismiss} />
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

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="superadmin-tickets-file-input"
        onChange={handleFileChange}
        aria-hidden
      />

      {uploadError && (
        <div className="superadmin-tickets-error" role="alert">
          {uploadError}
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
              <div
                key={t.id}
                className="superadmin-ticket-card superadmin-ticket-card--clickable"
                onClick={() => setSelectedTicket(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTicket(t);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${getRoute(t)}`}
              >
                <div className="superadmin-ticket-icon" title="Crew ticket">
                  <FileText size={20} />
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
                <div className="superadmin-ticket-actions">
                  <button
                    type="button"
                    className={`superadmin-ticket-pdf-btn${t.pdf ? ' superadmin-ticket-pdf-btn--uploaded' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleUploadClick(t.id); }}
                    disabled={uploadingTicketId === t.id}
                    title={t.pdf ? 'Click to re-upload PDF' : 'Upload ticket PDF'}
                  >
                    {uploadingTicketId === t.id ? (
                      <span className="superadmin-ticket-upload-spinner" />
                    ) : t.pdf ? (
                      <>
                        <span className="superadmin-ticket-pdf-icon" title="Crew ticket">
                          <FileCheck size={16} />
                        </span>
                        PDF uploaded
                      </>
                    ) : (
                      <>
                        <span className="superadmin-ticket-pdf-icon" title="Crew ticket">
                          <FileText size={16} />
                        </span>
                        Upload PDF
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="superadmin-ticket-send-btn"
                    onClick={(e) => { e.stopPropagation(); handleSendTicketClick(t.id); }}
                    disabled={sendingTicketId === t.id}
                    title="Send ticket to crew email"
                  >
                    {sendingTicketId === t.id ? (
                      <span className="superadmin-ticket-send-spinner" />
                    ) : (
                      <>
                        <Send size={16} />
                        Send ticket
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title="Ticket details"
        size="medium"
      >
        {selectedTicket && (
          <div className="superadmin-tickets-detail-card">
            <section className="superadmin-tickets-detail-section">
              <h3 className="superadmin-tickets-detail-heading">Flight details</h3>
              <dl className="superadmin-tickets-detail-list">
                <div className="superadmin-tickets-detail-item">
                  <dt>From</dt>
                  <dd>{selectedTicket.from?.Name ?? '—'}</dd>
                  <dd className="superadmin-tickets-detail-meta">
                    {selectedTicket.from?.COUNTRYNAME ?? ''} ({selectedTicket.from?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>To</dt>
                  <dd>{selectedTicket.to?.Name ?? '—'}</dd>
                  <dd className="superadmin-tickets-detail-meta">
                    {selectedTicket.to?.COUNTRYNAME ?? ''} ({selectedTicket.to?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>Class</dt>
                  <dd>{selectedTicket.class ?? '—'}</dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>Trip</dt>
                  <dd>{selectedTicket.trip?.replace('_', ' ') ?? '—'}</dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>Passengers</dt>
                  <dd>
                    {[selectedTicket.adult && `${selectedTicket.adult} adult(s)`, selectedTicket.children ? `${selectedTicket.children} child(ren)` : null, selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="superadmin-tickets-detail-section">
              <h3 className="superadmin-tickets-detail-heading">Crew</h3>
              <dl className="superadmin-tickets-detail-list">
                <div className="superadmin-tickets-detail-item">
                  <dt>Name</dt>
                  <dd>{getCrewName(selectedTicket)}</dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>Email</dt>
                  <dd>{(selectedTicket.crew_id as { email?: string })?.email ?? '—'}</dd>
                </div>
                <div className="superadmin-tickets-detail-item">
                  <dt>Project</dt>
                  <dd>{getProjectTitle(selectedTicket)}</dd>
                </div>
              </dl>
            </section>
            <section className="superadmin-tickets-detail-section">
              <h3 className="superadmin-tickets-detail-heading">PDF status</h3>
              <p className="superadmin-tickets-detail-pdf-status">
                {selectedTicket.pdf ? (
                  <span className="superadmin-tickets-detail-pdf-uploaded">
                    <FileCheck size={16} /> PDF uploaded
                  </span>
                ) : (
                  <span className="superadmin-tickets-detail-pdf-missing">No PDF uploaded yet</span>
                )}
              </p>
              <div className="superadmin-tickets-detail-actions">
                <button
                  type="button"
                  className={`superadmin-ticket-pdf-btn${selectedTicket.pdf ? ' superadmin-ticket-pdf-btn--uploaded' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleUploadClick(selectedTicket.id); }}
                  disabled={uploadingTicketId === selectedTicket.id}
                  title={selectedTicket.pdf ? 'Click to re-upload PDF' : 'Upload ticket PDF'}
                >
                  {uploadingTicketId === selectedTicket.id ? (
                    <span className="superadmin-ticket-upload-spinner" />
                  ) : selectedTicket.pdf ? (
                    <>
                      <span className="superadmin-ticket-pdf-icon" title="Crew ticket">
                        <FileCheck size={16} />
                      </span>
                      PDF uploaded
                    </>
                  ) : (
                    <>
                      <span className="superadmin-ticket-pdf-icon" title="Crew ticket">
                        <FileText size={16} />
                      </span>
                      Upload PDF
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="superadmin-ticket-send-btn"
                  onClick={(e) => { e.stopPropagation(); handleSendTicketClick(selectedTicket.id); }}
                  disabled={sendingTicketId === selectedTicket.id}
                  title="Send ticket to crew email"
                >
                  {sendingTicketId === selectedTicket.id ? (
                    <span className="superadmin-ticket-send-spinner" />
                  ) : (
                    <>
                      <Send size={16} />
                      Send ticket
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SuperadminTicketsPage;
