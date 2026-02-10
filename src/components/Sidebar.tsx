import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, Users, Building2, FolderKanban, Calendar, Settings, Rocket, X, Ship } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const location = useLocation();
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Ship, label: 'Crew', path: '/crew' },
    { icon: Search, label: 'Leads', path: '/leads' },
    { icon: Users, label: 'People', path: '/people' },
    { icon: Building2, label: 'Companies', path: '/companies' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">O</div>
          <span className="logo-text">Offshore CRM</span>
        </div>
        <button className="sidebar-close-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isCrewActive = item.path === '/crew' && location.pathname.startsWith('/crew');
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${(isActive || isCrewActive) ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="update-card">
          <Rocket size={24} className="rocket-icon" />
          <p className="update-text">New update available click to update</p>
          <button className="update-button">Update!</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
