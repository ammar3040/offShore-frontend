import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, MailPlus, Calendar, Check, X } from 'lucide-react';
import {
  getCrewEnrolledProjects,
  getCrewProjectInvitations,
  acceptCrewInvitation,
  rejectCrewInvitation,
  type CrewEnrolledProject,
  type CrewProjectInvitation,
} from '../api/crew';
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
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    refetch()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate, refetch]);

  const handleAccept = async (inv: CrewProjectInvitation) => {
    setActionError(null);
    setActionInProgress(`accept-${inv.id}`);
    try {
      await acceptCrewInvitation(inv.projectId);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setActionInProgress(null);
    }
  };

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
                        <button
                          type="button"
                          className="crew-enrolled-btn crew-enrolled-btn--accept"
                          onClick={() => handleAccept(inv)}
                          disabled={!!actionInProgress}
                        >
                          {actionInProgress === `accept-${inv.id}` ? (
                            <span className="crew-enrolled-spinner" />
                          ) : (
                            <>
                              <Check size={16} />
                              Accept
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
    </div>
  );
};

export default CrewEnrolledProjectsPage;
