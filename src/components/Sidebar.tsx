import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearAccessToken } from '../lib/auth';
import {
  LayoutDashboard,
  Ship,
  Search,
  Users,
  Building2,
  FolderKanban,
  Calendar,
  Settings,
  LogOut,
  X,
  HelpCircle,
  Ticket,
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Ship, label: 'Crew', path: '/crew' },
  { icon: Search, label: 'Leads', path: '/leads' },
  { icon: Users, label: 'People', path: '/people' },
  { icon: Building2, label: 'Companies', path: '/companies' },
  { icon: FolderKanban, label: 'Projects', path: '/projects' },
  { icon: Ticket, label: 'Tickets', path: '/tickets' },
  { icon: Calendar, label: 'Schedule', path: '/schedule' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
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
        <div className="sidebar-help">
          <HelpCircle size={18} className="sidebar-help-icon" />
          <div className="sidebar-help-content">
            <p className="sidebar-help-title">Need Help?</p>
            <p className="sidebar-help-text">
              Contact portal technical support for HIPAA security inquiries.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
