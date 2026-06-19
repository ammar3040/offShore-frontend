import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, MapPin, FileText, CreditCard } from 'lucide-react';
import { getCrewMe } from '../api/crew';
import { getStoredCrewPanelUser, hasCrewAccessToken } from '../lib/crewPanelAuth';
import type { CrewMemberApi } from '../api/crew';
import './CrewProfilePage.css';

function field(value: string): string {
  return value?.trim() || '—';
}

function placeholderCrew(email: string): CrewMemberApi {
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
    passport: { passport_number: '', issue_date: '', expiry_date: '', issuing_country: '', passport_document: '' },
    identity: { identity_type: '', identity_number: '', issue_date: '', expiry_date: '', identity_document: '' },
  };
}

const CrewProfilePage = () => {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<CrewMemberApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    const user = getStoredCrewPanelUser();
    if (!user?.email) {
      navigate('/panel/crew/login', { replace: true });
      return;
    }
    let cancelled = false;
    getCrewMe()
      .then((me) => {
        if (!cancelled) setCrew(me ?? placeholderCrew(user.email));
      })
      .catch(() => {
        if (!cancelled) setCrew(placeholderCrew(user.email));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading || !crew) {
    return (
      <div className="crew-profile-loading">
        <div className="crew-profile-spinner" />
        <p>Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="crew-profile-page">
      <header className="crew-profile-header">
        <h1 className="crew-profile-title">Profile</h1>
        <p className="crew-profile-subtitle">Your crew information</p>
      </header>

      <div className="crew-profile-grid">
        <section className="crew-profile-card crew-profile-card--span-2">
          <h2 className="crew-profile-card-title"><User size={20} /> Personal</h2>
          <div className="crew-profile-fields">
            <div className="crew-profile-field">
              <span className="crew-profile-label">First name</span>
              <span className="crew-profile-value">{field(crew.firstname)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Last name</span>
              <span className="crew-profile-value">{field(crew.lastname)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Date of birth</span>
              <span className="crew-profile-value">{field(crew.dateOfBirth)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Nationality</span>
              <span className="crew-profile-value">{field(crew.nationality)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Gender</span>
              <span className="crew-profile-value">{field(crew.gender)}</span>
            </div>
          </div>
        </section>

        <section className="crew-profile-card">
          <h2 className="crew-profile-card-title"><Mail size={20} /> Contact</h2>
          <div className="crew-profile-list">
            <div className="crew-profile-field">
              <span className="crew-profile-label">Email</span>
              <span className="crew-profile-value">{field(crew.email)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Phone</span>
              <span className="crew-profile-value">{field(crew.phone)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Alternate phone</span>
              <span className="crew-profile-value">{field(crew.alternate_phone)}</span>
            </div>
          </div>
        </section>

        <section className="crew-profile-card">
          <h2 className="crew-profile-card-title"><MapPin size={20} /> Address</h2>
          <div className="crew-profile-list">
            <div className="crew-profile-field">
              <span className="crew-profile-label">Address</span>
              <span className="crew-profile-value">{field(crew.address)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">City</span>
              <span className="crew-profile-value">{field(crew.city)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Country</span>
              <span className="crew-profile-value">{field(crew.country)}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Postal code</span>
              <span className="crew-profile-value">{field(crew.postal_code)}</span>
            </div>
          </div>
        </section>

        <section className="crew-profile-card crew-profile-card--span-2">
          <h2 className="crew-profile-card-title"><FileText size={20} /> Passport</h2>
          <div className="crew-profile-fields">
            <div className="crew-profile-field">
              <span className="crew-profile-label">Passport number</span>
              <span className="crew-profile-value">{field(crew.passport?.passport_number ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Issuing country</span>
              <span className="crew-profile-value">{field(crew.passport?.issuing_country ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Issue date</span>
              <span className="crew-profile-value">{field(crew.passport?.issue_date ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Expiry date</span>
              <span className="crew-profile-value">{field(crew.passport?.expiry_date ?? '')}</span>
            </div>
          </div>
        </section>

        <section className="crew-profile-card crew-profile-card--span-2">
          <h2 className="crew-profile-card-title"><CreditCard size={20} /> Identity</h2>
          <div className="crew-profile-fields">
            <div className="crew-profile-field">
              <span className="crew-profile-label">Identity type</span>
              <span className="crew-profile-value">{field(crew.identity?.identity_type ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Identity number</span>
              <span className="crew-profile-value">{field(crew.identity?.identity_number ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Issue date</span>
              <span className="crew-profile-value">{field(crew.identity?.issue_date ?? '')}</span>
            </div>
            <div className="crew-profile-field">
              <span className="crew-profile-label">Expiry date</span>
              <span className="crew-profile-value">{field(crew.identity?.expiry_date ?? '')}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CrewProfilePage;
