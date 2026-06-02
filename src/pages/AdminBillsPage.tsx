import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor,
  BadgeCheck,
  Bell,
  CalendarDays,
  Download,
  FileText,
  Filter,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Radio,
  Receipt,
  Search,
  Settings,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { fetchAdminInvoicePdfBlob, getAdminInvoices, type AdminInvoiceApi } from '../api/adminInvoice';
import { getProjects, type ProjectApi } from '../api/project';
import { formatGbp } from '../lib/invoice/format';
import './RigsPage.css';
import './AdminBillsPage.css';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

type BillStatus = 'Sent' | 'Generated' | 'Draft';

function getBillStatus(invoice: AdminInvoiceApi): BillStatus {
  const status = String(invoice.status ?? '').toUpperCase();
  if (status === 'SENT' || invoice.sentAt) return 'Sent';
  if (status === 'GENERATED' || invoice.pdf) return 'Generated';
  return 'Draft';
}

const AdminBillsPage = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<AdminInvoiceApi[]>([]);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [invoicesRes, projectsRes] = await Promise.all([
          getAdminInvoices(),
          getProjects().catch(() => ({ projects: [] as ProjectApi[] })),
        ]);
        if (cancelled) return;
        setInvoices(invoicesRes.adminInvoices ?? []);
        setProjects(projectsRes.projects ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load bills');
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

  const projectTitleById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.title]));
  }, [projects]);

  const getProjectTitle = (invoice: AdminInvoiceApi): string => {
    return (
      invoice.projectTitle ||
      projectTitleById.get(invoice.projectId) ||
      (invoice.projectId ? `Project ${invoice.projectId.slice(-6)}` : 'Untitled project')
    );
  };

  // Admins should only see bills that were actually issued to them (have a PDF).
  const bills = useMemo(() => {
    return invoices
      .filter((invoice) => Boolean(invoice.pdf) || getBillStatus(invoice) === 'Sent')
      .sort((a, b) => {
        const aDate = new Date(a.sentAt ?? a.createdAt ?? 0).getTime();
        const bDate = new Date(b.sentAt ?? b.createdAt ?? 0).getTime();
        return bDate - aDate;
      });
  }, [invoices]);

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((invoice) => {
      const title = getProjectTitle(invoice).toLowerCase();
      const number = (invoice.invoiceNumber ?? '').toLowerCase();
      return title.includes(q) || number.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, search, projectTitleById]);

  const totalDue = useMemo(
    () => bills.reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0),
    [bills]
  );
  const sentCount = useMemo(() => bills.filter((b) => getBillStatus(b) === 'Sent').length, [bills]);

  const handleViewPdf = async (invoice: AdminInvoiceApi) => {
    if (!invoice.projectId) return;
    try {
      const blob = await fetchAdminInvoicePdfBlob(invoice.projectId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open invoice PDF');
    }
  };

  const handleDownloadPdf = async (invoice: AdminInvoiceApi) => {
    if (!invoice.projectId) return;
    try {
      const blob = await fetchAdminInvoicePdfBlob(invoice.projectId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber ?? 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice PDF');
    }
  };

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
            { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
            { icon: Users, label: 'Crew Management', path: '/crew', badge: true },
            { icon: Ship, label: 'Rigs', path: '/rig' },
            { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
            { icon: Wallet, label: 'Payroll', path: '/payroll' },
            { icon: FileText, label: 'Contracts', path: '/contracts' },
            { icon: Receipt, label: 'Bills', path: '/bills', active: true },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects', path: '/projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar', path: '/timeline' },
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
          <span className="subsea-sb-title">Bills</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search project, invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Billing</div>
          <button type="button" className="subsea-sb-link active">
            <Receipt size={13} /> Project Bills <span className="subsea-sb-count">{loading ? '…' : bills.length}</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <BadgeCheck size={13} /> Sent <span className="subsea-sb-count">{loading ? '…' : sentCount}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Bills</span>
          </div>
          <div className="subsea-sync-pill">
            <span className="subsea-sync-dot" />
            GMDSS Online · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
          </div>
          <div className="subsea-top-actions">
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Project Bills</h1>
              <p>Invoices issued by the superadmin for your projects. View or download the PDF.</p>
            </div>
          </div>

          {error && (
            <div className="subsea-alert subsea-alert-warn admin-bills-alert" role="alert">
              <FileText size={15} />
              <span>
                <strong>Could not load bills:</strong> {error}
              </span>
            </div>
          )}

          <div className="subsea-proj-kpi-strip">
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Total Bills</div>
              <div className="subsea-kpi-value">{loading ? '…' : bills.length}</div>
              <div className="subsea-kpi-meta flat">Across your projects</div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Sent</div>
              <div className="subsea-kpi-value">{loading ? '…' : sentCount}</div>
              <div className="subsea-kpi-meta flat">Delivered to you</div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Total Due</div>
              <div className="subsea-kpi-value">{loading ? '…' : formatGbp(totalDue)}</div>
              <div className="subsea-kpi-meta flat">Sum of all bills</div>
            </div>
          </div>

          <div className="subsea-pane">
            <div className="subsea-pane-head">
              <div className="subsea-pane-title">Received Bills</div>
              <div className="subsea-pane-sub">{loading ? 'Loading…' : `${filteredBills.length} bill${filteredBills.length !== 1 ? 's' : ''}`}</div>
            </div>

            {loading ? (
              <div className="admin-bills-empty">Loading bills…</div>
            ) : filteredBills.length === 0 ? (
              <div className="admin-bills-empty">
                {bills.length === 0
                  ? 'No bills yet. Invoices will appear here once the superadmin sends them for your projects.'
                  : 'No bills match your search.'}
              </div>
            ) : (
              <div className="admin-bills-list">
                {filteredBills.map((invoice) => {
                  const status = getBillStatus(invoice);
                  return (
                    <div key={invoice.id ?? invoice.projectId} className="admin-bills-card">
                      <div className="admin-bills-card-icon" title="Invoice">
                        <Receipt size={20} />
                      </div>

                      <div className="admin-bills-card-main">
                        <div className="admin-bills-card-project">{getProjectTitle(invoice)}</div>
                        <div className="admin-bills-card-meta">
                          {invoice.invoiceNumber && (
                            <>
                              <span>{invoice.invoiceNumber}</span>
                              <span className="admin-bills-sep">·</span>
                            </>
                          )}
                          <span>Sent {formatDate(invoice.sentAt ?? invoice.createdAt)}</span>
                        </div>
                        <div className="admin-bills-card-amounts">
                          {invoice.margin != null && Number(invoice.margin) > 0 ? (
                            <span>Margin: {formatGbp(Number(invoice.margin))}</span>
                          ) : null}
                          <strong>Total: {formatGbp(Number(invoice.total) || 0)}</strong>
                        </div>
                      </div>

                      <div className="admin-bills-card-side">
                        <span className={`admin-bills-status admin-bills-status--${status.toLowerCase()}`}>
                          {status}
                        </span>
                        <div className="admin-bills-card-actions">
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-default subsea-btn-sm"
                            onClick={() => handleViewPdf(invoice)}
                            disabled={!invoice.pdf}
                            title={invoice.pdf ? 'Open invoice PDF' : 'PDF not available yet'}
                          >
                            <FileText size={13} /> View PDF
                          </button>
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-primary subsea-btn-sm"
                            onClick={() => handleDownloadPdf(invoice)}
                            disabled={!invoice.pdf}
                            title={invoice.pdf ? 'Download invoice PDF' : 'PDF not available yet'}
                          >
                            <Download size={13} /> Download
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminBillsPage;
