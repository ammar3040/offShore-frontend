import { type ReactNode } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Ticket, LogOut, Shield } from 'lucide-react';
import { clearSuperadminSession } from '../lib/superadminAuth';
import './SuperadminPanelLayout.css';

interface SuperadminPanelLayoutProps {
  children?: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/superadmin/dashboard' },
  { icon: Users, label: 'Admins', path: '/panel/superadmin/admins' },
  { icon: Ticket, label: 'Crew Tickets', path: '/panel/superadmin/tickets' },
];

const SuperadminPanelLayout = ({ children }: SuperadminPanelLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearSuperadminSession();
    navigate('/panel/superadmin/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="superadmin-panel-layout">
      <aside className="superadmin-panel-sidebar">
        <div className="superadmin-panel-sidebar-header">
          <div className="superadmin-panel-logo">
            <div className="superadmin-panel-logo-icon">
              <Shield size={20} />
            </div>
            <span className="superadmin-panel-logo-text">Superadmin</span>
          </div>
          <span className="superadmin-panel-badge">SA</span>
        </div>

        <nav className="superadmin-panel-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`superadmin-panel-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="superadmin-panel-sidebar-footer">
          <button
            type="button"
            className="superadmin-panel-logout"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="superadmin-panel-body">
        {children ?? <Outlet />}
      </div>
    </div>
  );
};

export default SuperadminPanelLayout;
