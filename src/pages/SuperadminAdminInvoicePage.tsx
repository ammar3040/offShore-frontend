import { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck, FileText, Receipt, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
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
import { buildProjectInvoiceBills } from '../lib/invoice/buildInvoice';
import { formatGbp } from '../lib/invoice/format';
import { generateInvoicePdfFile } from '../lib/invoice/generateInvoicePdf';
import type { ProjectInvoiceBill } from '../lib/invoice/types';
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
  const [bills, setBills] = useState<ProjectInvoiceBill[]>([]);
  const [invoiceRecords, setInvoiceRecords] = useState<Record<string, AdminInvoiceApi>>({});
  const [margins, setMargins] = useState<Record<string, string>>({});
  const [generatingProjectId, setGeneratingProjectId] = useState<string | null>(null);
  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);
  const [sendingProjectId, setSendingProjectId] = useState<string | null>(null);
  const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdfState>({});
  const [selectedBill, setSelectedBill] = useState<ProjectInvoiceBill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadProjectId = useRef<string | null>(null);

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
          (invoicesRes.adminInvoices ?? []).map((invoice) => [invoice.projectId, invoice])
        );
        setInvoiceRecords(invoiceMap);

        const marginDefaults = Object.fromEntries(
          (invoicesRes.adminInvoices ?? [])
            .filter((invoice) => invoice.margin != null)
            .map((invoice) => [invoice.projectId, String(invoice.margin)])
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

        const computedBills = buildProjectInvoiceBills(
          projectsRes.projects ?? [],
          ticketsRes.crewTickets ?? [],
          adminsRes.admins ?? [],
          Object.fromEntries(
            Object.entries(marginDefaults).map(([projectId, value]) => [projectId, Number(value)])
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
      Object.entries(margins).map(([projectId, value]) => {
        const parsed = parseFloat(value.trim());
        return [projectId, Number.isFinite(parsed) && parsed > 0 ? parsed : 0];
      })
    );

    return bills.map((bill) => {
      const marginGbp = marginNumbers[bill.project.id] ?? 0;
      const totalGbp = bill.ticketsSubtotalGbp + marginGbp;
      return { ...bill, marginGbp, totalGbp };
    });
  }, [bills, margins]);

  const getAdminLabel = (bill: ProjectInvoiceBill) => {
    if (!bill.admin) return 'Unknown admin';
    return `${bill.admin.firstname} ${bill.admin.lastname}`.trim();
  };

  const handleMarginChange = (projectId: string, value: string) => {
    setMargins((prev) => ({ ...prev, [projectId]: value }));
    setGeneratedPdfs((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  };

  const handleDownloadGeneratedPdf = (projectId: string) => {
    const file = generatedPdfs[projectId];
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleGeneratePdf = async (bill: ProjectInvoiceBill) => {
    setGeneratingProjectId(bill.project.id);
    try {
      const file = await generateInvoicePdfFile(bill);
      setGeneratedPdfs((prev) => ({ ...prev, [bill.project.id]: file }));
      toast.success('PDF generated', {
        description: `${bill.invoiceNumber}.pdf is ready to attach or send.`,
      });
    } catch (err) {
      toast.error('PDF generation failed', {
        description: err instanceof Error ? err.message : 'Could not generate invoice PDF.',
      });
    } finally {
      setGeneratingProjectId(null);
    }
  };

  const handleUploadClick = (projectId: string) => {
    pendingUploadProjectId.current = projectId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const projectId = pendingUploadProjectId.current;
    pendingUploadProjectId.current = null;
    event.target.value = '';
    if (!file || !projectId) return;

    const margin = parseFloat(margins[projectId]?.trim() ?? '');
    setUploadingProjectId(projectId);
    try {
      const res = await uploadSuperadminAdminInvoicePdf(
        projectId,
        file,
        Number.isFinite(margin) ? margin : undefined
      );
      if (res.adminInvoice) {
        setInvoiceRecords((prev) => ({ ...prev, [projectId]: res.adminInvoice! }));
      }
      setGeneratedPdfs((prev) => ({ ...prev, [projectId]: file }));
      toast.success('PDF attached', { description: res.message || 'Invoice PDF uploaded successfully.' });
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Could not upload invoice PDF.',
      });
    } finally {
      setUploadingProjectId(null);
    }
  };

  const handleSendInvoice = async (bill: ProjectInvoiceBill) => {
    const projectId = bill.project.id;
    const generatedPdf = generatedPdfs[projectId];
    const existingPdf = invoiceRecords[projectId]?.pdf;
    const margin = parseFloat(margins[projectId]?.trim() ?? '');
    const marginValue = Number.isFinite(margin) ? margin : undefined;

    if (!generatedPdf && !existingPdf) {
      toast.error('PDF required', {
        description: 'Generate or attach the invoice PDF before sending to admin.',
      });
      return;
    }

    setSendingProjectId(projectId);
    try {
      // Always upload the freshly generated PDF so the sent invoice reflects the
      // latest margin/total (a stored PDF may be stale after a margin change).
      if (generatedPdf) {
        const uploadRes = await uploadSuperadminAdminInvoicePdf(projectId, generatedPdf, marginValue);
        if (uploadRes.adminInvoice) {
          setInvoiceRecords((prev) => ({ ...prev, [projectId]: uploadRes.adminInvoice! }));
        }
      }

      const res = await sendSuperadminAdminInvoice(projectId, {
        margin: marginValue,
        invoiceNumber: bill.invoiceNumber,
      });

      if (res.adminInvoice) {
        setInvoiceRecords((prev) => ({ ...prev, [projectId]: res.adminInvoice! }));
      }

      toast.success('Invoice sent', {
        description: res.message || `Invoice sent to ${getAdminLabel(bill)}.`,
      });
    } catch (err) {
      toast.error('Send failed', {
        description: err instanceof Error ? err.message : 'Could not send invoice to admin.',
      });
    } finally {
      setSendingProjectId(null);
    }
  };

  const getInvoiceStatus = (projectId: string) => {
    const record = invoiceRecords[projectId];
    if (record?.status === 'SENT' || record?.sentAt) return 'Sent';
    if (record?.pdf || generatedPdfs[projectId]) return 'PDF ready';
    return 'Draft';
  };

  return (
    <div className="superadmin-admin-invoice-page">
      <header className="superadmin-admin-invoice-header">
        <div>
          <h1 className="superadmin-admin-invoice-title">Admin Invoices</h1>
          <p className="superadmin-admin-invoice-subtitle">
            Review project bills, add an optional margin, generate the Lynq Travel invoice PDF, and send it to the admin.
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
            <p className="superadmin-admin-invoice-empty">Loading project bills…</p>
          ) : billsWithMargins.length === 0 ? (
            <p className="superadmin-admin-invoice-empty">
              No billable projects yet. Approved crew tickets are required before an admin invoice can be created.
            </p>
          ) : (
            <div className="superadmin-admin-invoice-list">
              {billsWithMargins.map((bill) => {
                const projectId = bill.project.id;
                const hasGeneratedPdf = Boolean(generatedPdfs[projectId] || invoiceRecords[projectId]?.pdf);
                const status = getInvoiceStatus(projectId);

                return (
                  <div key={projectId} className="superadmin-admin-invoice-card">
                    <div className="superadmin-admin-invoice-icon" title="Admin invoice">
                      <Receipt size={20} />
                    </div>

                    <div className="superadmin-admin-invoice-main">
                      <div className="superadmin-admin-invoice-project">{bill.project.title}</div>
                      <div className="superadmin-admin-invoice-meta">
                        <span>{getAdminLabel(bill)}</span>
                        <span className="superadmin-admin-invoice-sep">·</span>
                        <span>{bill.lineItems.length} ticket{bill.lineItems.length !== 1 ? 's' : ''}</span>
                        <span className="superadmin-admin-invoice-sep">·</span>
                        <span>{bill.invoiceNumber}</span>
                      </div>
                      <div className="superadmin-admin-invoice-amounts">
                        <span>Tickets: {formatGbp(bill.ticketsSubtotalGbp)}</span>
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
                          value={margins[projectId] ?? ''}
                          onChange={(e) => handleMarginChange(projectId, e.target.value)}
                        />
                      </label>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGeneratePdf(bill)}
                        disabled={generatingProjectId === projectId}
                        title="Generate invoice PDF from Lynq Travel template"
                      >
                        {generatingProjectId === projectId ? (
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
                        onClick={() => handleDownloadGeneratedPdf(projectId)}
                        disabled={!generatedPdfs[projectId]}
                        title={generatedPdfs[projectId] ? 'Preview generated PDF' : 'Generate PDF first'}
                      >
                        <FileCheck size={16} />
                        View PDF
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className={hasGeneratedPdf ? 'superadmin-admin-invoice-pdf-btn--ready' : ''}
                        onClick={() => handleUploadClick(projectId)}
                        disabled={uploadingProjectId === projectId}
                        title={hasGeneratedPdf ? 'Replace attached PDF' : 'Attach invoice PDF'}
                      >
                        {uploadingProjectId === projectId ? (
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
                        disabled={sendingProjectId === projectId || !hasGeneratedPdf}
                        title={hasGeneratedPdf ? 'Send invoice to admin' : 'Generate or attach PDF first'}
                      >
                        {sendingProjectId === projectId ? (
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
                  <dt>Project</dt>
                  <dd>{selectedBill.project.title}</dd>
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
                  <dt>Tickets subtotal</dt>
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

              <h3>Line items</h3>
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
