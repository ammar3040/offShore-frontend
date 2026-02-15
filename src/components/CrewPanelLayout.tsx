import { type ReactNode } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  User,
  Settings,
  Ticket,
  ClipboardList,
  LogOut,
  Plane,
} from 'lucide-react';
import { clearCrewSession } from '../lib/crewPanelAuth';
import './CrewPanelLayout.css';

interface CrewPanelLayoutProps {
  children?: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/crew/dashboard' },
  { icon: FolderKanban, label: 'Enrolled Projects', path: '/panel/crew/enrolled-projects' },
  { icon: User, label: 'Profile', path: '/panel/crew/profile' },
  { icon: Settings, label: 'Settings', path: '/panel/crew/settings' },
  { icon: Ticket, label: 'Tickets', path: '/panel/crew/tickets' },
  { icon: ClipboardList, label: 'Timesheet', path: '/panel/crew/timesheet' },
];

const CrewPanelLayout = ({ children }: CrewPanelLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearCrewSession();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/panel/crew/dashboard') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="crew-panel-layout">
      <aside className="crew-panel-sidebar">
        <div className="crew-panel-sidebar-header">
          <div className="crew-panel-logo">
            <div className="crew-panel-logo-icon">
              <Plane size={20} />
            </div>
            <span className="crew-panel-logo-text">Offshore CRM</span>
          </div>
          <span className="crew-panel-badge">Crew</span>
        </div>

        <nav className="crew-panel-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`crew-panel-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="crew-panel-sidebar-footer">
          <button
            type="button"
            className="crew-panel-logout"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="crew-panel-body">
        {children ?? <Outlet />}
      </div>
    </div>
  );
};

export default CrewPanelLayout;
