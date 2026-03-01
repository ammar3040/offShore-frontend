import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Menu, LogOut, Percent, Wallet } from 'lucide-react';
import { clearAccessToken, getAdminUserFromToken } from '../lib/auth';
import { getAdminProfile } from '../api/admin';
import { fetchRates, convert, type CurrencyCode } from '../lib/currency';
import './Header.css';

const BALANCE_CURRENCIES: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'INR', label: 'INR', symbol: '₹' },
];

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [markup, setMarkup] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState<CurrencyCode>('GBP');
  const [rates, setRates] = useState<Record<CurrencyCode, number> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getAdminUserFromToken();
  const email = user?.email ?? 'admin@gmail.com';
  const name = user?.name ?? 'Admin';
  const initials = name ? name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() : 'AD';

  useEffect(() => {
    let cancelled = false;
    getAdminProfile()
      .then((profile) => {
        if (!cancelled) {
          if (profile.markup != null) setMarkup(profile.markup);
          if (profile.balance != null) setBalance(profile.balance);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search"
            className="search-input"
          />
        </div>
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
                  const symbol = BALANCE_CURRENCIES.find((c) => c.value === balanceCurrency)?.symbol ?? '£';
                  const displayAmount =
                    rates && balanceCurrency !== 'GBP'
                      ? convert(balance, 'GBP', balanceCurrency, rates)
                      : balance;
                  return `${symbol}${displayAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()
              : '—'}
          </span>
          <div className="admin-balance-currency-wrap">
            <select
              className="admin-balance-currency-select"
              value={balanceCurrency}
              onChange={(e) => setBalanceCurrency(e.target.value as CurrencyCode)}
              aria-label="Balance currency"
            >
              {BALANCE_CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="admin-balance-currency-chevron" aria-hidden />
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
