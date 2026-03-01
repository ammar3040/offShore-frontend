import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Users, FolderKanban, Plus, Search, ChevronDown, UserPlus } from 'lucide-react';
import Modal from '../components/Modal';
import { getProjects, createProject, type ProjectApi, type CreateProjectPayload } from '../api/project';
import { getCrewAvailableForProject, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
import './ProjectsPage.css';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'project-card-status-active';
  if (s === 'completed') return 'project-card-status-completed';
  if (s === 'pending' || s === 'draft') return 'project-card-status-pending';
  return 'project-card-status-default';
}

const ProjectsPage = () => {
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [inviteProject, setInviteProject] = useState<ProjectApi | null>(null);
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const pageSize = 6;

  const fetchProjects = useCallback(() => {
    getProjects()
      .then((res) => setProjects(res.projects ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjects()
      .then((res) => {
        if (!cancelled) setProjects(res.projects ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load projects');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((p) => (p.status || '').toLowerCase() === statusFilter);
    }
    return list;
  }, [projects, search, statusFilter]);

  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, page]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));

  const activeCount = projects.filter((p) => (p.status || '').toLowerCase() === 'active').length;
  const completedCount = projects.filter((p) => (p.status || '').toLowerCase() === 'completed').length;

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

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = (formData.get('title') as string)?.trim() ?? '';
    const description = (formData.get('description') as string)?.trim() ?? '';
    const startDate = (formData.get('startDate') as string) ?? '';
    const endDate = (formData.get('endDate') as string) ?? '';
    const span = (formData.get('span') as string)?.trim() ?? '';
    if (!title || !startDate || !endDate) return;

    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload: CreateProjectPayload = {
        title,
        description,
        duration: { startDate, endDate },
        span: span || `${startDate} to ${endDate}`,
      };
      await createProject(payload);
      fetchProjects();
      closeCreateModal();
      form.reset();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  };

  const openInviteModal = useCallback((project: ProjectApi) => {
    setInviteProject(project);
    setSelectedCrewIds([]);
    setInviteError(null);
    setInviteSuccess(false);
    setCrewLoading(true);
    getCrewAvailableForProject(project.id)
      .then((res) => setCrew(res.crew ?? []))
      .catch(() => setCrew([]))
      .finally(() => setCrewLoading(false));
  }, []);

  const toggleCrewSelection = useCallback((crewId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  }, []);

  const selectAllCrew = useCallback(() => {
    setSelectedCrewIds(crew.map((c) => c.id));
  }, [crew]);

  const deselectAllCrew = useCallback(() => {
    setSelectedCrewIds([]);
  }, []);

  const closeInviteModal = useCallback(() => {
    if (!inviteLoading) {
      setInviteProject(null);
      setInviteError(null);
      setInviteSuccess(false);
    }
  }, [inviteLoading]);

  const handleInviteCrew = async () => {
    if (!inviteProject || selectedCrewIds.length === 0) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteCrewToProject(inviteProject.id, selectedCrewIds);
      setInviteSuccess(true);
      setTimeout(closeInviteModal, 1200);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="projects-page">
      <div className="projects-page-header">
        <div>
          <h1 className="projects-page-title">Projects</h1>
          <p className="projects-page-subtitle">
            View and manage all projects. {loading ? '' : `${projects.length} project${projects.length !== 1 ? 's' : ''} total.`}
          </p>
        </div>
        <button type="button" className="projects-page-create-btn" onClick={openCreateModal}>
          <Plus size={18} />
          Create project
        </button>
      </div>

      <div className="projects-stat-cards">
        <div className="projects-stat-card">
          <div className="projects-stat-icon projects-stat-blue">
            <FolderKanban size={24} />
          </div>
          <span className="projects-stat-value">{loading ? '…' : projects.length}</span>
          <span className="projects-stat-label">TOTAL PROJECTS</span>
        </div>
        <div className="projects-stat-card">
          <div className="projects-stat-icon projects-stat-green">
            <FolderKanban size={24} />
          </div>
          <span className="projects-stat-value">{loading ? '…' : activeCount}</span>
          <span className="projects-stat-label">ACTIVE</span>
        </div>
        <div className="projects-stat-card">
          <div className="projects-stat-icon projects-stat-purple">
            <FolderKanban size={24} />
          </div>
          <span className="projects-stat-value">{loading ? '…' : completedCount}</span>
          <span className="projects-stat-label">COMPLETED</span>
        </div>
        <div className="projects-stat-card">
          <div className="projects-stat-icon projects-stat-teal">
            <Users size={24} />
          </div>
          <span className="projects-stat-value">{loading ? '…' : projects.filter((p) => (p.status || '').toLowerCase() === 'pending').length}</span>
          <span className="projects-stat-label">PENDING</span>
        </div>
      </div>

      <div className="projects-filters">
        <div className="projects-search-wrap">
          <Search size={18} className="projects-search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            className="projects-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="projects-select-wrap">
          <select
            className="projects-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <ChevronDown size={18} className="projects-select-chevron" />
        </div>
      </div>

      {loading ? (
        <div className="projects-page-loading" role="status">Loading projects…</div>
      ) : error ? (
        <div className="projects-page-error" role="alert">{error}</div>
      ) : paginatedProjects.length === 0 ? (
        <div className="projects-page-empty">
          <FolderKanban size={48} className="projects-page-empty-icon" />
          <p>No projects yet.</p>
          <button type="button" className="projects-page-create-btn projects-page-create-inline" onClick={openCreateModal}>
            <Plus size={18} />
            Create project
          </button>
        </div>
      ) : (
        <>
          <div className="projects-card-grid">
            {paginatedProjects.map((project) => (
              <article key={project.id} className="project-card">
                <div className="project-card-header">
                  <h3 className="project-card-title">{project.title}</h3>
                  <span className={`project-card-status ${statusClass(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="project-card-description">{project.description}</p>
                )}
                <div className="project-card-meta">
                  <span className="project-card-meta-item">
                    <Calendar size={14} />
                    {project.span || (project.duration
                      ? `${formatDate(project.duration.startDate)} – ${formatDate(project.duration.endDate)}`
                      : '—')}
                  </span>
                  <span className="project-card-meta-item">
                    <Users size={14} />
                    {project.participants?.length ?? 0} participant{(project.participants?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="project-card-actions">
                  <button
                    type="button"
                    className="project-card-invite-btn"
                    onClick={() => openInviteModal(project)}
                    title="Invite crew to this project"
                  >
                    <UserPlus size={16} />
                    Invite crew
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredProjects.length > pageSize && (
            <div className="projects-pagination">
              <span className="projects-pagination-info">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
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

      <Modal
        isOpen={!!inviteProject}
        onClose={closeInviteModal}
        title="Invite crew to project"
        size="medium"
      >
        {inviteProject && (
          <div className="project-invite-modal">
            <p className="project-invite-intro">
              Invite crew members to <strong>{inviteProject.title}</strong>. Only crews whose availability aligns with this project&apos;s duration are listed. Selected crew will see the invitation in their crew panel.
            </p>
            {inviteSuccess ? (
              <div className="project-invite-success" role="status">
                Invitation{selectedCrewIds.length !== 1 ? 's' : ''} sent successfully.
              </div>
            ) : (
              <>
                {inviteError && (
                  <div className="projects-page-form-error project-invite-error" role="alert">
                    {inviteError}
                  </div>
                )}
                <div className="project-invite-field">
                  <div className="project-invite-label-row">
                    <span className="project-invite-label">Crew members</span>
                    {!crewLoading && crew.length > 0 && (
                      <span className="project-invite-select-actions">
                        <button type="button" className="project-invite-select-link" onClick={selectAllCrew}>
                          Select all
                        </button>
                        <span className="project-invite-select-sep">·</span>
                        <button type="button" className="project-invite-select-link" onClick={deselectAllCrew}>
                          Deselect all
                        </button>
                      </span>
                    )}
                  </div>
                  {crewLoading ? (
                    <p className="project-invite-loading">Loading crew…</p>
                  ) : crew.length === 0 ? (
                    <p className="project-invite-loading">No crew available for this project&apos;s duration.</p>
                  ) : (
                    <div className="project-invite-crew-list" role="group" aria-label="Select crew to invite">
                      {crew.map((c) => (
                        <label key={c.id} className="project-invite-crew-item">
                          <input
                            type="checkbox"
                            checked={selectedCrewIds.includes(c.id)}
                            onChange={() => toggleCrewSelection(c.id)}
                            disabled={inviteLoading}
                            className="project-invite-crew-checkbox"
                          />
                          <span className="project-invite-crew-name">
                            {c.firstname} {c.lastname}
                          </span>
                          <span className="project-invite-crew-email">{c.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!crewLoading && crew.length > 0 && selectedCrewIds.length > 0 && (
                    <p className="project-invite-count">
                      {selectedCrewIds.length} member{selectedCrewIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
                <div className="project-invite-actions">
                  <button
                    type="button"
                    className="projects-page-form-cancel"
                    onClick={closeInviteModal}
                    disabled={inviteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="projects-page-form-submit"
                    onClick={handleInviteCrew}
                    disabled={inviteLoading || selectedCrewIds.length === 0 || crewLoading}
                  >
                    {inviteLoading ? 'Sending…' : `Send invitation${selectedCrewIds.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create project" size="medium">
        {createError && (
          <div className="projects-page-form-error" role="alert">{createError}</div>
        )}
        <form className="projects-page-create-form" onSubmit={handleCreateProject}>
          <div className="projects-page-form-field">
            <label htmlFor="project-title">Title</label>
            <input
              id="project-title"
              name="title"
              type="text"
              placeholder="e.g. Barcelona Project"
              required
              disabled={createLoading}
            />
          </div>
          <div className="projects-page-form-field">
            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              name="description"
              rows={3}
              placeholder="Short description of the project..."
              disabled={createLoading}
            />
          </div>
          <div className="projects-page-form-row">
            <div className="projects-page-form-field">
              <label htmlFor="project-start">Start date</label>
              <input
                id="project-start"
                name="startDate"
                type="date"
                required
                disabled={createLoading}
              />
            </div>
            <div className="projects-page-form-field">
              <label htmlFor="project-end">End date</label>
              <input
                id="project-end"
                name="endDate"
                type="date"
                required
                disabled={createLoading}
              />
            </div>
          </div>
          <div className="projects-page-form-field">
            <label htmlFor="project-span">Span</label>
            <input
              id="project-span"
              name="span"
              type="text"
              placeholder="e.g. 1 month"
              disabled={createLoading}
            />
          </div>
          <div className="projects-page-form-actions">
            <button type="button" className="projects-page-form-cancel" onClick={closeCreateModal} disabled={createLoading}>
              Cancel
            </button>
            <button type="submit" className="projects-page-form-submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
