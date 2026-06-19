import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Briefcase,
  CreditCard,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Search,
  Send,
  Ship,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserMinus,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import { getCrewList, getCrewById, createCrewMember, updateCrewMember, deleteCrewMember, inviteCrewToProject, removeCrewFromProject, crewApiToFormData, type CrewMemberApi, type CrewAssignedProject } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { availabilityFromCrewSignal, crewAvailabilityDotClass, getCrewAvailabilityLabel, type CrewAvailability } from '../utils/crewAvailability';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import ErrorAlertPopup from '../components/ErrorAlertPopup';
import type { CrewMemberFormData } from '../components/forms/CrewMemberForm';
import './CrewListPage.css';
import './RigsPage.css';

const CrewMemberForm = lazy(() => import('../components/forms/CrewMemberForm'));

function getInitials(firstname: string, lastname: string): string {
  const f = (firstname || '').trim().charAt(0) || '';
  const l = (lastname || '').trim().charAt(0) || '';
  return (f + l).toUpperCase() || '?';
}

function field(value: string | undefined): string {
  return value?.trim() || '—';
}

const SAMPLE_RANKS = ['Master', 'Chief Officer', '2nd Engineer', 'DP Operator', 'Chief Engineer', 'Radio Officer'];
const SAMPLE_RIGS = ['MV Deepwater Alpha', 'MV Nordic Surveyor', 'MV Poseidon Rex', 'MV Atlantic Pioneer', 'MV Gulf Endeavour'];

type RosterTab = 'available' | 'inProject';

function crewStatus(kind: CrewAvailability): { label: string; className: string } {
  if (kind === 'available') return { label: 'Available', className: 'subsea-b-green' };
  if (kind === 'endingSoon') return { label: 'Sign-Off Due', className: 'subsea-b-amber' };
  return { label: 'In Project', className: 'subsea-b-blue' };
}

const CrewListPage = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rosterTab, setRosterTab] = useState<RosterTab>('available');
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [selectedCrew, setSelectedCrew] = useState<CrewMemberApi | null>(null);
  const [crewDetailData, setCrewDetailData] = useState<{ crew: CrewMemberApi; projects: CrewAssignedProject[] } | null>(null);
  const [crewDetailLoading] = useState(false);
  const [crewDetailError, setCrewDetailError] = useState<string | null>(null);
  const [inviteCrewMember, setInviteCrewMember] = useState<CrewMemberApi | null>(null);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [editingCrew, setEditingCrew] = useState<CrewMemberApi | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteCrewId, setDeleteCrewId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [removeFromProjectCrew, setRemoveFromProjectCrew] = useState<CrewMemberApi | null>(null);
  const [assignedProjects, setAssignedProjects] = useState<CrewAssignedProject[]>([]);
  const [assignedProjectsLoading, setAssignedProjectsLoading] = useState(false);
  const [removeFromProjectId, setRemoveFromProjectId] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  const pageSize = 5;

  const loadCrew = useCallback(async (withListLoading: boolean) => {
    if (withListLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const crewRes = await getCrewList();
      setCrew(crewRes.crew ?? []);
    } catch (err) {
      if (withListLoading) {
        setError(err instanceof Error ? err.message : 'Failed to load crew');
      }
    } finally {
      if (withListLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCrew(true);
  }, [loadCrew]);

  const refreshCrewData = useCallback(() => {
    return loadCrew(false);
  }, [loadCrew]);

  const filteredCrew = useMemo(() => {
    let list = crew.filter((member) => {
      const kind = availabilityFromCrewSignal(member.signal);
      return rosterTab === 'available' ? kind === 'available' : kind !== 'available';
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.firstname + ' ' + c.lastname).toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [crew, rosterTab, search]);

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
      void refreshCrewData();
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
      await refreshCrewData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add crew member');
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (member: CrewMemberApi) => {
    setEditingCrew(member);
    setEditError(null);
  };

  const closeEditModal = () => {
    if (!editLoading) {
      setEditingCrew(null);
      setEditError(null);
    }
  };

  const handleSubmitEdit = async (data: CrewMemberFormData) => {
    if (!editingCrew) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await updateCrewMember(editingCrew.id, data);
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
          setEditError(msg);
          return;
        }
      }
      closeEditModal();
      closeCrewDetail();
      await refreshCrewData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update crew member');
    } finally {
      setEditLoading(false);
    }
  };

  const openDeleteConfirm = (member: CrewMemberApi) => {
    setDeleteCrewId(member.id);
    setDeleteError(null);
  };

  const closeDeleteConfirm = () => {
    if (!deleteLoading) {
      setDeleteCrewId(null);
      setDeleteError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCrewId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteCrewMember(deleteCrewId);
      closeDeleteConfirm();
      closeCrewDetail();
      await refreshCrewData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete crew member');
    } finally {
      setDeleteLoading(false);
    }
  };

  const memberToDelete = crew.find((c) => c.id === deleteCrewId);

  const openRemoveFromProjectModal = useCallback((member: CrewMemberApi) => {
    setRemoveFromProjectCrew(member);
    setRemoveFromProjectId('');
    setRemoveError(null);
    setRemoveSuccess(false);
    setAssignedProjects([]);
    setAssignedProjectsLoading(true);
    getCrewById(member.id)
      .then((res) => setAssignedProjects(res.projects ?? []))
      .catch(() => setAssignedProjects([]))
      .finally(() => setAssignedProjectsLoading(false));
  }, []);

  const closeRemoveFromProjectModal = useCallback(() => {
    if (!removeLoading) {
      setRemoveFromProjectCrew(null);
      setAssignedProjects([]);
      setRemoveFromProjectId('');
      setRemoveError(null);
      setRemoveSuccess(false);
    }
  }, [removeLoading]);

  const handleRemoveFromProject = async () => {
    if (!removeFromProjectCrew || !removeFromProjectId) return;
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      await removeCrewFromProject(removeFromProjectId, removeFromProjectCrew.id);
      setRemoveSuccess(true);
      setTimeout(() => {
        closeRemoveFromProjectModal();
        void refreshCrewData();
      }, 1200);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove crew from project');
    } finally {
      setRemoveLoading(false);
    }
  };

  const onProjectCount = crew.filter((member) => availabilityFromCrewSignal(member.signal) !== 'available').length;
  const availableCount = crew.filter((member) => availabilityFromCrewSignal(member.signal) === 'available').length;
  const nationalityCount = new Set(
    crew
      .map((member) => (member.nationality || member.country || '').trim())
      .filter(Boolean)
  ).size;

  const openCrewDetail = useCallback((member: CrewMemberApi) => {
    navigate(`/crew/${member.id}`);
  }, [navigate]);

  const closeCrewDetail = useCallback(() => {
    setSelectedCrew(null);
    setCrewDetailData(null);
    setCrewDetailError(null);
  }, []);

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="crew" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Crew Management</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search crew, rigs..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Crew</div>
          <button
            type="button"
            className={`subsea-sb-link${rosterTab === 'available' ? ' active' : ''}`}
            onClick={() => {
              setRosterTab('available');
              setPage(1);
            }}
          >
            <UserPlus size={13} /> Available <span className="subsea-sb-count">{loading ? '...' : availableCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${rosterTab === 'inProject' ? ' active' : ''}`}
            onClick={() => {
              setRosterTab('inProject');
              setPage(1);
            }}
          >
            <UserCheck size={13} /> In Project <span className="subsea-sb-count">{loading ? '...' : onProjectCount}</span>
          </button>
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/rig')}>
            <Ship size={13} /> Rig Assignments <span className="subsea-sb-count">11</span>
          </button>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/tickets')}>
            <Plane size={13} /> Crew Flights <span className="subsea-sb-count">31</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <button
            type="button"
            className="subsea-btn subsea-btn-default subsea-btn-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={12} className="mr-1.5" /> Back
          </button>
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Crew Management</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={handleAddCrewMember}>
              <Plus size={12} /> Add Crew
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Crew Management</h1>
              <p>{loading ? 'Loading crew roster...' : `${crew.length} crew members · 11 rigs · ${Math.max(nationalityCount, 1)} nationalities`}</p>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
                <Upload size={11} /> Import
              </button>
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={handleAddCrewMember}>
                <Plus size={11} /> Add Crew
              </button>
            </div>
          </div>

          <section className="subsea-kpi-strip subsea-kpi-strip-4">
            {[
              { label: 'Total Crew', value: loading ? '...' : String(crew.length), meta: '+12 this month', tone: 'up', bar: '71%', color: 'blue' },
              { label: 'Available', value: loading ? '...' : String(availableCount), meta: `${crew.length ? Math.round((availableCount / crew.length) * 100) : 0}% of roster`, tone: 'flat', bar: `${crew.length ? Math.round((availableCount / crew.length) * 100) : 0}%`, color: 'green' },
              { label: 'In Project', value: loading ? '...' : String(onProjectCount), meta: `${crew.length ? Math.round((onProjectCount / crew.length) * 100) : 0}% of roster`, tone: 'flat', bar: `${crew.length ? Math.round((onProjectCount / crew.length) * 100) : 0}%`, color: 'teal' },
              { label: 'Nationalities', value: loading ? '...' : String(nationalityCount || '—'), meta: 'GBR, PHL, IND, NOR...', tone: 'flat', bar: '40%', color: 'amber' },
            ].map((kpi) => (
              <article key={kpi.label} className="subsea-kpi">
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{kpi.value}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>{kpi.meta}</div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          <div className="subsea-toolbar-row">
            <div className="subsea-tb-search">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search by name, rank, IMO no..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">All Ranks</button>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">All Rigs</button>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">Status: All</button>
            <div className="subsea-toolbar-spacer" />
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={11} /> Export
            </button>
          </div>

          <div className="user-mgmt-availability-legend" role="list" aria-label="Availability legend">
            <span className="user-mgmt-availability-legend-item" role="listitem">
              <span className="user-mgmt-availability-dot user-mgmt-availability-dot--available" aria-hidden />
              <span>Available</span>
            </span>
            <span className="user-mgmt-availability-legend-item" role="listitem">
              <span className="user-mgmt-availability-dot user-mgmt-availability-dot--on-project" aria-hidden />
              <span>In project</span>
            </span>
            <span className="user-mgmt-availability-legend-item" role="listitem">
              <span className="user-mgmt-availability-dot user-mgmt-availability-dot--ending-soon" aria-hidden />
              <span>In project, ends in ≤7 days</span>
            </span>
          </div>

          <div className="subsea-pane">
            <div className="subsea-pane-head">
              <div className="subsea-pane-title">{rosterTab === 'available' ? 'Available Crew' : 'Crew In Project'}</div>
              <div className="subsea-pane-actions">
                <span className="subsea-pane-sub">{loading ? 'Loading...' : `${filteredCrew.length} members`}</span>
              </div>
            </div>
            <div className="subsea-table-wrap">
              {loading ? (
                <div className="subsea-state">Loading crew...</div>
              ) : error ? (
                <div className="subsea-state subsea-state-error" role="alert">{error}</div>
              ) : (
                <table className="subsea-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>Nationality</th>
                      <th>Rig</th>
                      <th>Status</th>
                      <th>Certs</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCrew.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="subsea-empty-cell">
                          {rosterTab === 'available' ? 'No available crew members found.' : 'No crew members currently in project.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedCrew.map((member, index) => {
                        const kind = availabilityFromCrewSignal(member.signal);
                        const status = crewStatus(kind);
                        const project = member.activeProjects?.[0];
                        const certExpiring = member.certificate_expiry_date || member.crew_certificate?.expiry_date;
                        return (
                          <tr key={member.id} onClick={() => openCrewDetail(member)}>
                            <td className="strong">
                              <div className="subsea-roster-name">
                                <span
                                  className={crewAvailabilityDotClass(kind)}
                                  title={getCrewAvailabilityLabel(kind)}
                                  aria-label={getCrewAvailabilityLabel(kind)}
                                />
                                <div className={`subsea-c-av subsea-c-av-${index % 6}`}>
                                  {getInitials(member.firstname, member.lastname)}
                                </div>
                                <span>{member.firstname} {member.lastname}</span>
                              </div>
                            </td>
                            <td>{member.organization || SAMPLE_RANKS[index % SAMPLE_RANKS.length]}</td>
                            <td className="mono">{member.nationality || member.country || '—'}</td>
                            <td>{project?.title || SAMPLE_RIGS[index % SAMPLE_RIGS.length]}</td>
                            <td><span className={`subsea-badge ${status.className}`}>{status.label}</span></td>
                            <td>
                              <span className={`subsea-badge ${certExpiring ? 'subsea-b-amber' : 'subsea-b-green'}`}>
                                {certExpiring ? '1 expiring' : 'All valid'}
                              </span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="subsea-row-actions">
                                <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => openCrewDetail(member)}>
                                  View
                                </button>
                                <button type="button" className="subsea-icon-action" aria-label="Invite to project" title="Invite to project" onClick={() => openInviteModal(member)}>
                                  <Send size={13} />
                                </button>
                                <button type="button" className="subsea-icon-action" aria-label="Edit crew member" title="Edit crew member" onClick={() => openEditModal(member)}>
                                  <Pencil size={13} />
                                </button>
                                <button type="button" className="subsea-icon-action" aria-label="Remove from project" title="Remove from project" onClick={() => openRemoveFromProjectModal(member)}>
                                  <UserMinus size={13} />
                                </button>
                                <button type="button" className="subsea-icon-action danger" aria-label="Delete crew member" title="Delete crew member" onClick={() => openDeleteConfirm(member)}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {!loading && !error && filteredCrew.length > pageSize && (
            <div className="subsea-pagination">
              <span>
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredCrew.length)} of {filteredCrew.length} crew members
              </span>
              <div>
                <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className={`subsea-btn subsea-btn-sm ${p === page ? 'subsea-btn-primary' : 'subsea-btn-default'}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal} title="Add New Crew Member" size="xlarge" variant="subsea">
        {addError && (
          <ErrorAlertPopup message={addError} onDismiss={() => setAddError(null)} />
        )}
        <Suspense
          fallback={
            <div className="user-mgmt-form-suspense" role="status" aria-busy="true" aria-label="Loading form">
              <Loader2 size={32} className="user-mgmt-form-suspense-spinner" />
              <p>Loading form…</p>
            </div>
          }
        >
          <CrewMemberForm
            onSubmit={handleSubmitCrewMember}
            onCancel={handleCloseAddModal}
            isLoading={addLoading}
            theme="subsea"
          />
        </Suspense>
      </Modal>

      <Modal isOpen={!!editingCrew} onClose={closeEditModal} title="Edit Crew Member" size="xlarge" variant="subsea">
        {editingCrew && (
          <>
            {editError && (
              <ErrorAlertPopup message={editError} onDismiss={() => setEditError(null)} />
            )}
            <Suspense
              fallback={
                <div className="user-mgmt-form-suspense" role="status" aria-busy="true" aria-label="Loading form">
                  <Loader2 size={32} className="user-mgmt-form-suspense-spinner" />
                  <p>Loading form…</p>
                </div>
              }
            >
              <CrewMemberForm
                key={editingCrew.id}
                mode="edit"
                onSubmit={handleSubmitEdit}
                onCancel={closeEditModal}
                isLoading={editLoading}
                initialData={crewApiToFormData(editingCrew)}
                submitLabel="Save Changes"
                theme="subsea"
              />
            </Suspense>
          </>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteCrewId}
        onClose={closeDeleteConfirm}
        title="Delete Crew Member"
        size="small"
        variant="subsea"
      >
        {memberToDelete && (
          <div className="delete-crew-modal">
            <p className="delete-crew-message">
              Are you sure you want to delete <strong>{memberToDelete.firstname} {memberToDelete.lastname}</strong>? This action cannot be undone.
            </p>
            {deleteError && (
              <ErrorAlertPopup message={deleteError} onDismiss={() => setDeleteError(null)} />
            )}
            <div className="delete-crew-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={closeDeleteConfirm}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!removeFromProjectCrew}
        onClose={closeRemoveFromProjectModal}
        title="Remove from Project"
        size="medium"
        variant="subsea"
      >
        {removeFromProjectCrew && (
          <div className="invite-to-project-modal">
            <p className="invite-to-project-intro">
              Remove <strong>{removeFromProjectCrew.firstname} {removeFromProjectCrew.lastname}</strong> from a project. They will no longer be assigned to the selected project.
            </p>
            {removeSuccess ? (
              <div className="invite-to-project-success" role="status">
                Crew member removed from project successfully.
              </div>
            ) : (
              <>
                {removeError && (
                  <ErrorAlertPopup message={removeError} onDismiss={() => setRemoveError(null)} />
                )}
                <div className="invite-to-project-field">
                  <label htmlFor="remove-project-select" className="invite-to-project-label">
                    Assigned project
                  </label>
                  {assignedProjectsLoading ? (
                    <p className="invite-to-project-loading">Loading assigned projects…</p>
                  ) : assignedProjects.length === 0 ? (
                    <p className="invite-to-project-loading">This crew member is not assigned to any project.</p>
                  ) : (
                    <select
                      id="remove-project-select"
                      className="invite-to-project-select"
                      value={removeFromProjectId}
                      onChange={(e) => setRemoveFromProjectId(e.target.value)}
                      disabled={removeLoading}
                    >
                      <option value="">Select a project</option>
                      {assignedProjects.map((p) => (
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
                    onClick={closeRemoveFromProjectModal}
                    disabled={removeLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="invite-to-project-submit"
                    onClick={handleRemoveFromProject}
                    disabled={removeLoading || !removeFromProjectId || assignedProjectsLoading || assignedProjects.length === 0}
                  >
                    {removeLoading ? 'Removing…' : 'Remove from project'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!inviteCrewMember}
        onClose={closeInviteModal}
        title="Invite to project"
        size="medium"
        variant="subsea"
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
        onClose={closeCrewDetail}
        title={selectedCrew ? `${selectedCrew.firstname} ${selectedCrew.lastname} — Crew Details` : 'Crew Details'}
        size="xlarge"
        variant="subsea"
      >
        {selectedCrew && (
          <div className="crew-detail-modal">
            {crewDetailLoading ? (
              <div className="crew-detail-loading">
                <Loader2 size={32} className="crew-detail-spinner" />
                <p>Loading crew details…</p>
              </div>
            ) : crewDetailError ? (
              <div className="crew-detail-error">
                <ErrorAlertPopup message={crewDetailError} onDismiss={() => setCrewDetailError(null)} />
              </div>
            ) : crewDetailData ? (
              <>
                <div className="crew-detail-grid">
                  {(() => {
                    const c = crewDetailData.crew;
                    const raw = c as Record<string, unknown> & CrewMemberApi;
                    const certRaw = raw.crew_certificate;
                    const certs: Array<{ certificate_name?: string; issue_date?: string; expiry_date?: string }> = Array.isArray(certRaw)
                      ? certRaw
                      : certRaw && typeof certRaw === 'object'
                        ? [certRaw as { certificate_name?: string; issue_date?: string; expiry_date?: string }]
                        : [];
                    return (
                      <>
                        <section className="crew-detail-card crew-detail-card--span-2">
                          <h3 className="crew-detail-card-title"><User size={20} /> Personal</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">First name</span>
                              <span className="crew-detail-value">{field(c.firstname)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Last name</span>
                              <span className="crew-detail-value">{field(c.lastname)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Date of birth</span>
                              <span className="crew-detail-value">{field(c.dateOfBirth ?? (raw.date_of_birth as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Nationality</span>
                              <span className="crew-detail-value">{field(c.nationality ?? (raw.nationality as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Gender</span>
                              <span className="crew-detail-value">{field(c.gender ?? (raw.gender as string))}</span>
                            </div>
                          </div>
                        </section>

                        <section className="crew-detail-card">
                          <h3 className="crew-detail-card-title"><Mail size={20} /> Contact</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Email</span>
                              <span className="crew-detail-value">{field(c.email)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Phone</span>
                              <span className="crew-detail-value">{field(c.phone)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Alternate phone</span>
                              <span className="crew-detail-value">{field(c.alternate_phone ?? (raw.alternate_phone as string))}</span>
                            </div>
                          </div>
                        </section>

                        <section className="crew-detail-card">
                          <h3 className="crew-detail-card-title"><MapPin size={20} /> Address</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Address</span>
                              <span className="crew-detail-value">{field(c.address ?? (raw.address as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">City</span>
                              <span className="crew-detail-value">{field(c.city ?? (raw.city as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Country</span>
                              <span className="crew-detail-value">{field(c.country ?? (raw.country as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Postal code</span>
                              <span className="crew-detail-value">{field(c.postal_code ?? (raw.postal_code as string))}</span>
                            </div>
                          </div>
                        </section>

                        <section className="crew-detail-card crew-detail-card--span-2">
                          <h3 className="crew-detail-card-title"><FileText size={20} /> Passport</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Passport number</span>
                              <span className="crew-detail-value">{field(c.passport?.passport_number)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Issuing country</span>
                              <span className="crew-detail-value">{field(c.passport?.issuing_country)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Issue date</span>
                              <span className="crew-detail-value">{field(c.passport?.issue_date)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Expiry date</span>
                              <span className="crew-detail-value">{field(c.passport?.expiry_date)}</span>
                            </div>
                          </div>
                        </section>

                        <section className="crew-detail-card crew-detail-card--span-2">
                          <h3 className="crew-detail-card-title"><CreditCard size={20} /> Identity</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Identity type</span>
                              <span className="crew-detail-value">{field(c.identity?.identity_type)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Identity number</span>
                              <span className="crew-detail-value">{field(c.identity?.identity_number)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Issue date</span>
                              <span className="crew-detail-value">{field(c.identity?.issue_date)}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Expiry date</span>
                              <span className="crew-detail-value">{field(c.identity?.expiry_date)}</span>
                            </div>
                          </div>
                        </section>

                        <section className="crew-detail-card crew-detail-card--span-2">
                          <h3 className="crew-detail-card-title"><Briefcase size={20} /> Professional &amp; Numbers</h3>
                          <div className="crew-detail-fields">
                            <div className="crew-detail-field crew-detail-field--wide">
                              <span className="crew-detail-label">Organization</span>
                              <span className="crew-detail-value">{field(c.organization ?? (raw.organization as string))}</span>
                            </div>
                            <div className="crew-detail-field crew-detail-field--wide">
                              <span className="crew-detail-label">LinkedIn</span>
                              <span className="crew-detail-value">
                                {field(c.linkedin ?? (raw.linkedin as string)) !== '—' ? (
                                  <a href={(c.linkedin ?? raw.linkedin) as string} target="_blank" rel="noopener noreferrer" className="crew-detail-link">
                                    {field(c.linkedin ?? (raw.linkedin as string))}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Azerbaijan Vantage number</span>
                              <span className="crew-detail-value">{field(c.azerbaijan_vantage_number ?? (raw.azerbaijan_vantage_number as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Norwegian D number</span>
                              <span className="crew-detail-value">{field(c.norwegian_d_number ?? (raw.norwegian_d_number as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Dawinci number</span>
                              <span className="crew-detail-value">{field(c.dawinci_number ?? (raw.dawinci_number as string))}</span>
                            </div>
                            <div className="crew-detail-field">
                              <span className="crew-detail-label">Vantage number</span>
                              <span className="crew-detail-value">{field(c.vantage_number ?? (raw.vantage_number as string))}</span>
                            </div>
                          </div>
                        </section>

                        {(() => {
                          const visaRaw = (c.visa ?? (raw.visa as string) ?? '').trim();
                          const visaParts: Record<string, string> = {};
                          if (visaRaw) {
                            visaRaw.split('|').forEach((seg) => {
                              const s = seg.trim();
                              const colonIdx = s.indexOf(':');
                              if (colonIdx > 0) {
                                const key = s.slice(0, colonIdx).trim().toLowerCase();
                                const val = s.slice(colonIdx + 1).trim();
                                if (key === 'country') visaParts.country = val;
                                else if (key === 'issue') visaParts.issue = val;
                                else if (key === 'expiry') visaParts.expiry = val;
                              }
                            });
                          }
                          return (
                            <section className="crew-detail-card crew-detail-card--span-2">
                              <h3 className="crew-detail-card-title"><FileText size={20} /> Visa</h3>
                              <div className="crew-detail-fields">
                                <div className="crew-detail-field">
                                  <span className="crew-detail-label">Visa country</span>
                                  <span className="crew-detail-value">{field(visaParts.country)}</span>
                                </div>
                                <div className="crew-detail-field">
                                  <span className="crew-detail-label">Issue date</span>
                                  <span className="crew-detail-value">{field(visaParts.issue)}</span>
                                </div>
                                <div className="crew-detail-field">
                                  <span className="crew-detail-label">Expiry date</span>
                                  <span className="crew-detail-value">{field(visaParts.expiry)}</span>
                                </div>
                              </div>
                            </section>
                          );
                        })()}

                        {certs.length > 0 && certs.some((x) => (x?.certificate_name ?? '').trim() || (x?.issue_date ?? '').trim() || (x?.expiry_date ?? '').trim()) ? (
                          <section className="crew-detail-card crew-detail-card--span-2">
                            <h3 className="crew-detail-card-title"><Award size={20} /> Certificates</h3>
                            {certs.map((cert, idx) => (
                              <div key={idx} className={certs.length > 1 ? 'mb-4 last:mb-0' : ''}>
                                {certs.length > 1 && (
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Certificate {idx + 1}</p>
                                )}
                                <div className="crew-detail-fields">
                                  <div className="crew-detail-field">
                                    <span className="crew-detail-label">Certificate name</span>
                                    <span className="crew-detail-value">{field(cert.certificate_name)}</span>
                                  </div>
                                  <div className="crew-detail-field">
                                    <span className="crew-detail-label">Issue date</span>
                                    <span className="crew-detail-value">{field(cert.issue_date)}</span>
                                  </div>
                                  <div className="crew-detail-field">
                                    <span className="crew-detail-label">Expiry date</span>
                                    <span className="crew-detail-value">{field(cert.expiry_date)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </section>
                        ) : null}

                        {crewDetailData.projects.length > 0 && (
                          <section className="crew-detail-card crew-detail-card--span-2">
                            <h3 className="crew-detail-card-title"><FolderOpen size={20} /> Assigned Projects</h3>
                            <ul className="crew-detail-projects-list">
                              {crewDetailData.projects.map((p) => (
                                <li key={p.id} className="crew-detail-project-item">
                                  <span className="crew-detail-project-title">{p.title}</span>
                                  {p.status && <span className="crew-detail-project-status">({p.status})</span>}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="crew-detail-actions">
                  <button
                    type="button"
                    className="crew-detail-edit-btn"
                    onClick={() => {
                      openEditModal(crewDetailData.crew);
                      closeCrewDetail();
                    }}
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="crew-detail-invite-btn"
                    onClick={() => {
                      closeCrewDetail();
                      openInviteModal(crewDetailData.crew);
                    }}
                  >
                    <Send size={16} />
                    Invite to project
                  </button>
                  <button type="button" className="crew-detail-close-btn" onClick={closeCrewDetail}>
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CrewListPage;
