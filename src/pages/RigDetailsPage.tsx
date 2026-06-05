import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Anchor,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Calendar,
  CalendarDays,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  Plane,
  Radio,
  Settings,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import type { ProjectApi } from '../api/project';
import { getRigById, type RigApi, type RigCreatedByAdmin } from '../api/rig';
import './RigsPage.css';

type RigTab = 'overview' | 'projects';

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

function statusClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'subsea-b-green';
  if (s === 'finished' || s === 'completed') return 'subsea-b-gray';
  if (s === 'onhold' || s === 'pending' || s === 'draft') return 'subsea-b-amber';
  return 'subsea-b-teal';
}

function createdByLabel(createdBy?: RigApi['createdBy']): string {
  if (!createdBy) return '—';
  if (typeof createdBy === 'string') return createdBy;
  const admin = createdBy as RigCreatedByAdmin;
  const name = `${admin.firstname ?? ''} ${admin.lastname ?? ''}`.trim();
  return name || admin.email || '—';
}

function activeProjectCount(projects: ProjectApi[]): number {
  return projects.filter((project) => (project.status || '').toLowerCase() === 'active').length;
}

function totalParticipants(projects: ProjectApi[]): number {
  return projects.reduce((sum, project) => sum + (project.participants?.length ?? 0), 0);
}

const RigDetailsPage = () => {
  const { rigId } = useParams<{ rigId: string }>();
  const navigate = useNavigate();
  const [rig, setRig] = useState<RigApi | null>(null);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(() => Boolean(rigId));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RigTab>('overview');

  useEffect(() => {
    if (!rigId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRigById(rigId)
      .then((res) => {
        if (cancelled) return;
        setRig(res.rig);
        setProjects(res.projects ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load rig details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rigId]);

  const pageError = !rigId ? 'Missing rig id' : error;
  const activeCount = useMemo(() => activeProjectCount(projects), [projects]);
  const participantCount = useMemo(() => totalParticipants(projects), [projects]);

  const kpis = useMemo(() => {
    if (!rig) return [];
    return [
      { label: 'Assigned Projects', value: String(projects.length), meta: `${activeCount} active`, color: 'blue', bar: projects.length ? `${Math.min(100, projects.length * 20)}%` : '0%' },
      { label: 'Active Projects', value: String(activeCount), meta: 'Currently in progress', color: 'green', bar: projects.length ? `${Math.round((activeCount / projects.length) * 100)}%` : '0%' },
      { label: 'Crew Assigned', value: String(participantCount), meta: 'Across all projects', color: 'teal', bar: participantCount ? `${Math.min(100, participantCount * 8)}%` : '0%' },
      { label: 'Position', value: rig.address ? 'Live' : 'Unknown', meta: rig.address || 'No position recorded', color: 'amber', bar: '70%' },
    ];
  }, [activeCount, participantCount, projects.length, rig]);

  const tabs: Array<{ id: RigTab; label: string; icon: typeof Ship }> = [
    { id: 'overview', label: 'Overview', icon: Ship },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
  ];

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
            { icon: Ship, label: 'Rigs', path: '/rig', active: true },
            { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
            { icon: Wallet, label: 'Payroll', path: '/payroll' },
            { icon: FileText, label: 'Contracts', path: '/contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects', path: '/projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar', path: '/timeline' },
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
          <SubseaProfileMenu />
        </div>
      </nav>

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Rig</span>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Rig</div>
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
                {tab.id === 'projects' && <span className="subsea-sb-count">{projects.length}</span>}
              </button>
            );
          })}
          <div className="subsea-sb-group">Actions</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/rig')}>
            <ArrowLeft size={13} /> Back to Rigs
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span>Rig Fleet</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">{rig?.name || 'Rig Details'}</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/rig')}>
              <ArrowLeft size={12} /> Back
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div className="subsea-profile-head-left">
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/rig')}>
                <ArrowLeft size={11} /> Back
              </button>
              <div>
                <h1>{rig?.name || 'Rig Details'}</h1>
                <p>{rig?.description || rig?.address || 'Rig overview and assigned projects'}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="subsea-state" role="status">Loading rig details...</div>
          ) : pageError || !rig ? (
            <div className="subsea-empty-panel" role="alert">
              <Ship size={34} />
              <h3>Unable to load rig</h3>
              <p>{pageError || 'Rig not found'}</p>
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate('/rig')}>
                Back to Rigs
              </button>
            </div>
          ) : (
            <>
              <section className="subsea-proj-detail-hero">
                <div className="subsea-proj-card-icon blue">
                  <Ship size={18} />
                </div>
                <div className="subsea-proj-detail-hero-main">
                  <div className="subsea-proj-detail-hero-top">
                    <div>
                      <div className="subsea-proj-detail-title">{rig.name}</div>
                      <div className="subsea-proj-detail-sub">{rig.address || 'No position recorded'}</div>
                    </div>
                    <span className="subsea-badge subsea-b-blue">{projects.length} project{projects.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="subsea-proj-progress">
                    <div className="subsea-proj-progress-label">
                      <span className="subsea-proj-progress-text">Fleet assignment</span>
                      <span className="subsea-proj-progress-pct">{activeCount} active</span>
                    </div>
                    <div className="subsea-prog-bar">
                      <div
                        className="subsea-prog-fill blue"
                        style={{ width: projects.length ? `${Math.round((activeCount / projects.length) * 100)}%` : '0%' }}
                      />
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
                      {tab.id === 'projects' && projects.length > 0 && (
                        <span className="subsea-badge subsea-b-blue">{projects.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'overview' && (
                <div className="subsea-g2">
                  <div className="subsea-pane">
                    <div className="subsea-pane-head"><div className="subsea-pane-title">Rig Details</div></div>
                    <div className="subsea-detail-grid">
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Name</div><div className="subsea-detail-val">{rig.name}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Position</div><div className="subsea-detail-val">{rig.address || '—'}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Description</div><div className="subsea-detail-val">{rig.description || '—'}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Created</div><div className="subsea-detail-val">{formatDate(rig.createdAt)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Last Updated</div><div className="subsea-detail-val">{formatDate(rig.updatedAt)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Created By</div><div className="subsea-detail-val">{createdByLabel(rig.createdBy)}</div></div>
                      <div className="subsea-detail-row"><div className="subsea-detail-label">Rig ID</div><div className="subsea-detail-val">{rig.id}</div></div>
                    </div>
                  </div>

                  <div>
                    <div className="subsea-pane subsea-mb-12">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Location</div></div>
                      <div className="subsea-feed">
                        <div className="subsea-feed-item">
                          <div className="subsea-feed-icon blue"><MapPin size={13} /></div>
                          <div>
                            <div className="subsea-feed-text"><strong>Current position</strong></div>
                            <div className="subsea-feed-meta">{rig.address || 'No position recorded'}</div>
                          </div>
                        </div>
                        <div className="subsea-feed-item">
                          <div className="subsea-feed-icon teal"><Calendar size={13} /></div>
                          <div>
                            <div className="subsea-feed-text"><strong>Registered</strong></div>
                            <div className="subsea-feed-meta">{formatDate(rig.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="subsea-pane">
                      <div className="subsea-pane-head"><div className="subsea-pane-title">Quick Stats</div></div>
                      <div className="subsea-detail-grid">
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Assigned Projects</div><div className="subsea-detail-val">{projects.length}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Active Projects</div><div className="subsea-detail-val">{activeCount}</div></div>
                        <div className="subsea-detail-row"><div className="subsea-detail-label">Total Crew</div><div className="subsea-detail-val">{participantCount}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="subsea-pane">
                  <div className="subsea-pane-head">
                    <div>
                      <div className="subsea-pane-title">Assigned Projects</div>
                      <div className="subsea-pane-sub">{projects.length} project{projects.length === 1 ? '' : 's'} linked to this rig</div>
                    </div>
                  </div>
                  <div className="subsea-table-wrap">
                    {projects.length === 0 ? (
                      <div className="subsea-state">No projects assigned to this rig yet.</div>
                    ) : (
                      <table className="subsea-table">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Crew</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map((project) => (
                            <tr
                              key={project.id}
                              onClick={() => navigate(`/projects/${project.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="strong">{project.title}</td>
                              <td>{formatDate(project.duration?.startDate)}</td>
                              <td>{formatDate(project.duration?.endDate)}</td>
                              <td>{project.participants?.length ?? 0}</td>
                              <td>
                                <span className={`subsea-badge ${statusClass(project.status)}`}>
                                  {(project.status || 'active').replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
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
    </div>
  );
};

export default RigDetailsPage;
