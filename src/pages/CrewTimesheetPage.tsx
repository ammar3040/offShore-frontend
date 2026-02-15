import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ClipboardList, Calendar } from 'lucide-react';
import { getCrewEnrolledProjects, type CrewEnrolledProject } from '../api/crew';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewTimesheetPage.css';

type AttendanceStatus = 'present' | 'absent' | 'leave' | null;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function getDayOfWeek(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
  } catch {
    return '—';
  }
}

function getDatesInRange(start: string, end: string): string[] {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const out: string[] = [];
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);
  e.setHours(23, 59, 59, 999);
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const PAGE_SIZE = 10;

const CrewTimesheetPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CrewEnrolledProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CrewEnrolledProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!hasCrewAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    getCrewEnrolledProjects()
      .then(({ projects: p }) => {
        if (!cancelled) {
          setProjects(p ?? []);
          if ((p ?? []).length > 0 && !selectedProject) {
            setSelectedProject((p ?? [])[0]);
          }
          setPage(1);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="crew-timesheet-loading">
        <div className="crew-timesheet-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const dates = selectedProject?.startDate && selectedProject?.endDate
    ? getDatesInRange(selectedProject.startDate, selectedProject.endDate)
    : [];

  const totalPages = Math.max(1, Math.ceil(dates.length / PAGE_SIZE));
  const paginatedDates = dates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;

  const handleProjectChange = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    setSelectedProject(p ?? null);
    setPage(1);
  };

  return (
    <div className="crew-timesheet-page">
      <header className="crew-timesheet-header">
        <h1 className="crew-timesheet-title">Timesheet</h1>
        <p className="crew-timesheet-subtitle">Track your attendance for enrolled projects</p>
      </header>

      {projects.length === 0 ? (
        <div className="crew-timesheet-empty">
          <ClipboardList size={48} />
          <p>No enrolled projects.</p>
          <Link to="/panel/crew/enrolled-projects" className="crew-timesheet-link">View Enrolled Projects</Link>
        </div>
      ) : (
        <>
          <div className="crew-timesheet-select-wrap">
            <label htmlFor="crew-timesheet-project">Select project</label>
            <select
              id="crew-timesheet-project"
              value={selectedProject?.id ?? ''}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {selectedProject && dates.length > 0 ? (
            <>
              <div className="crew-timesheet-table-wrap">
                <table className="crew-timesheet-table">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Project</th>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDates.map((date, i) => {
                    const status: AttendanceStatus = null;
                    const rowNum = startIndex + i + 1;
                    return (
                      <tr key={date}>
                        <td>{rowNum}</td>
                        <td>{selectedProject?.title ?? '—'}</td>
                        <td>{formatDate(date)}</td>
                        <td>{getDayOfWeek(date)}</td>
                          <td>
                            <span className={`crew-timesheet-attendance crew-timesheet-attendance--${status ?? 'placeholder'}`}>
                              {status ?? '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {dates.length > PAGE_SIZE && (
                <div className="crew-timesheet-pagination">
                  <span className="crew-timesheet-pagination-info">
                    Showing {startIndex + 1}-{Math.min(page * PAGE_SIZE, dates.length)} of {dates.length} entries
                  </span>
                  <div className="crew-timesheet-pagination-btns">
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`crew-timesheet-pagination-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : selectedProject ? (
            <div className="crew-timesheet-no-dates">
              <Calendar size={40} />
              <p>No project duration set.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default CrewTimesheetPage;
