import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { adminLogin } from '../api/admin';
import './AdminLoginPage.css';

interface AdminLoginPageProps {
  /** When true, renders without the outer page wrapper (for use inside LoginPage) */
  embedded?: boolean;
  /** When true, use split-screen form style (Welcome Back is in parent; no header/tabs) */
  variant?: 'default' | 'split';
}

const AdminLoginPage = ({ embedded, variant = 'default' }: AdminLoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
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
      await adminLogin({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <>
      {!isSplit && (
        <div className="admin-login-header">
          <div className="admin-login-logo">
            <div className="admin-login-logo-icon">O</div>
            <span className="admin-login-logo-text">Offshore CRM</span>
          </div>
          <h1 className="admin-login-title">Admin sign in</h1>
          <p className="admin-login-subtitle">Sign in to manage crew, projects, and leads.</p>
        </div>
      )}

      {error && (
        <div className="admin-login-error" role="alert">
          {error}
        </div>
      )}

      <form className={`admin-login-form ${isSplit ? 'admin-login-form-split' : ''}`} onSubmit={handleLogin}>
        <div className="admin-login-field">
          <label htmlFor="admin-email">{isSplit ? 'Email Address' : 'Email'}</label>
          <div className="admin-login-input-wrapper">
            <Mail size={18} className="admin-login-input-icon" />
            <input
              id="admin-email"
              type="email"
              placeholder={isSplit ? 'marine-admin@yopmail.com' : 'you@company.com'}
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
            <label htmlFor="admin-password">Password</label>
            {isSplit && (
              <a href="#" className="admin-login-forgot" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
            )}
          </div>
          <div className={`admin-login-input-wrapper ${isSplit ? 'admin-login-input-has-toggle' : ''}`}>
            <Lock size={18} className="admin-login-input-icon" />
            <input
              id="admin-password"
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
                className="admin-login-password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>
        </div>
        {isSplit && (
          <label className="admin-login-remember">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            />
            <span>Remember this device for 30 days</span>
          </label>
        )}
        <button
          type="submit"
          className="admin-login-button"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="admin-login-spinner" />
          ) : (
            <>
              {isSplit ? 'Sign In to Portal' : 'Sign in'}
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>

      {!isSplit && (
        <p className="admin-login-footer">
          Admin access only. Contact your administrator to get access.
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div className="admin-login-embedded">{content}</div>;
  }

  return (
    <div className="admin-login">
      <div className="admin-login-background" />
      <div className="admin-login-card">{content}</div>
    </div>
  );
};

export default AdminLoginPage;
