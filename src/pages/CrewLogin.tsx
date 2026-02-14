import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock } from 'lucide-react';
import { crewLogin } from '../api/crew';
import { setCrewPanelUser } from '../lib/crewPanelAuth';
import './CrewLogin.css';

interface CrewLoginProps {
  /** Redirect path after successful login (default: /panel/crew/dashboard) */
  redirectTo?: string;
}

const CrewLogin = ({ redirectTo = '/panel/crew/dashboard' }: CrewLoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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

  return (
    <div className="crew-login">
      <div className="crew-login-background" />
      <div className="crew-login-card">
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

          <button
            type="submit"
            className="crew-login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="crew-login-spinner" />
            ) : (
              <>
                <LogIn size={20} />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="crew-login-footer">
          Crew member access only. Contact your admin if you need help.
        </p>
      </div>
    </div>
  );
};

export default CrewLogin;
