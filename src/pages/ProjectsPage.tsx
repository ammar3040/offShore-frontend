import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Banknote,
  Calendar,
  CheckSquare,
  ChevronDown,
  Filter,
  FolderKanban,
  Kanban,
  List,
  Plus,
  Search,
  ShieldCheck,
  Ship,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { getProjects, createProject, type ProjectApi, type CreateProjectPayload } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewAvailableForProject, getCrewList, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
import { recordContractInvites } from '../lib/contractsStore';
import './ProjectsPage.css';
import './RigsPage.css';

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
  if (s === 'active') return 'subsea-b-green';
  if (s === 'completed') return 'subsea-b-gray';
  if (s === 'pending' || s === 'draft') return 'subsea-b-amber';
  if (s === 'blocked') return 'subsea-b-red';
  return 'subsea-b-teal';
}

function projectCompletion(project: ProjectApi): number {
  const status = (project.status || '').toLowerCase();
  if (status === 'completed') return 100;

  const startDate = project.duration?.startDate;
  const endDate = project.duration?.endDate;
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}

function projectTone(status: string, index: number): 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange' {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'green';
  if (s === 'pending' || s === 'draft') return 'amber';
  if (s === 'blocked') return 'red';
  return ['teal', 'red', 'amber', 'blue', 'green', 'orange'][index % 6] as 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange';
}

const CERT_EXPIRY_WINDOW_DAYS = 30;

type AtRiskCertRow = {
  id: string;
  crewId: string;
  crewName: string;
  document: string;
  projectTitle: string;
  expiry: string;
  daysUntil: number;
  statusLabel: string;
  statusClassName: string;
};

function formatCertDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntilCertExpiry(value?: string): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function buildAtRiskCertRows(crew: CrewMemberApi[]): AtRiskCertRow[] {
  const rows: AtRiskCertRow[] = [];

  for (const member of crew) {
    const crewName = `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || 'Unnamed crew';
    const projectTitle = member.activeProjects?.[0]?.title || 'Unassigned';
    const documents: Array<{ document: string; expiry?: string }> = [
      { document: 'Passport', expiry: member.passport?.expiry_date },
      { document: 'Identity Document', expiry: member.identity?.expiry_date },
      {
        document: 'Crew Certificate',
        expiry: member.certificate_expiry_date || member.crew_certificate?.expiry_date,
      },
      { document: 'Visa', expiry: member.visa_expiry_date },
    ];

    for (const { document, expiry } of documents) {
      if (!expiry) continue;
      const daysUntil = daysUntilCertExpiry(expiry);
      if (daysUntil == null || daysUntil < 0 || daysUntil > CERT_EXPIRY_WINDOW_DAYS) continue;

      const statusLabel = daysUntil <= 7 ? `Critical (${daysUntil}d)` : `Expiring (${daysUntil}d)`;
      const statusClassName = daysUntil <= 7 ? 'subsea-b-red' : 'subsea-b-amber';

      rows.push({
        id: `${member.id}-${document.toLowerCase().replace(/\s+/g, '-')}`,
        crewId: member.id,
        crewName,
        document,
        projectTitle,
        expiry: formatCertDate(expiry),
        daysUntil,
        statusLabel,
        statusClassName,
      });
    }
  }

  return rows.sort((a, b) => a.daysUntil - b.daysUntil);
}

function projectInitials(project: ProjectApi): string[] {
  const participants = project.participants ?? [];
  if (participants.length === 0) return ['JO', 'SM'];
  return participants.slice(0, 3).map((participant, index) => {
    if (typeof participant === 'string') return `P${index + 1}`;
    const p = participant as { firstname?: string; lastname?: string; name?: string; email?: string };
    const name = p.name || `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim() || p.email || `P${index + 1}`;
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || `P${index + 1}`;
  });
}

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRigId, setCreateRigId] = useState('');
  const [rigs, setRigs] = useState<RigApi[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const [inviteProject, setInviteProject] = useState<ProjectApi | null>(null);
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [allCrew, setAllCrew] = useState<CrewMemberApi[]>([]);
  const [crewRosterLoading, setCrewRosterLoading] = useState(true);

  const pageSize = 6;

  const fetchProjects = useCallback(() => {
    getProjects()
      .then((res) => setProjects(res.projects ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRigs()
      .then((res) => {
        if (!cancelled) setRigs(res.rigs ?? []);
      })
      .catch(() => {
        if (!cancelled) setRigs([]);
      });
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    let cancelled = false;
    setCrewRosterLoading(true);
    getCrewList()
      .then((res) => {
        if (!cancelled) setAllCrew(res.crew ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllCrew([]);
      })
      .finally(() => {
        if (!cancelled) setCrewRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const atRiskCertRows = useMemo(() => buildAtRiskCertRows(allCrew), [allCrew]);
  const atRiskCrewCount = useMemo(
    () => new Set(atRiskCertRows.map((row) => row.crewId)).size,
    [atRiskCertRows]
  );

  const showAtRiskView = statusFilter === 'at-risk';

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
    if (statusFilter !== 'all' && statusFilter !== 'at-risk') {
      list = list.filter((p) => (p.status || '').toLowerCase() === statusFilter);
    }
    return list;
  }, [projects, search, statusFilter]);

  const paginatedAtRiskRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return atRiskCertRows.slice(start, start + pageSize);
  }, [atRiskCertRows, page]);

  const atRiskTotalPages = Math.max(1, Math.ceil(atRiskCertRows.length / pageSize));

  const openAtRiskView = useCallback(() => {
    setStatusFilter('at-risk');
    setPage(1);
  }, []);

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
      setCreateRigId('');
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
        ...(createRigId ? { rig_id: createRigId } : {}),
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
      recordContractInvites(selectedCrewIds, inviteProject.id, inviteProject.title);
      setInviteSuccess(true);
      setTimeout(closeInviteModal, 1200);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const openProjectDetails = useCallback((project: ProjectApi) => {
    navigate(`/projects/${project.id}`);
  }, [navigate]);

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="projects" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Projects</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter projects">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Portfolio</div>
          <button
            type="button"
            className={`subsea-sb-link${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
          >
            <FolderKanban size={13} /> All Projects <span className="subsea-sb-count">{projects.length}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${statusFilter === 'active' ? ' active' : ''}`}
            onClick={() => {
              setStatusFilter('active');
              setPage(1);
            }}
          >
            <CheckSquare size={13} /> Active <span className="subsea-sb-count">{activeCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${statusFilter === 'at-risk' ? ' active' : ''}`}
            onClick={openAtRiskView}
          >
            <AlertTriangle size={13} /> At Risk <span className="subsea-sb-count subsea-sb-count-red">{crewRosterLoading ? '...' : atRiskCrewCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${statusFilter === 'completed' ? ' active' : ''}`}
            onClick={() => {
              setStatusFilter('completed');
              setPage(1);
            }}
          >
            <BadgeCheck size={13} /> Completed <span className="subsea-sb-count">{completedCount}</span>
          </button>
          <div className="subsea-sb-group">Views</div>
          <button type="button" className="subsea-sb-link" onClick={() => setViewMode('board')}>
            <Kanban size={13} /> Board
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => setViewMode('list')}>
            <List size={13} /> List
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Projects</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Filter size={12} /> Filter
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
              <Plus size={12} /> New Project
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Projects</h1>
              <p>Rig operations, dry docks, crew mobilisations & compliance programmes</p>
            </div>
            <div className="subsea-ph-right">
              <div className="subsea-view-toggle">
                <button
                  type="button"
                  className={`subsea-vt-btn${viewMode === 'board' ? ' active' : ''}`}
                  onClick={() => setViewMode('board')}
                >
                  <Kanban size={12} /> Board
                </button>
                <button
                  type="button"
                  className={`subsea-vt-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <List size={12} /> List
                </button>
              </div>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
                <Filter size={12} /> Filter
              </button>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={12} /> New Project
              </button>
            </div>
          </div>

          <div className="subsea-proj-kpi-strip">
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Active Projects</div>
              <div className="subsea-kpi-value">{loading ? '...' : activeCount}</div>
              <div className="subsea-kpi-meta up">2 added this month</div>
              <div className="subsea-kpi-bar"><div className="subsea-kpi-fill blue" style={{ width: '60%' }} /></div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">On Track</div>
              <div className="subsea-kpi-value">{Math.max(0, activeCount - projects.filter((p) => (p.status || '').toLowerCase() === 'pending').length)}</div>
              <div className="subsea-kpi-meta flat">67% of portfolio</div>
              <div className="subsea-kpi-bar"><div className="subsea-kpi-fill green" style={{ width: '67%' }} /></div>
            </div>
            <button
              type="button"
              className={`subsea-kpi subsea-kpi-clickable${showAtRiskView ? ' subsea-kpi-active' : ''}`}
              onClick={openAtRiskView}
            >
              <div className="subsea-kpi-label">At Risk</div>
              <div className="subsea-kpi-value">{crewRosterLoading ? '...' : atRiskCrewCount}</div>
              <div className="subsea-kpi-meta down">Certs expiring within 30 days</div>
              <div className="subsea-kpi-bar">
                <div
                  className="subsea-kpi-fill amber"
                  style={{ width: `${allCrew.length ? Math.min(100, Math.round((atRiskCrewCount / allCrew.length) * 100)) : 0}%` }}
                />
              </div>
            </button>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Open Tasks</div>
              <div className="subsea-kpi-value">{projects.length ? projects.length * 5 + 17 : 47}</div>
              <div className="subsea-kpi-meta flat">Across all projects</div>
              <div className="subsea-kpi-bar"><div className="subsea-kpi-fill teal" style={{ width: '47%' }} /></div>
            </div>
          </div>

          {!showAtRiskView ? (
          <div className="subsea-toolbar-row">
            <div className="subsea-tb-search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="subsea-filter-wrap">
              <span className="subsea-filter-label">Status</span>
              <select
                className="subsea-filter-select"
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
              <ChevronDown size={14} className="subsea-filter-chevron" />
            </div>
          </div>
          ) : null}

          {showAtRiskView ? (
            crewRosterLoading ? (
              <div className="subsea-state" role="status">Loading crew certifications...</div>
            ) : atRiskCertRows.length === 0 ? (
              <div className="subsea-empty-panel">
                <BadgeCheck size={34} />
                <h3>No crew at risk</h3>
                <p>No crew certificates are expiring within the next 30 days.</p>
              </div>
            ) : (
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div>
                    <div className="subsea-pane-title">Crew at Risk — Certificate Expiry</div>
                    <div className="subsea-pane-sub">
                      {atRiskCrewCount} crew member{atRiskCrewCount !== 1 ? 's' : ''} · {atRiskCertRows.length} certificate{atRiskCertRows.length !== 1 ? 's' : ''} expiring within 30 days
                    </div>
                  </div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr>
                        <th>Crew Member</th>
                        <th>Project</th>
                        <th>Document</th>
                        <th>Expiry</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAtRiskRows.map((row) => (
                        <tr key={row.id} onClick={() => navigate(`/crew/${row.crewId}`)}>
                          <td className="strong">{row.crewName}</td>
                          <td>{row.projectTitle}</td>
                          <td>{row.document}</td>
                          <td className="mono">{row.expiry}</td>
                          <td><span className={`subsea-badge ${row.statusClassName}`}>{row.statusLabel}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : loading ? (
            <div className="subsea-state" role="status">Loading projects...</div>
          ) : error ? (
            <div className="subsea-empty-panel" role="alert">{error}</div>
          ) : paginatedProjects.length === 0 ? (
            <div className="subsea-empty-panel">
              <FolderKanban size={34} />
              <h3>No projects yet</h3>
              <p>Create Rig operations, dry docks, mobilisations, and compliance programmes.</p>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={12} /> New Project
              </button>
            </div>
          ) : viewMode === 'board' ? (
            <>
              <div className="subsea-proj-board projects-proj-board">
                {paginatedProjects.map((project, index) => {
                  const tone = projectTone(project.status, index);
                  const completion = projectCompletion(project);
                  const ProjectIcon = [Wrench, Users, Award, ShieldCheck, Banknote, Ship][index % 6];
                  const deadline = project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || 'No deadline';
                  const initials = projectInitials(project);
                  return (
                    <article
                      key={project.id}
                      className="subsea-proj-card"
                      onClick={() => openProjectDetails(project)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openProjectDetails(project);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="subsea-proj-card-top">
                        <div className={`subsea-proj-card-icon ${tone}`}>
                          <ProjectIcon size={16} />
                        </div>
                        <div className="subsea-proj-card-name">{project.title}</div>
                        <div className="subsea-proj-card-sub">{project.description || project.span || 'Operations programme'}</div>
                        <div className="subsea-proj-badge-row">
                          <span className={`subsea-badge ${statusClass(project.status)}`}>
                            {(project.status || 'On Track').replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="subsea-proj-card-body">
                        <div className="subsea-proj-progress">
                          <div className="subsea-proj-progress-label">
                            <span className="subsea-proj-progress-text">Project Completion</span>
                            <span className="subsea-proj-progress-pct">{completion}%</span>
                          </div>
                          <div className="subsea-prog-bar">
                            <div className={`subsea-prog-fill ${tone}`} style={{ width: `${completion}%` }} />
                          </div>
                        </div>
                        <div className="subsea-proj-meta-row">
                          <div className="subsea-proj-meta-item"><Calendar size={12} />{deadline}</div>
                        </div>
                        <div className="subsea-proj-card-actions">
                          <div className="subsea-proj-avatars">
                            {initials.map((initial, idx) => (
                              <div key={`${project.id}-${initial}-${idx}`} className={`subsea-proj-av subsea-proj-av-${idx + 1}`}>{initial}</div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-default subsea-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInviteModal(project);
                            }}
                          >
                            <UserPlus size={12} /> Invite
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="subsea-pane">
                <div className="subsea-pane-head"><div className="subsea-pane-title">Upcoming Deadlines</div></div>
                <div className="subsea-feed">
                  {paginatedProjects.slice(0, 4).map((project, index) => {
                    const tone = projectTone(project.status, index);
                    return (
                      <button
                        type="button"
                        className="subsea-feed-item"
                        key={`deadline-${project.id}`}
                        onClick={() => openProjectDetails(project)}
                      >
                        <div className={`subsea-feed-icon ${tone}`}><Calendar size={13} /></div>
                        <div>
                          <div className="subsea-feed-text"><strong>{project.title}</strong></div>
                          <div className="subsea-feed-meta">Deadline {project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || 'TBC'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="subsea-pane">
              <div className="subsea-pane-head">
                <div className="subsea-pane-title">All Projects</div>
                <div className="subsea-pane-sub">{filteredProjects.length} projects</div>
              </div>
              <div className="subsea-table-wrap">
                <table className="subsea-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Due Date</th>
                      <th>Completion</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.map((project, index) => {
                      const tone = projectTone(project.status, index);
                      const completion = projectCompletion(project);
                      return (
                        <tr key={project.id} onClick={() => openProjectDetails(project)}>
                          <td className="s">{project.title}</td>
                          <td>{project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || '—'}</td>
                          <td>
                            <div className="subsea-proj-list-progress">
                              <div className="subsea-prog-bar">
                                <div className={`subsea-prog-fill ${tone}`} style={{ width: `${completion}%` }} />
                              </div>
                              <span>{completion}%</span>
                            </div>
                          </td>
                          <td><span className={`subsea-badge ${statusClass(project.status)}`}>{project.status || 'Active'}</span></td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => openInviteModal(project)}>
                              Invite
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAtRiskView && atRiskCertRows.length > pageSize && (
            <div className="subsea-pagination">
              <span className="subsea-pagination-info">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, atRiskCertRows.length)} of {atRiskCertRows.length} at-risk certificates
              </span>
              <div className="subsea-pagination-btns">
                <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                {Array.from({ length: atRiskTotalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`subsea-pagination-btn${p === page ? ' active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page >= atRiskTotalPages} onClick={() => setPage((p) => Math.min(atRiskTotalPages, p + 1))}>Next</button>
              </div>
            </div>
          )}

          {!showAtRiskView && filteredProjects.length > pageSize && (
            <div className="subsea-pagination">
              <span className="subsea-pagination-info">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
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
        </main>
      </div>

      <Modal
        isOpen={!!inviteProject}
        onClose={closeInviteModal}
        title="Invite crew to project"
        size="medium"
        variant="subsea"
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

      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create project" size="medium" variant="subsea">
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
            <label htmlFor="project-rig">Rig</label>
            <select
              id="project-rig"
              value={createRigId}
              onChange={(e) => setCreateRigId(e.target.value)}
              disabled={createLoading}
            >
              <option value="">No rig selected (optional)</option>
              {rigs.map((rig) => (
                <option key={rig.id} value={rig.id}>
                  {rig.name}
                </option>
              ))}
            </select>
          </div>
          <div className="projects-page-form-field">
            <label htmlFor="project-span">Message to Crew</label>
            <input
              id="project-span"
              name="span"
              type="text"
              placeholder="e.g. We are starting a new project on March 1st. Please join us."
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
