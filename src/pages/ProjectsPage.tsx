import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Anchor,
  Award,
  BadgeCheck,
  Banknote,
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  Filter,
  FolderKanban,
  HelpCircle,
  Kanban,
  LayoutDashboard,
  List,
  Plane,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { getProjects, createProject, type ProjectApi, type CreateProjectPayload } from '../api/project';
import { getCrewAvailableForProject, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
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

function projectProgress(project: ProjectApi, index: number): number {
  const status = (project.status || '').toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'pending' || status === 'draft') return 10 + (index % 3) * 13;
  if (status === 'blocked') return 35;
  return [68, 55, 80, 47, 62, 72][index % 6];
}

function projectTone(status: string, index: number): 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange' {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'green';
  if (s === 'pending' || s === 'draft') return 'amber';
  if (s === 'blocked') return 'red';
  return ['teal', 'red', 'amber', 'blue', 'green', 'orange'][index % 6] as 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange';
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
            { icon: Anchor, label: 'Projects', path: '/projects', active: true },
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
          <button type="button" className="subsea-sb-link active" onClick={() => setStatusFilter('all')}>
            <FolderKanban size={13} /> All Projects <span className="subsea-sb-count">{projects.length}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => setStatusFilter('active')}>
            <CheckSquare size={13} /> Active <span className="subsea-sb-count">{activeCount}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => setStatusFilter('pending')}>
            <AlertTriangle size={13} /> At Risk <span className="subsea-sb-count subsea-sb-count-red">{projects.filter((p) => (p.status || '').toLowerCase() === 'pending').length}</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => setStatusFilter('completed')}>
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
            <div className="subsea-avatar subsea-avatar-sm">SK</div>
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Projects</h1>
              <p>Vessel operations, dry docks, crew mobilisations & compliance programmes</p>
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
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">At Risk</div>
              <div className="subsea-kpi-value">{projects.filter((p) => (p.status || '').toLowerCase() === 'pending').length}</div>
              <div className="subsea-kpi-meta down">Attention needed</div>
              <div className="subsea-kpi-bar"><div className="subsea-kpi-fill amber" style={{ width: '22%' }} /></div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Open Tasks</div>
              <div className="subsea-kpi-value">{projects.length ? projects.length * 5 + 17 : 47}</div>
              <div className="subsea-kpi-meta flat">Across all projects</div>
              <div className="subsea-kpi-bar"><div className="subsea-kpi-fill teal" style={{ width: '47%' }} /></div>
            </div>
          </div>

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

          {loading ? (
            <div className="subsea-state" role="status">Loading projects...</div>
          ) : error ? (
            <div className="subsea-empty-panel" role="alert">{error}</div>
          ) : paginatedProjects.length === 0 ? (
            <div className="subsea-empty-panel">
              <FolderKanban size={34} />
              <h3>No projects yet</h3>
              <p>Create vessel operations, dry docks, mobilisations, and compliance programmes.</p>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                <Plus size={12} /> New Project
              </button>
            </div>
          ) : viewMode === 'board' ? (
            <>
              <div className="subsea-proj-board">
                {paginatedProjects.map((project, index) => {
                  const tone = projectTone(project.status, index);
                  const progress = projectProgress(project, index);
                  const ProjectIcon = [Wrench, Users, Award, ShieldCheck, Banknote, Ship][index % 6];
                  const deadline = project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || 'No deadline';
                  const initials = projectInitials(project);
                  return (
                    <article key={project.id} className="subsea-proj-card">
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
                            <span className="subsea-proj-progress-text">Overall Progress</span>
                            <span className="subsea-proj-progress-pct">{progress}%</span>
                          </div>
                          <div className="subsea-prog-bar">
                            <div className={`subsea-prog-fill ${tone}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="subsea-proj-meta-row">
                          <div className="subsea-proj-meta-item"><Calendar size={12} />{deadline}</div>
                          <div className="subsea-proj-meta-item"><CheckSquare size={12} />{Math.round(progress / 8)}/{Math.max(9, Math.round(progress / 4))} tasks</div>
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
                            onClick={() => openInviteModal(project)}
                          >
                            <UserPlus size={12} /> Invite
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="subsea-g-main">
                <div className="subsea-pane">
                  <div className="subsea-pane-head">
                    <div>
                      <div className="subsea-pane-title">Active Tasks</div>
                      <div className="subsea-pane-sub">My tasks across all projects</div>
                    </div>
                    <div className="subsea-pane-actions">
                      <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => setViewMode('list')}>View All</button>
                    </div>
                  </div>
                  <div className="subsea-pane-body subsea-pane-body-flat">
                    {[
                      ['Confirm DP cert renewal for Carlos Mendez', 'STCW Renewal Programme · Completed May 16', 'Done', 'subsea-b-green', true],
                      ['Book replacement crew for MV Poseidon Rex — Bosun role', 'Red Sea Crew Mobilisation · Due Jun 10', 'Urgent', 'subsea-b-red', false],
                      ['Initiate June payroll batch in system', 'June 2025 Payroll Run · Due Jun 20', 'Pending', 'subsea-b-amber', false],
                      ['Coordinate with Sembcorp on dry-dock phase 3 handover', 'MV Coral Star Dry Dock · Due Jul 01', 'Upcoming', 'subsea-b-blue', false],
                    ].map(([task, meta, badge, badgeClass, done]) => (
                      <div className="subsea-proj-task-row" key={task as string}>
                        <div className={`subsea-proj-task-check${done ? ' done' : ''}`} />
                        <div className="subsea-proj-task-main">
                          <div className={`subsea-proj-task-text${done ? ' done' : ''}`}>{task}</div>
                          <div className="subsea-proj-task-meta">{meta}</div>
                        </div>
                        <span className={`subsea-badge ${badgeClass}`}>{badge}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="subsea-pane subsea-mb-12">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Project Health</div></div>
                    <div className="subsea-pane-body subsea-pane-body-flat">
                      <div className="subsea-metric-row"><span className="subsea-metric-label"><span className="subsea-badge subsea-b-green subsea-b-dot">On Track</span></span><span className="subsea-metric-val">{activeCount}</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label"><span className="subsea-badge subsea-b-amber subsea-b-dot">At Risk</span></span><span className="subsea-metric-val">{projects.filter((p) => (p.status || '').toLowerCase() === 'pending').length}</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label"><span className="subsea-badge subsea-b-red subsea-b-dot">Blocked</span></span><span className="subsea-metric-val">0</span></div>
                      <div className="subsea-metric-row"><span className="subsea-metric-label"><span className="subsea-badge subsea-b-gray subsea-b-dot">Completed</span></span><span className="subsea-metric-val">{completedCount}</span></div>
                    </div>
                  </div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Upcoming Deadlines</div></div>
                    <div className="subsea-feed">
                      {paginatedProjects.slice(0, 4).map((project, index) => {
                        const tone = projectTone(project.status, index);
                        return (
                          <div className="subsea-feed-item" key={`deadline-${project.id}`}>
                            <div className={`subsea-feed-icon ${tone}`}><Calendar size={13} /></div>
                            <div>
                              <div className="subsea-feed-text"><strong>{project.title}</strong></div>
                              <div className="subsea-feed-meta">Deadline {project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || 'TBC'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                      <th>Progress</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.map((project, index) => {
                      const tone = projectTone(project.status, index);
                      const progress = projectProgress(project, index);
                      return (
                        <tr key={project.id}>
                          <td className="s">{project.title}</td>
                          <td>{project.duration?.endDate ? formatDate(project.duration.endDate) : project.span || '—'}</td>
                          <td>
                            <div className="subsea-proj-list-progress">
                              <div className="subsea-prog-bar">
                                <div className={`subsea-prog-fill ${tone}`} style={{ width: `${progress}%` }} />
                              </div>
                              <span>{progress}%</span>
                            </div>
                          </td>
                          <td><span className={`subsea-badge ${statusClass(project.status)}`}>{project.status || 'Active'}</span></td>
                          <td>
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

          {filteredProjects.length > pageSize && (
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
