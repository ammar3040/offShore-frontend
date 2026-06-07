import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Filter,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { getSignedContracts, type SignedProjectContract } from '../api/contract';
import { getCrewList, inviteCrewToProject, type CrewMemberApi } from '../api/crew';
import { getProjects, type ProjectApi } from '../api/project';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import {
  DEFAULT_CONTRACT_DRAFT_TEMPLATE,
  deleteContractDraft,
  getContractDrafts,
  markContractDraftSent,
  saveContractDraft,
  type ContractDraft,
} from '../lib/contractsStore';
import './RigsPage.css';
import './ContractsPage.css';

type ContractsTab = 'drafts' | 'signed';

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

function crewDisplayName(member: CrewMemberApi): string {
  return `${member.firstname ?? ''} ${member.lastname ?? ''}`.trim() || member.email || member.id;
}

const ContractsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ContractsTab>('drafts');
  const [contracts, setContracts] = useState<SignedProjectContract[]>([]);
  const [drafts, setDrafts] = useState<ContractDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [crewList, setCrewList] = useState<CrewMemberApi[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftProjectId, setDraftProjectId] = useState('');
  const [draftBody, setDraftBody] = useState(DEFAULT_CONTRACT_DRAFT_TEMPLATE);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [crewSearch, setCrewSearch] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setDrafts(getContractDrafts());
    try {
      const { contracts: signed } = await getSignedContracts();
      setContracts(signed);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'offshore-contract-drafts') {
        setDrafts(getContractDrafts());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    Promise.all([getProjects(), getCrewList()])
      .then(([projectsRes, crewRes]) => {
        if (cancelled) return;
        setProjects(projectsRes.projects ?? []);
        setCrewList(crewRes.crew ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === draftProjectId) ?? null,
    [projects, draftProjectId]
  );

  const resetEditor = useCallback((draft?: ContractDraft | null) => {
    if (draft) {
      setSelectedDraftId(draft.id);
      setDraftTitle(draft.title);
      setDraftProjectId(draft.projectId);
      setDraftBody(draft.body);
      setSelectedCrewIds(draft.crewIds);
    } else {
      setSelectedDraftId(null);
      setDraftTitle('');
      setDraftProjectId('');
      setDraftBody(DEFAULT_CONTRACT_DRAFT_TEMPLATE);
      setSelectedCrewIds([]);
    }
    setCrewSearch('');
    setSaveMessage(null);
    setSaveError(null);
  }, []);

  const startNewDraft = () => {
    setActiveTab('drafts');
    resetEditor(null);
  };

  const openDraft = (draft: ContractDraft) => {
    setActiveTab('drafts');
    resetEditor(draft);
  };

  const filteredCrew = useMemo(() => {
    const q = crewSearch.trim().toLowerCase();
    if (!q) return crewList;
    return crewList.filter((c) => {
      const name = crewDisplayName(c).toLowerCase();
      return name.includes(q) || c.email?.toLowerCase().includes(q);
    });
  }, [crewList, crewSearch]);

  const toggleCrewSelection = (crewId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  };

  const handleSaveDraft = () => {
    setSaveError(null);
    setSaveMessage(null);

    if (!draftProjectId) {
      setSaveError('Select a project before saving the contract draft.');
      return;
    }
    if (!draftBody.trim()) {
      setSaveError('Contract body cannot be empty.');
      return;
    }

    const projectTitle = selectedProject?.title ?? 'Project assignment';
    const saved = saveContractDraft({
      id: selectedDraftId ?? undefined,
      title: draftTitle.trim() || `${projectTitle} contract`,
      projectId: draftProjectId,
      projectTitle,
      body: draftBody,
      crewIds: selectedCrewIds,
      status: 'draft',
    });

    setSelectedDraftId(saved.id);
    setDrafts(getContractDrafts());
    setSaveMessage('Draft saved.');
  };

  const handleSendToCrew = async () => {
    setSaveError(null);
    setSaveMessage(null);

    if (!draftProjectId) {
      setSaveError('Select a project before sending the contract.');
      return;
    }
    if (!draftBody.trim()) {
      setSaveError('Contract body cannot be empty.');
      return;
    }
    if (selectedCrewIds.length === 0) {
      setSaveError('Attach at least one crew member to send this contract.');
      return;
    }

    const projectTitle = selectedProject?.title ?? 'Project assignment';
    setActionLoading(true);

    try {
      const contractTitle = draftTitle.trim() || `${projectTitle} contract`;
      await inviteCrewToProject(draftProjectId, selectedCrewIds, {
        contractBody: draftBody,
        contractTitle,
      });

      const saved = saveContractDraft({
        id: selectedDraftId ?? undefined,
        title: draftTitle.trim() || `${projectTitle} contract`,
        projectId: draftProjectId,
        projectTitle,
        body: draftBody,
        crewIds: selectedCrewIds,
        status: 'sent',
      });
      markContractDraftSent(saved.id);

      setSelectedDraftId(saved.id);
      await loadContracts();
      setSaveMessage(
        `Contract sent to ${selectedCrewIds.length} crew member${selectedCrewIds.length === 1 ? '' : 's'}. They can view it in the crew panel under Project Invitations.`
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to send contract to crew');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraft = () => {
    if (!selectedDraftId) return;
    deleteContractDraft(selectedDraftId);
    setDrafts(getContractDrafts());
    resetEditor(null);
    setSaveMessage('Draft deleted.');
  };

  const filteredSigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.crewName.toLowerCase().includes(q) ||
        c.projectTitle.toLowerCase().includes(q) ||
        c.crewId.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const paginatedSigned = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSigned.slice(start, start + pageSize);
  }, [filteredSigned, page]);

  const totalPages = Math.max(1, Math.ceil(filteredSigned.length / pageSize));

  const filteredDrafts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.projectTitle.toLowerCase().includes(q) ||
        d.crewIds.length.toString().includes(q)
    );
  }, [drafts, search]);

  const editorReadOnly = selectedDraftId
    ? (drafts.find((d) => d.id === selectedDraftId)?.status === 'sent')
    : false;

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
              placeholder="Search contracts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Manage</div>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'drafts' ? ' active' : ''}`}
            onClick={() => setActiveTab('drafts')}
          >
            <FileText size={13} /> Draft Contracts{' '}
            <span className="subsea-sb-count">{loading ? '…' : drafts.length}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'signed' ? ' active' : ''}`}
            onClick={() => setActiveTab('signed')}
          >
            <FileText size={13} /> Signed Contracts{' '}
            <span className="subsea-sb-count">{loading ? '…' : contracts.length}</span>
          </button>

          {activeTab === 'drafts' && (
            <>
              <div className="subsea-sb-group">Drafts</div>
              <button type="button" className="subsea-sb-link contracts-new-draft-link" onClick={startNewDraft}>
                <Plus size={13} /> New contract
              </button>
              {filteredDrafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={`subsea-sb-link contracts-draft-link${selectedDraftId === draft.id ? ' active' : ''}`}
                  onClick={() => openDraft(draft)}
                >
                  <span className="contracts-draft-link-title">{draft.title}</span>
                  <span className={`contracts-draft-status contracts-draft-status--${draft.status}`}>
                    {draft.status}
                  </span>
                </button>
              ))}
            </>
          )}
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
          {activeTab === 'drafts' ? (
            <>
              <div className="subsea-page-head">
                <div>
                  <h1>Draft Project Contracts</h1>
                  <p>Write contract terms, attach crew members, and send for signing in the crew panel</p>
                </div>
                <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={startNewDraft}>
                  <Plus size={14} />
                  New contract
                </button>
              </div>

              <div className="contracts-editor-layout">
                <section className="contracts-editor-pane subsea-pane">
                  <div className="subsea-pane-head">
                    <div className="subsea-pane-title">
                      {selectedDraftId ? 'Edit contract draft' : 'New contract draft'}
                    </div>
                    {editorReadOnly && (
                      <span className="contracts-draft-status contracts-draft-status--sent">Sent</span>
                    )}
                  </div>

                  <div className="contracts-editor-form">
                    <div className="contracts-editor-meta">
                      <div className="contracts-form-field">
                        <label htmlFor="contract-title">Contract title</label>
                        <input
                          id="contract-title"
                          type="text"
                          placeholder="e.g. North Sea Assignment Agreement"
                          value={draftTitle}
                          disabled={editorReadOnly || actionLoading}
                          onChange={(e) => setDraftTitle(e.target.value)}
                        />
                      </div>
                      <div className="contracts-form-field">
                        <label htmlFor="contract-project">Project</label>
                        <select
                          id="contract-project"
                          value={draftProjectId}
                          disabled={editorReadOnly || actionLoading || dataLoading}
                          onChange={(e) => setDraftProjectId(e.target.value)}
                        >
                          <option value="">Select project…</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="contracts-editor-window">
                      <div className="contracts-editor-toolbar">
                        <FileText size={14} />
                        <span>Contract document</span>
                        <span className="contracts-editor-hint">Write the full agreement text below</span>
                      </div>
                      <textarea
                        className="contracts-editor-textarea"
                        value={draftBody}
                        disabled={editorReadOnly || actionLoading}
                        onChange={(e) => setDraftBody(e.target.value)}
                        placeholder="Write your project assignment contract here…"
                        spellCheck
                      />
                    </div>

                    <div className="contracts-crew-attach">
                      <div className="contracts-crew-attach-head">
                        <Users size={14} />
                        <span>Attach crew</span>
                        <span className="contracts-crew-count">
                          {selectedCrewIds.length} selected
                        </span>
                      </div>
                      <div className="contracts-crew-search">
                        <Search size={13} />
                        <input
                          type="text"
                          placeholder="Search crew by name or email…"
                          value={crewSearch}
                          disabled={editorReadOnly || actionLoading}
                          onChange={(e) => setCrewSearch(e.target.value)}
                        />
                      </div>
                      <div className="contracts-crew-list" role="list">
                        {dataLoading ? (
                          <p className="contracts-crew-empty">Loading crew…</p>
                        ) : filteredCrew.length === 0 ? (
                          <p className="contracts-crew-empty">No crew members match your search.</p>
                        ) : (
                          filteredCrew.map((member) => (
                            <label key={member.id} className="contracts-crew-item">
                              <input
                                type="checkbox"
                                checked={selectedCrewIds.includes(member.id)}
                                disabled={editorReadOnly || actionLoading}
                                onChange={() => toggleCrewSelection(member.id)}
                              />
                              <span className="contracts-crew-item-name">{crewDisplayName(member)}</span>
                              {member.email && (
                                <span className="contracts-crew-item-email">{member.email}</span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {saveError && (
                      <div className="subsea-alert subsea-alert-error" role="alert">
                        {saveError}
                      </div>
                    )}
                    {saveMessage && (
                      <div className="subsea-alert subsea-alert-success" role="status">
                        {saveMessage}
                      </div>
                    )}

                    <div className="contracts-editor-actions">
                      {!editorReadOnly && (
                        <>
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-default"
                            disabled={actionLoading}
                            onClick={handleSaveDraft}
                          >
                            <Save size={14} />
                            Save draft
                          </button>
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-primary"
                            disabled={actionLoading}
                            onClick={() => void handleSendToCrew()}
                          >
                            <Send size={14} />
                            {actionLoading ? 'Sending…' : 'Send to crew'}
                          </button>
                        </>
                      )}
                      {selectedDraftId && !editorReadOnly && (
                        <button
                          type="button"
                          className="subsea-btn subsea-btn-default contracts-delete-btn"
                          disabled={actionLoading}
                          onClick={handleDeleteDraft}
                        >
                          <Trash2 size={14} />
                          Delete draft
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <>
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
                      ) : paginatedSigned.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="subsea-table-empty">
                            {contracts.length === 0
                              ? 'No signed contracts yet. Draft a contract and send it to crew; signed copies appear here after acceptance in the crew panel.'
                              : 'No contracts match your search.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedSigned.map((row) => (
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

                {!loading && filteredSigned.length > pageSize && (
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
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ContractsPage;
