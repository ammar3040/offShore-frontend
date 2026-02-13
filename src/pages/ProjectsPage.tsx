import { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, FolderKanban, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { getProjects, createProject, type ProjectApi, type CreateProjectPayload } from '../api/project';
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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const header = (
    <div className="projects-page-header">
      <div className="projects-page-header-text">
        <h1 className="projects-page-title">Projects</h1>
        <p className="projects-page-subtitle">
          {loading
            ? 'View and manage all projects.'
            : error
              ? 'View and manage all projects.'
              : `View and manage all projects. ${projects.length} project${projects.length !== 1 ? 's' : ''} total.`}
        </p>
      </div>
      <button type="button" className="projects-page-create-btn" onClick={openCreateModal}>
        <Plus size={18} />
        Create project
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="projects-page">
        {header}
        <div className="projects-page-loading" role="status">
          Loading projects…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-page">
        {header}
        <div className="projects-page-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="projects-page">
      {header}

      {projects.length === 0 ? (
        <div className="projects-page-empty">
          <FolderKanban size={48} className="projects-page-empty-icon" />
          <p>No projects yet.</p>
        </div>
      ) : (
        <div className="projects-card-grid">
          {projects.map((project) => (
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
              {project.duration?.startDate && project.duration?.endDate && project.span && (
                <p className="project-card-dates">
                  {formatDate(project.duration.startDate)} – {formatDate(project.duration.endDate)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create project" size="medium">
        {createError && (
          <div className="projects-page-form-error" role="alert">
            {createError}
          </div>
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
