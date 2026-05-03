import type { Airport } from '../types/flight';
import { env } from '../config/env';

/** Country code (ISO 3166-1 alpha-2) to country name mapping */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates",
  FR: "France", DE: "Germany", NL: "Netherlands", SG: "Singapore", AU: "Australia",
  CA: "Canada", CN: "China", JP: "Japan", KR: "South Korea", PK: "Pakistan",
  BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", MY: "Malaysia", TH: "Thailand",
  ID: "Indonesia", NO: "Norway", ES: "Spain", IT: "Italy", SA: "Saudi Arabia",
};

/** Riya Marine getcity API response item (marinecorp.riya.travel/Home/getcity) */
interface RiyaCityHit {
  Id?: number;
  Name?: string;
  Code?: string;
  NameLat?: string;
  CountryId?: number;
  CountryCode?: string;
  CountryName?: string;
  RegionName?: string;
  [key: string]: unknown;
}

/** Backend may return Airport[] directly or Riya-style Items */
type AirportsApiResponse =
  | Airport[]
  | { airports?: Airport[]; data?: Airport[]; Items?: RiyaCityHit[]; items?: RiyaCityHit[] };

function normalizeToAirports(data: AirportsApiResponse): Airport[] {
  if (Array.isArray(data)) {
    return data.filter((a): a is Airport => a && typeof a.Name === 'string');
  }
  if (Array.isArray(data.airports)) return data.airports;
  if (Array.isArray(data.data)) return data.data;
  const hits = data.Items ?? data.items ?? [];
  return hits
    .map((hit): Airport => {
      const name = hit.Name ?? hit.NameLat ?? '';
      const code = hit.Code ?? '';
      const countryCode = hit.CountryCode ?? '';
      const countryName = COUNTRY_NAMES[countryCode] ?? hit.CountryName ?? countryCode;
      const codePart = code ? ` [${code}]` : '';
      const countryPart = countryName ? `, ${countryName}` : '';
      const displayName = name + codePart + countryPart;
      return { Name: displayName, COUNTRY: countryCode, COUNTRYNAME: countryName };
    })
    .filter((a) => a.Name);
}

/**
 * Search airports via internal backend API, which proxies to Riya Marine (marinecorp.riya.travel/Home/getcity).
 * Backend handles Riya login and session cookies.
 * Returns [] on error or when no results are found.
 */
export async function searchAirportsApi(query: string): Promise<Airport[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  try {
    const token = localStorage.getItem(env.authTokenKey);
    const headers: HeadersInit = {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.apiTimeout);

    const res = await fetch(
      `${env.apiBaseUrl}/airports/search?query=${encodeURIComponent(q)}`,
      {
        method: 'GET',
        headers,
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = (await res.json()) as AirportsApiResponse;
    return normalizeToAirports(data);
  } catch {
    return [];
  }
}