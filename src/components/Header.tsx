import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Menu, LogOut } from 'lucide-react';
import { clearAccessToken } from '../lib/auth';
import './Header.css';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
        <button className="mobile-menu-button" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
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
        <button className="icon-button">
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
            <div className="avatar">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="#e5e7eb"/>
                <path d="M16 10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-3.31 0-6 1.34-6 3v1h12v-1c0-1.66-2.69-3-6-3z" fill="#6b7280"/>
              </svg>
            </div>
            <div className="user-info">
              <div className="user-name">Alex</div>
              <div className="user-email">Alex@gmail.com</div>
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
