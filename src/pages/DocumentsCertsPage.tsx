import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Download,
  FileText,
  Filter,
  IdCard,
  Plane,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import './DocumentsCertsPage.css';
import './RigsPage.css';

type CertStatus = 'valid' | 'expiring' | 'expired' | 'missing';
type CertFilter = 'all' | 'attention' | 'valid';
type DocTypeFilter = 'all' | 'Passport' | 'Identity' | 'Crew Certificate' | 'Visa';

type CertRow = {
  id: string;
  crewId: string;
  crewName: string;
  document: string;
  type: string;
  expiry: string;
  daysUntil: number | null;
  status: CertStatus;
  statusLabel: string;
  statusClassName: string;
};

const PAGE_SIZE = 8;
const DOC_TYPE_OPTIONS: Array<{ id: DocTypeFilter; label: string }> = [
  { id: 'all', label: 'All types' },
  { id: 'Passport', label: 'Passport' },
  { id: 'Identity', label: 'Identity' },
  { id: 'Crew Certificate', label: 'STCW / Crew Cert' },
  { id: 'Visa', label: 'Visa' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function certStatus(expiry?: string): { status: CertStatus; label: string; className: string } {
  if (!expiry) return { status: 'missing', label: 'Missing', className: 'subsea-b-gray' };
  const days = daysUntil(expiry);
  if (days == null) return { status: 'missing', label: 'Unknown', className: 'subsea-b-gray' };
  if (days < 0) return { status: 'expired', label: 'Expired', className: 'subsea-b-red' };
  if (days <= 30) return { status: 'expiring', label: days <= 7 ? 'Critical' : 'Expiring', className: days <= 7 ? 'subsea-b-red' : 'subsea-b-amber' };
  return { status: 'valid', label: 'Valid', className: 'subsea-b-green' };
}

function expiryRelativeLabel(daysUntilExpiry: number | null, status: CertStatus): string {
  if (daysUntilExpiry == null) return 'No expiry date';
  if (status === 'expired') return `Expired ${Math.abs(daysUntilExpiry)}d ago`;
  if (daysUntilExpiry === 0) return 'Expires today';
  if (daysUntilExpiry === 1) return 'Expires tomorrow';
  return `Expires in ${daysUntilExpiry}d`;
}

function expiryBarPct(daysUntilExpiry: number | null): number {
  if (daysUntilExpiry == null || daysUntilExpiry < 0) return 100;
  return Math.max(8, Math.min(100, Math.round(((30 - Math.min(daysUntilExpiry, 30)) / 30) * 100)));
}

function expiryBarColor(status: CertStatus, daysUntilExpiry: number | null): string {
  if (status === 'expired' || (daysUntilExpiry != null && daysUntilExpiry <= 7)) return 'red';
  if (status === 'expiring') return 'amber';
  return 'green';
}

function docIconKind(document: string, type: string): 'identity' | 'stcw' | 'travel' {
  if (document === 'Visa' || type === 'Travel') return 'travel';
  if (document === 'Crew Certificate' || type === 'STCW') return 'stcw';
  return 'identity';
}

function DocIcon({ document, type }: { document: string; type: string }) {
  const kind = docIconKind(document, type);
  const Icon = document === 'Visa' ? Plane : document === 'Crew Certificate' ? ShieldCheck : type === 'Identity' ? IdCard : FileText;
  return (
    <span className={`docs-cert-doc-icon ${kind}`} aria-hidden>
      <Icon size={14} />
    </span>
  );
}

function buildCertRows(crew: CrewMemberApi[]): CertRow[] {
  const rows: CertRow[] = [];

  for (const member of crew) {
    const crewName = `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || 'Unnamed crew';

    const pushRow = (document: string, type: string, expiryRaw?: string) => {
      const badge = certStatus(expiryRaw);
      const days = daysUntil(expiryRaw);
      let statusLabel = badge.label;
      if (badge.status === 'expiring' && days != null) {
        statusLabel = `${badge.label} (${days}d)`;
      }
      if (badge.status === 'expired' && days != null) {
        statusLabel = `Expired (${Math.abs(days)}d)`;
      }
      rows.push({
        id: `${member.id}-${document.toLowerCase().replace(/\s+/g, '-')}`,
        crewId: member.id,
        crewName,
        document,
        type,
        expiry: formatDate(expiryRaw),
        daysUntil: days,
        status: badge.status,
        statusLabel,
        statusClassName: badge.className,
      });
    };

    if (member.passport?.expiry_date || member.passport?.passport_number) {
      pushRow('Passport', 'Identity', member.passport.expiry_date);
    }

    if (member.identity?.expiry_date || member.identity?.identity_number) {
      pushRow(member.identity.identity_type || 'Identity Document', 'Identity', member.identity.expiry_date);
    }

    const crewCertExpiry = member.certificate_expiry_date || member.crew_certificate?.expiry_date;
    if (crewCertExpiry || member.certificate_issue_date || member.crew_certificate?.issue_date) {
      pushRow('Crew Certificate', 'STCW', crewCertExpiry);
    }

    if (member.visa_expiry_date || member.visa) {
      pushRow('Visa', member.visa_country || 'Travel', member.visa_expiry_date);
    }
  }

  return rows.sort((a, b) => {
    const priority = (s: CertStatus) => (s === 'expired' ? 0 : s === 'expiring' ? 1 : s === 'missing' ? 2 : 3);
    const diff = priority(a.status) - priority(b.status);
    if (diff !== 0) return diff;
    if (a.daysUntil != null && b.daysUntil != null) return a.daysUntil - b.daysUntil;
    return a.crewName.localeCompare(b.crewName);
  });
}

function matchesDocType(row: CertRow, filter: DocTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'Identity') return row.type === 'Identity';
  return row.document === filter;
}

const DocumentsCertsPage = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [certFilter, setCertFilter] = useState<CertFilter>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    getCrewList()
      .then((res) => {
        if (!cancelled) {
          setCrew(res.crew ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load crew certifications');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const certRows = useMemo(() => buildCertRows(crew), [crew]);

  const counts = useMemo(() => ({
    all: certRows.length,
    attention: certRows.filter((row) => row.status === 'expiring' || row.status === 'expired').length,
    valid: certRows.filter((row) => row.status === 'valid').length,
    passport: certRows.filter((row) => row.document === 'Passport').length,
    identity: certRows.filter((row) => row.type === 'Identity').length,
    stcw: certRows.filter((row) => row.document === 'Crew Certificate').length,
    visa: certRows.filter((row) => row.document === 'Visa').length,
  }), [certRows]);

  const filteredRows = useMemo(() => {
    let list = certRows;
    if (certFilter === 'attention') {
      list = list.filter((row) => row.status === 'expiring' || row.status === 'expired');
    } else if (certFilter === 'valid') {
      list = list.filter((row) => row.status === 'valid');
    }
    list = list.filter((row) => matchesDocType(row, docTypeFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (row) =>
          row.crewName.toLowerCase().includes(q) ||
          row.document.toLowerCase().includes(q) ||
          row.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [certRows, certFilter, docTypeFilter, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const watchlistRows = useMemo(
    () => certRows.filter((row) => row.status === 'expired' || row.status === 'expiring').slice(0, 6),
    [certRows]
  );

  const setCertFilterAndReset = useCallback((filter: CertFilter) => {
    setCertFilter(filter);
    setPage(1);
  }, []);

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="documents" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Documents & Certs</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search crew, documents..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Overview</div>
          <button
            type="button"
            className={`subsea-sb-link${certFilter === 'all' ? ' active' : ''}`}
            onClick={() => setCertFilterAndReset('all')}
          >
            <BadgeCheck size={13} /> All Certifications <span className="subsea-sb-count">{loading ? '...' : counts.all}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${certFilter === 'attention' ? ' active' : ''}`}
            onClick={() => setCertFilterAndReset('attention')}
          >
            <AlertTriangle size={13} /> Needs Attention <span className="subsea-sb-count subsea-sb-count-red">{loading ? '...' : counts.attention}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${certFilter === 'valid' ? ' active' : ''}`}
            onClick={() => setCertFilterAndReset('valid')}
          >
            <ShieldCheck size={13} /> Valid <span className="subsea-sb-count">{loading ? '...' : counts.valid}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <button
            type="button"
            className="subsea-btn subsea-btn-default subsea-btn-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={12} className="mr-1.5" /> Back
          </button>
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Documents & Certificates</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Documents & Certificates</h1>
              <p>
                {loading
                  ? 'Loading certifications...'
                  : `${crew.length} crew members · ${certRows.length} documents · ${counts.attention} need attention`}
              </p>
            </div>
            <div className="subsea-ph-right">
              <button
                type="button"
                className="subsea-btn subsea-btn-default subsea-btn-sm"
                onClick={() => setCertFilterAndReset('attention')}
                disabled={counts.attention === 0}
              >
                <AlertTriangle size={11} /> Review alerts
              </button>
            </div>
          </div>

          {!loading && counts.attention > 0 && (
            <div className="subsea-alert subsea-alert-warn docs-cert-alert">
              <AlertTriangle size={15} />
              <span>
                <strong>{counts.attention} certification{counts.attention !== 1 ? 's' : ''} need attention</strong> — expired or expiring within 30 days.
              </span>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => setCertFilterAndReset('attention')}>
                View all
              </button>
            </div>
          )}

          <section className="subsea-kpi-strip subsea-kpi-strip-4">
            {[
              { id: 'all' as const, label: 'Total Documents', value: counts.all, meta: 'Across all crew', tone: 'flat', bar: '60%', color: 'blue' },
              { id: 'valid' as const, label: 'Valid', value: counts.valid, meta: 'Current certifications', tone: 'up', bar: `${counts.all ? Math.round((counts.valid / counts.all) * 100) : 0}%`, color: 'green' },
              { id: 'attention' as const, label: 'Needs Attention', value: counts.attention, meta: 'Expired or expiring', tone: counts.attention ? 'down' : 'flat', bar: `${counts.all ? Math.round((counts.attention / counts.all) * 100) : 0}%`, color: 'red' },
              { id: 'all' as const, label: 'Crew Members', value: crew.length, meta: 'With tracked documents', tone: 'flat', bar: '50%', color: 'teal', static: true },
            ].map((kpi) => (
              <article
                key={kpi.label}
                className={`subsea-kpi docs-cert-kpi-clickable${!kpi.static && certFilter === kpi.id ? ' active' : ''}`}
                onClick={() => !kpi.static && setCertFilterAndReset(kpi.id)}
                onKeyDown={(e) => {
                  if (!kpi.static && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setCertFilterAndReset(kpi.id);
                  }
                }}
                role={kpi.static ? undefined : 'button'}
                tabIndex={kpi.static ? undefined : 0}
              >
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{loading ? '...' : String(kpi.value)}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>{kpi.meta}</div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          <div className="subsea-toolbar-row docs-cert-toolbar">
            <div className="subsea-tb-search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search by crew name or document..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="subsea-filter-wrap">
              <span className="subsea-filter-label">Document</span>
              <select
                className="subsea-filter-select"
                value={docTypeFilter}
                onChange={(e) => {
                  setDocTypeFilter(e.target.value as DocTypeFilter);
                  setPage(1);
                }}
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="subsea-filter-chevron" />
            </div>
          </div>

          <div className="docs-cert-filter-chips docs-cert-toolbar" role="group" aria-label="Filter by status">
            {([
              { id: 'all' as const, label: 'All', count: counts.all },
              { id: 'attention' as const, label: 'Needs attention', count: counts.attention },
              { id: 'valid' as const, label: 'Valid', count: counts.valid },
            ]).map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`docs-cert-chip${certFilter === chip.id ? ' active' : ''}`}
                onClick={() => setCertFilterAndReset(chip.id)}
              >
                {chip.label}
                <span className="docs-cert-chip-count">{loading ? '…' : chip.count}</span>
              </button>
            ))}
          </div>

          <div className="docs-cert-legend" role="list" aria-label="Certificate status legend">
            <span className="docs-cert-legend-item" role="listitem"><span className="subsea-badge subsea-b-green">Valid</span> More than 30 days</span>
            <span className="docs-cert-legend-item" role="listitem"><span className="subsea-badge subsea-b-amber">Expiring</span> Within 30 days</span>
            <span className="docs-cert-legend-item" role="listitem"><span className="subsea-badge subsea-b-red">Critical</span> Within 7 days or expired</span>
          </div>

          <div className="subsea-g2 docs-cert-layout">
            <div className="subsea-pane">
              <div className="subsea-pane-head">
                <div>
                  <div className="subsea-pane-title">
                    {certFilter === 'attention' ? 'Certificates Needing Attention' : certFilter === 'valid' ? 'Valid Certificates' : 'All Crew Certifications'}
                  </div>
                  <div className="subsea-pane-sub">{loading ? 'Loading...' : `${filteredRows.length} records`}</div>
                </div>
              </div>
              <div className="subsea-table-wrap">
                {loading ? (
                  <div className="subsea-state">Loading certifications...</div>
                ) : error ? (
                  <div className="subsea-state subsea-state-error" role="alert">{error}</div>
                ) : filteredRows.length === 0 ? (
                  <div className="subsea-empty-panel">
                    <BadgeCheck size={34} />
                    <h3>No records match your filters</h3>
                    <p>Try clearing search or switching to another certification filter.</p>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => {
                      setSearch('');
                      setCertFilterAndReset('all');
                      setDocTypeFilter('all');
                    }}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <table className="subsea-table docs-cert-table">
                    <thead>
                      <tr>
                        <th>Crew Member</th>
                        <th>Document</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={row.id} onClick={() => navigate(`/crew/${row.crewId}`)}>
                          <td className="strong">
                            <div className="subsea-roster-name">
                              <div className={`subsea-c-av subsea-c-av-${index % 6}`}>{getInitials(row.crewName)}</div>
                              <span>{row.crewName}</span>
                            </div>
                          </td>
                          <td>
                            <div className="docs-cert-doc-cell">
                              <DocIcon document={row.document} type={row.type} />
                              <div>
                                <div>{row.document}</div>
                                <div className="subsea-pane-sub">{row.type}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="docs-cert-expiry-cell">
                              <span className="docs-cert-expiry-date">{row.expiry}</span>
                              <span className={`docs-cert-expiry-relative${row.status === 'expired' || (row.daysUntil != null && row.daysUntil <= 7) ? ' urgent' : ''}`}>
                                {expiryRelativeLabel(row.daysUntil, row.status)}
                              </span>
                              {row.daysUntil != null && row.status !== 'valid' && (
                                <div className="docs-cert-expiry-bar" aria-hidden>
                                  <div
                                    className={`docs-cert-expiry-fill ${expiryBarColor(row.status, row.daysUntil)}`}
                                    style={{ width: `${expiryBarPct(row.daysUntil)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td><span className={`subsea-badge ${row.statusClassName}`}>{row.statusLabel}</span></td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate(`/crew/${row.crewId}`)}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {filteredRows.length > PAGE_SIZE && (
                <div className="subsea-pagination">
                  <span className="subsea-pagination-info">
                    Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                  </span>
                  <div className="subsea-pagination-btns">
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`subsea-pagination-btn${p === page ? ' active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                  </div>
                </div>
              )}
            </div>

            <div className="subsea-pane">
              <div className="subsea-pane-head">
                <div className="subsea-pane-title">Cert Expiry Watchlist</div>
                <span className="subsea-badge subsea-b-red">{loading ? '...' : watchlistRows.length}</span>
              </div>
              <div className="docs-cert-watchlist">
                {loading ? (
                  <div className="subsea-state">Loading...</div>
                ) : watchlistRows.length === 0 ? (
                  <div className="subsea-empty-cell">All certifications are current.</div>
                ) : (
                  watchlistRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="docs-cert-watch-row"
                      onClick={() => navigate(`/crew/${row.crewId}`)}
                    >
                      <span className={`subsea-badge ${row.statusClassName}`}>
                        {row.daysUntil != null && row.daysUntil >= 0 ? `${row.daysUntil}d` : '!' }
                      </span>
                      <span>
                        <div className="docs-cert-watch-name">{row.crewName}</div>
                        <div className="docs-cert-watch-doc">{row.document} · {row.expiry}</div>
                      </span>
                      <span className={`subsea-badge ${row.statusClassName}`}>{row.statusLabel}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocumentsCertsPage;
