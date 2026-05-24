import { useCallback, useEffect, useMemo, useState } from 'react';
import { Anchor, Plus, Search } from 'lucide-react';
import Modal from '../components/Modal';
import { createRig, getRigs, type CreateRigPayload, type RigApi } from '../api/rig';
import './ProjectsPage.css';

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

const RigsPage = () => {
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
        (rig.description || '').toLowerCase().includes(q)
    );
  }, [rigs, search]);

  const paginatedRigs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRigs.slice(start, start + pageSize);
  }, [filteredRigs, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRigs.length / pageSize));

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
    const description = (formData.get('description') as string)?.trim() ?? '';
    if (!name) return;

    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload: CreateRigPayload = {
        name,
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
    <div className="projects-page">
      <div className="projects-page-header">
        <div>
          <h1 className="projects-page-title">Rigs</h1>
          <p className="projects-page-subtitle">
            Create and manage rigs used when assigning crew flight tickets.
            {loading ? '' : ` ${rigs.length} rig${rigs.length !== 1 ? 's' : ''} total.`}
          </p>
        </div>
        <button type="button" className="projects-page-create-btn" onClick={openCreateModal}>
          <Plus size={18} />
          Create rig
        </button>
      </div>

      <div className="projects-stat-cards">
        <div className="projects-stat-card">
          <div className="projects-stat-icon projects-stat-blue">
            <Anchor size={24} />
          </div>
          <span className="projects-stat-value">{loading ? '…' : rigs.length}</span>
          <span className="projects-stat-label">TOTAL RIGS</span>
        </div>
      </div>

      <div className="projects-filters">
        <div className="projects-search-wrap">
          <Search size={18} className="projects-search-icon" />
          <input
            type="text"
            placeholder="Search rigs..."
            className="projects-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="projects-page-loading" role="status">Loading rigs…</div>
      ) : error ? (
        <div className="projects-page-error" role="alert">{error}</div>
      ) : paginatedRigs.length === 0 ? (
        <div className="projects-page-empty">
          <Anchor size={48} className="projects-page-empty-icon" />
          <p>No rigs yet.</p>
          <button type="button" className="projects-page-create-btn projects-page-create-inline" onClick={openCreateModal}>
            <Plus size={18} />
            Create rig
          </button>
        </div>
      ) : (
        <>
          <div className="projects-card-grid">
            {paginatedRigs.map((rig) => (
              <article key={rig.id} className="project-card">
                <div className="project-card-header">
                  <h3 className="project-card-title">{rig.name}</h3>
                </div>
                {rig.description && (
                  <p className="project-card-description">{rig.description}</p>
                )}
                <div className="project-card-meta">
                  <span className="project-card-meta-item">
                    <Anchor size={14} />
                    Created {formatDate(rig.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {filteredRigs.length > pageSize && (
            <div className="projects-pagination">
              <span className="projects-pagination-info">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRigs.length)} of {filteredRigs.length} rigs
              </span>
              <div className="projects-pagination-btns">
                <button
                  type="button"
                  className="projects-pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`projects-pagination-btn ${p === page ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="projects-pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <footer className="projects-footer">
        <p className="projects-footer-copy">© 2023 Offshore CRM. All rights reserved.</p>
        <nav className="projects-footer-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/security">Security Audit Logs</a>
        </nav>
        <p className="projects-footer-status">• All Systems Operational</p>
      </footer>

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create rig" size="medium">
        {createError && (
          <div className="projects-page-form-error" role="alert">{createError}</div>
        )}
        <form className="projects-page-create-form" onSubmit={handleCreateRig}>
          <div className="projects-page-form-field">
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
          <div className="projects-page-form-field">
            <label htmlFor="rig-description">Description</label>
            <textarea
              id="rig-description"
              name="description"
              rows={3}
              placeholder="Optional details about this rig..."
              disabled={createLoading}
            />
          </div>
          <div className="projects-page-form-actions">
            <button type="button" className="projects-page-form-cancel" onClick={closeCreateModal} disabled={createLoading}>
              Cancel
            </button>
            <button type="submit" className="projects-page-form-submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create rig'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RigsPage;
