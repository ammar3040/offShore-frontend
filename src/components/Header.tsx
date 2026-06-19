import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Menu, LogOut, Percent, Wallet } from 'lucide-react';
import { clearAccessToken, getAdminUserFromToken } from '../lib/auth';
import { getAdminProfile } from '../api/admin';
import { fetchRates, convert, type CurrencyCode } from '../lib/currency';
import {
  ADMIN_BALANCE_DISPLAY_OPTIONS,
  broadcastAdminBalanceCurrencyChange,
  getStoredAdminBalanceCurrency,
  setStoredAdminBalanceCurrency,
} from '../lib/adminBalanceCurrency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useCommandPaletteOpen, getModKeyLabel } from './CommandPalette';
import './Header.css';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const openCommandPalette = useCommandPaletteOpen();
  const modKey = getModKeyLabel();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [markup, setMarkup] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState<CurrencyCode>(() =>
    getStoredAdminBalanceCurrency()
  );
  const [rates, setRates] = useState<Record<CurrencyCode, number> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getAdminUserFromToken();
  const email = user?.email ?? 'admin@gmail.com';
  const name = user?.name ?? 'Admin';
  const initials = name ? name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() : 'AD';

  const fetchProfile = () => {
    getAdminProfile()
      .then((profile) => {
        if (profile.markup != null) setMarkup(profile.markup);
        if (profile.balance != null) setBalance(profile.balance);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleBalanceRefresh = () => fetchProfile();
    window.addEventListener('admin-balance-refresh', handleBalanceRefresh);
    return () => window.removeEventListener('admin-balance-refresh', handleBalanceRefresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRates()
      .then((r) => { if (!cancelled) setRates(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = () => {
    clearAccessToken();
    setDropdownOpen(false);
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-menu-button" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={24} />
        </button>
        <div className="header-brand">Offshore CRM</div>
        <button
          type="button"
          className="search-container search-trigger"
          onClick={openCommandPalette}
          aria-label="Open search"
        >
          <Search size={18} className="search-icon" />
          <span className="search-input search-input-fake">Search anything...</span>
          <kbd className="search-kbd">{modKey}K</kbd>
        </button>
      </div>

      <div className="header-right">
        {markup != null && (
          <div className="header-markup-badge" title="Markup balance">
            <Percent size={14} />
            <span className="header-markup-value">{markup}%</span>
            <span className="header-markup-label">Markup</span>
          </div>
        )}
        <div className="admin-balance-badge" title="Admin balance">
          <Wallet size={14} />
          <span className="admin-balance-label">Admin Balance</span>
          <span className="admin-balance-value">
            {balance != null
              ? (() => {
                  const symbol =
                    ADMIN_BALANCE_DISPLAY_OPTIONS.find((c) => c.value === balanceCurrency)?.symbol ?? '£';
                  const displayAmount =
                    rates && balanceCurrency !== 'GBP'
                      ? convert(balance, 'GBP', balanceCurrency, rates)
                      : balance;
                  return `${symbol}${displayAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()
              : '—'}
          </span>
          <div className="admin-balance-currency-wrap">
            <Select
              value={balanceCurrency}
              onValueChange={(v) => {
                const code = v as CurrencyCode;
                setBalanceCurrency(code);
                setStoredAdminBalanceCurrency(code);
                broadcastAdminBalanceCurrencyChange(code);
              }}
            >
              <SelectTrigger className="admin-balance-currency-select h-8 min-w-0 border-0 bg-transparent px-2 shadow-none focus:ring-0" aria-label="Balance currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_BALANCE_DISPLAY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <div className="user-profile-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className={`user-profile ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="user-email">{email}</div>
              <div className="user-role">Admin</div>
            </div>
            <ChevronDown size={16} className="chevron-icon" />
          </button>
          {dropdownOpen && (
            <div className="user-profile-dropdown" role="menu">
              <button
                type="button"
                className="user-profile-dropdown-item logout"
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={18} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
