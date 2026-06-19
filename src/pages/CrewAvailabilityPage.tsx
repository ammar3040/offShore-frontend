import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import { getCrewAvailability, updateCrewAvailability } from '../api/crew';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewAvailabilityPage.css';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** YYYY-MM-DD for input[type="date"] */
function toInputDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

const CrewAvailabilityPage = () => {
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<{ availableFrom: string | null; availableTo: string | null }>({
    availableFrom: null,
    availableTo: null,
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    getCrewAvailability()
      .then((data) => {
        if (!cancelled) {
          setAvailability({ availableFrom: data.availableFrom, availableTo: data.availableTo });
          if (data.availableFrom) setFormFrom(toInputDate(data.availableFrom));
          if (data.availableTo) setFormTo(toInputDate(data.availableTo));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleOpenForm = () => {
    setError(null);
    setSuccess(false);
    setFormFrom(availability.availableFrom ? toInputDate(availability.availableFrom) : '');
    setFormTo(availability.availableTo ? toInputDate(availability.availableTo) : '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFrom || !formTo) {
      setError('Please select both From and To dates.');
      return;
    }
    const fromDate = new Date(formFrom);
    const toDate = new Date(formTo);
    if (toDate < fromDate) {
      setError('To date must be on or after From date.');
      return;
    }
    setSubmitLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateCrewAvailability({
        availableFrom: formFrom,
        availableTo: formTo,
      });
      setAvailability({ availableFrom: updated.availableFrom, availableTo: updated.availableTo });
      setSuccess(true);
      setShowForm(false);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="crew-availability-page crew-availability-loading">
        <div className="crew-availability-spinner" />
        <p>Loading availability…</p>
      </div>
    );
  }

  const hasAvailability = availability.availableFrom && availability.availableTo;

  return (
    <div className="crew-availability-page">
      <header className="crew-availability-header">
        <h1 className="crew-availability-title">Availability</h1>
        <p className="crew-availability-subtitle">
          Set when you are available so admins can see your availability window.
        </p>
      </header>

      <div className="crew-availability-card">
        <div className="crew-availability-card-header">
          <CalendarRange size={22} className="crew-availability-card-icon" />
          <h2 className="crew-availability-card-title">Your availability</h2>
        </div>
        <div className="crew-availability-card-body">
          {success && (
            <div className="crew-availability-success" role="status">
              Availability updated successfully.
            </div>
          )}
          {hasAvailability ? (
            <div className="crew-availability-display">
              <p className="crew-availability-range">
                <span className="crew-availability-label">Available from</span>{' '}
                <strong>{formatDate(availability.availableFrom!)}</strong>
                <span className="crew-availability-sep"> until </span>
                <strong>{formatDate(availability.availableTo!)}</strong>
              </p>
            </div>
          ) : (
            <p className="crew-availability-empty">No availability period set. Add one below.</p>
          )}

          {!showForm ? (
            <button type="button" className="crew-availability-add-btn" onClick={handleOpenForm}>
              {hasAvailability ? 'Update availability' : 'Add availability'}
            </button>
          ) : (
            <form className="crew-availability-form" onSubmit={handleSubmit}>
              {error && (
                <div className="crew-availability-error" role="alert">
                  {error}
                </div>
              )}
              <div className="crew-availability-fields">
                <div className="crew-availability-field">
                  <label htmlFor="availability-from">From date</label>
                  <input
                    id="availability-from"
                    type="date"
                    value={formFrom}
                    onChange={(e) => setFormFrom(e.target.value)}
                    disabled={submitLoading}
                  />
                </div>
                <div className="crew-availability-field">
                  <label htmlFor="availability-to">To date</label>
                  <input
                    id="availability-to"
                    type="date"
                    value={formTo}
                    onChange={(e) => setFormTo(e.target.value)}
                    disabled={submitLoading}
                  />
                </div>
              </div>
              <div className="crew-availability-actions">
                <button
                  type="button"
                  className="crew-availability-cancel"
                  onClick={() => setShowForm(false)}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crew-availability-submit"
                  disabled={submitLoading || !formFrom || !formTo}
                >
                  {submitLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrewAvailabilityPage;
