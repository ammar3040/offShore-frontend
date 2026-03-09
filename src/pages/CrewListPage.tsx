import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Pencil, Trash2, MoreVertical, Users, UserPlus, UserCheck, Send, User, Mail, MapPin, FileText, CreditCard } from 'lucide-react';
import { getCrewList, createCrewMember, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import Modal from '../components/Modal';
import ErrorAlertPopup from '../components/ErrorAlertPopup';
import CrewMemberForm, { type CrewMemberFormData } from '../components/forms/CrewMemberForm';
import './CrewListPage.css';

function getInitials(firstname: string, lastname: string): string {
  const f = (firstname || '').trim().charAt(0) || '';
  const l = (lastname || '').trim().charAt(0) || '';
  return (f + l).toUpperCase() || '?';
}

function field(value: string | undefined): string {
  return value?.trim() || '—';
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

  const [selectedCrew, setSelectedCrew] = useState<CrewMemberApi | null>(null);
  const [inviteCrewMember, setInviteCrewMember] = useState<CrewMemberApi | null>(null);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

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

  const openInviteModal = useCallback((member: CrewMemberApi) => {
    setInviteCrewMember(member);
    setSelectedProjectId('');
    setInviteError(null);
    setInviteSuccess(false);
    setProjectsLoading(true);
    getProjects()
      .then((res) => setProjects(res.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));
  }, []);

  const closeInviteModal = useCallback(() => {
    if (!inviteLoading) {
      setInviteCrewMember(null);
      setInviteError(null);
      setInviteSuccess(false);
    }
  }, [inviteLoading]);

  const handleInviteToProject = async () => {
    if (!inviteCrewMember || !selectedProjectId) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteCrewToProject(selectedProjectId, [inviteCrewMember.id]);
      setInviteSuccess(true);
      setTimeout(closeInviteModal, 1200);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
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
                  <tr
                    key={member.id}
                    className="user-mgmt-row-clickable"
                    onClick={() => setSelectedCrew(member)}
                  >
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="user-mgmt-actions">
                        <button
                          type="button"
                          className="user-mgmt-action-btn user-mgmt-action-btn-invite"
                          aria-label="Invite to project"
                          onClick={() => openInviteModal(member)}
                          title="Invite to project"
                        >
                          <Send size={16} />
                        </button>
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

      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal} title="Add New Crew Member" size="xlarge">
        {addError && (
          <ErrorAlertPopup message={addError} onDismiss={() => setAddError(null)} />
        )}
        <CrewMemberForm
          onSubmit={handleSubmitCrewMember}
          onCancel={handleCloseAddModal}
          isLoading={addLoading}
        />
      </Modal>

      <Modal
        isOpen={!!inviteCrewMember}
        onClose={closeInviteModal}
        title="Invite to project"
        size="medium"
      >
        {inviteCrewMember && (
          <div className="invite-to-project-modal">
            <p className="invite-to-project-intro">
              Invite <strong>{inviteCrewMember.firstname} {inviteCrewMember.lastname}</strong> to a project. They will see the invitation in their crew panel.
            </p>
            {inviteSuccess ? (
              <div className="invite-to-project-success" role="status">
                Invitation sent successfully.
              </div>
            ) : (
              <>
                {inviteError && (
                  <ErrorAlertPopup message={inviteError} onDismiss={() => setInviteError(null)} />
                )}
                <div className="invite-to-project-field">
                  <label htmlFor="invite-project-select" className="invite-to-project-label">
                    Project
                  </label>
                  {projectsLoading ? (
                    <p className="invite-to-project-loading">Loading projects…</p>
                  ) : (
                    <select
                      id="invite-project-select"
                      className="invite-to-project-select"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      disabled={inviteLoading || projects.length === 0}
                    >
                      <option value="">
                        {projects.length === 0 ? 'No projects available' : 'Select a project'}
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.status ? `(${p.status})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="invite-to-project-actions">
                  <button
                    type="button"
                    className="invite-to-project-cancel"
                    onClick={closeInviteModal}
                    disabled={inviteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="invite-to-project-submit"
                    onClick={handleInviteToProject}
                    disabled={inviteLoading || !selectedProjectId || projectsLoading}
                  >
                    {inviteLoading ? 'Sending…' : 'Send invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedCrew}
        onClose={() => setSelectedCrew(null)}
        title={selectedCrew ? `${selectedCrew.firstname} ${selectedCrew.lastname} — Crew Details` : 'Crew Details'}
        size="xlarge"
      >
        {selectedCrew && (
          <div className="crew-detail-modal">
            <div className="crew-detail-grid">
              <section className="crew-detail-card crew-detail-card--span-2">
                <h3 className="crew-detail-card-title"><User size={20} /> Personal</h3>
                <div className="crew-detail-fields">
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">First name</span>
                    <span className="crew-detail-value">{field(selectedCrew.firstname)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Last name</span>
                    <span className="crew-detail-value">{field(selectedCrew.lastname)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Date of birth</span>
                    <span className="crew-detail-value">{field(selectedCrew.dateOfBirth)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Nationality</span>
                    <span className="crew-detail-value">{field(selectedCrew.nationality)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Gender</span>
                    <span className="crew-detail-value">{field(selectedCrew.gender)}</span>
                  </div>
                </div>
              </section>

              <section className="crew-detail-card">
                <h3 className="crew-detail-card-title"><Mail size={20} /> Contact</h3>
                <div className="crew-detail-fields">
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Email</span>
                    <span className="crew-detail-value">{field(selectedCrew.email)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Phone</span>
                    <span className="crew-detail-value">{field(selectedCrew.phone)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Alternate phone</span>
                    <span className="crew-detail-value">{field(selectedCrew.alternate_phone)}</span>
                  </div>
                </div>
              </section>

              <section className="crew-detail-card">
                <h3 className="crew-detail-card-title"><MapPin size={20} /> Address</h3>
                <div className="crew-detail-fields">
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Address</span>
                    <span className="crew-detail-value">{field(selectedCrew.address)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">City</span>
                    <span className="crew-detail-value">{field(selectedCrew.city)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Country</span>
                    <span className="crew-detail-value">{field(selectedCrew.country)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Postal code</span>
                    <span className="crew-detail-value">{field(selectedCrew.postal_code)}</span>
                  </div>
                </div>
              </section>

              <section className="crew-detail-card crew-detail-card--span-2">
                <h3 className="crew-detail-card-title"><FileText size={20} /> Passport</h3>
                <div className="crew-detail-fields">
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Passport number</span>
                    <span className="crew-detail-value">{field(selectedCrew.passport?.passport_number)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Issuing country</span>
                    <span className="crew-detail-value">{field(selectedCrew.passport?.issuing_country)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Issue date</span>
                    <span className="crew-detail-value">{field(selectedCrew.passport?.issue_date)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Expiry date</span>
                    <span className="crew-detail-value">{field(selectedCrew.passport?.expiry_date)}</span>
                  </div>
                </div>
              </section>

              <section className="crew-detail-card crew-detail-card--span-2">
                <h3 className="crew-detail-card-title"><CreditCard size={20} /> Identity</h3>
                <div className="crew-detail-fields">
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Identity type</span>
                    <span className="crew-detail-value">{field(selectedCrew.identity?.identity_type)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Identity number</span>
                    <span className="crew-detail-value">{field(selectedCrew.identity?.identity_number)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Issue date</span>
                    <span className="crew-detail-value">{field(selectedCrew.identity?.issue_date)}</span>
                  </div>
                  <div className="crew-detail-field">
                    <span className="crew-detail-label">Expiry date</span>
                    <span className="crew-detail-value">{field(selectedCrew.identity?.expiry_date)}</span>
                  </div>
                </div>
              </section>
            </div>
            <div className="crew-detail-actions">
              <button
                type="button"
                className="crew-detail-invite-btn"
                onClick={() => {
                  setSelectedCrew(null);
                  openInviteModal(selectedCrew);
                }}
              >
                <Send size={16} />
                Invite to project
              </button>
              <button type="button" className="crew-detail-close-btn" onClick={() => setSelectedCrew(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CrewListPage;
