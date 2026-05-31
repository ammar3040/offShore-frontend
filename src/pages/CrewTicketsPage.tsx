import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, FileCheck } from 'lucide-react';
import { getCrewMe } from '../api/crew';
import { canUseTicketPdf, getCrewTicketsByCrewId, getTicketStatus, getTicketStatusLabel, type CrewTicketApi } from '../api/ticket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewTicketsPage.css';

const CrewTicketsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);

  const fetchTickets = useCallback(async () => {
    const crew = await getCrewMe();
    if (!crew) {
      setTickets([]);
      return;
    }
    const crewId = crew.id ?? (crew as { _id?: string })?._id;
    if (!crewId) {
      setTickets([]);
      return;
    }
    const { crewTickets } = await getCrewTicketsByCrewId(crewId);
    setTickets(crewTickets ?? []);
  }, []);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    fetchTickets()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tickets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate, fetchTickets]);

  const getProjectTitle = (t: CrewTicketApi) => {
    const p = t.project_id;
    return p?.title ?? (p as { title?: string })?.title ?? '—';
  };

  if (loading) {
    return (
      <div className="crew-tickets-loading">
        <div className="crew-tickets-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crew-tickets-page">
        <header className="crew-tickets-header">
          <h1 className="crew-tickets-title">Tickets</h1>
          <p className="crew-tickets-subtitle">Your flight tickets for assigned projects</p>
        </header>
        <div className="crew-tickets-error" role="alert">{error}</div>
      </div>
    );
  }

  return (
    <div className="crew-tickets-page">
      <header className="crew-tickets-header">
        <h1 className="crew-tickets-title">Tickets</h1>
        <p className="crew-tickets-subtitle">Your flight tickets for assigned projects</p>
      </header>

      {tickets.length === 0 ? (
        <div className="crew-tickets-placeholder">
          <Plane size={48} className="crew-tickets-icon" />
          <p>No flight tickets assigned yet.</p>
          <p className="crew-tickets-placeholder-hint">Enroll in a project to receive flight tickets.</p>
        </div>
      ) : (
        <Card className="crew-tickets-table-wrap overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Passengers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booking Ref</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="crew-tickets-row-clickable cursor-pointer"
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
                  <TableCell>
                    <span className="crew-tickets-cell-project">{getProjectTitle(ticket)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="crew-tickets-cell-route" title={`${ticket.from?.Name ?? ''} → ${ticket.to?.Name ?? ''}`}>
                      {ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>{ticket.class ?? '—'}</TableCell>
                  <TableCell>{ticket.trip?.replace('_', ' ') ?? '—'}</TableCell>
                  <TableCell>
                    {[ticket.adult, ticket.children, ticket.infants]
                      .filter((n) => n != null && n > 0)
                      .join(' / ') || '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`crew-tickets-status-badge ${getTicketStatus(ticket) === 'APPROVED' ? 'approved' : 'pending'}`}>
                      {getTicketStatusLabel(ticket)}
                    </span>
                  </TableCell>
                  <TableCell>{ticket.bookingReference || '—'}</TableCell>
                  <TableCell>
                    {canUseTicketPdf(ticket) ? (
                      <button
                        type="button"
                        className="crew-tickets-pdf-action"
                        title="Open approved ticket PDF"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(ticket.pdf, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <FileCheck size={16} className="mr-1" />
                        View
                      </button>
                    ) : (
                      <span className="crew-tickets-pdf-missing">Pending approval</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ticket details</DialogTitle>
          </DialogHeader>
        {selectedTicket && (
          <div className="crew-tickets-detail-card">
            <section className="crew-tickets-detail-section">
              <h3 className="crew-tickets-detail-heading">Flight details</h3>
              <dl className="crew-tickets-detail-list">
                <div className="crew-tickets-detail-item">
                  <dt>From</dt>
                  <dd>{selectedTicket.from?.Name ?? '—'}</dd>
                  <dd className="crew-tickets-detail-meta">
                    {selectedTicket.from?.COUNTRYNAME ?? ''} ({selectedTicket.from?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>To</dt>
                  <dd>{selectedTicket.to?.Name ?? '—'}</dd>
                  <dd className="crew-tickets-detail-meta">
                    {selectedTicket.to?.COUNTRYNAME ?? ''} ({selectedTicket.to?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Project</dt>
                  <dd>{getProjectTitle(selectedTicket)}</dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Class</dt>
                  <dd>{selectedTicket.class ?? '—'}</dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Trip</dt>
                  <dd>{selectedTicket.trip?.replace('_', ' ') ?? '—'}</dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Status</dt>
                  <dd>
                    <span className={`crew-tickets-status-badge ${getTicketStatus(selectedTicket) === 'APPROVED' ? 'approved' : 'pending'}`}>
                      {getTicketStatusLabel(selectedTicket)}
                    </span>
                  </dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Booking reference</dt>
                  <dd>{selectedTicket.bookingReference || 'Pending approval'}</dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Ticket PDF</dt>
                  <dd>
                    {canUseTicketPdf(selectedTicket) ? (
                      <button
                        type="button"
                        className="crew-tickets-pdf-action"
                        onClick={() => window.open(selectedTicket.pdf, '_blank', 'noopener,noreferrer')}
                      >
                        <FileCheck size={16} className="mr-1" />
                        View approved ticket
                      </button>
                    ) : (
                      <span className="crew-tickets-pdf-missing">Available after approval</span>
                    )}
                  </dd>
                </div>
                <div className="crew-tickets-detail-item">
                  <dt>Passengers</dt>
                  <dd>
                    {[selectedTicket.adult && `${selectedTicket.adult} adult(s)`, selectedTicket.children ? `${selectedTicket.children} child(ren)` : null, selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrewTicketsPage;
