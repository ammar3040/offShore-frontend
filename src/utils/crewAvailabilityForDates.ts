import type { CrewAvailabilityAdminItem } from '../api/crew';
import { crewStatusTierLabel, resolveAvailabilityItemStatus } from './crewAvailability';

export interface CrewTravelConflict {
  crewId: string;
  crewName: string;
  status: string;
  statusLabel: string;
  periodFrom: string;
  periodTo: string;
  reason: string;
}

function parseYmd(value: string | undefined): Date | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(+match[1], +match[2] - 1, +match[3]);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getTravelDateRange(
  departureDate: string,
  returnDate?: string
): { start: Date; end: Date } | null {
  const start = parseYmd(departureDate);
  if (!start) return null;
  const end = returnDate?.trim() ? parseYmd(returnDate) : start;
  if (!end) return { start, end: endOfDay(start) };
  return start <= end
    ? { start, end: endOfDay(end) }
    : { start: end, end: endOfDay(start) };
}

function dateRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function formatPeriodDate(value: string): string {
  const d = parseYmd(value);
  if (!d) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildConflictReason(item: CrewAvailabilityAdminItem, status: string): string {
  const parts: string[] = [];
  if (item.rig_vessel?.trim()) parts.push(`Rig/vessel: ${item.rig_vessel.trim()}`);
  if (item.employer?.trim()) parts.push(`Employer: ${item.employer.trim()}`);
  if (item.client?.trim()) parts.push(`Client: ${item.client.trim()}`);
  if (item.country?.trim()) parts.push(`Country: ${item.country.trim()}`);
  if (item.notes?.trim()) parts.push(item.notes.trim());
  if (parts.length > 0) return parts.join(' · ');
  return `Marked as ${crewStatusTierLabel(status)} for this period`;
}

/** Find crew members with non-available status overlapping the travel window. */
export function findCrewTravelConflicts(
  crewIds: string[],
  getCrewName: (crewId: string) => string,
  travelStart: Date,
  travelEnd: Date,
  availabilities: CrewAvailabilityAdminItem[]
): CrewTravelConflict[] {
  const conflicts: CrewTravelConflict[] = [];
  const warnedCrew = new Set<string>();

  for (const crewId of crewIds) {
    if (warnedCrew.has(crewId)) continue;

    const items = availabilities.filter((item) => String(item.crew_id ?? '') === crewId);
    for (const item of items) {
      const itemStart = parseYmd(item.from);
      const itemEnd = parseYmd(item.to);
      if (!itemStart || !itemEnd) continue;

      if (!dateRangesOverlap(itemStart, endOfDay(itemEnd), travelStart, travelEnd)) continue;

      const status = resolveAvailabilityItemStatus(item);
      if (status === 'Available') continue;

      conflicts.push({
        crewId,
        crewName: getCrewName(crewId),
        status,
        statusLabel: crewStatusTierLabel(status),
        periodFrom: formatPeriodDate(item.from),
        periodTo: formatPeriodDate(item.to),
        reason: buildConflictReason(item, status),
      });
      warnedCrew.add(crewId);
      break;
    }
  }

  return conflicts;
}
