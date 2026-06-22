import { useState, useEffect, useRef } from 'react';
import { FileText, FileCheck, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSuperadminCrewTickets, getSuperadminProjects, uploadSuperadminCrewTicketPdf, deleteSuperadminCrewTicket, type ApiPagination } from '../api/superadmin';
import { approveAndUploadTicketPdf, regenerateAndUploadTicketPdf } from '../lib/crewTicket/approveAndUploadTicketPdf';
import { env } from '../config/env';
import {
  canUseTicketPdf,
  getTicketStatus,
  getTicketStatusLabel,
  getTicketDepartureIso,
  getTicketArrivalIso,
  formatTicketSchedule,
  openCrewTicketPdf,
  ticketHasStoredPdf,
  type CrewTicketApi,
} from '../api/ticket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import './SuperadminTicketsPage.css';

const PAGE_SIZE = env.defaultPageSize;

const SuperadminTicketsPage = () => {
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [uploadingTicketId, setUploadingTicketId] = useState<string | null>(null);
  // const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [approvingTicketId, setApprovingTicketId] = useState<string | null>(null);
  const [regeneratingTicketId, setRegeneratingTicketId] = useState<string | null>(null);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<CrewTicketApi | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approvalRefs, setApprovalRefs] = useState<Record<string, string>>({});
  const [approvalErrors, setApprovalErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets, selectedTicket?.id]);

  useEffect(() => {
    let cancelled = false;
    getSuperadminProjects()
      .then((projectsRes) => {
        if (!cancelled) {
          setProjects(projectsRes.projects ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSuperadminCrewTickets({
      page,
      limit: PAGE_SIZE,
      ...(projectFilter !== 'all' ? { projectId: projectFilter } : {}),
    })
      .then((ticketsRes) => {
        if (!cancelled) {
          setTickets(ticketsRes.crewTickets ?? []);
          setPagination(ticketsRes.pagination ?? null);
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

    return () => {
      cancelled = true;
    };
  }, [page, projectFilter]);

  const handleProjectFilterChange = (value: string) => {
    setProjectFilter(value);
    setPage(1);
  };

  const totalItems = pagination?.total ?? tickets.length;
  const totalPages = pagination?.totalPages ?? 1;
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = pagination
    ? Math.min(page * pagination.limit, totalItems)
    : Math.min(page * PAGE_SIZE, totalItems);

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

  const getRouteCodes = (t: CrewTicketApi) => {
    const fromMatch = t.from?.Name?.match(/\[([A-Z0-9]{3})\]/);
    const toMatch = t.to?.Name?.match(/\[([A-Z0-9]{3})\]/);
    const fromCode = fromMatch?.[1] ?? t.from?.Name?.slice(0, 3).toUpperCase() ?? '—';
    const toCode = toMatch?.[1] ?? t.to?.Name?.slice(0, 3).toUpperCase() ?? '—';
    return { fromCode, toCode };
  };

  const formatTripLabel = (trip?: string) => trip?.replace(/_/g, ' ') ?? '—';

  const getTicketStatusClass = (ticket: CrewTicketApi) =>
    getTicketStatus(ticket) === 'APPROVED'
      ? 'superadmin-ticket-status-approved'
      : 'superadmin-ticket-status-pending';

  const replaceTicket = (updated: CrewTicketApi) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
    setSelectedTicket((current) => (current?.id === updated.id ? updated : current));
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
        replaceTicket(res.crewTicket);
      }
      toast.success('PDF uploaded', { description: 'Ticket PDF uploaded successfully.' });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingTicketId(null);
    }
  };

  // Send ticket temporarily disabled — backend POST /crew-ticket/:id/send-ticket-email is unavailable.
  // const handleSendTicketClick = async (ticketId: string) => {
  //   const ticket = tickets.find((item) => item.id === ticketId);
  //   if (ticket && (!canUseTicketPdf(ticket) || !ticketHasStoredPdf(ticket))) {
  //     toast.error('Ticket not ready', { description: 'Approve the ticket and upload its PDF before sending email.' });
  //     return;
  //   }
  //   setSendingTicketId(ticketId);
  //   try {
  //     await sendSuperadminCrewTicketEmail(ticketId);
  //     toast.success('Ticket sent', { description: 'Ticket email sent to crew member successfully.' });
  //   } catch (err) {
  //     toast.error('Send failed', { description: err instanceof Error ? err.message : 'Failed to send ticket email.' });
  //   } finally {
  //     setSendingTicketId(null);
  //   }
  // };

  const handleOpenTicketPdf = async (ticket: CrewTicketApi) => {
    if (!canUseTicketPdf(ticket)) return;
    try {
      await openCrewTicketPdf(ticket, 'superadmin');
    } catch (err) {
      toast.error('Failed to open ticket PDF', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  };

  const handleRegeneratePdf = async (ticket: CrewTicketApi, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (getTicketStatus(ticket) !== 'APPROVED') return;

    setRegeneratingTicketId(ticket.id);
    try {
      const res = await regenerateAndUploadTicketPdf(ticket.id);
      replaceTicket(res.crewTicket);
      if (res.pdfUploaded) {
        toast.success('PDF regenerated', {
          description: 'Ticket PDF was generated in the browser and uploaded.',
        });
      } else {
        toast.warning('Regeneration incomplete', {
          description: 'PDF was generated but upload may have failed. Try again or upload manually.',
        });
      }
    } catch (err) {
      toast.error('PDF regeneration failed', {
        description: err instanceof Error ? err.message : 'Could not regenerate ticket PDF.',
      });
    } finally {
      setRegeneratingTicketId(null);
    }
  };

  const handleApproveTicket = async (ticket: CrewTicketApi, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const bookingReference = (approvalRefs[ticket.id] ?? ticket.bookingReference ?? '').trim();
    if (!bookingReference) {
      setApprovalErrors((prev) => ({ ...prev, [ticket.id]: 'Enter a booking reference.' }));
      return;
    }

    setApprovingTicketId(ticket.id);
    setApprovalErrors((prev) => ({ ...prev, [ticket.id]: '' }));
    try {
      const res = await approveAndUploadTicketPdf(ticket.id, bookingReference);
      replaceTicket(res.crewTicket);
      setApprovalRefs((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      });
      if (res.pdfUploaded) {
        toast.success('Ticket approved', {
          description: res.message || 'Ticket approved and PDF uploaded successfully.',
        });
      } else {
        toast.warning('Ticket approved', {
          description: 'Approval succeeded but PDF upload failed. Use Upload PDF to attach manually.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not approve the ticket. Please try again.';
      setApprovalErrors((prev) => ({ ...prev, [ticket.id]: message }));
      toast.error('Approval failed', { description: message });
    } finally {
      setApprovingTicketId(null);
    }
  };

  const getCrewId = (t: CrewTicketApi) =>
    t.crew_id?._id ?? (t.crew_id as { id?: string; _id?: string })?.id ?? (t.crew_id as { id?: string; _id?: string })?._id ?? '';

  const handleDeleteTicketClick = (t: CrewTicketApi, e: React.MouseEvent) => {
    e.stopPropagation();
    const crewId = getCrewId(t);
    if (!crewId) {
      toast.error('Delete failed', { description: 'Could not determine crew ID for this ticket.' });
      return;
    }
    setTicketToDelete(t);
  };

  const handleConfirmDelete = async () => {
    const t = ticketToDelete;
    if (!t) return;
    const crewId = getCrewId(t);
    if (!crewId) {
      toast.error('Delete failed', { description: 'Could not determine crew ID for this ticket.' });
      setTicketToDelete(null);
      return;
    }
    setTicketToDelete(null);
    setDeletingTicketId(t.id);
    try {
      await deleteSuperadminCrewTicket(crewId, t.id);
      setSelectedTicket((current) => (current?.id === t.id ? null : current));
      if (tickets.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setTickets((prev) => prev.filter((x) => x.id !== t.id));
        setPagination((prev) =>
          prev
            ? {
                ...prev,
                total: Math.max(0, prev.total - 1),
                totalPages: Math.max(1, Math.ceil(Math.max(0, prev.total - 1) / prev.limit)),
              }
            : prev
        );
      }
      toast.success('Ticket deleted', { description: 'The ticket was deleted successfully.' });
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : 'Failed to delete ticket.' });
    } finally {
      setDeletingTicketId(null);
    }
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
          <Select value={projectFilter} onValueChange={handleProjectFilterChange}>
            <SelectTrigger id="sa-tickets-project" className="superadmin-tickets-select w-[240px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <Card className="superadmin-tickets-content py-0 gap-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <p className="superadmin-tickets-empty">Loading…</p>
        ) : totalItems === 0 ? (
          <p className="superadmin-tickets-empty">No crew tickets found.</p>
        ) : (
          <>
          <div className="superadmin-tickets-list">
            {tickets.map((t) => (
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
                  <div className="superadmin-ticket-schedule">
                    <span className="superadmin-ticket-schedule-item">
                      <span className="superadmin-ticket-schedule-label">Dep</span>
                      {formatTicketSchedule(getTicketDepartureIso(t))}
                    </span>
                    <span className="superadmin-ticket-schedule-sep" aria-hidden="true">→</span>
                    <span className="superadmin-ticket-schedule-item">
                      <span className="superadmin-ticket-schedule-label">Arr</span>
                      {formatTicketSchedule(getTicketArrivalIso(t))}
                    </span>
                  </div>
                  <div className="superadmin-ticket-meta">
                    <span className="superadmin-ticket-crew">{getCrewName(t)}</span>
                    <span className="superadmin-ticket-sep">·</span>
                    <span className="superadmin-ticket-project">{getProjectTitle(t)}</span>
                  </div>
                </div>
                <div className="superadmin-ticket-badges">
                  <span className="superadmin-ticket-class">{t.class}</span>
                  <span className="superadmin-ticket-trip">{t.trip}</span>
                  <span className={`superadmin-ticket-status ${getTicketStatusClass(t)}`}>
                    {getTicketStatusLabel(t)}
                  </span>
                </div>
                <div className="superadmin-ticket-actions">
                  {getTicketStatus(t) !== 'APPROVED' && (
                    <div className="superadmin-ticket-approve-inline" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={approvalRefs[t.id] ?? ''}
                        onChange={(e) => {
                          setApprovalRefs((prev) => ({ ...prev, [t.id]: e.target.value }));
                          setApprovalErrors((prev) => ({ ...prev, [t.id]: '' }));
                        }}
                        placeholder="Booking ref"
                        aria-label={`Booking reference for ${getRoute(t)}`}
                      />
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => handleApproveTicket(t, e)}
                        disabled={approvingTicketId === t.id}
                        title="Approve and generate PDF"
                      >
                        {approvingTicketId === t.id ? (
                          <span className="superadmin-ticket-send-spinner" />
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            Approve
                          </>
                        )}
                      </Button>
                      {approvalErrors[t.id] ? <span className="superadmin-ticket-approve-error">{approvalErrors[t.id]}</span> : null}
                    </div>
                  )}
                  {getTicketStatus(t) === 'APPROVED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleRegeneratePdf(t, e)}
                      disabled={regeneratingTicketId === t.id}
                      title="Regenerate ticket PDF in browser and upload"
                    >
                      {regeneratingTicketId === t.id ? (
                        <span className="superadmin-ticket-upload-spinner" />
                      ) : (
                        <>
                          <FileText size={16} />
                          Regenerate PDF
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={ticketHasStoredPdf(t) ? 'superadmin-ticket-pdf-btn--uploaded' : ''}
                    onClick={(e) => { e.stopPropagation(); handleUploadClick(t.id); }}
                    disabled={uploadingTicketId === t.id || getTicketStatus(t) !== 'APPROVED'}
                    title={getTicketStatus(t) !== 'APPROVED' ? 'Approve ticket first' : ticketHasStoredPdf(t) ? 'Upload a PDF file to replace the stored ticket' : 'Upload ticket PDF file'}
                  >
                    {uploadingTicketId === t.id ? (
                      <span className="superadmin-ticket-upload-spinner" />
                    ) : ticketHasStoredPdf(t) ? (
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
                  </Button>
                  {/* Send ticket temporarily disabled — backend endpoint unavailable.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleSendTicketClick(t.id); }}
                    disabled={sendingTicketId === t.id || !canUseTicketPdf(t) || !ticketHasStoredPdf(t)}
                    title={ticketHasStoredPdf(t) ? 'Send ticket to crew email' : 'Approve and upload PDF before sending email'}
                  >
                    {sendingTicketId === t.id ? (
                      <span className="superadmin-ticket-send-spinner" />
                    ) : (
                      <>
                        <Send size={16} />
                        Send ticket
                      </>
                    )}
                  </Button>
                  */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDeleteTicketClick(t, e)}
                    disabled={deletingTicketId === t.id}
                    title="Delete ticket"
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingTicketId === t.id ? (
                      <span className="superadmin-ticket-send-spinner" />
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {pagination && totalItems > 0 && (
            <div className="superadmin-tickets-pagination">
              <span className="superadmin-tickets-pagination-info">
                Showing {rangeStart}–{rangeEnd} of {totalItems}
              </span>
              <div className="superadmin-tickets-pagination-btns">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="superadmin-tickets-pagination-page">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          </>
        )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="superadmin-tickets-detail-dialog flex flex-col sm:max-w-2xl gap-0 p-0">
          {selectedTicket && (
            <>
              <DialogHeader className="superadmin-tickets-detail-header">
                <div className="superadmin-tickets-detail-header-top">
                  <div>
                    <DialogTitle className="superadmin-tickets-detail-title">{getRoute(selectedTicket)}</DialogTitle>
                    <DialogDescription className="superadmin-tickets-detail-subtitle">
                      {getCrewName(selectedTicket)} · {getProjectTitle(selectedTicket)}
                    </DialogDescription>
                  </div>
                  <span className={`superadmin-ticket-status ${getTicketStatusClass(selectedTicket)}`}>
                    {getTicketStatusLabel(selectedTicket)}
                  </span>
                </div>
                <div className="superadmin-tickets-detail-route-banner">
                  {(() => {
                    const { fromCode, toCode } = getRouteCodes(selectedTicket);
                    return (
                      <>
                        <div className="superadmin-tickets-detail-route-end">
                          <span className="superadmin-tickets-detail-route-code">{fromCode}</span>
                          <span className="superadmin-tickets-detail-route-label">Departure</span>
                          <span className="superadmin-tickets-detail-route-time">
                            {formatTicketSchedule(getTicketDepartureIso(selectedTicket))}
                          </span>
                        </div>
                        <div className="superadmin-tickets-detail-route-line" aria-hidden="true">
                          <span />
                          <span className="superadmin-tickets-detail-route-trip">{formatTripLabel(selectedTicket.trip)}</span>
                          <span />
                        </div>
                        <div className="superadmin-tickets-detail-route-end superadmin-tickets-detail-route-end--right">
                          <span className="superadmin-tickets-detail-route-code">{toCode}</span>
                          <span className="superadmin-tickets-detail-route-label">Arrival</span>
                          <span className="superadmin-tickets-detail-route-time">
                            {formatTicketSchedule(getTicketArrivalIso(selectedTicket))}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </DialogHeader>

              <div className="superadmin-tickets-detail-body">
                <div className="superadmin-tickets-detail-grid">
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">From</span>
                    <span className="superadmin-tickets-detail-field-value">{selectedTicket.from?.Name ?? '—'}</span>
                    <span className="superadmin-tickets-detail-field-meta">
                      {selectedTicket.from?.COUNTRYNAME ?? ''} ({selectedTicket.from?.COUNTRY ?? ''})
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">To</span>
                    <span className="superadmin-tickets-detail-field-value">{selectedTicket.to?.Name ?? '—'}</span>
                    <span className="superadmin-tickets-detail-field-meta">
                      {selectedTicket.to?.COUNTRYNAME ?? ''} ({selectedTicket.to?.COUNTRY ?? ''})
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Class</span>
                    <span className="superadmin-tickets-detail-field-value">{selectedTicket.class ?? '—'}</span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Trip</span>
                    <span className="superadmin-tickets-detail-field-value">{formatTripLabel(selectedTicket.trip)}</span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Passengers</span>
                    <span className="superadmin-tickets-detail-field-value">
                      {[selectedTicket.adult && `${selectedTicket.adult} adult(s)`, selectedTicket.children ? `${selectedTicket.children} child(ren)` : null, selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Crew email</span>
                    <span className="superadmin-tickets-detail-field-value">
                      {(selectedTicket.crew_id as { email?: string })?.email ?? '—'}
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Booking reference</span>
                    <span className="superadmin-tickets-detail-field-value">
                      {selectedTicket.bookingReference || 'Pending approval'}
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field">
                    <span className="superadmin-tickets-detail-field-label">Approved at</span>
                    <span className="superadmin-tickets-detail-field-value">
                      {selectedTicket.approvedAt ? new Date(selectedTicket.approvedAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="superadmin-tickets-detail-field superadmin-tickets-detail-field--full">
                    <span className="superadmin-tickets-detail-field-label">PDF status</span>
                    <span className="superadmin-tickets-detail-field-value">
                      {getTicketStatus(selectedTicket) !== 'APPROVED' ? (
                        <span className="superadmin-tickets-detail-pdf-missing">Pending approval</span>
                      ) : ticketHasStoredPdf(selectedTicket) ? (
                        <span className="superadmin-tickets-detail-pdf-uploaded">
                          <FileCheck size={16} /> PDF uploaded
                        </span>
                      ) : (
                        <span className="superadmin-tickets-detail-pdf-missing">Approved — PDF not uploaded yet</span>
                      )}
                    </span>
                  </div>
                </div>

                {getTicketStatus(selectedTicket) !== 'APPROVED' && (
                  <div className="superadmin-ticket-approve-detail">
                    <label htmlFor={`approve-ref-${selectedTicket.id}`}>Booking reference</label>
                    <div>
                      <input
                        id={`approve-ref-${selectedTicket.id}`}
                        value={approvalRefs[selectedTicket.id] ?? ''}
                        onChange={(e) => {
                          setApprovalRefs((prev) => ({ ...prev, [selectedTicket.id]: e.target.value }));
                          setApprovalErrors((prev) => ({ ...prev, [selectedTicket.id]: '' }));
                        }}
                        placeholder="e.g. 8XT6HB"
                      />
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => handleApproveTicket(selectedTicket, e)}
                        disabled={approvingTicketId === selectedTicket.id}
                      >
                        {approvingTicketId === selectedTicket.id ? (
                          <span className="superadmin-ticket-send-spinner" />
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            Approve & generate PDF
                          </>
                        )}
                      </Button>
                    </div>
                    {approvalErrors[selectedTicket.id] ? <p>{approvalErrors[selectedTicket.id]}</p> : null}
                  </div>
                )}
              </div>

              <DialogFooter className="superadmin-tickets-detail-footer">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canUseTicketPdf(selectedTicket)}
                  onClick={() => {
                    void handleOpenTicketPdf(selectedTicket);
                  }}
                  title={canUseTicketPdf(selectedTicket) ? 'View generated ticket PDF' : 'Available after approval'}
                >
                  <FileCheck size={16} />
                  View PDF
                </Button>
                {getTicketStatus(selectedTicket) === 'APPROVED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleRegeneratePdf(selectedTicket, e)}
                    disabled={regeneratingTicketId === selectedTicket.id}
                    title="Regenerate ticket PDF in browser and upload"
                  >
                    {regeneratingTicketId === selectedTicket.id ? (
                      <span className="superadmin-ticket-upload-spinner" />
                    ) : (
                      <>
                        <FileText size={16} />
                        Regenerate
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={ticketHasStoredPdf(selectedTicket) ? 'superadmin-ticket-pdf-btn--uploaded' : ''}
                  onClick={() => handleUploadClick(selectedTicket.id)}
                  disabled={uploadingTicketId === selectedTicket.id || getTicketStatus(selectedTicket) !== 'APPROVED'}
                  title={getTicketStatus(selectedTicket) !== 'APPROVED' ? 'Approve ticket first' : ticketHasStoredPdf(selectedTicket) ? 'Upload a PDF file to replace the stored ticket' : 'Upload ticket PDF file'}
                >
                  {uploadingTicketId === selectedTicket.id ? (
                    <span className="superadmin-ticket-upload-spinner" />
                  ) : ticketHasStoredPdf(selectedTicket) ? (
                    <>
                      <FileCheck size={16} />
                      Replace PDF
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      Upload PDF
                    </>
                  )}
                </Button>
                {/* Send ticket temporarily disabled — backend endpoint unavailable.
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendTicketClick(selectedTicket.id)}
                  disabled={sendingTicketId === selectedTicket.id || !canUseTicketPdf(selectedTicket) || !ticketHasStoredPdf(selectedTicket)}
                  title={ticketHasStoredPdf(selectedTicket) ? 'Send ticket to crew email' : 'Approve and upload PDF before sending email'}
                >
                  {sendingTicketId === selectedTicket.id ? (
                    <span className="superadmin-ticket-send-spinner" />
                  ) : (
                    <>
                      <Send size={16} />
                      Send
                    </>
                  )}
                </Button>
                */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleDeleteTicketClick(selectedTicket, e)}
                  disabled={deletingTicketId === selectedTicket.id}
                  title="Delete ticket"
                  className="text-destructive hover:text-destructive"
                >
                  {deletingTicketId === selectedTicket.id ? (
                    <span className="superadmin-ticket-send-spinner" />
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ticket? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setTicketToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!!ticketToDelete && deletingTicketId === ticketToDelete.id}
            >
              {ticketToDelete && deletingTicketId === ticketToDelete.id ? (
                <span className="superadmin-ticket-send-spinner" />
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperadminTicketsPage;
