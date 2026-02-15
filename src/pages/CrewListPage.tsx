import { useState, useEffect, useMemo } from 'react';
import { Search, Pencil, Trash2, MoreVertical, Users, UserPlus, UserCheck, RefreshCw } from 'lucide-react';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import Modal from '../components/Modal';
import CrewMemberForm, { type CrewMemberFormData } from '../components/forms/CrewMemberForm';
import { createCrewMember } from '../api/crew';
import './CrewListPage.css';

function getInitials(firstname: string, lastname: string): string {
  const f = (firstname || '').trim().charAt(0) || '';
  const l = (lastname || '').trim().charAt(0) || '';
  return (f + l).toUpperCase() || '?';
}

const CrewListPage = () => {
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const pageSize = 5;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCrewList()
      .then((res) => {
        if (!cancelled) setCrew(res.crew ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load crew');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredCrew = useMemo(() => {
    let list = crew;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.firstname + ' ' + c.lastname).toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [crew, search]);

  const paginatedCrew = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCrew.slice(start, start + pageSize);
  }, [filteredCrew, page]);

  const totalPages = Math.max(1, Math.ceil(filteredCrew.length / pageSize));

  const handleAddCrewMember = () => {
    setIsAddModalOpen(true);
    setAddError(null);
  };

  const handleCloseAddModal = () => {
    if (!addLoading) {
      setIsAddModalOpen(false);
      setAddError(null);
    }
  };

  const handleSubmitCrewMember = async (data: CrewMemberFormData) => {
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await createCrewMember(data);
      if (!res.ok) {
        const text = await res.text();
        let msg = `Request failed (${res.status})`;
        if (text) {
          try {
            const j = JSON.parse(text);
            msg = j?.message || j?.error || msg;
          } catch {
            msg = text;
          }
          setAddError(msg);
          return;
        }
      }
      handleCloseAddModal();
      const list = await getCrewList();
      setCrew(list.crew ?? []);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add crew member');
    } finally {
      setAddLoading(false);
    }
  };

  const activeCount = crew.length; // All crew treated as active for now

  return (
    <div className="user-mgmt-page">
      <div className="user-mgmt-header">
        <div>
          <h1 className="user-mgmt-title">Crew</h1>
          <p className="user-mgmt-subtitle">View and manage all crew members. {crew.length} member{crew.length !== 1 ? 's' : ''} total.</p>
        </div>
        <button type="button" className="user-mgmt-add-btn" onClick={handleAddCrewMember}>
          <UserPlus size={18} />
          Add crew member
        </button>
      </div>

      <div className="user-mgmt-cards">
        <div className="user-mgmt-stat-card">
          <div className="user-mgmt-stat-icon user-mgmt-stat-blue">
            <Users size={24} />
          </div>
          <span className="user-mgmt-stat-value">{loading ? '…' : crew.length}</span>
          <span className="user-mgmt-stat-label">TOTAL CREWS</span>
        </div>
        <div className="user-mgmt-stat-card">
          <div className="user-mgmt-stat-icon user-mgmt-stat-green">
            <UserCheck size={24} />
          </div>
          <span className="user-mgmt-stat-value">{loading ? '…' : activeCount}</span>
          <span className="user-mgmt-stat-label">ACTIVE</span>
        </div>
        <div className="user-mgmt-stat-card">
          <div className="user-mgmt-stat-icon user-mgmt-stat-purple">
            <Users size={24} />
          </div>
          <span className="user-mgmt-stat-value">—</span>
          <span className="user-mgmt-stat-label">ON ASSIGNMENT</span>
        </div>
        <div className="user-mgmt-stat-card">
          <div className="user-mgmt-stat-icon user-mgmt-stat-teal">
            <UserPlus size={24} />
          </div>
          <span className="user-mgmt-stat-value">—</span>
          <span className="user-mgmt-stat-label">AVAILABLE</span>
        </div>
      </div>

      <div className="user-mgmt-filters">
        <div className="user-mgmt-search-wrap">
          <Search size={18} className="user-mgmt-search-icon" />
          <input
            type="text"
            placeholder="Search crew by name or email..."
            className="user-mgmt-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="user-mgmt-table-wrap">
        {loading ? (
          <div className="user-mgmt-loading">Loading users…</div>
        ) : error ? (
          <div className="user-mgmt-error" role="alert">{error}</div>
        ) : (
          <table className="user-mgmt-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>ADDRESS</th>
                <th>CITY</th>
                <th>COUNTRY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCrew.length === 0 ? (
                <tr>
                  <td colSpan={7} className="user-mgmt-empty-cell">
                    No crew members found.
                  </td>
                </tr>
              ) : (
                paginatedCrew.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="user-mgmt-user-cell">
                        <div className="user-mgmt-avatar">
                          {getInitials(member.firstname, member.lastname)}
                        </div>
                        <span className="user-mgmt-name">
                          {member.firstname} {member.lastname}
                        </span>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>{member.phone || '—'}</td>
                    <td>{member.address || '—'}</td>
                    <td>{member.city || '—'}</td>
                    <td>{member.country || '—'}</td>
                    <td>
                      <div className="user-mgmt-actions">
                        <button type="button" className="user-mgmt-action-btn" aria-label="Edit">
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="user-mgmt-action-btn" aria-label="Delete">
                          <Trash2 size={16} />
                        </button>
                        <button type="button" className="user-mgmt-action-btn" aria-label="More">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filteredCrew.length > 0 && (
        <div className="user-mgmt-pagination">
          <span className="user-mgmt-pagination-info">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredCrew.length)} of {filteredCrew.length} crew members
          </span>
          <div className="user-mgmt-pagination-btns">
            <button
              type="button"
              className="user-mgmt-pagination-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`user-mgmt-pagination-btn ${p === page ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="user-mgmt-pagination-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <button type="button" className="user-mgmt-switch-view" aria-label="Switch view">
        <RefreshCw size={18} />
        Switch View
      </button>

      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal} title="Add New Crew Member" size="xlarge">
        {addError && (
          <div className="form-error-message" role="alert">{addError}</div>
        )}
        <CrewMemberForm
          onSubmit={handleSubmitCrewMember}
          onCancel={handleCloseAddModal}
          isLoading={addLoading}
        />
      </Modal>
    </div>
  );
};

export default CrewListPage;
