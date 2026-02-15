import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Menu, LogOut } from 'lucide-react';
import { clearAccessToken, getAdminUserFromToken } from '../lib/auth';
import './Header.css';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getAdminUserFromToken();
  const email = user?.email ?? 'admin@gmail.com';
  const name = user?.name ?? 'Admin';
  const initials = name ? name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() : 'AD';

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
        <span className="hipaa-badge">HIPAA COMPLIANT SESSION</span>
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
