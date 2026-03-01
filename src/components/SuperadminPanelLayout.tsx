import { type ReactNode, useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Ticket, LogOut, Shield, Menu, X, Sun, Moon } from 'lucide-react';
import { Toaster } from './ui/sonner';
import { clearSuperadminSession } from '../lib/superadminAuth';
import { getSuperadminTheme, setSuperadminTheme, type SuperadminTheme } from '../lib/superadminTheme';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<SuperadminTheme>(() => getSuperadminTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next: SuperadminTheme = theme === 'dark' ? 'light' : 'dark';
    setSuperadminTheme(next);
    setTheme(next);
  };

  const handleLogout = () => {
    clearSuperadminSession();
    setMobileOpen(false);
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className={`superadmin-panel-layout${theme === 'dark' ? ' superadmin-panel-layout--dark dark' : ''}`}>
      <div
        className={`superadmin-panel-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`superadmin-panel-sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="superadmin-panel-sidebar-header">
          <div className="superadmin-panel-logo">
            <div className="superadmin-panel-logo-icon">
              <Shield size={20} />
            </div>
            <span className="superadmin-panel-logo-text">Superadmin</span>
          </div>
          <span className="superadmin-panel-badge">SA</span>
          <button
            type="button"
            className="superadmin-panel-sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
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
                onClick={() => setMobileOpen(false)}
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
            className="superadmin-panel-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
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

      <div className="superadmin-panel-main">
        <header className="superadmin-panel-mobile-header">
          <button
            type="button"
            className="superadmin-panel-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="superadmin-panel-mobile-logo">
            <Shield size={18} />
            <span>Superadmin</span>
          </div>
        </header>
        <div className="superadmin-panel-body">
          {children ?? <Outlet />}
        </div>
      </div>
      <Toaster theme={theme} richColors position="bottom-right" />
    </div>
  );
};

export default SuperadminPanelLayout;
