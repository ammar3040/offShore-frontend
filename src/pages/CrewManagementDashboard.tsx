import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Users, Ticket, Plus, Calendar } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { getProjects } from '../api/project';
import { getCrewList } from '../api/crew';
import { getCrewTickets } from '../api/ticket';
import type { ProjectApi } from '../api/project';
import type { CrewTicketApi } from '../api/ticket';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
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
  const [tickets, setTickets] = useState<CrewTicketApi[] | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    getCrewTickets()
      .then((res) => {
        if (!cancelled) setTickets(res.crewTickets ?? []);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      });
    return () => { cancelled = true; };
  }, []);

  const creationChartData = useMemo(() => {
    const byMonth: Record<string, { month: string; projects: number; tickets: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = { month: key, projects: 0, tickets: 0 };
    }
    projects.forEach((p) => {
      const dateStr = p.createdAt ?? p.duration?.startDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth[key]) byMonth[key].projects += 1;
    });
    (tickets ?? []).forEach((t) => {
      const dateStr = t.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth[key]) byMonth[key].tickets += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [projects, tickets]);

  const creationChartConfig = {
    month: { label: 'Month' },
    projects: { label: 'Projects', color: 'hsl(var(--chart-1))' },
    tickets: { label: 'Tickets', color: 'hsl(var(--chart-2))' },
  } satisfies ChartConfig;

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
          <Plus size={14} />
          Create New Project
        </Link>
      </div>

      <div className="admin-dashboard-cards">
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-blue">
            <FolderKanban size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{loadingProjects ? '…' : activeProjects}</span>
            <span className="admin-stat-label">TOTAL ACTIVE PROJECTS</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-purple">
            <Users size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{crewCount}</span>
            <span className="admin-stat-label">TOTAL CREWS</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon-green">
            <Ticket size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-value">{tickets === null ? '…' : tickets.length}</span>
            <span className="admin-stat-label">TOTAL TICKETS</span>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-panels">
        <div className="admin-dashboard-panel admin-panel-chart">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Projects &amp; Tickets Created</h2>
          </div>
          <div className="admin-panel-body admin-chart-body">
            {loadingProjects ? (
              <p className="admin-panel-empty">Loading…</p>
            ) : creationChartData.length === 0 ? (
              <p className="admin-panel-empty">No creation data available yet.</p>
            ) : (
              <ChartContainer config={creationChartConfig} className="h-[210px] w-full">
                <BarChart accessibilityLayer data={creationChartData} margin={{ top: 4, left: 8, right: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tickFormatter={(value) => {
                      const [y, m] = value.split('-');
                      return new Date(parseInt(y, 10), parseInt(m, 10) - 1).toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      });
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) =>
                          new Date(value + '-01').toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                          })
                        }
                      />
                    }
                  />
                  <Bar dataKey="projects" fill="var(--color-projects)" radius={4} />
                  <Bar dataKey="tickets" fill="var(--color-tickets)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

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
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/security">Security Audit Logs</a>
        </nav>
        <p className="admin-footer-status">• All Systems Operational</p>
      </footer>
    </div>
  );
};

export default CrewManagementDashboard;
