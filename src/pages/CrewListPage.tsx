import { useState, useEffect } from 'react';
import { getCrewList, type CrewMemberApi } from '../api/crew';
import './CrewListPage.css';

const CrewListPage = () => {
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCrewList()
      .then((res) => {
        if (!cancelled) setCrew(res.crew ?? []);
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

  if (loading) {
    return (
      <div className="crew-list-page">
        <div className="crew-list-header">
          <h1 className="crew-list-title">Crew</h1>
          <p className="crew-list-subtitle">View and manage all crew members.</p>
        </div>
        <div className="crew-list-loading" role="status">
          Loading crew…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crew-list-page">
        <div className="crew-list-header">
          <h1 className="crew-list-title">Crew</h1>
          <p className="crew-list-subtitle">View and manage all crew members.</p>
        </div>
        <div className="crew-list-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="crew-list-page">
      <div className="crew-list-header">
        <h1 className="crew-list-title">Crew</h1>
        <p className="crew-list-subtitle">
          View and manage all crew members. {crew.length} member{crew.length !== 1 ? 's' : ''} total.
        </p>
      </div>

      {crew.length === 0 ? (
        <div className="crew-list-empty">
          No crew members yet. Add crew from the dashboard welcome section.
        </div>
      ) : (
        <div className="crew-list-table-wrapper">
          <table className="crew-list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>City</th>
                <th>Country</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((member) => (
                <tr key={member.id}>
                  <td className="crew-list-name">
                    {member.firstname} {member.lastname}
                  </td>
                  <td>{member.email}</td>
                  <td>{member.phone}</td>
                  <td>{member.address || '—'}</td>
                  <td>{member.city || '—'}</td>
                  <td>{member.country || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrewListPage;
