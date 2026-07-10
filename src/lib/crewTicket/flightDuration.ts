export function parseFlightDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDurationFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Resolve segment/leg duration, computing from times when API value is missing or "Unknown". */
export function resolveFlightDuration(
  segment?: { duration?: string; departureTime?: string; arrivalTime?: string },
  leg?: { duration?: string; departureTime?: string; arrivalTime?: string }
): string {
  const raw = (segment?.duration ?? leg?.duration)?.trim();
  if (raw && raw !== '—' && raw.toLowerCase() !== 'unknown') {
    return raw;
  }

  const dep = parseFlightDate(segment?.departureTime ?? leg?.departureTime);
  const arr = parseFlightDate(segment?.arrivalTime ?? leg?.arrivalTime);
  if (dep && arr) {
    const diffMs = arr.getTime() - dep.getTime();
    if (diffMs > 0) {
      return formatDurationFromMinutes(Math.round(diffMs / 60000));
    }
  }

  return '—';
}

export function formatFlightTime(value?: string): string {
  const d = parseFlightDate(value);
  if (!d) return value?.trim() || '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatFlightDate(value?: string): string {
  const d = parseFlightDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFlightDateTime(value?: string): string {
  const d = parseFlightDate(value);
  if (!d) return '—';
  return `${formatFlightDate(value)} · ${formatFlightTime(value)}`;
}
