import { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck, FileText, Receipt, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAdminInvoiceKey,
  getSuperadminAdminInvoices,
  sendSuperadminAdminInvoice,
  uploadSuperadminAdminInvoicePdf,
  type AdminInvoiceApi,
} from '../api/adminInvoice';
import {
  getTicketDepartureIso,
  getTicketArrivalIso,
  formatTicketSchedule,
} from '../api/ticket';
import {
  getSuperadminAdmins,
  getSuperadminCrewById,
  getSuperadminCrewTickets,
  getSuperadminProjects,
  type ApiPagination,
} from '../api/superadmin';
import type { CrewMemberApi } from '../api/crew';
import { buildTicketInvoiceBills, getTicketPassengerName } from '../lib/invoice/buildInvoice';
import { formatGbp } from '../lib/invoice/format';
import { generateInvoicePdfFile } from '../lib/invoice/generateInvoicePdf';
import type { TicketInvoiceBill } from '../lib/invoice/types';
import { env } from '../config/env';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './SuperadminAdminInvoicePage.css';

type GeneratedPdfState = Record<string, File>;

const PAGE_SIZE = env.defaultPageSize;

const SuperadminAdminInvoicePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [bills, setBills] = useState<TicketInvoiceBill[]>([]);
  const [invoiceRecords, setInvoiceRecords] = useState<Record<string, AdminInvoiceApi>>({});
  const [margins, setMargins] = useState<Record<string, string>>({});
  const [draftMargins, setDraftMargins] = useState<Record<string, string>>({});
  const [marginConfirm, setMarginConfirm] = useState<{
    ticketId: string;
    bill: TicketInvoiceBill;
    newValue: string;
    oldValue: string;
  } | null>(null);
  const [generatingTicketId, setGeneratingTicketId] = useState<string | null>(null);
  const [uploadingTicketId, setUploadingTicketId] = useState<string | null>(null);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdfState>({});
  const [selectedBill, setSelectedBill] = useState<TicketInvoiceBill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTicketId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [projectsRes, ticketsRes, adminsRes, invoicesRes] = await Promise.all([
          getSuperadminProjects(),
          getSuperadminCrewTickets({ status: 'APPROVED', page, limit: PAGE_SIZE }),
          getSuperadminAdmins(),
          getSuperadminAdminInvoices().catch(() => ({ adminInvoices: [] as AdminInvoiceApi[] })),
        ]);

        if (cancelled) return;

        const invoiceMap = Object.fromEntries(
          (invoicesRes.adminInvoices ?? [])
            .filter((invoice) => Boolean(getAdminInvoiceKey(invoice)))
            .map((invoice) => [getAdminInvoiceKey(invoice), invoice])
        );
        setInvoiceRecords((prev) => ({ ...prev, ...invoiceMap }));

        const marginDefaults = Object.fromEntries(
          (invoicesRes.adminInvoices ?? [])
            .filter((invoice) => invoice.margin != null && getAdminInvoiceKey(invoice))
            .map((invoice) => [getAdminInvoiceKey(invoice), String(invoice.margin)])
        );

        const crewIds = [
          ...new Set(
            (ticketsRes.crewTickets ?? [])
              .map((ticket) => ticket.crew_id?._id)
              .filter((crewId): crewId is string => Boolean(crewId))
          ),
        ];
        const crewProfiles = await Promise.all(
          crewIds.map(async (crewId) => {
            const crew = await getSuperadminCrewById(crewId);
            return crew ? ([crewId, crew] as const) : null;
          })
        );
        const crewById = Object.fromEntries(
          crewProfiles.filter((entry): entry is readonly [string, CrewMemberApi] => entry != null)
        ) as Record<string, CrewMemberApi>;

        const indexOffset = ticketsRes.pagination
          ? (ticketsRes.pagination.page - 1) * ticketsRes.pagination.limit
          : (page - 1) * PAGE_SIZE;

        const computedBills = buildTicketInvoiceBills(
          projectsRes.projects ?? [],
          ticketsRes.crewTickets ?? [],
          adminsRes.admins ?? [],
          Object.fromEntries(
            Object.entries(marginDefaults).map(([ticketId, value]) => [ticketId, Number(value)])
          ),
          crewById,
          indexOffset
        );

        setBills(computedBills);
        setPagination(ticketsRes.pagination ?? null);
        setMargins((prev) => ({ ...marginDefaults, ...prev }));
        setDraftMargins((prev) => ({ ...marginDefaults, ...prev }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load admin invoices');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const billsWithMargins = useMemo(() => {
    const marginNumbers = Object.fromEntries(
      Object.entries(margins).map(([ticketId, value]) => {
        const parsed = parseFloat(value.trim());
        return [ticketId, Number.isFinite(parsed) && parsed > 0 ? parsed : 0];
      })
    );

    return bills.map((bill) => {
      const marginGbp = marginNumbers[bill.ticket.id] ?? 0;
      const totalGbp = bill.ticketsSubtotalGbp + marginGbp;
      return { ...bill, marginGbp, totalGbp };
    });
  }, [bills, margins]);

  const getAdminLabel = (bill: TicketInvoiceBill) => {
    if (!bill.admin) return 'Unknown admin';
    return `${bill.admin.firstname} ${bill.admin.lastname}`.trim();
  };

  const getPassengerLabel = (bill: TicketInvoiceBill) => getTicketPassengerName(bill.ticket);

  const getRouteLabel = (bill: TicketInvoiceBill) => {
    const from = bill.ticket.from?.Name ?? '—';
    const to = bill.ticket.to?.Name ?? '—';
    return `${from} → ${to}`;
  };

  const handleMarginDraftChange = (ticketId: string, value: string) => {
    setDraftMargins((prev) => ({ ...prev, [ticketId]: value }));
  };

  const requestMarginUpdate = (ticketId: string, bill: TicketInvoiceBill) => {
    const draft = (draftMargins[ticketId] ?? '').trim();
    const applied = (margins[ticketId] ?? '').trim();
    if (draft === applied) return;
    setMarginConfirm({ ticketId, bill, newValue: draft, oldValue: applied });
  };

  const confirmMarginUpdate = () => {
    if (!marginConfirm) return;
    const { ticketId, newValue } = marginConfirm;
    setMargins((prev) => ({ ...prev, [ticketId]: newValue }));
    setDraftMargins((prev) => ({ ...prev, [ticketId]: newValue }));
    setGeneratedPdfs((prev) => {
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });
    setMarginConfirm(null);
    toast.success('Margin updated', {
      description: 'Totals refreshed. Regenerate the PDF if one was already created.',
    });
  };

  const cancelMarginUpdate = () => {
    if (!marginConfirm) return;
    setDraftMargins((prev) => ({ ...prev, [marginConfirm.ticketId]: marginConfirm.oldValue }));
    setMarginConfirm(null);
  };

  const parseMarginDisplay = (value: string) => {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? formatGbp(parsed) : formatGbp(0);
  };

  const handleDownloadGeneratedPdf = (ticketId: string) => {
    const file = generatedPdfs[ticketId];
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleGeneratePdf = async (bill: TicketInvoiceBill) => {
    setGeneratingTicketId(bill.ticket.id);
    try {
      const file = await generateInvoicePdfFile(bill);
      setGeneratedPdfs((prev) => ({ ...prev, [bill.ticket.id]: file }));
      toast.success('PDF generated', {
        description: `${bill.invoiceNumber}.pdf is ready to attach or send.`,
      });
    } catch (err) {
      toast.error('PDF generation failed', {
        description: err instanceof Error ? err.message : 'Could not generate invoice PDF.',
      });
    } finally {
      setGeneratingTicketId(null);
    }
  };

  const handleUploadClick = (ticketId: string) => {
    pendingUploadTicketId.current = ticketId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const ticketId = pendingUploadTicketId.current;
    pendingUploadTicketId.current = null;
    event.target.value = '';
    if (!file || !ticketId) return;

    const margin = parseFloat(margins[ticketId]?.trim() ?? '');
    setUploadingTicketId(ticketId);
    try {
      const res = await uploadSuperadminAdminInvoicePdf(
        ticketId,
        file,
        Number.isFinite(margin) ? margin : undefined
      );
      if (res.adminInvoice) {
        setInvoiceRecords((prev) => ({ ...prev, [ticketId]: res.adminInvoice! }));
      }
      setGeneratedPdfs((prev) => ({ ...prev, [ticketId]: file }));
      toast.success('PDF attached', { description: res.message || 'Invoice PDF uploaded successfully.' });
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Could not upload invoice PDF.',
      });
    } finally {
      setUploadingTicketId(null);
    }
  };

  const handleSendInvoice = async (bill: TicketInvoiceBill) => {
    const ticketId = bill.ticket.id;
    const generatedPdf = generatedPdfs[ticketId];
    const existingPdf = invoiceRecords[ticketId]?.pdf;
    const margin = parseFloat(margins[ticketId]?.trim() ?? '');
    const marginValue = Number.isFinite(margin) ? margin : undefined;

    if (!generatedPdf && !existingPdf) {
      toast.error('PDF required', {
        description: 'Generate or attach the invoice PDF before sending to admin.',
      });
      return;
    }

    setSendingTicketId(ticketId);
    try {
      if (generatedPdf) {
        const uploadRes = await uploadSuperadminAdminInvoicePdf(ticketId, generatedPdf, marginValue);
        if (uploadRes.adminInvoice) {
          setInvoiceRecords((prev) => ({ ...prev, [ticketId]: uploadRes.adminInvoice! }));
        }
      }

      const res = await sendSuperadminAdminInvoice(ticketId, {
        margin: marginValue,
        invoiceNumber: bill.invoiceNumber,
      });

      if (res.adminInvoice) {
        setInvoiceRecords((prev) => ({ ...prev, [ticketId]: res.adminInvoice! }));
      }

      toast.success('Invoice sent', {
        description: res.message || `Invoice sent to ${getAdminLabel(bill)}.`,
      });
    } catch (err) {
      toast.error('Send failed', {
        description: err instanceof Error ? err.message : 'Could not send invoice to admin.',
      });
    } finally {
      setSendingTicketId(null);
    }
  };

  const getInvoiceStatus = (ticketId: string) => {
    const record = invoiceRecords[ticketId];
    if (record?.status === 'SENT' || record?.sentAt) return 'Sent';
    if (record?.pdf || generatedPdfs[ticketId]) return 'PDF ready';
    return 'Draft';
  };

  const totalItems = pagination?.total ?? billsWithMargins.length;
  const totalPages = pagination?.totalPages ?? 1;
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = pagination
    ? Math.min(page * pagination.limit, totalItems)
    : Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="superadmin-admin-invoice-page">
      <header className="superadmin-admin-invoice-header">
        <div>
          <h1 className="superadmin-admin-invoice-title">Admin Invoices</h1>
          <p className="superadmin-admin-invoice-subtitle">
            One invoice per approved ticket. Add an optional margin, generate the Lynq Travel invoice PDF, and send it to the admin.
          </p>
        </div>
      </header>

      {error && (
        <div className="superadmin-admin-invoice-error" role="alert">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="superadmin-admin-invoice-file-input"
        onChange={handleFileChange}
        aria-hidden
      />

      <Card className="superadmin-admin-invoice-content py-0 gap-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <p className="superadmin-admin-invoice-empty">Loading ticket invoices…</p>
          ) : billsWithMargins.length === 0 ? (
            <p className="superadmin-admin-invoice-empty">
              No billable tickets yet. Approved crew tickets are required before an admin invoice can be created.
            </p>
          ) : (
            <>
            <div className="superadmin-admin-invoice-list">
              {billsWithMargins.map((bill) => {
                const ticketId = bill.ticket.id;
                const hasGeneratedPdf = Boolean(generatedPdfs[ticketId] || invoiceRecords[ticketId]?.pdf);
                const status = getInvoiceStatus(ticketId);

                return (
                  <div key={ticketId} className="superadmin-admin-invoice-card">
                    <div className="superadmin-admin-invoice-icon" title="Admin invoice">
                      <Receipt size={20} />
                    </div>

                    <div className="superadmin-admin-invoice-main">
                      <div className="superadmin-admin-invoice-project">{getPassengerLabel(bill)}</div>
                      <div className="superadmin-admin-invoice-schedule">
                        <span className="superadmin-admin-invoice-schedule-item">
                          <span className="superadmin-admin-invoice-schedule-label">Dep</span>
                          {formatTicketSchedule(getTicketDepartureIso(bill.ticket))}
                        </span>
                        <span className="superadmin-admin-invoice-schedule-sep" aria-hidden="true">→</span>
                        <span className="superadmin-admin-invoice-schedule-item">
                          <span className="superadmin-admin-invoice-schedule-label">Arr</span>
                          {formatTicketSchedule(getTicketArrivalIso(bill.ticket))}
                        </span>
                      </div>
                      <div className="superadmin-admin-invoice-meta">
                        <span>{bill.project.title}</span>
                        <span className="superadmin-admin-invoice-sep">·</span>
                        <span>{getRouteLabel(bill)}</span>
                        <span className="superadmin-admin-invoice-sep">·</span>
                        <span>{bill.invoiceNumber}</span>
                      </div>
                      <div className="superadmin-admin-invoice-meta">
                        <span>{getAdminLabel(bill)}</span>
                      </div>
                      <div className="superadmin-admin-invoice-amounts">
                        <span>Ticket: {formatGbp(bill.ticketsSubtotalGbp)}</span>
                        {bill.marginGbp > 0 ? <span>Margin: {formatGbp(bill.marginGbp)}</span> : null}
                        <strong>Total: {formatGbp(bill.totalGbp)}</strong>
                      </div>
                    </div>

                    <div className="superadmin-admin-invoice-badges">
                      <span className={`superadmin-admin-invoice-status superadmin-admin-invoice-status--${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {status}
                      </span>
                    </div>

                    <div className="superadmin-admin-invoice-actions">
                      <div className="superadmin-admin-invoice-actions-group">
                        <label className="superadmin-admin-invoice-margin">
                          <span>Margin (£)</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={draftMargins[ticketId] ?? ''}
                            onChange={(e) => handleMarginDraftChange(ticketId, e.target.value)}
                            onBlur={() => requestMarginUpdate(ticketId, bill)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="superadmin-admin-invoice-actions-group superadmin-admin-invoice-actions-group--pdf">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGeneratePdf(bill)}
                          disabled={generatingTicketId === ticketId}
                          title="Generate invoice PDF from Lynq Travel template"
                        >
                          {generatingTicketId === ticketId ? (
                            <span className="superadmin-admin-invoice-spinner" />
                          ) : (
                            <>
                              <Sparkles size={16} />
                              Generate PDF
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadGeneratedPdf(ticketId)}
                          disabled={!generatedPdfs[ticketId]}
                          title={generatedPdfs[ticketId] ? 'Preview generated PDF' : 'Generate PDF first'}
                        >
                          <FileCheck size={16} />
                          View PDF
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className={hasGeneratedPdf ? 'superadmin-admin-invoice-pdf-btn--ready' : ''}
                          onClick={() => handleUploadClick(ticketId)}
                          disabled={uploadingTicketId === ticketId}
                          title={hasGeneratedPdf ? 'Replace attached PDF' : 'Attach invoice PDF'}
                        >
                          {uploadingTicketId === ticketId ? (
                            <span className="superadmin-admin-invoice-spinner" />
                          ) : hasGeneratedPdf ? (
                            <>
                              <FileCheck size={16} />
                              PDF attached
                            </>
                          ) : (
                            <>
                              <FileText size={16} />
                              Attach PDF
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="superadmin-admin-invoice-actions-group superadmin-admin-invoice-actions-group--send">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSendInvoice(bill)}
                          disabled={sendingTicketId === ticketId || !hasGeneratedPdf}
                          title={hasGeneratedPdf ? 'Send invoice to admin' : 'Generate or attach PDF first'}
                        >
                          {sendingTicketId === ticketId ? (
                            <span className="superadmin-admin-invoice-spinner" />
                          ) : (
                            <>
                              <Send size={16} />
                              Send to admin
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBill(bill)}
                        >
                          View bill
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination && totalItems > 0 && (
              <div className="superadmin-admin-invoice-pagination">
                <span className="superadmin-admin-invoice-pagination-info">
                  Showing {rangeStart}–{rangeEnd} of {totalItems}
                </span>
                <div className="superadmin-admin-invoice-pagination-btns">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="superadmin-admin-invoice-pagination-page">
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

      <Dialog open={!!marginConfirm} onOpenChange={(open) => !open && cancelMarginUpdate()}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Update margin?</DialogTitle>
            <DialogDescription>
              {marginConfirm
                ? `Confirm the margin change for ${getPassengerLabel(marginConfirm.bill)} (${getRouteLabel(marginConfirm.bill)}).`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {marginConfirm && (
            <div className="superadmin-admin-invoice-margin-confirm">
              <div className="superadmin-admin-invoice-margin-confirm-row">
                <span>Current margin</span>
                <strong>{parseMarginDisplay(marginConfirm.oldValue)}</strong>
              </div>
              <div className="superadmin-admin-invoice-margin-confirm-row">
                <span>New margin</span>
                <strong>{parseMarginDisplay(marginConfirm.newValue)}</strong>
              </div>
              <p className="superadmin-admin-invoice-margin-confirm-note">
                Updating the margin will recalculate the invoice total. Any generated PDF for this ticket will need to be regenerated.
              </p>
            </div>
          )}
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={cancelMarginUpdate}>
              Cancel
            </Button>
            <Button onClick={confirmMarginUpdate}>
              Update margin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice bill details</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="superadmin-admin-invoice-detail">
              <dl className="superadmin-admin-invoice-detail-list">
                <div>
                  <dt>Passenger</dt>
                  <dd>{getPassengerLabel(selectedBill)}</dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>{selectedBill.project.title}</dd>
                </div>
                <div>
                  <dt>Route</dt>
                  <dd>{getRouteLabel(selectedBill)}</dd>
                </div>
                <div>
                  <dt>Admin</dt>
                  <dd>{getAdminLabel(selectedBill)}</dd>
                </div>
                <div>
                  <dt>Invoice number</dt>
                  <dd>{selectedBill.invoiceNumber}</dd>
                </div>
                <div>
                  <dt>Ticket price</dt>
                  <dd>{formatGbp(selectedBill.ticketsSubtotalGbp)}</dd>
                </div>
                <div>
                  <dt>Margin</dt>
                  <dd>{formatGbp(selectedBill.marginGbp)}</dd>
                </div>
                <div>
                  <dt>Total due</dt>
                  <dd>{formatGbp(selectedBill.totalGbp)}</dd>
                </div>
              </dl>

              <h3>Line item</h3>
              <ul className="superadmin-admin-invoice-line-items">
                {selectedBill.lineItems.map((item, index) => (
                  <li key={`${item.passengerName}-${index}`}>
                    <strong>{item.passengerName}</strong>
                    <span>{item.routeLabel}</span>
                    <span>{formatGbp(item.amountGbp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperadminAdminInvoicePage;
