import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { superadminLogin } from '../api/superadmin';
import './SuperadminLoginPage.css';

interface SuperadminLoginPageProps {
  embedded?: boolean;
  variant?: 'default' | 'split';
}

const SuperadminLoginPage = ({ embedded, variant = 'default' }: SuperadminLoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isSplit = embedded && variant === 'split';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    setIsLoading(true);
    try {
      await superadminLogin({ email, password });
      navigate('/panel/superadmin/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <>
      {!isSplit && (
        <div className="superadmin-login-header">
          <div className="superadmin-login-logo">
            <div className="superadmin-login-logo-icon">SA</div>
            <span className="superadmin-login-logo-text">Superadmin</span>
          </div>
          <h1 className="superadmin-login-title">Superadmin sign in</h1>
          <p className="superadmin-login-subtitle">Sign in to manage admins, analytics, and crew tickets.</p>
        </div>
      )}

      {error && (
        <div className="superadmin-login-error" role="alert">
          {error}
        </div>
      )}

      <form className={`superadmin-login-form ${isSplit ? 'superadmin-login-form-split' : ''}`} onSubmit={handleLogin}>
        <div className="superadmin-login-field">
          <label htmlFor="superadmin-email">{isSplit ? 'Email' : 'Email'}</label>
          <div className="superadmin-login-input-wrapper">
            <Mail size={18} className="superadmin-login-input-icon" />
            <input
              id="superadmin-email"
              type="email"
              placeholder="superadmin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="superadmin-login-field">
          <label htmlFor="superadmin-password">Password</label>
          <div className={`superadmin-login-input-wrapper ${isSplit ? 'superadmin-login-input-has-toggle' : ''}`}>
            <Lock size={18} className="superadmin-login-input-icon" />
            <input
              id="superadmin-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
            {isSplit && (
              <button
                type="button"
                className="superadmin-login-password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>
        </div>
        <button
          type="submit"
          className="superadmin-login-button"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="superadmin-login-spinner" />
          ) : (
            <>
              {isSplit ? 'Sign In' : 'Sign in'}
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>

      {!isSplit && (
        <p className="superadmin-login-footer">
          Superadmin access only. Restricted to platform administrators.
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div className="superadmin-login-embedded">{content}</div>;
  }

  return (
    <div className="superadmin-login">
      <div className="superadmin-login-background" />
      <div className="superadmin-login-card">{content}</div>
    </div>
  );
};

export default SuperadminLoginPage;
