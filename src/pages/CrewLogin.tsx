import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { crewLogin } from '../api/crew';
import { setCrewPanelUser } from '../lib/crewPanelAuth';
import './CrewLogin.css';
import './AdminLoginPage.css';

interface CrewLoginProps {
  /** Redirect path after successful login (default: /panel/crew/dashboard) */
  redirectTo?: string;
  /** When true, renders without the outer page wrapper (for use inside LoginPage) */
  embedded?: boolean;
  /** When true, use split-screen form style (same as AdminLoginPage split) */
  variant?: 'default' | 'split';
}

const CrewLogin = ({ redirectTo = '/panel/crew/dashboard', embedded, variant = 'default' }: CrewLoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isSplit = embedded && variant === 'split';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      await crewLogin({ email, password });
      if (redirectTo.startsWith('/panel/crew/')) {
        setCrewPanelUser({ email });
      }
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formContent = isSplit ? (
    <form className="admin-login-form admin-login-form-split" onSubmit={handleSubmit}>
      <div className="admin-login-field">
        <label htmlFor="crew-email">Email Address</label>
        <div className="admin-login-input-wrapper">
          <Mail size={18} className="admin-login-input-icon" />
          <input
            id="crew-email"
            type="email"
            placeholder="marine-admin@yopmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="admin-login-field">
        <div className="admin-login-label-row">
          <label htmlFor="crew-password">Password</label>
          <a href="#" className="admin-login-forgot" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
        </div>
        <div className="admin-login-input-wrapper admin-login-input-has-toggle">
          <Lock size={18} className="admin-login-input-icon" />
          <input
            id="crew-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
          <button
            type="button"
            className="admin-login-password-toggle"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      <label className="admin-login-remember">
        <input
          type="checkbox"
          checked={rememberDevice}
          onChange={(e) => setRememberDevice(e.target.checked)}
        />
        <span>Remember this device for 30 days</span>
      </label>
      {error && (
        <div className="admin-login-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="admin-login-button" disabled={isLoading}>
        {isLoading ? (
          <span className="admin-login-spinner" />
        ) : (
          <>
            Sign In to Portal
            <ArrowRight size={20} />
          </>
        )}
      </button>
    </form>
  ) : (
    <>
      <div className="crew-login-header">
        <div className="crew-login-logo">
          <div className="crew-login-logo-icon">O</div>
          <span className="crew-login-logo-text">Offshore CRM</span>
        </div>
        <h1 className="crew-login-title">Crew Portal</h1>
        <p className="crew-login-subtitle">Sign in to access your workspace</p>
      </div>
      <form className="crew-login-form" onSubmit={handleSubmit}>
        <div className="crew-login-field">
          <label htmlFor="crew-email">Email</label>
          <div className="crew-login-input-wrapper">
            <Mail size={18} className="crew-login-input-icon" />
            <input
              id="crew-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="crew-login-field">
          <label htmlFor="crew-password">Password</label>
          <div className="crew-login-input-wrapper">
            <Lock size={18} className="crew-login-input-icon" />
            <input
              id="crew-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
        </div>
        {error && (
          <div className="crew-login-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="crew-login-button" disabled={isLoading}>
          {isLoading ? (
            <span className="crew-login-spinner" />
          ) : (
            <>
              <ArrowRight size={20} />
              Sign in
            </>
          )}
        </button>
      </form>
      <p className="crew-login-footer">
        Crew member access only. Contact your admin if you need help.
      </p>
    </>
  );

  const content = <>{formContent}</>;

  if (embedded) {
    return <div className="crew-login-embedded">{content}</div>;
  }

  return (
    <div className="crew-login">
      <div className="crew-login-background" />
      <div className="crew-login-card">{content}</div>
    </div>
  );
};

export default CrewLogin;
