import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Filter,
  Search,
} from 'lucide-react';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { getSignedContracts, type SignedProjectContract } from '../lib/contractsStore';
import './RigsPage.css';
import './ContractsPage.css';

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

const ContractsPage = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<SignedProjectContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadContracts = useCallback(() => {
    setLoading(true);
    setContracts(getSignedContracts());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'offshore-contracts-signed' || e.key === 'offshore-contract-pending') {
        loadContracts();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadContracts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.crewName.toLowerCase().includes(q) ||
        c.projectTitle.toLowerCase().includes(q) ||
        c.crewId.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="contracts" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Contracts</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search crew, projects..."
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
          <button type="button" className="subsea-sb-link active">
            <FileText size={13} /> Signed Contracts{' '}
            <span className="subsea-sb-count">{loading ? '…' : contracts.length}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Contracts</span>
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
              <h1>Project Contracts</h1>
              <p>Crew members who accepted and signed their project assignment contract</p>
            </div>
          </div>

          <div className="subsea-proj-kpi-strip">
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Signed Contracts</div>
              <div className="subsea-kpi-value">{loading ? '…' : contracts.length}</div>
              <div className="subsea-kpi-meta flat">Accepted via crew panel</div>
            </div>
          </div>

          <div className="subsea-pane">
            <div className="subsea-pane-head">
              <div className="subsea-pane-title">Active Signed Contracts</div>
            </div>
            <div className="subsea-table-wrap">
              <table className="subsea-table">
                <thead>
                  <tr>
                    <th>Crew Member</th>
                    <th>Project Contract</th>
                    <th>Contract End Date</th>
                    <th>Signed On</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="subsea-table-empty">
                        Loading contracts…
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="subsea-table-empty">
                        {contracts.length === 0
                          ? 'No signed contracts yet. Invite crew to a project; they will appear here after accepting and signing in the crew panel.'
                          : 'No contracts match your search.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button
                            type="button"
                            className="subsea-link-btn"
                            onClick={() => navigate(`/crew/${row.crewId}`)}
                          >
                            {row.crewName}
                          </button>
                        </td>
                        <td>{row.projectTitle}</td>
                        <td>{formatDate(row.contractEndDate)}</td>
                        <td>
                          <span className="contracts-signed-date">{formatDate(row.signedAt)}</span>
                        </td>
                        <td>
                          <span className="contracts-status-badge">Signed</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > pageSize && (
              <div className="subsea-pagination">
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContractsPage;
