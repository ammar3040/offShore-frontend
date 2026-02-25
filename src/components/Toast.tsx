import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 5000) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return { toasts, toast, dismiss };
}

export function Toaster({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`toast toast-${item.type}${visible ? ' toast-visible' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-icon">
        {item.type === 'success' && <CheckCircle size={20} />}
        {item.type === 'error' && <XCircle size={20} />}
        {item.type === 'info' && <CheckCircle size={20} />}
      </div>
      <div className="toast-body">
        <p className="toast-title">{item.title}</p>
        {item.description && <p className="toast-desc">{item.description}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      <div className="toast-progress" />
    </div>
  );
}
