import type { ProjectApi } from '../api/project';

export type CrewAvailability = 'available' | 'onProject' | 'endingSoon';

function stripToLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseYmd(ymd: string | undefined): Date | null {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = +m[1];
    const mo = +m[2] - 1;
    const day = +m[3];
    return new Date(y, mo, day);
  }
  const d = new Date(ymd);
  return Number.isNaN(d.getTime()) ? null : stripToLocalDate(d);
}

function daysFromTodayTo(end: Date, today: Date): number {
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isParticipant(project: ProjectApi, crewId: string): boolean {
  const list = project.participants;
  if (!Array.isArray(list)) return false;
  return list.some((p) => String(p) === String(crewId));
}

/**
 * A project the crew is assigned to that counts as "current" (not completed, in date range).
 */
function isOngoingProject(project: ProjectApi, today: Date): boolean {
  const st = (project.status || '').toLowerCase();
  if (st === 'completed') return false;
  const end = project.duration?.endDate ? parseYmd(project.duration.endDate) : null;
  if (end && end < today) return false;
  const start = project.duration?.startDate ? parseYmd(project.duration.startDate) : null;
  if (start && start > today) return false;
  if (end) return true;
  return st === 'active' || st === 'pending' || st === 'draft' || st === '' || st === 'in progress';
}

/**
 * Green: not on a current project.
 * Red: on at least one current project, none of which end within 7 days.
 * Yellow: on a current project whose end date is within the next 7 days (inclusive of today through +7).
 */
export function getCrewAvailability(crewId: string, projects: ProjectApi[]): CrewAvailability {
  const today = stripToLocalDate(new Date());
  const ongoing = projects.filter((p) => isParticipant(p, crewId) && isOngoingProject(p, today));
  if (ongoing.length === 0) return 'available';

  let minDaysUntilEnd: number | null = null;
  for (const p of ongoing) {
    const end = p.duration?.endDate ? parseYmd(p.duration.endDate) : null;
    if (!end) continue;
    const d = daysFromTodayTo(end, today);
    if (d < 0) continue;
    if (minDaysUntilEnd === null || d < minDaysUntilEnd) minDaysUntilEnd = d;
  }

  if (minDaysUntilEnd !== null && minDaysUntilEnd >= 0 && minDaysUntilEnd <= 7) {
    return 'endingSoon';
  }
  return 'onProject';
}

/**
 * Availability for crew listed on a project details page. Enrolled members on an
 * ongoing project are on board (or sign-off due); only show available once the
 * project is no longer current.
 */
export function getProjectEnrollmentAvailability(project: ProjectApi): CrewAvailability {
  const today = stripToLocalDate(new Date());
  if (!isOngoingProject(project, today)) return 'available';

  const end = project.duration?.endDate ? parseYmd(project.duration.endDate) : null;
  if (end) {
    const d = daysFromTodayTo(end, today);
    if (d >= 0 && d <= 7) return 'endingSoon';
  }
  return 'onProject';
}

/**
 * Maps API `signal` to UI availability. Backend may send YELLOW, RED, GREEN;
 * some payloads use ORANGE for the same meaning as YELLOW.
 */
export function availabilityFromCrewSignal(signal: string | undefined | null): CrewAvailability {
  if (signal == null || typeof signal !== 'string') return 'available';
  const s = signal.trim().toUpperCase();
  if (s === 'GREEN') return 'available';
  if (s === 'RED') return 'onProject';
  if (s === 'YELLOW' || s === 'ORANGE') return 'endingSoon';
  return 'available';
}

export function getCrewAvailabilityLabel(kind: CrewAvailability): string {
  if (kind === 'available') return 'Available (not on a current project)';
  if (kind === 'endingSoon') return 'On a project; ends within 7 days';
  return 'On a project';
}

export function crewAvailabilityDotClass(kind: CrewAvailability): string {
  if (kind === 'available') return 'user-mgmt-availability-dot user-mgmt-availability-dot--available';
  if (kind === 'onProject') return 'user-mgmt-availability-dot user-mgmt-availability-dot--on-project';
  return 'user-mgmt-availability-dot user-mgmt-availability-dot--ending-soon';
}
