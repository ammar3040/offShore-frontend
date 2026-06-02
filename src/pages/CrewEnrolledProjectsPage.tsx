import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, MailPlus, Calendar, Check, X, FileText } from 'lucide-react';
import {
  getCrewEnrolledProjects,
  getCrewProjectInvitations,
  acceptCrewInvitation,
  rejectCrewInvitation,
  getCrewMe,
  type CrewEnrolledProject,
  type CrewMemberApi,
  type CrewProjectInvitation,
} from '../api/crew';
import Modal from '../components/Modal';
import {
  buildFullContractDocument,
  getContractInviteMessage,
  resolveContractEndDate,
  signProjectContract,
} from '../lib/contractsStore';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewEnrolledProjectsPage.css';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const CrewEnrolledProjectsPage = () => {
  const navigate = useNavigate();
  const [enrolledProjects, setEnrolledProjects] = useState<CrewEnrolledProject[]>([]);
  const [invitations, setInvitations] = useState<CrewProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [crewMe, setCrewMe] = useState<CrewMemberApi | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractModalInvite, setContractModalInvite] = useState<CrewProjectInvitation | null>(null);
  const [termsAgreedByInviteId, setTermsAgreedByInviteId] = useState<Record<string, boolean>>({});
  const [modalTermsChecked, setModalTermsChecked] = useState(false);

  const refetch = useCallback(async () => {
    const [{ projects }, { invitations: invs }] = await Promise.all([
      getCrewEnrolledProjects(),
      getCrewProjectInvitations(),
    ]);
    setEnrolledProjects(projects ?? []);
    setInvitations(invs ?? []);
  }, []);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    Promise.all([refetch(), getCrewMe().then((c) => c)])
      .then(([, crew]) => {
        if (!cancelled && crew) setCrewMe(crew);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate, refetch]);

  const handleAcceptAndSign = async (inv: CrewProjectInvitation) => {
    setActionError(null);
    setActionInProgress(`accept-${inv.id}`);
    try {
      const crew = crewMe ?? (await getCrewMe());
      if (!crew?.id) throw new Error('Could not load your crew profile');
      await acceptCrewInvitation(inv.projectId);
      const crewName = `${crew.firstname ?? ''} ${crew.lastname ?? ''}`.trim() || 'Crew member';
      signProjectContract({
        crewId: crew.id,
        crewName,
        projectId: inv.projectId,
        projectTitle: inv.title,
        contractEndDate: resolveContractEndDate(inv.endDate),
      });
      if (!crewMe) setCrewMe(crew);
      setContractModalInvite(null);
      setTermsAgreedByInviteId((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept and sign');
    } finally {
      setActionInProgress(null);
    }
  };

  const fullContractText = (inv: CrewProjectInvitation): string => {
    const summary =
      crewMe?.id != null
        ? getContractInviteMessage(crewMe.id, inv.projectId) ?? undefined
        : undefined;
    return buildFullContractDocument({
      projectTitle: inv.title,
      projectDescription: inv.description,
      startDate: inv.startDate,
      endDate: inv.endDate,
      summaryMessage: summary,
    });
  };

  const openContractModal = (inv: CrewProjectInvitation) => {
    setContractModalInvite(inv);
    setModalTermsChecked(!!termsAgreedByInviteId[inv.id]);
    setActionError(null);
  };

  const closeContractModal = () => {
    setContractModalInvite(null);
    setModalTermsChecked(false);
  };

  const handleModalTermsChange = (invId: string, checked: boolean) => {
    setModalTermsChecked(checked);
    setTermsAgreedByInviteId((prev) => ({ ...prev, [invId]: checked }));
  };

  const hasAgreedToTerms = (invId: string) => !!termsAgreedByInviteId[invId];

  const handleReject = async (inv: CrewProjectInvitation) => {
    setActionError(null);
    setActionInProgress(`reject-${inv.id}`);
    try {
      await rejectCrewInvitation(inv.projectId);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="crew-enrolled-loading">
        <div className="crew-panel-dashboard-spinner" />
        <p>Loading projects…</p>
      </div>
    );
  }

  return (
    <div className="crew-enrolled-page">
      <header className="crew-enrolled-header">
        <h1 className="crew-enrolled-title">Enrolled Projects</h1>
        <p className="crew-enrolled-subtitle">Your projects and pending invitations</p>
      </header>

      <div className="crew-enrolled-section">
        <h2 className="crew-enrolled-section-title">My Projects</h2>
        {enrolledProjects.length === 0 ? (
          <div className="crew-enrolled-empty">
            <FolderKanban size={48} />
            <p>No enrolled projects yet.</p>
          </div>
        ) : (
          <div className="crew-enrolled-grid">
            {enrolledProjects.map((p) => (
              <article key={p.id} className="crew-enrolled-card">
                <div className="crew-enrolled-card-header">
                  <h3>{p.title}</h3>
                  <span className={`crew-enrolled-status crew-enrolled-status--${(p.status || '').toLowerCase()}`}>
                    {p.status || '—'}
                  </span>
                </div>
                {p.description && <p className="crew-enrolled-card-desc">{p.description}</p>}
                {(p.startDate || p.endDate) && (
                  <div className="crew-enrolled-card-meta">
                    <Calendar size={14} />
                    {p.startDate && p.endDate
                      ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`
                      : p.startDate ? formatDate(p.startDate) : p.endDate ? formatDate(p.endDate) : '—'}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="crew-enrolled-section">
        <h2 className="crew-enrolled-section-title">Project Invitations</h2>
        {invitations.length === 0 ? (
          <div className="crew-enrolled-empty crew-enrolled-empty--small">
            <MailPlus size={40} />
            <p>No pending invitations.</p>
          </div>
        ) : (
          <>
            {actionError && (
              <div className="crew-enrolled-error" role="alert">{actionError}</div>
            )}
            <div className="crew-enrolled-grid">
              {invitations.map((inv) => {
                const pending = (inv.invitationStatus ?? 'pending') === 'pending';
                return (
                  <article key={inv.id} className="crew-enrolled-card crew-enrolled-card--invitation">
                    <div className="crew-enrolled-card-header">
                      <h3>{inv.title}</h3>
                      <span className={`crew-enrolled-status crew-enrolled-status--${inv.invitationStatus ?? 'pending'}`}>
                        {inv.invitationStatus ?? 'Pending'}
                      </span>
                    </div>
                    {inv.description && <p className="crew-enrolled-card-desc">{inv.description}</p>}
                    {pending && (
                      <button
                        type="button"
                        className="crew-enrolled-contract-box"
                        onClick={() => openContractModal(inv)}
                        aria-label={`Open project contract for ${inv.title}`}
                      >
                        <div className="crew-enrolled-contract-box-head">
                          <FileText size={16} />
                          <span>Project contract</span>
                          <span className="crew-enrolled-contract-open-hint">Click to read</span>
                        </div>
                        <p className="crew-enrolled-contract-message crew-enrolled-contract-message--preview">
                          {fullContractText(inv)}
                        </p>
                      </button>
                    )}
                    {(inv.startDate || inv.endDate) && (
                      <div className="crew-enrolled-card-meta">
                        <Calendar size={14} />
                        {inv.startDate && inv.endDate
                          ? `${formatDate(inv.startDate)} – ${formatDate(inv.endDate)}`
                          : inv.startDate ? formatDate(inv.startDate) : inv.endDate ? formatDate(inv.endDate) : '—'}
                      </div>
                    )}
                    {pending && (
                      <div className="crew-enrolled-invitation-actions">
                        {!hasAgreedToTerms(inv.id) && (
                          <p className="crew-enrolled-terms-hint">
                            Open the project contract and agree to the terms before signing.
                          </p>
                        )}
                        <button
                          type="button"
                          className="crew-enrolled-btn crew-enrolled-btn--accept"
                          onClick={() => handleAcceptAndSign(inv)}
                          disabled={!!actionInProgress || !hasAgreedToTerms(inv.id)}
                          title={
                            hasAgreedToTerms(inv.id)
                              ? undefined
                              : 'Read the contract and agree to terms first'
                          }
                        >
                          {actionInProgress === `accept-${inv.id}` ? (
                            <span className="crew-enrolled-spinner" />
                          ) : (
                            <>
                              <Check size={16} />
                              Accept and sign the contract
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="crew-enrolled-btn crew-enrolled-btn--reject"
                          onClick={() => handleReject(inv)}
                          disabled={!!actionInProgress}
                        >
                          <X size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={!!contractModalInvite}
        onClose={closeContractModal}
        title={contractModalInvite ? `Project contract — ${contractModalInvite.title}` : 'Project contract'}
        size="large"
      >
        {contractModalInvite && (
          <div className="crew-contract-modal">
            <div className="crew-contract-modal-scroll" tabIndex={0}>
              <pre className="crew-contract-modal-body">{fullContractText(contractModalInvite)}</pre>
            </div>
            <label className="crew-contract-modal-terms">
              <input
                type="checkbox"
                checked={modalTermsChecked}
                onChange={(e) => handleModalTermsChange(contractModalInvite.id, e.target.checked)}
              />
              <span>
                I agree to the terms and conditions of this project assignment contract.
              </span>
            </label>
            <div className="crew-contract-modal-actions">
              <button type="button" className="crew-enrolled-btn crew-enrolled-btn--reject" onClick={closeContractModal}>
                Close
              </button>
              <button
                type="button"
                className="crew-enrolled-btn crew-enrolled-btn--accept"
                disabled={
                  !modalTermsChecked ||
                  !!actionInProgress ||
                  actionInProgress === `accept-${contractModalInvite.id}`
                }
                onClick={() => void handleAcceptAndSign(contractModalInvite)}
              >
                {actionInProgress === `accept-${contractModalInvite.id}` ? (
                  <span className="crew-enrolled-spinner" />
                ) : (
                  <>
                    <Check size={16} />
                    Accept and sign the contract
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CrewEnrolledProjectsPage;
