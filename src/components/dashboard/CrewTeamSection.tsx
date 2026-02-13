import { useState, useEffect } from 'react';
import { Calendar, MessageCircle, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCrewList, type CrewMemberApi } from '../../api/crew';
import './CrewTeamSection.css';

function getInitial(firstname: string, lastname: string): string {
  const f = firstname?.trim().charAt(0) || '';
  const l = lastname?.trim().charAt(0) || '';
  return (f + l).toUpperCase() || '?';
}

const CrewTeamSection = () => {
  const [crewMembers, setCrewMembers] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCrewList()
      .then((res) => {
        if (!cancelled) {
          setCrewMembers(res.crew ?? []);
          setCurrentIndex(0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load crew');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nextMember = () => {
    setCurrentIndex((prev) => (prev + 1) % crewMembers.length);
  };

  const prevMember = () => {
    setCurrentIndex((prev) => (prev - 1 + crewMembers.length) % crewMembers.length);
  };

  const currentMember = crewMembers[currentIndex];

  return (
    <div className="crew-team-section">
      <div className="section-header">
        <h2 className="section-title">Your crew</h2>
        <p className="section-description">
          Be aware of who is on your crew and how you can contact them.
        </p>
      </div>

      {loading && (
        <div className="crew-team-loading" role="status">
          Loading crew…
        </div>
      )}

      {error && (
        <div className="crew-team-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && crewMembers.length === 0 && (
        <div className="crew-team-empty">
          No crew members yet. Add crew from the welcome section above.
        </div>
      )}

      {!loading && !error && crewMembers.length > 0 && (
        <>
          <div className="crew-card-container">
            <button className="crew-nav-button crew-nav-left" onClick={prevMember}>
              <ChevronLeft size={20} />
            </button>

            <div className="crew-card">
              <div className="crew-card-layers">
                <div className="crew-card-layer-1"></div>
                <div className="crew-card-layer-2"></div>
                <div className="crew-card-content">
                  <div className="crew-avatar-large">
                    {getInitial(currentMember.firstname, currentMember.lastname)}
                  </div>
                  <h3 className="crew-name">
                    {currentMember.firstname} {currentMember.lastname}
                  </h3>
                  <p className="crew-role">{currentMember.address || '—'}</p>
                  <div className="crew-actions">
                    <button className="crew-action-button">
                      <Calendar size={18} />
                    </button>
                    <button className="crew-action-button">
                      <MessageCircle size={18} />
                    </button>
                    <button className="crew-action-button">
                      <Video size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button className="crew-nav-button crew-nav-right" onClick={nextMember}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="crew-indicators">
            {crewMembers.map((member, index) => (
              <button
                key={member.id}
                className={`crew-indicator ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CrewTeamSection;
