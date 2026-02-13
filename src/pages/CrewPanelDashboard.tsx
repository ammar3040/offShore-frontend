import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  MapPin,
  FileText,
  CreditCard,
} from 'lucide-react';
import { getCrewMe, type CrewMemberApi } from '../api/crew';
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

const CrewPanelDashboard = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredCrewPanelUser();
    if (!user?.email) {
      navigate('/panel/crew/login', { replace: true });
      return;
    }

    let cancelled = false;
    getCrewMe()
      .then((me) => {
        if (cancelled) return;
        setCrew(me ?? placeholderCrewProfile(user.email));
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
        <h1 className="crew-panel-dashboard-title">My profile</h1>
        <p className="crew-panel-dashboard-subtitle">Your crew information</p>
      </header>

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
    </div>
  );
};

export default CrewPanelDashboard;
