import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { createRig, getRigs, type CreateRigPayload, type RigApi } from '../api/rig';
import './RigsPage.css';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

const rigTypes = ['FPSO', 'DSV', 'PSV', 'OSV', 'CSV', 'Jack-up'];
const rigRegions = ['Red Sea', 'North Sea', 'Norwegian Sea', 'Gulf of Mexico', 'Barents Sea', 'Dry Dock'];

function getRigType(rig: RigApi, index: number): string {
  const fromDescription = rig.description?.split('·')[0]?.trim();
  return fromDescription || rigTypes[index % rigTypes.length];
}

function getRigRegion(rig: RigApi, index: number): string {
  const fromDescription = rig.description?.split('·')[1]?.trim();
  return fromDescription || rigRegions[index % rigRegions.length];
}

function getRigStatus(index: number): { label: string; className: string; crew: string; fill: number; color: string } {
  if (index === 0) {
    return { label: 'Understaffed', className: 'subsea-b-amber', crew: '18 / 22', fill: 82, color: 'var(--amber)' };
  }
  if (index === 5) {
    return { label: 'Dry Dock', className: 'subsea-b-gray', crew: '4 / 18', fill: 22, color: 'var(--text-tertiary)' };
  }
  if (index === 3) {
    return { label: 'In Transit', className: 'subsea-b-teal', crew: '14 / 14', fill: 100, color: 'var(--green)' };
  }
  return { label: 'Full Crew', className: 'subsea-b-green', crew: '24 / 24', fill: 100, color: 'var(--green)' };
}

const RigsPage = () => {
  const navigate = useNavigate();
  const [rigs, setRigs] = useState<RigApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const pageSize = 6;

  const fetchRigs = useCallback(() => {
    getRigs()
      .then((res) => setRigs(res.rigs ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load rigs'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRigs()
      .then((res) => {
        if (!cancelled) setRigs(res.rigs ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load rigs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRigs = useMemo(() => {
    if (!search.trim()) return rigs;
    const q = search.trim().toLowerCase();
    return rigs.filter(
      (rig) =>
        (rig.name || '').toLowerCase().includes(q) ||
        (rig.address || '').toLowerCase().includes(q) ||
        (rig.description || '').toLowerCase().includes(q)
    );
  }, [rigs, search]);

  const paginatedRigs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRigs.slice(start, start + pageSize);
  }, [filteredRigs, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRigs.length / pageSize));
  const operationalCount = Math.max(0, rigs.length - (rigs.length > 0 ? 1 : 0));

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setCreateError(null);
  };

  const closeCreateModal = () => {
    if (!createLoading) {
      setIsCreateModalOpen(false);
      setCreateError(null);
    }
  };

  const handleCreateRig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string)?.trim() ?? '';
    const address = (formData.get('address') as string)?.trim() ?? '';
    const description = (formData.get('description') as string)?.trim() ?? '';
    if (!name || !address) return;

    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload: CreateRigPayload = {
        name,
        address,
        ...(description ? { description } : {}),
      };
      await createRig(payload);
      fetchRigs();
      closeCreateModal();
      form.reset();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create rig');
    } finally {
      setCreateLoading(false);
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
            { icon: Ship, label: 'Vessels', path: '/rig' },
            { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
            { icon: Wallet, label: 'Payroll' },
            { icon: FileText, label: 'Contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Rigs', path: '/rig', active: true },
            { icon: CalendarDays, label: 'Timeline & Calendar' },
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
          <div className="subsea-avatar">SK</div>
        </div>
      </nav>

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Rig Fleet</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search rigs, regions..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Fleet</div>
          <button type="button" className="subsea-sb-link active">
            <Anchor size={13} /> All Rigs <span className="subsea-sb-count">{loading ? '...' : rigs.length}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Ship size={13} /> Fully Crewed <span className="subsea-sb-count">{operationalCount}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Users size={13} /> Understaffed <span className="subsea-sb-count subsea-sb-count-red">{rigs.length > 0 ? 1 : 0}</span>
          </button>
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link">
            <Radio size={13} /> Live Positions
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/projects')}>
            <ShieldCheck size={13} /> Compliance
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Rig Fleet</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
              <Plus size={12} /> Add Rig
            </button>
            <span className="subsea-vr" />
            <div className="subsea-avatar subsea-avatar-sm">SK</div>
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Rig Fleet</h1>
              <p>{loading ? 'Loading rigs...' : `${rigs.length} rigs · 4 rig types · 6 operating regions`}</p>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={11} /> Add Rig
              </button>
            </div>
          </div>

          <section className="subsea-kpi-strip subsea-kpi-strip-4">
            {[
              { label: 'Total Rigs', value: loading ? '...' : String(rigs.length), meta: '2 added this year', tone: 'up', bar: '60%', color: 'blue' },
              { label: 'Fully Crewed', value: loading ? '...' : String(operationalCount), meta: rigs.length ? `${Math.round((operationalCount / rigs.length) * 100)}% of fleet` : 'No active rigs', tone: 'flat', bar: rigs.length ? `${Math.round((operationalCount / rigs.length) * 100)}%` : '0%', color: 'green' },
              { label: 'Understaffed', value: loading ? '...' : String(rigs.length > 0 ? 1 : 0), meta: 'Needs urgent fill', tone: 'down', bar: rigs.length ? '9%' : '0%', color: 'red' },
              { label: 'In Dry Dock', value: loading ? '...' : String(rigs.length > 5 ? 1 : 0), meta: rigs.length > 5 ? paginatedRigs[5]?.name ?? 'Scheduled' : 'No dry dock', tone: 'flat', bar: rigs.length > 5 ? '9%' : '0%', color: 'amber' },
            ].map((kpi) => (
              <article key={kpi.label} className="subsea-kpi">
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{kpi.value}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>{kpi.meta}</div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          <div className="subsea-toolbar-row">
            <div className="subsea-tb-search">
              <Search size={13} />
              <input
                value={search}
                placeholder="Search rigs..."
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">All Types</button>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">All Regions</button>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">Status: All</button>
          </div>

          {loading ? (
            <div className="subsea-state">Loading rigs...</div>
          ) : error ? (
            <div className="subsea-state subsea-state-error" role="alert">{error}</div>
          ) : paginatedRigs.length === 0 ? (
            <div className="subsea-empty-panel">
              <Anchor size={42} />
              <p>No rigs found.</p>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={12} /> Create rig
              </button>
            </div>
          ) : (
            <>
              <div className="subsea-vessel-grid">
                {paginatedRigs.map((rig, index) => {
                  const status = getRigStatus(index);
                  return (
                    <article key={rig.id} className="subsea-vessel-card">
                      <div className="subsea-vessel-top">
                        <div className={`subsea-vessel-icon subsea-vessel-icon-${index % 4}`}>
                          <Ship size={18} />
                        </div>
                        <div>
                          <div className="subsea-vessel-name">{rig.name}</div>
                          <div className="subsea-vessel-type">{getRigType(rig, index)} · {getRigRegion(rig, index)}</div>
                        </div>
                        <div className="subsea-vessel-status">
                          <span className={`subsea-badge ${status.className}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="subsea-vessel-body">
                        <div className="subsea-vessel-row">
                          <span className="subsea-vessel-row-label">Crew</span>
                          <span className={index === 0 ? 'subsea-vessel-row-val danger' : 'subsea-vessel-row-val success'}>{status.crew}</span>
                        </div>
                        <div className="subsea-vessel-row">
                          <span className="subsea-vessel-row-label">Position</span>
                          <span className="subsea-vessel-row-val mono">{rig.address || 'No position'}</span>
                        </div>
                        <div className="subsea-vessel-row">
                          <span className="subsea-vessel-row-label">Next Port</span>
                          <span className="subsea-vessel-row-val">{index === 0 ? 'Djibouti · Jun 3' : `Created ${formatDate(rig.createdAt)}`}</span>
                        </div>
                        <div className="subsea-vessel-row">
                          <span className="subsea-vessel-row-label">Crew fill</span>
                          <div className="subsea-vessel-progress">
                            <div className="subsea-prog-bar">
                              <div className="subsea-prog-fill" style={{ width: `${status.fill}%`, background: status.color }} />
                            </div>
                          </div>
                          <span className="subsea-vessel-pct" style={{ color: status.color }}>{status.fill}%</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredRigs.length > pageSize && (
                <div className="subsea-pagination">
                  <span>
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRigs.length)} of {filteredRigs.length} rigs
                  </span>
                  <div>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} type="button" className={`subsea-btn subsea-btn-sm ${p === page ? 'subsea-btn-primary' : 'subsea-btn-default'}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create rig" size="medium">
        {createError && (
          <div className="subsea-form-error" role="alert">{createError}</div>
        )}
        <form className="subsea-create-form" onSubmit={handleCreateRig}>
          <div className="subsea-form-field">
            <label htmlFor="rig-name">Name</label>
            <input
              id="rig-name"
              name="name"
              type="text"
              placeholder="e.g. Deepwater Horizon"
              required
              disabled={createLoading}
            />
          </div>
          <div className="subsea-form-field">
            <label htmlFor="rig-address">Address</label>
            <input
              id="rig-address"
              name="address"
              type="text"
              placeholder="e.g. Port Fourchon, Louisiana"
              required
              disabled={createLoading}
            />
          </div>
          <div className="subsea-form-field">
            <label htmlFor="rig-description">Description</label>
            <textarea
              id="rig-description"
              name="description"
              rows={3}
              placeholder="Optional details about this rig..."
              disabled={createLoading}
            />
          </div>
          <div className="subsea-form-actions">
            <button type="button" className="subsea-form-cancel" onClick={closeCreateModal} disabled={createLoading}>
              Cancel
            </button>
            <button type="submit" className="subsea-form-submit" disabled={createLoading}>
              {createLoading ? 'Creating...' : 'Create rig'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RigsPage;
