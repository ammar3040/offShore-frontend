import { env } from '../config/env';
import type { Airport } from '../types/flight';

const API_BASE = env.apiBaseUrl || '';

/**
 * Raw response item from airport search API (backend or Riya getcity).
 * Supports both { Name, COUNTRY, COUNTRYNAME } and { name, country, countryName }.
 */
interface AirportSearchResult {
  Name?: string;
  name?: string;
  COUNTRY?: string;
  country?: string;
  COUNTRYNAME?: string;
  countryName?: string;
}

function toAirport(item: AirportSearchResult): Airport {
  const name = item.Name ?? item.name ?? '';
  const country = item.COUNTRY ?? item.country ?? '';
  const countryName = item.COUNTRYNAME ?? item.countryName ?? '';
  return { Name: name, COUNTRY: country, COUNTRYNAME: countryName };
}

/**
 * Search airports via backend API (e.g. /api/airports/search proxying to Riya getcity).
 * Returns [] if the endpoint is not implemented or on error.
 * When the backend exposes this endpoint, it enables dynamic results (e.g. Edinburgh).
 */
export async function searchAirportsApi(query: string): Promise<Airport[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const token = localStorage.getItem(env.authTokenKey);
    const headers: HeadersInit = {};
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(
      `${API_BASE}/api/airports/search?query=${encodeURIComponent(q)}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data ?? data?.airports ?? []);
    if (!Array.isArray(list)) return [];
    return list.map((item: AirportSearchResult) => toAirport(item)).filter((a: Airport) => a.Name);
  } catch {
    return [];
  }
}
