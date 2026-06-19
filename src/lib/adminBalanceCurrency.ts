import type { CurrencyCode } from './currency';

const STORAGE_KEY = 'offshore_admin_balance_currency';

/** Fired when admin changes balance display currency in the header. */
export const ADMIN_BALANCE_CURRENCY_CHANGE_EVENT = 'admin-balance-currency-change';

export const ADMIN_BALANCE_DISPLAY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'INR', label: 'INR', symbol: '₹' },
];

function isCurrencyCode(v: string): v is CurrencyCode {
  return v === 'GBP' || v === 'USD' || v === 'INR';
}

export function getStoredAdminBalanceCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isCurrencyCode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'GBP';
}

export function setStoredAdminBalanceCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function broadcastAdminBalanceCurrencyChange(code: CurrencyCode): void {
  window.dispatchEvent(
    new CustomEvent<{ currency: CurrencyCode }>(ADMIN_BALANCE_CURRENCY_CHANGE_EVENT, {
      detail: { currency: code },
    })
  );
}
