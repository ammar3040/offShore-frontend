import type { ProjectApi } from '../api/project';

export type CrewAvailability = 'available' | 'onProject' | 'endingSoon' | 'unavailable';

/** MD Section 3.2 — 7-tier personnel status (matches backend CrewStatus enum). */
export type CrewStatusTier =
  | 'Available'
  | 'Offered'
  | 'Confirmed'
  | 'On assignment for us'
  | 'Offshore (Competitor)'
  | 'Holiday / Not Available'
  | 'Unknown / Inactive';

export const CREW_STATUS_TIER_OPTIONS: CrewStatusTier[] = [
  'Available',
  'Offered',
  'Confirmed',
  // TODO: confirm with client — see MD Section 9 #2 (display label "On Assignment" vs enum "On assignment for us")
  'On assignment for us',
  // TODO: confirm with client — see MD Section 9 #3 (Red=Competitor vs doc1 colour mix-up)
  'Offshore (Competitor)',
  'Holiday / Not Available',
  'Unknown / Inactive',
];

export const PREFERRED_RATING_OPTIONS = ['AAA', 'AA', 'A', 'None'] as const;
export const BOP_OEM_OPTIONS = ['Cameron', 'NOV', 'GE', 'Other'] as const;

const CREW_STATUS_BADGE_CLASS: Record<CrewStatusTier, string> = {
  Available: 'crew-status-tier--available',
  Offered: 'crew-status-tier--offered',
  Confirmed: 'crew-status-tier--confirmed',
  'On assignment for us': 'crew-status-tier--on-assignment',
  'Offshore (Competitor)': 'crew-status-tier--offshore-competitor',
  'Holiday / Not Available': 'crew-status-tier--holiday',
  'Unknown / Inactive': 'crew-status-tier--inactive',
};

/** MD Section 3.2 — short display label for roster badges. */
export function crewStatusTierLabel(status: string | undefined | null): string {
  if (!status) return 'Available';
  if (status === 'On assignment for us') return 'On Assignment';
  if (status === 'Holiday / Not Available') return 'Holiday';
  if (status === 'Unknown / Inactive') return 'Inactive';
  if (status === 'Offshore (Competitor)') return 'Offshore (Competitor)';
  return status;
}

/** MD Section 3.2 — CSS class for 7-tier status badge. */
export function crewStatusTierBadgeClass(status: string | undefined | null): string {
  const key = (status ?? 'Available') as CrewStatusTier;
  return CREW_STATUS_BADGE_CLASS[key] ?? CREW_STATUS_BADGE_CLASS.Available;
}

/** MD Section 3.2 — dot class for 7-tier status indicator. */
export function crewStatusTierDotClass(status: string | undefined | null): string {
  return `crew-status-dot ${crewStatusTierBadgeClass(status)}`;
}

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

export function getCrewSignal(member: { signal?: string; activeProjects?: any[] }): string {
  if (member.signal) return member.signal;
  const activeProjects = member.activeProjects ?? [];
  if (activeProjects.length === 0) return 'GREEN';
  const now = Date.now();
  let minEndMs = Infinity;
  for (const p of activeProjects) {
    if (!p.duration?.endDate) continue;
    const end = new Date(p.duration.endDate).getTime();
    if (end < minEndMs) minEndMs = end;
  }
  if (minEndMs === Infinity) return 'GREEN';
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysLeft = (minEndMs - now) / MS_PER_DAY;
  if (daysLeft <= 7) return 'ORANGE';
  return 'RED';
}

/**
 * Maps API `signal` to UI availability. Backend may send YELLOW, RED, GREEN;
 * some payloads use ORANGE for the same meaning as YELLOW.
 */
export function availabilityFromCrewSignal(signal: string | undefined | null): CrewAvailability {
  if (signal == null || typeof signal !== 'string') return 'available';
  const s = signal.trim().toUpperCase();
  if (s === 'UNAVAILABLE') return 'unavailable';
  if (s === 'GREEN') return 'available';
  if (s === 'RED') return 'onProject';
  if (s === 'YELLOW' || s === 'ORANGE') return 'endingSoon';
  return 'available';
}

export function getCrewAvailabilityLabel(kind: CrewAvailability): string {
  if (kind === 'unavailable') return 'Unavailable (manually set)';
  if (kind === 'available') return 'Available (not on a current project)';
  if (kind === 'endingSoon') return 'On a project; ends within 7 days';
  return 'On a project';
}

export function crewAvailabilityDotClass(kind: CrewAvailability): string {
  if (kind === 'unavailable') return 'user-mgmt-availability-dot user-mgmt-availability-dot--unavailable';
  if (kind === 'available') return 'user-mgmt-availability-dot user-mgmt-availability-dot--available';
  if (kind === 'onProject') return 'user-mgmt-availability-dot user-mgmt-availability-dot--on-project';
  return 'user-mgmt-availability-dot user-mgmt-availability-dot--ending-soon';
}
