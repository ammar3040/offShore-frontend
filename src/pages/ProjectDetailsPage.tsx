import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  FolderKanban,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { getCrewAvailableForProject, getCrewEnrolledInProject, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
import { getProjectById, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { availabilityFromCrewSignal, crewAvailabilityDotClass, getCrewAvailabilityLabel } from '../utils/crewAvailability';
import './ProjectsPage.css';
import './RigsPage.css';

type ProjectTab = 'overview' | 'crew';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

function projectProgress(project: ProjectApi): number {
  const status = (project.status || '').toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'pending' || status === 'draft') return 25;
  if (status === 'blocked') return 35;
  return 65;
}

function projectTone(status: string): 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'orange' {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'green';
  if (s === 'pending' || s === 'draft') return 'amber';
  if (s === 'blocked') return 'red';
  return 'teal';
}

function crewName(member: CrewMemberApi): string {
  return `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || 'Unnamed crew';
}

function crewStatusLabel(member: CrewMemberApi): { label: string; className: string } {
  const kind = availabilityFromCrewSignal(member.signal);
  if (kind === 'available') return { label: 'Available', className: 'subsea-b-green' };
  if (kind === 'endingSoon') return { label: 'Sign-Off Due', className: 'subsea-b-amber' };
  return { label: 'On Board', className: 'subsea-b-blue' };
}

function getProjectRigDetails(project: ProjectApi, rigs: RigApi[]): Partial<RigApi> | null {
  const rig = project.rig_id;
  if (!rig) return null;

  if (typeof rig === 'string') {
    return rigs.find((item) => item.id === rig) ?? { id: rig };
  }

  const matchedRig = rig.id ? rigs.find((item) => item.id === rig.id) : undefined;
  return {
    id: rig.id || matchedRig?.id,
    name: rig.name || matchedRig?.name,
    address: rig.address || matchedRig?.address,
    description: rig.description || matchedRig?.description,
    createdBy: rig.createdBy || matchedRig?.createdBy,
    createdAt: rig.createdAt || matchedRig?.createdAt,
    updatedAt: rig.updatedAt || matchedRig?.updatedAt,
  };
}

const ProjectDetailsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectApi | null>(null);
  const [rigs, setRigs] = useState<RigApi[]>([]);
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [crewLoading, setCrewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [availableCrew, setAvailableCrew] = useState<CrewMemberApi[]>([]);
  const [availableCrewLoading, setAvailableCrewLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const loadCrew = useCallback((id: string) => {
    setCrewLoading(true);
    getCrewEnrolledInProject(id)
      .then((res) => setCrew(res.crew ?? []))
      .catch(() => setCrew([]))
      .finally(() => setCrewLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getProjectById(projectId), getRigs().catch(() => ({ rigs: [] as RigApi[] }))])
      .then(([res, rigsRes]) => {
        if (cancelled) return;
        setProject(res);
        setRigs(rigsRes.rigs ?? []);
        loadCrew(res.id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, loadCrew]);

  const progress = project ? projectProgress(project) : 0;
  const tone = project ? projectTone(project.status) : 'teal';
  const ProjectIcon = Wrench;
  const pageError = !projectId ? 'Missing project id' : error;
  const rigDetails = useMemo(() => (project ? getProjectRigDetails(project, rigs) : null), [project, rigs]);

  const kpis = useMemo(() => {
    if (!project) return [];
    return [
      { label: 'Progress', value: `${progress}%`, meta: 'Overall completion', color: tone, bar: `${progress}%` },
      { label: 'Crew Enrolled', value: String(crew.length), meta: 'Assigned to project', color: 'blue', bar: `${Math.min(100, crew.length * 12)}%` },
      { label: 'End Date', value: formatDate(project.duration?.endDate), meta: `Started ${formatDate(project.duration?.startDate)}`, color: 'amber', bar: '70%' },
      { label: 'Participants', value: String(project.participants?.length ?? crew.length), meta: 'Total roster slots', color: 'teal', bar: `${Math.min(100, (project.participants?.length ?? crew.length) * 15)}%` },
    ];
  }, [crew.length, progress, project, tone]);

  const openInviteModal = useCallback(() => {
    if (!project) return;
    setIsInviteModalOpen(true);
    setSelectedCrewIds([]);
    setInviteError(null);
    setInviteSuccess(false);
    setAvailableCrewLoading(true);
    getCrewAvailableForProject(project.id)
      .then((res) => setAvailableCrew(res.crew ?? []))
      .catch(() => setAvailableCrew([]))
      .finally(() => setAvailableCrewLoading(false));
  }, [project]);

  const closeInviteModal = useCallback(() => {
    if (!inviteLoading) {
      setIsInviteModalOpen(false);
      setInviteError(null);
      setInviteSuccess(false);
    }
  }, [inviteLoading]);

  const toggleCrewSelection = useCallback((crewId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  }, []);

  const handleInviteCrew = async () => {
    if (!project || selectedCrewIds.length === 0) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteCrewToProject(project.id, selectedCrewIds);
      setInviteSuccess(true);
      loadCrew(project.id);
      setTimeout(closeInviteModal, 1200);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const tabs: Array<{ id: ProjectTab; label: string; icon: typeof FolderKanban }> = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'crew', label: 'Crew', icon: Users },
  ];

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="projects" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Project</span>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Project</div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`subsea-sb-link${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={13} /> {tab.label}
                {tab.id === 'crew' && <span className="subsea-sb-count">{crew.length}</span>}
              </button>
            );
          })}
          <div className="subsea-sb-group">Actions</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/projects')}>
            <ArrowLeft size={13} /> Back to Projects
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span>Projects</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">{project?.title || 'Project Details'}</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/projects')}>
              <ArrowLeft size={12} /> Back
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openInviteModal} disabled={!project}>
              <UserPlus size={12} /> Invite Crew
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div className="subsea-profile-head-left">
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/projects')}>
                <ArrowLeft size={11} /> Back
              </button>
              <div>
                <h1>{project?.title || 'Project Details'}</h1>
                <p>{project?.description || 'Project overview and crew roster'}</p>
              </div>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openInviteModal} disabled={!project}>
                <UserPlus size={11} /> Invite Crew
              </button>
            </div>
          </div>

          {loading ? (
            <div className="subsea-state" role="status">Loading project...</div>
          ) : pageError || !project ? (
            <div className="subsea-empty-panel" role="alert">
              <FolderKanban size={34} />
              <h3>Unable to load project</h3>
              <p>{pageError || 'Project not found'}</p>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/projects')}>
                Back to Projects
              </button>
            </div>
          ) : (
            <>
              <section className="subsea-proj-detail-hero">
                <div className={`subsea-proj-card-icon ${tone}`}>
                  <ProjectIcon size={18} />
                </div>
                <div className="subsea-proj-detail-hero-main">
                  <div className="subsea-proj-detail-hero-top">
                    <div>
                      <div className="subsea-proj-detail-title">{project.title}</div>
                      <div className="subsea-proj-detail-sub">{project.description || project.span || 'Operations programme'}</div>
                    </div>
                    <span className={`subsea-badge ${statusClass(project.status)}`}>
                      {(project.status || 'Active').replace('_', ' ')}
                    </span>
                  </div>
                  <div className="subsea-proj-progress">
                    <div className="subsea-proj-progress-label">
                      <span className="subsea-proj-progress-text">Overall Progress</span>
                      <span className="subsea-proj-progress-pct">{progress}%</span>
                    </div>
                    <div className="subsea-prog-bar">
                      <div className={`subsea-prog-fill ${tone}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="subsea-kpi-strip subsea-kpi-strip-4">
                {kpis.map((kpi) => (
                  <article key={kpi.label} className="subsea-kpi">
                    <div className="subsea-kpi-label">{kpi.label}</div>
                    <div className="subsea-kpi-value">{kpi.value}</div>
                    <div className="subsea-kpi-meta flat">{kpi.meta}</div>
                    <div className="subsea-kpi-bar">
                      <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                    </div>
                  </article>
                ))}
              </section>

              <div className="subsea-prof-tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      type="button"
                      key={tab.id}
                      className={`subsea-prof-tab${activeTab === tab.id ? ' active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon size={13} /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'overview' && (
                <div className="subsea-g2">
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Project Details</div></div>
                    <div className="subsea-detail-grid">
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Title</div><div className="subsea-detail-val">{project.title}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Status</div><div className="subsea-detail-val">{(project.status || 'Active').replace('_', ' ')}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Start Date</div><div className="subsea-detail-val">{formatDate(project.duration?.startDate)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">End Date</div><div className="subsea-detail-val">{formatDate(project.duration?.endDate)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Duration</div><div className="subsea-detail-val">{project.span || '—'}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Created</div><div className="subsea-detail-val">{formatDate(project.createdAt)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Description</div><div className="subsea-detail-val">{project.description || '—'}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Message to Crew</div><div className="subsea-detail-val">{project.span || '—'}</div></div>
                    </div>
                  </div>

                  <div>
                    <div className="subsea-pane subsea-mb-12">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Timeline</div></div>
                      <div className="subsea-feed">
                        <div className="subsea-feed-item">
                          <div className={`subsea-feed-icon ${tone}`}><Calendar size={13} /></div>
                          <div>
                            <div className="subsea-feed-text"><strong>Project start</strong></div>
                            <div className="subsea-feed-meta">{formatDate(project.duration?.startDate)}</div>
                          </div>
                        </div>
                        <div className="subsea-feed-item">
                          <div className={`subsea-feed-icon amber`}><CheckSquare size={13} /></div>
                          <div>
                            <div className="subsea-feed-text"><strong>Current progress</strong></div>
                            <div className="subsea-feed-meta">{progress}% complete · {crew.length} crew enrolled</div>
                          </div>
                        </div>
                        <div className="subsea-feed-item">
                          <div className={`subsea-feed-icon red`}><Calendar size={13} /></div>
                          <div>
                            <div className="subsea-feed-text"><strong>Project deadline</strong></div>
                            <div className="subsea-feed-meta">{formatDate(project.duration?.endDate)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="subsea-pane subsea-mb-12">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Rig Details</div></div>
                      <div className="subsea-detail-grid">
                        {rigDetails ? (
                          <>
                            <div className="subsea-detail-row"><div className="subsea-detail-label">Name</div><div className="subsea-detail-val">{rigDetails.name || '—'}</div></div>
                            <div className="subsea-detail-row"><div className="subsea-detail-label">Address</div><div className="subsea-detail-val">{rigDetails.address || '—'}</div></div>
                            <div className="subsea-detail-row"><div className="subsea-detail-label">Description</div><div className="subsea-detail-val">{rigDetails.description || '—'}</div></div>
                            <div className="subsea-detail-row"><div className="subsea-detail-label">Rig ID</div><div className="subsea-detail-val">{rigDetails.id || '—'}</div></div>
                          </>
                        ) : (
                          <div className="subsea-detail-row"><div className="subsea-detail-label">Assigned Rig</div><div className="subsea-detail-val">No rig assigned</div></div>
                        )}
                      </div>
                    </div>
                    <div className="subsea-pane">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Quick Stats</div></div>
                      <div className="subsea-detail-grid">
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Crew Enrolled</div><div className="subsea-detail-val">{crew.length}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Participants</div><div className="subsea-detail-val">{project.participants?.length ?? 0}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Progress</div><div className="subsea-detail-val">{progress}%</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'crew' && (
                <div className="subsea-pane">
                  <div className="subsea-pane-head">
                    <div>
                      <div className="subsea-pane-title">Project Crew</div>
                      <div className="subsea-pane-sub">{crewLoading ? 'Loading crew...' : `${crew.length} enrolled crew members`}</div>
                    </div>
                    <div className="subsea-pane-actions">
                      <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openInviteModal}>
                        <UserPlus size={12} /> Invite Crew
                      </button>
                    </div>
                  </div>
                  <div className="subsea-table-wrap">
                    {crewLoading ? (
                      <div className="subsea-state">Loading crew...</div>
                    ) : crew.length === 0 ? (
                      <div className="subsea-empty-panel">
                        <Users size={28} />
                        <h3>No crew enrolled yet</h3>
                        <p>Invite crew members whose availability aligns with this project.</p>
                        <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openInviteModal}>
                          <UserPlus size={12} /> Invite Crew
                        </button>
                      </div>
                    ) : (
                      <table className="subsea-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Organization</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crew.map((member) => {
                            const kind = availabilityFromCrewSignal(member.signal);
                            const status = crewStatusLabel(member);
                            return (
                              <tr key={member.id} onClick={() => navigate(`/crew/${member.id}`)}>
                                <td className="strong">
                                  <div className="subsea-roster-name">
                                    <span
                                      className={crewAvailabilityDotClass(kind)}
                                      title={getCrewAvailabilityLabel(kind)}
                                      aria-label={getCrewAvailabilityLabel(kind)}
                                    />
                                    <span>{crewName(member)}</span>
                                  </div>
                                </td>
                                <td>{member.email || '—'}</td>
                                <td>{member.organization || '—'}</td>
                                <td><span className={`subsea-badge ${status.className}`}>{status.label}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={closeInviteModal}
        title="Invite crew to project"
        size="medium"
        variant="subsea"
      >
        {project && (
          <div className="project-invite-modal">
            <p className="project-invite-intro">
              Invite crew members to <strong>{project.title}</strong>. Only crews whose availability aligns with this project&apos;s duration are listed.
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
                  <span className="project-invite-label">Crew members</span>
                  {availableCrewLoading ? (
                    <p className="project-invite-loading">Loading crew…</p>
                  ) : availableCrew.length === 0 ? (
                    <p className="project-invite-loading">No crew available for this project&apos;s duration.</p>
                  ) : (
                    <div className="project-invite-crew-list" role="group" aria-label="Select crew to invite">
                      {availableCrew.map((c) => (
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
                </div>
                <div className="project-invite-actions">
                  <button type="button" className="projects-page-form-cancel" onClick={closeInviteModal} disabled={inviteLoading}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="projects-page-form-submit"
                    onClick={handleInviteCrew}
                    disabled={inviteLoading || selectedCrewIds.length === 0 || availableCrewLoading}
                  >
                    {inviteLoading ? 'Sending…' : `Send invitation${selectedCrewIds.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectDetailsPage;
