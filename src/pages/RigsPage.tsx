import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Download,
  Filter,
  Plus,
  Search,
  Ship,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
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
const rigRegions = ['Red Sea', 'North Sea', 'Norwegian Sea', 'Gulf of Mexico', 'Barents Sea', 'Persian Gulf'];

function getRigType(rig: RigApi, index: number): string {
  const fromDescription = rig.description?.split('·')[0]?.trim();
  return fromDescription || rigTypes[index % rigTypes.length];
}

function getRigRegion(rig: RigApi, index: number): string {
  const fromDescription = rig.description?.split('·')[1]?.trim();
  return fromDescription || rigRegions[index % rigRegions.length];
}

function getRigStatus(rig: RigApi): { label: string; className: string } {
  const now = Date.now();
  const createdAt = rig.createdAt ? new Date(rig.createdAt).getTime() : 0;
  const updatedAt = rig.updatedAt ? new Date(rig.updatedAt).getTime() : createdAt;
  const daysSinceUpdate = updatedAt ? (now - updatedAt) / (1000 * 60 * 60 * 24) : Infinity;

  if (createdAt && now - createdAt < 14 * 24 * 60 * 60 * 1000) {
    return { label: 'New', className: 'subsea-b-teal' };
  }
  if (daysSinceUpdate > 45) {
    return { label: 'In Transit', className: 'subsea-b-amber' };
  }
  return { label: 'Operational', className: 'subsea-b-green' };
}

function computeFleetStats(rigs: RigApi[]) {
  const types = new Set<string>();
  const regions = new Map<string, number>();
  let operational = 0;
  let addedThisYear = 0;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();

  rigs.forEach((rig, index) => {
    const type = getRigType(rig, index);
    const region = getRigRegion(rig, index);
    types.add(type);
    regions.set(region, (regions.get(region) ?? 0) + 1);

    const status = getRigStatus(rig);
    if (status.label === 'Operational' || status.label === 'New') operational += 1;

    const createdAt = rig.createdAt ? new Date(rig.createdAt).getTime() : 0;
    if (createdAt >= yearStart) addedThisYear += 1;
  });

  const topRegion = [...regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const operationalPct = rigs.length ? Math.round((operational / rigs.length) * 100) : 0;

  return {
    typeCount: types.size,
    regionCount: regions.size,
    operational,
    operationalPct,
    addedThisYear,
    topRegion,
  };
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

  const fleetStats = useMemo(() => computeFleetStats(rigs), [rigs]);

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
      setCreateError(err instanceof Error ? err.message : 'Failed to Create Rig');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="rigs" />

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
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Rig Fleet</h1>
              <p>
                {loading
                  ? 'Loading rigs...'
                  : `${rigs.length} rigs · ${fleetStats.typeCount} rig types · ${fleetStats.regionCount} operating regions`}
              </p>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={11} /> Add Rig
              </button>
            </div>
          </div>

          <section className="subsea-kpi-strip subsea-kpi-strip-2">
            {[
              {
                label: 'Total Rigs',
                value: loading ? '...' : String(rigs.length),
                meta: fleetStats.addedThisYear
                  ? `${fleetStats.addedThisYear} added this year`
                  : 'No new rigs this year',
                tone: fleetStats.addedThisYear ? 'up' : 'flat',
                bar: rigs.length ? `${Math.min(100, Math.round((rigs.length / Math.max(rigs.length, 10)) * 100))}%` : '0%',
                color: 'blue',
              },
              {
                label: 'Operational',
                value: loading ? '...' : String(fleetStats.operational),
                meta: rigs.length
                  ? `${fleetStats.operationalPct}% of fleet · top region: ${fleetStats.topRegion}`
                  : 'No rigs loaded',
                tone: 'flat',
                bar: `${fleetStats.operationalPct}%`,
                color: 'green',
              },
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
                <Plus size={12} /> Create Rig
              </button>
            </div>
          ) : (
            <>
              <div className="subsea-rig-grid">
                {paginatedRigs.map((rig, index) => {
                  const status = getRigStatus(rig);
                  return (
                    <article
                      key={rig.id}
                      className="subsea-rig-card"
                      onClick={() => navigate(`/rig/${rig.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/rig/${rig.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${rig.name}`}
                    >
                      <div className="subsea-rig-top">
                        <div className={`subsea-rig-icon subsea-rig-icon-${index % 4}`}>
                          <Ship size={18} />
                        </div>
                        <div>
                          <div className="subsea-rig-name">{rig.name}</div>
                          <div className="subsea-rig-type">{getRigType(rig, index)} · {getRigRegion(rig, index)}</div>
                        </div>
                        <div className="subsea-rig-status">
                          <span className={`subsea-badge ${status.className}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="subsea-rig-body">
                        <div className="subsea-rig-row">
                          <span className="subsea-rig-row-label">Position</span>
                          <span className="subsea-rig-row-val mono">{rig.address || 'No position'}</span>
                        </div>
                        <div className="subsea-rig-row">
                          <span className="subsea-rig-row-label">Last Updated</span>
                          <span className="subsea-rig-row-val">{formatDate(rig.updatedAt ?? rig.createdAt)}</span>
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

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create Rig" size="medium" variant="subsea">
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
              {createLoading ? 'Creating...' : 'Create Rig'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RigsPage;
