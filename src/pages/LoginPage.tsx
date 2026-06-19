import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Check, Lock, ArrowRight, Mail, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { authLogin } from '../api/auth';
import { getAdminTheme, setAdminTheme, type AdminTheme } from '../lib/adminTheme';
import './LoginPage.css';
import './AdminLoginPage.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<AdminTheme>(() => getAdminTheme());
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setAdminTheme(next);
    setTheme(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const { redirectTo } = await authLogin({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page-left">
        <div className="login-page-left-content">
          <header className="login-page-brand">
            <div className="login-page-logo">
              <Plane size={28} className="login-page-logo-icon" strokeWidth={2} />
              <span className="login-page-logo-text">
                <span className="login-page-logo-med">Marine Flight</span>
                <span className="login-page-logo-pro"> Pro</span>
              </span>
            </div>
          </header>
          <div className="login-page-hero">
            <div className="login-page-hero-icon-wrap">
              <Plane size={64} className="login-page-hero-icon" strokeWidth={1.5} />
            </div>
            <h2 className="login-page-motto">Bridging Project Expertise with Transport Strategy</h2>
            <p className="login-page-tagline">
              Secure, enterprise-grade consulting for the nation's Project Expertise and trade experts.
            </p>
          </div>
          <div className="login-page-badges">
            <div className="login-page-badge">
              <span className="login-page-badge-icon"><Check size={16} strokeWidth={2.5} /></span>
              <span>SECURE ACCESS</span>
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
        <button
          type="button"
          className="login-page-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="login-page-right-inner">
          <h1 className="login-page-welcome">Welcome Back</h1>
          <p className="login-page-subtitle">Please enter your credentials to access the secure portal.</p>

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <form className="admin-login-form admin-login-form-split" onSubmit={handleSubmit}>
            <div className="admin-login-field">
              <label htmlFor="login-email">Email Address</label>
              <div className="admin-login-input-wrapper">
                <Mail size={18} className="admin-login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="user@example.com"
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
                <label htmlFor="login-password">Password</label>
                <a href="#" className="admin-login-forgot" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
              </div>
              <div className="admin-login-input-wrapper admin-login-input-has-toggle">
                <Lock size={18} className="admin-login-input-icon" />
                <input
                  id="login-password"
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
            <button
              type="submit"
              className="admin-login-button"
              disabled={isLoading}
            >
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

          <footer className="login-page-footer">
            <p className="login-page-copy">© 2024 Marine Flight Pro Platform. All Rights Reserved.</p>
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
