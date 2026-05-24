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
  AirportName?: string;
  CityName?: string;
  City?: string;
  AirportCode?: string;
  IataCode?: string;
  IATA?: string;
  Distance?: number | string;
  DistanceKM?: number | string;
  DistanceKm?: number | string;
  distance?: number | string;
  distanceKm?: number | string;
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readNestedAirportList(hit: RiyaCityHit): RiyaCityHit[] {
  const keys = [
    'nearbyAirports',
    'NearbyAirports',
    'nearestAirports',
    'NearestAirports',
    'airports',
    'Airports',
    'airportList',
    'AirportList',
  ];
  for (const key of keys) {
    const value = hit[key];
    if (Array.isArray(value)) return value as RiyaCityHit[];
  }
  return [];
}

function normalizeHit(hit: RiyaCityHit): Airport | null {
  const cityName = asString(hit.Name) || asString(hit.CityName) || asString(hit.City) || asString(hit.NameLat);
  const airportName = asString(hit.AirportName);
  const code = asString(hit.Code) || asString(hit.AirportCode) || asString(hit.IataCode) || asString(hit.IATA);
  const countryCode = asString(hit.CountryCode);
  const countryName = COUNTRY_NAMES[countryCode] ?? asString(hit.CountryName) ?? countryCode;
  const distanceKm = asNumber(
    hit.distanceKm ?? hit.DistanceKm ?? hit.DistanceKM ?? hit.distance ?? hit.Distance
  );

  const placeName = cityName || airportName;
  const codePart = code && !placeName.includes(`[${code}]`) ? ` [${code}]` : '';
  const countryPart = countryName && !placeName.includes(countryName) ? `, ${countryName}` : '';
  const detailPart = airportName && airportName !== placeName ? ` - ${airportName}` : '';
  const displayName = placeName ? `${placeName}${codePart}${detailPart}${countryPart}` : '';
  if (!displayName) return null;

  const nearbyAirports = readNestedAirportList(hit)
    .map(normalizeHit)
    .filter((airport): airport is Airport => Boolean(airport));

  return {
    Name: displayName,
    COUNTRY: countryCode,
    COUNTRYNAME: countryName,
    ...(code ? { Code: code } : {}),
    ...(cityName ? { CityName: cityName } : {}),
    ...(airportName ? { AirportName: airportName } : {}),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
    ...(nearbyAirports.length > 0 ? { nearbyAirports } : {}),
  };
}

function normalizeToAirports(data: AirportsApiResponse): Airport[] {
  if (Array.isArray(data)) {
    return data.filter((a): a is Airport => a && typeof a.Name === 'string');
  }
  if (Array.isArray(data.airports)) return data.airports;
  if (Array.isArray(data.data)) return data.data;
  const hits = data.Items ?? data.items ?? [];
  return hits
    .map(normalizeHit)
    .filter((a): a is Airport => Boolean(a));
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