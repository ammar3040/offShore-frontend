import { useState } from 'react';
import { Scale, Check, Lock, ChevronDown } from 'lucide-react';
import AdminLoginPage from './AdminLoginPage';
import CrewLogin from './CrewLogin';
import './LoginPage.css';

type Role = 'admin' | 'crew';

const LOGIN_AS_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin/Attorney Dashboard' },
  { value: 'crew', label: 'Crew Portal' },
];

const LoginPage = () => {
  const [role, setRole] = useState<Role>('admin');

  return (
    <div className="login-page">
      <div className="login-page-left">
        <div className="login-page-left-content">
          <header className="login-page-brand">
            <div className="login-page-logo">
              <Scale size={28} className="login-page-logo-icon" strokeWidth={2} />
              <span className="login-page-logo-text">
                <span className="login-page-logo-med">MedLegal</span>
                <span className="login-page-logo-pro"> Pro</span>
              </span>
            </div>
          </header>
          <div className="login-page-hero">
            <div className="login-page-hero-icon-wrap">
              <Scale size={64} className="login-page-hero-icon" strokeWidth={1.5} />
            </div>
            <h2 className="login-page-motto">Bridging Medical Expertise with Legal Strategy</h2>
            <p className="login-page-tagline">
              Secure, HIPAA-compliant consulting for the nation's leading attorneys and medical experts.
            </p>
          </div>
          <div className="login-page-badges">
            <div className="login-page-badge">
              <span className="login-page-badge-icon"><Check size={16} strokeWidth={2.5} /></span>
              <span>HIPAA COMPLIANT</span>
            </div>
            <div className="login-page-badge">
              <span className="login-page-badge-icon"><Lock size={16} strokeWidth={2} /></span>
              <span>AES-256 ENCRYPTED</span>
            </div>
          </div>
        </div>
        <div className="login-page-left-bg" aria-hidden />
      </div>

      <div className="login-page-right">
        <div className="login-page-right-inner">
          <h1 className="login-page-welcome">Welcome Back</h1>
          <p className="login-page-subtitle">Please enter your credentials to access the secure portal.</p>

          <div className="login-page-role-field">
            <label htmlFor="login-as">Login As (Demo Mode)</label>
            <div className="login-page-select-wrap">
              <select
                id="login-as"
                className="login-page-select"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {LOGIN_AS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={20} className="login-page-select-chevron" aria-hidden />
            </div>
          </div>

          {role === 'admin' ? (
            <AdminLoginPage embedded variant="split" />
          ) : (
            <CrewLogin redirectTo="/panel/crew/dashboard" embedded variant="split" />
          )}

          <footer className="login-page-footer">
            <p className="login-page-copy">© 2024 MedLegal Pro Platform. All Rights Reserved.</p>
            <nav className="login-page-links">
              <a href="/terms">Terms of Service</a>
              <span className="login-page-dot">·</span>
              <a href="/privacy">Privacy Policy</a>
              <span className="login-page-dot">·</span>
              <a href="/security">Security</a>
            </nav>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
