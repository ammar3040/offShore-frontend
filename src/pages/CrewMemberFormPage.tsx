import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, UserPlus, Users } from 'lucide-react';
import CrewMemberForm, { type CrewMemberFormData } from '../components/forms/CrewMemberForm';
import { getCrewById, createCrewMember, updateCrewMember, crewApiToFormData } from '../api/crew';
import ErrorAlertPopup from '../components/ErrorAlertPopup';
import { clearCrewMemberFormDraft } from '../utils/crewMemberFormDraft';
import './RigsPage.css';

const CrewMemberFormPage: React.FC = () => {
  const { crewId } = useParams<{ crewId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!crewId;
  const persistenceId = isEdit ? `edit-${crewId}` : 'create';

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [initialData, setInitialData] = useState<CrewMemberFormData | undefined>(undefined);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    if (isEdit && crewId) {
      const fetchProfile = async () => {
        setLoadingProfile(true);
        setError(null);
        try {
          const res = await getCrewById(crewId);
          if (res && res.crew) {
            setInitialData(crewApiToFormData(res.crew));
          } else {
            setError('Crew member not found');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch crew member');
        } finally {
          setLoadingProfile(false);
        }
      };
      void fetchProfile();
    }
  }, [isEdit, crewId]);

  const handleSubmit = async (data: CrewMemberFormData) => {
    setSubmitLoading(true);
    setError(null);
    try {
      if (isEdit && crewId) {
        await updateCrewMember(crewId, data);
        clearCrewMemberFormDraft(persistenceId);
        navigate(`/crew/${crewId}`);
      } else {
        await createCrewMember(data);
        clearCrewMemberFormDraft(persistenceId);
        navigate('/crew');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEdit && crewId) {
      navigate(`/crew/${crewId}`);
    } else {
      navigate('/crew');
    }
  };

  return (
    <div className="subsea-shell">

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Crew Management</span>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Actions</div>
          <button
            type="button"
            className="subsea-sb-link active"
            onClick={handleCancel}
          >
            <UserPlus size={13} /> {isEdit ? 'Edit Profile' : 'Add New Crew'}
          </button>
          <button
            type="button"
            className="subsea-sb-link"
            onClick={() => navigate('/crew')}
          >
            <Users size={13} /> Back to Roster
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <button
            type="button"
            className="subsea-btn subsea-btn-default subsea-btn-sm"
            onClick={handleCancel}
          >
            <ChevronLeft size={12} className="mr-1.5" /> Back
          </button>
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span>Crew Management</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">{isEdit ? 'Edit Crew' : 'Add Crew'}</span>
          </div>
          <div className="subsea-sync-pill">
            <span className="subsea-sync-dot" />
            {isEdit ? 'Editing profile' : 'Creating profile'}
          </div>
          <div className="subsea-top-actions">
          </div>
        </div>

        <main className="subsea-content crew-form-page">
          <div className="subsea-page-head crew-form-page__head">
            <div>
              <h1>{isEdit ? 'Edit Crew Member' : 'Add New Crew Member'}</h1>
              <p>
                {isEdit
                  ? 'Modify personal details, certificates, contact info, and status tiers'
                  : 'Register a new crew member to the subsea contractor pool'}
              </p>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '16px' }}>
              <ErrorAlertPopup message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {loadingProfile ? (
            <div
              className="user-mgmt-form-suspense flex flex-col items-center justify-center py-20"
              role="status"
              aria-busy="true"
              aria-label="Loading crew profile"
            >
              <Loader2 size={32} className="animate-spin text-primary" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--subsea-text-muted)' }}>
                Loading crew profile details…
              </p>
            </div>
          ) : !isEdit || initialData ? (
            <div className="subsea-pane crew-form-page__panel">
              <CrewMemberForm
                mode={isEdit ? 'edit' : 'create'}
                persistenceId={persistenceId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={submitLoading}
                initialData={initialData}
                submitLabel={isEdit ? 'Save Changes' : 'Add Crew Member'}
                theme="subsea"
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default CrewMemberFormPage;
