import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { crewChangePassword, crewForgotPassword } from '../api/crew';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewSettingsPage.css';

const CrewSettingsPage = () => {
  const navigate = useNavigate();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await crewChangePassword({ oldPassword: currentPassword, newPassword, confirmPassword });
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!forgotEmail.trim()) return;
    setIsLoading(true);
    try {
      await crewForgotPassword(forgotEmail.trim());
      setSuccess('If an account exists with that email, you will receive a password reset link.');
      setForgotEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToReset = () => {
    setShowForgotPassword(false);
    setError(null);
    setSuccess(null);
    setForgotEmail('');
  };

  return (
    <div className="crew-settings-page">
      <header className="crew-settings-header">
        <h1 className="crew-settings-title">Settings</h1>
        <p className="crew-settings-subtitle">Manage your account preferences</p>
      </header>

      <section className="crew-settings-card">
        <h2 className="crew-settings-card-title">
          <Lock size={20} />
          Reset Password
        </h2>

        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="crew-settings-form">
            <p className="crew-settings-hint">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <div className="crew-settings-field">
              <label htmlFor="crew-forgot-email">Email</label>
              <div className="crew-settings-input-wrap">
                <Mail size={18} className="crew-settings-input-icon" />
                <input
                  id="crew-forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && <div className="crew-settings-error" role="alert">{error}</div>}
            {success && <div className="crew-settings-success">{success}</div>}
            <button type="submit" className="crew-settings-btn crew-settings-btn-primary" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="crew-settings-link"
              onClick={handleBackToReset}
              disabled={isLoading}
            >
              ← Back to reset password
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="crew-settings-form">
            <div className="crew-settings-field">
              <label htmlFor="crew-current-password">Current password</label>
              <div className="crew-settings-input-wrap crew-settings-input-has-toggle">
                <Lock size={18} className="crew-settings-input-icon" />
                <input
                  id="crew-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="crew-settings-password-toggle"
                  onClick={() => setShowCurrentPassword((p) => !p)}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="button"
                className="crew-settings-forgot-link"
                onClick={() => setShowForgotPassword(true)}
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            <div className="crew-settings-field">
              <label htmlFor="crew-new-password">New password</label>
              <div className="crew-settings-input-wrap crew-settings-input-has-toggle">
                <Lock size={18} className="crew-settings-input-icon" />
                <input
                  id="crew-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="crew-settings-password-toggle"
                  onClick={() => setShowNewPassword((p) => !p)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="crew-settings-field">
              <label htmlFor="crew-confirm-password">Confirm password</label>
              <div className="crew-settings-input-wrap">
                <Lock size={18} className="crew-settings-input-icon" />
                <input
                  id="crew-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && <div className="crew-settings-error" role="alert">{error}</div>}
            {success && <div className="crew-settings-success">{success}</div>}

            <button type="submit" className="crew-settings-btn crew-settings-btn-primary" disabled={isLoading}>
              {isLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};

export default CrewSettingsPage;
