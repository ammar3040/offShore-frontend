import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { adminLogin, adminRegister } from '../api/admin';
import './AdminLoginPage.css';

type Mode = 'login' | 'register';

interface AdminLoginPageProps {
  /** When true, renders without the outer page wrapper (for use inside LoginPage) */
  embedded?: boolean;
  /** When true, use split-screen form style (Welcome Back is in parent; no header/tabs) */
  variant?: 'default' | 'split';
}

const AdminLoginPage = ({ embedded, variant = 'default' }: AdminLoginPageProps) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!firstname || !lastname || !email || !password || !phone) return;
    setIsLoading(true);
    try {
      await adminRegister({ firstname, lastname, email, password, phone });
      setSuccessMessage('Account created successfully. Sign in below.');
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError(null);
    setSuccessMessage(null);
  };

  const switchToRegister = () => {
    setMode('register');
    setError(null);
    setSuccessMessage(null);
  };

  const content = (
    <>
        {!isSplit && (
          <>
            <div className="admin-login-header">
              <div className="admin-login-logo">
                <div className="admin-login-logo-icon">O</div>
                <span className="admin-login-logo-text">Offshore CRM</span>
              </div>
              <h1 className="admin-login-title">
                {mode === 'login' ? 'Admin sign in' : 'Create admin account'}
              </h1>
              <p className="admin-login-subtitle">
                {mode === 'login'
                  ? 'Sign in to manage crew, projects, and leads.'
                  : 'Register a new admin account.'}
              </p>
            </div>
            <div className="admin-login-tabs">
              <button
                type="button"
                className={`admin-login-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={switchToLogin}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`admin-login-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={switchToRegister}
              >
                Register
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="admin-login-success" role="status">
            {successMessage}
          </div>
        )}

        {mode === 'login' ? (
          <form className={`admin-login-form ${isSplit ? 'admin-login-form-split' : ''}`} onSubmit={handleLogin}>
            <div className="admin-login-field">
              <label htmlFor="admin-email">{isSplit ? 'Email Address' : 'Email'}</label>
              <div className="admin-login-input-wrapper">
                <Mail size={18} className="admin-login-input-icon" />
                <input
                  id="admin-email"
                  type="email"
                  placeholder={isSplit ? 'attorney@firm.com' : 'you@company.com'}
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
                  {isSplit ? (
                    <>
                      Sign In to Portal
                      <ArrowRight size={20} />
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={20} />
                    </>
                  )}
                </>
              )}
            </button>
            {isSplit && (
              <p className="admin-login-create">
                Don&apos;t have an account?{' '}
                <button type="button" className="admin-login-create-btn" onClick={switchToRegister}>
                  Create Account →
                </button>
              </p>
            )}
          </form>
        ) : (
          <form className="admin-login-form" onSubmit={handleRegister}>
            <div className="admin-login-field">
              <label htmlFor="admin-firstname">First name</label>
              <div className="admin-login-input-wrapper">
                <User size={18} className="admin-login-input-icon" />
                <input
                  id="admin-firstname"
                  type="text"
                  placeholder="Marine"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  required
                  autoComplete="given-name"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="admin-login-field">
              <label htmlFor="admin-lastname">Last name</label>
              <div className="admin-login-input-wrapper">
                <User size={18} className="admin-login-input-icon" />
                <input
                  id="admin-lastname"
                  type="text"
                  placeholder="Admin"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  required
                  autoComplete="family-name"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="admin-login-field">
              <label htmlFor="admin-reg-email">Email</label>
              <div className="admin-login-input-wrapper">
                <Mail size={18} className="admin-login-input-icon" />
                <input
                  id="admin-reg-email"
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
              <label htmlFor="admin-phone">Phone</label>
              <div className="admin-login-input-wrapper">
                <Phone size={18} className="admin-login-input-icon" />
                <input
                  id="admin-phone"
                  type="tel"
                  placeholder="+918770780874"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="admin-login-field">
              <label htmlFor="admin-reg-password">Password</label>
              <div className="admin-login-input-wrapper">
                <Lock size={18} className="admin-login-input-icon" />
                <input
                  id="admin-reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            </div>
            <button
              type="submit"
              className="admin-login-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="admin-login-spinner" />
              ) : (
                <>
                  <UserPlus size={20} />
                  Create account
                </>
              )}
            </button>
            {isSplit && (
              <p className="admin-login-create">
                Already have an account?{' '}
                <button type="button" className="admin-login-create-btn" onClick={switchToLogin}>
                  Sign in →
                </button>
              </p>
            )}
          </form>
        )}

        {!isSplit && (
          <p className="admin-login-footer">
            Admin access only. Use this screen to sign in or register.
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
