import { useState, useEffect } from 'react';

/** Returns a live UTC time string like "17:03 UTC", updated every second. */
export function useUtcClock(): string {
  const [utc, setUtc] = useState(() => formatUtcNow());

  useEffect(() => {
    const id = setInterval(() => setUtc(formatUtcNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return utc;
}

function formatUtcNow(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}
