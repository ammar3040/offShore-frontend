import { type ReactNode, useState, useEffect } from 'react';
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
  CalendarRange,
  Moon,
  Sun,
} from 'lucide-react';
import { CommandPaletteProvider } from './CommandPalette';
import { Toaster } from './ui/sonner';
import { CREW_PANEL_COMMAND_PAGES } from '../config/commandPalette';
import { clearCrewSession } from '../lib/crewPanelAuth';
import { getCrewPanelTheme, setCrewPanelTheme, type CrewPanelTheme } from '../lib/crewPanelTheme';
import './CrewPanelLayout.css';

interface CrewPanelLayoutProps {
  children?: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/crew/dashboard' },
  { icon: FolderKanban, label: 'Enrolled Projects', path: '/panel/crew/enrolled-projects' },
  { icon: CalendarRange, label: 'Availability', path: '/panel/crew/availability' },
  { icon: User, label: 'Profile', path: '/panel/crew/profile' },
  { icon: Settings, label: 'Settings', path: '/panel/crew/settings' },
  { icon: Ticket, label: 'Tickets', path: '/panel/crew/tickets' },
  { icon: ClipboardList, label: 'Timesheet', path: '/panel/crew/timesheet' },
];

const CrewPanelLayout = ({ children }: CrewPanelLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<CrewPanelTheme>(() => getCrewPanelTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next: CrewPanelTheme = theme === 'dark' ? 'light' : 'dark';
    setCrewPanelTheme(next);
    setTheme(next);
  };

  const handleLogout = () => {
    clearCrewSession();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/panel/crew/dashboard') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <CommandPaletteProvider pages={CREW_PANEL_COMMAND_PAGES}>
    <div className={`crew-panel-layout${theme === 'dark' ? ' crew-panel-layout--dark dark' : ''}`}>
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
            className="crew-panel-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
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
      <Toaster theme={theme} richColors position="bottom-right" />
    </div>
    </CommandPaletteProvider>
  );
};

export default CrewPanelLayout;
