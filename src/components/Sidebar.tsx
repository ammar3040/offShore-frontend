import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, Users, Building2, FolderKanban, Calendar, Settings, Rocket } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Search, label: 'Leads', path: '/leads' },
    { icon: Users, label: 'People', path: '/people' },
    { icon: Building2, label: 'Companies', path: '/companies' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">sync</div>
          <span className="logo-text">sync</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
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
