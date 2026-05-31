import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearAccessToken } from '../lib/auth';
import {
  LayoutDashboard,
  Ship,
  FolderKanban,
  Anchor,
  CalendarDays,
  LogOut,
  X,
  HelpCircle,
  Ticket,
  Sun,
  Moon,
} from 'lucide-react';
import type { AdminTheme } from '../lib/adminTheme';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  theme?: AdminTheme;
  onToggleTheme?: () => void;
}

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Ship, label: 'Crew', path: '/crew' },
  { icon: FolderKanban, label: 'Projects', path: '/projects' },
  { icon: Anchor, label: 'Rigs', path: '/rig' },
  { icon: CalendarDays, label: 'Timeline', path: '/timeline' },
  { icon: Ticket, label: 'Tickets', path: '/tickets' },
];

const Sidebar = ({ isOpen = true, onClose, theme = 'light', onToggleTheme }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAccessToken();
    onClose?.();
    navigate('/login');
  };

  const handleNavClick = () => {
    onClose?.();
  };

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-text">Offshore CRM</span>
        </div>
        <button className="sidebar-close-button" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.path);
          const isCrewActive = item.path === '/crew' && location.pathname.startsWith('/crew');
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`nav-item ${(active || isCrewActive) ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <button type="button" className="nav-item nav-item-logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        {onToggleTheme && (
          <button
            type="button"
            className="sidebar-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        )}
        <div className="sidebar-help">
          <HelpCircle size={18} className="sidebar-help-icon" />
          <div className="sidebar-help-content">
            <p className="sidebar-help-title">Need Help?</p>
            <p className="sidebar-help-text">
              Contact portal technical support for security inquiries.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
