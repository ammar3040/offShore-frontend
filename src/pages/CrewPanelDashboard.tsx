import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  FolderKanban,
  Calendar,
  CalendarClock,
  MailPlus,
  Check,
  X,
} from 'lucide-react';
import Modal from '../components/Modal';
import { getCrewMe, getCrewEnrolledProjects, getCrewProjectInvitations, acceptCrewInvitation, rejectCrewInvitation, type CrewMemberApi, type CrewEnrolledProject, type CrewProjectInvitation } from '../api/crew';
import { getStoredCrewPanelUser } from '../lib/crewPanelAuth';
import './CrewPanelDashboard.css';

function placeholderCrewProfile(email: string): CrewMemberApi {
  const name = email.split('@')[0] || 'Crew';
  const first = name.includes('.') ? name.split('.')[0] : name;
  const last = name.includes('.') ? name.split('.').slice(1).join(' ') : '';
  return {
    id: 'me',
    firstname: first.charAt(0).toUpperCase() + first.slice(1),
    lastname: last ? last.charAt(0).toUpperCase() + last.slice(1) : '',
    dateOfBirth: '',
    nationality: '',
    gender: '',
    email,
    phone: '',
    alternate_phone: '',
    address: '',
    city: '',
    country: '',
    postal_code: '',
    passport: {
      passport_number: '',
      issue_date: '',
      expiry_date: '',
      issuing_country: '',
      passport_document: '',
    },
    identity: {
      identity_type: '',
      identity_number: '',
      issue_date: '',
      expiry_date: '',
      identity_document: '',
    },
  };
}

function field(value: string): string {
  return value?.trim() || '—';
}

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

type TabId = 'enrolled' | 'invitations' | 'profile';

const CrewPanelDashboard = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [enrolledProjects, setEnrolledProjects] = useState<CrewEnrolledProject[]>([]);
  const [invitations, setInvitations] = useState<CrewProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('enrolled');
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetchInvitationsAndEnrolled = useCallback(async () => {
    const [{ projects }, { invitations: invs }] = await Promise.all([
      getCrewEnrolledProjects(),
      getCrewProjectInvitations(),
    ]);
    setEnrolledProjects(projects ?? []);
    setInvitations(invs ?? []);
  }, []);

  const handleAcceptInvitation = async (inv: CrewProjectInvitation) => {
    setActionError(null);
    setActionInProgress(`accept-${inv.id}`);
    try {
      await acceptCrewInvitation(inv.projectId);
      await refetchInvitationsAndEnrolled();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRejectInvitation = async (inv: CrewProjectInvitation) => {
    setActionError(null);
    setActionInProgress(`reject-${inv.id}`);
    try {
      await rejectCrewInvitation(inv.projectId);
      await refetchInvitationsAndEnrolled();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    const user = getStoredCrewPanelUser();
    if (!user?.email) {
      navigate('/panel/crew/login', { replace: true });
      return;
    }

    let cancelled = false;
    Promise.all([
      getCrewMe(),
      getCrewEnrolledProjects(),
      getCrewProjectInvitations(),
    ])
      .then(([me, { projects }, { invitations: invs }]) => {
        if (cancelled) return;
        setCrew(me ?? placeholderCrewProfile(user.email));
        setEnrolledProjects(projects ?? []);
        setInvitations(invs ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrew(placeholderCrewProfile(user.email));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="crew-panel-dashboard crew-panel-dashboard--loading">
        <div className="crew-panel-dashboard-spinner" />
        <p>Loading your profile…</p>
      </div>
    );
  }

  if (!crew) return null;

  return (
    <div className="crew-panel-dashboard">
      <header className="crew-panel-dashboard-header">
        <div className="crew-panel-dashboard-header-row">
          <div>
            <h1 className="crew-panel-dashboard-title">My profile</h1>
            <p className="crew-panel-dashboard-subtitle">Your crew information</p>
          </div>
          <button
            type="button"
            className="crew-panel-update-availability-btn"
            onClick={() => setIsAvailabilityModalOpen(true)}
          >
            <CalendarClock size={18} />
            Update availability
          </button>
        </div>
      </header>

      <div className="crew-panel-tabs">
        <button
          type="button"
          className={`crew-panel-tab ${activeTab === 'enrolled' ? 'active' : ''}`}
          onClick={() => setActiveTab('enrolled')}
        >
          <FolderKanban size={18} />
          Enrolled projects
        </button>
        <button
          type="button"
          className={`crew-panel-tab ${activeTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          <MailPlus size={18} />
          Project invitations
          {invitations.length > 0 && (
            <span className="crew-panel-tab-badge">{invitations.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`crew-panel-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={18} />
          Complete profile
        </button>
      </div>

      <div className="crew-panel-tab-content">
        {activeTab === 'enrolled' && (
          <div className="crew-panel-enrolled-section">
            {enrolledProjects.length === 0 ? (
              <div className="crew-panel-enrolled-empty">
                <FolderKanban size={48} className="crew-panel-enrolled-empty-icon" />
                <p>No enrolled projects yet.</p>
              </div>
            ) : (
              <div className="crew-panel-enrolled-grid">
                {enrolledProjects.map((project) => (
                  <article key={project.id} className="crew-panel-project-card">
                    <div className="crew-panel-project-card-header">
                      <h3 className="crew-panel-project-card-title">{project.title}</h3>
                      <span className={`crew-panel-project-status crew-panel-project-status--${(project.status || '').toLowerCase()}`}>
                        {project.status || '—'}
                      </span>
                    </div>
                    {project.description && (
                      <p className="crew-panel-project-card-description">{project.description}</p>
                    )}
                    {(project.startDate || project.endDate) && (
                      <div className="crew-panel-project-card-meta">
                        <Calendar size={14} />
                        {project.startDate && project.endDate
                          ? `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`
                          : project.startDate
                            ? formatDate(project.startDate)
                            : project.endDate
                              ? formatDate(project.endDate)
                              : '—'}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="crew-panel-invitations-section">
            {invitations.length === 0 ? (
              <div className="crew-panel-invitations-empty">
                <MailPlus size={48} className="crew-panel-invitations-empty-icon" />
                <p>No project invitations yet.</p>
                <p className="crew-panel-invitations-empty-hint">When an admin invites you to a project, it will appear here.</p>
              </div>
            ) : (
              <>
                {actionError && (
                  <div className="crew-panel-invitation-error" role="alert">
                    {actionError}
                  </div>
                )}
                <div className="crew-panel-invitations-grid">
                {invitations.map((inv) => {
                  const isPending = (inv.invitationStatus ?? 'pending') === 'pending';
                  return (
                    <article key={inv.id} className="crew-panel-invitation-card">
                      <div className="crew-panel-invitation-card-header">
                        <h3 className="crew-panel-invitation-card-title">{inv.title}</h3>
                        <span className={`crew-panel-invitation-status crew-panel-invitation-status--${inv.invitationStatus ?? 'pending'}`}>
                          {inv.invitationStatus ?? 'Pending'}
                        </span>
                      </div>
                      {inv.description && (
                        <p className="crew-panel-invitation-card-description">{inv.description}</p>
                      )}
                      {(inv.startDate || inv.endDate) && (
                        <div className="crew-panel-invitation-card-meta">
                          <Calendar size={14} />
                          {inv.startDate && inv.endDate
                            ? `${formatDate(inv.startDate)} – ${formatDate(inv.endDate)}`
                            : inv.startDate
                              ? formatDate(inv.startDate)
                              : inv.endDate
                                ? formatDate(inv.endDate)
                                : '—'}
                        </div>
                      )}
                      {inv.invitedAt && (
                        <p className="crew-panel-invitation-invited">
                          Invited {formatDate(inv.invitedAt)}
                        </p>
                      )}
                      {isPending && (
                        <div className="crew-panel-invitation-actions">
                          <button
                            type="button"
                            className="crew-panel-invitation-btn crew-panel-invitation-btn--accept"
                            onClick={() => handleAcceptInvitation(inv)}
                            disabled={!!actionInProgress}
                          >
                            {actionInProgress?.startsWith(`accept-${inv.id}`) ? (
                              <span className="crew-panel-invitation-spinner" />
                            ) : (
                              <>
                                <Check size={16} />
                                Accept
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="crew-panel-invitation-btn crew-panel-invitation-btn--reject"
                            onClick={() => handleRejectInvitation(inv)}
                            disabled={!!actionInProgress}
                          >
                            {actionInProgress?.startsWith(`reject-${inv.id}`) ? (
                              <span className="crew-panel-invitation-spinner" />
                            ) : (
                              <>
                                <X size={16} />
                                Reject
                              </>
                            )}
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
        )}

        {activeTab === 'profile' && (
          <div className="crew-panel-dashboard-grid">
            <section className="crew-panel-card crew-panel-card--span-2">
              <h2 className="crew-panel-card-title">
                <User size={20} />
                Personal
              </h2>
              <div className="crew-panel-card-grid">
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">First name</span>
                  <span className="crew-panel-field-value">{field(crew.firstname)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Last name</span>
                  <span className="crew-panel-field-value">{field(crew.lastname)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Date of birth</span>
                  <span className="crew-panel-field-value">{field(crew.dateOfBirth)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Nationality</span>
                  <span className="crew-panel-field-value">{field(crew.nationality)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Gender</span>
                  <span className="crew-panel-field-value">{field(crew.gender)}</span>
                </div>
              </div>
            </section>

            <section className="crew-panel-card">
              <h2 className="crew-panel-card-title">
                <Mail size={20} />
                Contact
              </h2>
              <div className="crew-panel-card-list">
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Email</span>
                  <span className="crew-panel-field-value">{field(crew.email)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Phone</span>
                  <span className="crew-panel-field-value">{field(crew.phone)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Alternate phone</span>
                  <span className="crew-panel-field-value">{field(crew.alternate_phone)}</span>
                </div>
              </div>
            </section>

            <section className="crew-panel-card">
              <h2 className="crew-panel-card-title">
                <MapPin size={20} />
                Address
              </h2>
              <div className="crew-panel-card-list">
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Address</span>
                  <span className="crew-panel-field-value">{field(crew.address)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">City</span>
                  <span className="crew-panel-field-value">{field(crew.city)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Country</span>
                  <span className="crew-panel-field-value">{field(crew.country)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Postal code</span>
                  <span className="crew-panel-field-value">{field(crew.postal_code)}</span>
                </div>
              </div>
            </section>

            <section className="crew-panel-card crew-panel-card--span-2">
              <h2 className="crew-panel-card-title">
                <FileText size={20} />
                Passport
              </h2>
              <div className="crew-panel-card-grid">
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Passport number</span>
                  <span className="crew-panel-field-value">{field(crew.passport.passport_number)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Issuing country</span>
                  <span className="crew-panel-field-value">{field(crew.passport.issuing_country)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Issue date</span>
                  <span className="crew-panel-field-value">{field(crew.passport.issue_date)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Expiry date</span>
                  <span className="crew-panel-field-value">{field(crew.passport.expiry_date)}</span>
                </div>
              </div>
            </section>

            <section className="crew-panel-card crew-panel-card--span-2">
              <h2 className="crew-panel-card-title">
                <CreditCard size={20} />
                Identity
              </h2>
              <div className="crew-panel-card-grid">
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Identity type</span>
                  <span className="crew-panel-field-value">{field(crew.identity.identity_type)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Identity number</span>
                  <span className="crew-panel-field-value">{field(crew.identity.identity_number)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Issue date</span>
                  <span className="crew-panel-field-value">{field(crew.identity.issue_date)}</span>
                </div>
                <div className="crew-panel-field">
                  <span className="crew-panel-field-label">Expiry date</span>
                  <span className="crew-panel-field-value">{field(crew.identity.expiry_date)}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <Modal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        title="Update availability"
        size="medium"
      >
        <CrewAvailabilityForm onClose={() => setIsAvailabilityModalOpen(false)} />
      </Modal>
    </div>
  );
};

function CrewAvailabilityForm({ onClose }: { onClose: () => void }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('available');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // TODO: Wire to backend when API is available
    await new Promise((r) => setTimeout(r, 500));
    setSubmitting(false);
    onClose();
  };

  return (
    <form className="crew-availability-form" onSubmit={handleSubmit}>
      <div className="crew-availability-field">
        <label htmlFor="availability-from">From date</label>
        <input
          id="availability-from"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          required
        />
      </div>
      <div className="crew-availability-field">
        <label htmlFor="availability-to">To date</label>
        <input
          id="availability-to"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          required
        />
      </div>
      <div className="crew-availability-field">
        <label htmlFor="availability-status">Status</label>
        <select
          id="availability-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
          <option value="partially_available">Partially available</option>
        </select>
      </div>
      <div className="crew-availability-field">
        <label htmlFor="availability-notes">Notes (optional)</label>
        <textarea
          id="availability-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any additional details about your availability…"
        />
      </div>
      <div className="crew-availability-actions">
        <button type="button" className="crew-availability-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="crew-availability-submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default CrewPanelDashboard;
