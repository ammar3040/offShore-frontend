import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Users, Plane, Plus, Calendar } from 'lucide-react';
import { getProjects } from '../api/project';
import { getCrewList } from '../api/crew';
import type { ProjectApi } from '../api/project';
import './CrewManagementDashboard.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CrewManagementDashboard = () => {
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [crewCount, setCrewCount] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((res) => {
        if (!cancelled) setProjects(res.projects ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCrewList()
      .then((res) => {
        if (!cancelled) setCrewCount((res.crew ?? []).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const activeProjects = projects.filter((p) => (p.status || '').toLowerCase() === 'active').length;
  const recentProjects = projects.slice(0, 5);

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <div>
          <h1 className="admin-dashboard-greeting">
            {getGreeting()}, Admin
          </h1>
          <p className="admin-dashboard-date">Today is {formatDate(new Date())}.</p>
        </div>
        <Link to="/projects" className="admin-dashboard-create-btn">
          <Plus size={18} />
          Create New Project
        </Link>
      </div>

      <div className="admin-dashboard-cards">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-blue">
            <FolderKanban size={24} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{loadingProjects ? '…' : activeProjects}</span>
            <span className="admin-stat-label">TOTAL ACTIVE PROJECTS</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-purple">
            <Users size={24} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{crewCount}</span>
            <span className="admin-stat-label">TOTAL CREWS</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-green">
            <Plane size={24} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">—</span>
            <span className="admin-stat-label">TOTAL FLIGHTS</span>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-panels">
        <div className="admin-dashboard-panel admin-panel-cases">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Recent Projects</h2>
            <Link to="/projects" className="admin-panel-view-all">View All</Link>
          </div>
          <div className="admin-panel-body">
            {loadingProjects ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : recentProjects.length === 0 ? (
              <p className="admin-panel-empty">No projects found. Create your first project to get started.</p>
            ) : (
              <ul className="admin-cases-list">
                {recentProjects.map((p) => (
                  <li key={p.id} className="admin-case-item">
                    <span className="admin-case-title">{p.title}</span>
                    <span className="admin-case-status">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="admin-dashboard-panel admin-panel-deadlines">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Upcoming Deadlines</h2>
          </div>
          <div className="admin-panel-body">
            <p className="admin-panel-empty">No upcoming deadlines.</p>
            <Link to="/projects" className="admin-panel-calendar-btn">
              <Calendar size={16} />
              View Full Calendar
            </Link>
          </div>
        </div>
      </div>

      <footer className="admin-dashboard-footer">
        <p className="admin-footer-copy">© 2023 Offshore CRM. All rights reserved.</p>
        <nav className="admin-footer-links">
          <a href="/hipaa">HIPAA Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/security">Security Audit Logs</a>
        </nav>
        <p className="admin-footer-status">• All Systems Operational</p>
      </footer>
    </div>
  );
};

export default CrewManagementDashboard;
