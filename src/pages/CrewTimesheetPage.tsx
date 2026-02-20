import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ClipboardList, Calendar } from 'lucide-react';
import {
  getCrewEnrolledProjects,
  getCrewTimesheetForProject,
  updateCrewTimesheetEntry,
  type CrewEnrolledProject,
  type GetCrewTimesheetForProjectResponse,
} from '../api/crew';
import { hasCrewAccessToken } from '../lib/crewPanelAuth';
import './CrewTimesheetPage.css';

type AttendanceStatus = 'present' | 'absent' | 'leave' | null;

/** Entry row with guaranteed non-null attendance (from API). */
type TimesheetEntryRow = { date: string; status: 'present' | 'absent' | 'leave' };

/** Normalize API status to our AttendanceStatus. */
function normalizeApiStatus(apiStatus: string): AttendanceStatus {
  const s = (apiStatus || '').toUpperCase();
  if (s === 'PRESENT') return 'present';
  if (s === 'ABSENT') return 'absent';
  if (s === 'LEAVE') return 'leave';
  return null;
}

/** Normalize ISO date/datetime to YYYY-MM-DD. */
function toDateOnly(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

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

const PAGE_SIZE = 10;

/** Max page numbers to show in pagination (e.g. 5 → "... 4 5 6 7 8 ..."). */
const PAGINATION_WINDOW = 5;

/**
 * Returns page numbers and ellipsis to show. e.g. [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20].
 */
function getPaginationPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= PAGINATION_WINDOW + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(PAGINATION_WINDOW / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + PAGINATION_WINDOW - 1);
  if (end - start + 1 < PAGINATION_WINDOW) {
    start = Math.max(1, end - PAGINATION_WINDOW + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total) {
    if (end < total - 1) pages.push('ellipsis');
    pages.push(total);
  }
  return pages;
}

const CrewTimesheetPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CrewEnrolledProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CrewEnrolledProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetData, setTimesheetData] = useState<GetCrewTimesheetForProjectResponse | null>(null);
  const [page, setPage] = useState(1);
  const [updatingDate, setUpdatingDate] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedProject?.id) {
      setTimesheetData(null);
      setPage(1);
      return;
    }
    setTimesheetData(null);
    setTimesheetLoading(true);
    setPage(1);
    let cancelled = false;
    getCrewTimesheetForProject(selectedProject.id)
      .then((res) => {
        if (!cancelled) setTimesheetData(res ?? null);
      })
      .finally(() => {
        if (!cancelled) setTimesheetLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedProject?.id]);

  /** Only entries from API that have a valid attendance status, sorted by date. */
  const timesheetEntries = useMemo((): TimesheetEntryRow[] => {
    const entries = timesheetData?.timesheet?.entries ?? [];
    return entries
      .map((e): TimesheetEntryRow | null => {
        const dateKey = toDateOnly(e.date);
        const status = normalizeApiStatus(e.status);
        if (!dateKey || !status) return null;
        return { date: dateKey, status };
      })
      .filter((x): x is TimesheetEntryRow => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [timesheetData]);

  if (loading) {
    return (
      <div className="crew-timesheet-loading">
        <div className="crew-timesheet-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(timesheetEntries.length / PAGE_SIZE));
  const paginatedEntries = timesheetEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;

  const handleProjectChange = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    setSelectedProject(p ?? null);
    setPage(1);
    setUpdateError(null);
  };

  const handleAttendanceChange = async (date: string, newStatus: AttendanceStatus) => {
    if (!selectedProject?.id || !newStatus) return;
    setUpdateError(null);
    setUpdatingDate(date);
    try {
      const res = await updateCrewTimesheetEntry(selectedProject.id, {
        date,
        status: newStatus.toUpperCase(),
      });
      setTimesheetData(res);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update attendance');
    } finally {
      setUpdatingDate(null);
    }
  };

  const paginationPages = getPaginationPages(page, totalPages);

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
              disabled={timesheetLoading}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            {timesheetLoading && (
              <span className="crew-timesheet-select-loading" aria-live="polite">Loading timesheet…</span>
            )}
          </div>

          {selectedProject && !timesheetLoading && timesheetEntries.length > 0 ? (
            <>
              {updateError && (
                <div className="crew-timesheet-error" role="alert">
                  {updateError}
                </div>
              )}
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
                  {paginatedEntries.map((entry, i) => {
                    const rowNum = startIndex + i + 1;
                    return (
                      <tr key={entry.date}>
                        <td>{rowNum}</td>
                        <td>{selectedProject?.title ?? '—'}</td>
                        <td>{formatDate(entry.date)}</td>
                        <td>{getDayOfWeek(entry.date)}</td>
                        <td>
                          <select
                            className={`crew-timesheet-attendance crew-timesheet-attendance--${entry.status}`}
                            value={entry.status}
                            disabled={updatingDate === entry.date}
                            onChange={(e) => {
                              const v = e.target.value as AttendanceStatus;
                              handleAttendanceChange(entry.date, v);
                            }}
                            aria-label={`Attendance for ${formatDate(entry.date)}`}
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="leave">Leave</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {timesheetEntries.length > PAGE_SIZE && (
                <div className="crew-timesheet-pagination">
                  <span className="crew-timesheet-pagination-info">
                    Showing {startIndex + 1}-{Math.min(page * PAGE_SIZE, timesheetEntries.length)} of {timesheetEntries.length} entries
                  </span>
                  <div className="crew-timesheet-pagination-btns">
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                      aria-label="First page"
                    >
                      First
                    </button>
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    {paginationPages.map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="crew-timesheet-pagination-ellipsis" aria-hidden>
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`crew-timesheet-pagination-btn ${p === page ? 'active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      className="crew-timesheet-pagination-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                      aria-label="Last page"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : selectedProject && !timesheetLoading ? (
            <div className="crew-timesheet-no-dates">
              <Calendar size={40} />
              <p>No timesheet entries for this project.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default CrewTimesheetPage;
