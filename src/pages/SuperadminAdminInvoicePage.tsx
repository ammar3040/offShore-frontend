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
  getSuperadminAdmins,
  getSuperadminCrewById,
  getSuperadminCrewTickets,
  getSuperadminProjects,
} from '../api/superadmin';
import type { CrewMemberApi } from '../api/crew';
import { buildTicketInvoiceBills, getTicketPassengerName } from '../lib/invoice/buildInvoice';
import { formatGbp } from '../lib/invoice/format';
import { generateInvoicePdfFile } from '../lib/invoice/generateInvoicePdf';
import type { TicketInvoiceBill } from '../lib/invoice/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './SuperadminAdminInvoicePage.css';

type GeneratedPdfState = Record<string, File>;

const SuperadminAdminInvoicePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bills, setBills] = useState<TicketInvoiceBill[]>([]);
  const [invoiceRecords, setInvoiceRecords] = useState<Record<string, AdminInvoiceApi>>({});
  const [margins, setMargins] = useState<Record<string, string>>({});
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
          getSuperadminCrewTickets(),
          getSuperadminAdmins(),
          getSuperadminAdminInvoices().catch(() => ({ adminInvoices: [] as AdminInvoiceApi[] })),
        ]);

        if (cancelled) return;

        const invoiceMap = Object.fromEntries(
          (invoicesRes.adminInvoices ?? [])
            .filter((invoice) => Boolean(getAdminInvoiceKey(invoice)))
            .map((invoice) => [getAdminInvoiceKey(invoice), invoice])
        );
        setInvoiceRecords(invoiceMap);

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

        const computedBills = buildTicketInvoiceBills(
          projectsRes.projects ?? [],
          ticketsRes.crewTickets ?? [],
          adminsRes.admins ?? [],
          Object.fromEntries(
            Object.entries(marginDefaults).map(([ticketId, value]) => [ticketId, Number(value)])
          ),
          crewById
        );

        setBills(computedBills);
        setMargins((prev) => ({ ...marginDefaults, ...prev }));
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
  }, []);

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

  const handleMarginChange = (ticketId: string, value: string) => {
    setMargins((prev) => ({ ...prev, [ticketId]: value }));
    setGeneratedPdfs((prev) => {
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });
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

      <Card className="superadmin-admin-invoice-content">
        <CardContent className="p-0">
          {loading ? (
            <p className="superadmin-admin-invoice-empty">Loading ticket invoices…</p>
          ) : billsWithMargins.length === 0 ? (
            <p className="superadmin-admin-invoice-empty">
              No billable tickets yet. Approved crew tickets are required before an admin invoice can be created.
            </p>
          ) : (
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
                      <label className="superadmin-admin-invoice-margin">
                        <span>Margin (£)</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={margins[ticketId] ?? ''}
                          onChange={(e) => handleMarginChange(ticketId, e.target.value)}
                        />
                      </label>

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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
