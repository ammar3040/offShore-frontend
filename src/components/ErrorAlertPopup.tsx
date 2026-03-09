import { AlertCircle } from 'lucide-react';
import './ErrorAlertPopup.css';

interface ErrorAlertPopupProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * Prominent error popup with shake animation for form validation/API errors.
 * Use in modals when errors need to be highly visible and readable.
 */
const ErrorAlertPopup = ({ message, onDismiss }: ErrorAlertPopupProps) => {
  return (
    <div
      className="error-alert-popup"
      role="alert"
      aria-live="assertive"
    >
      <div className="error-alert-popup-inner">
        <AlertCircle className="error-alert-popup-icon" size={28} />
        <div className="error-alert-popup-content">
          <p className="error-alert-popup-title">Error</p>
          <p className="error-alert-popup-message">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="error-alert-popup-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlertPopup;
