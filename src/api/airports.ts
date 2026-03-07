import type { Airport } from '../types/flight';

/** Country code (ISO 3166-1 alpha-2) to country name mapping */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates",
  FR: "France", DE: "Germany", NL: "Netherlands", SG: "Singapore", AU: "Australia",
  CA: "Canada", CN: "China", JP: "Japan", KR: "South Korea", PK: "Pakistan",
  BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", MY: "Malaysia", TH: "Thailand",
  ID: "Indonesia", NO: "Norway", ES: "Spain", IT: "Italy", SA: "Saudi Arabia",
};

interface ExternalAirportHit {
  name: string;
  city: string;
  iata: string;
  icao: string;
  country_code: string;
}

/**
 * Search airports directly from the frontend via airportroutes.com.
 * Returns [] on error or when no results are found.
 */
export async function searchAirportsApi(query: string): Promise<Airport[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  try {
    const res = await fetch(
      `https://www.airportroutes.com/api/search-airports/?q=${encodeURIComponent(q)}&limit=20`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return [];
    //deplyment fix

    const data = await res.json() as { hits?: ExternalAirportHit[] };
    const hits = data.hits ?? [];

    return hits
      .map((hit): Airport => {
        const code = hit.iata || hit.icao || '';
        const countryCode = hit.country_code || '';
        const countryName = COUNTRY_NAMES[countryCode] || countryCode;
        const name = `${hit.city} [${code}] - ${hit.name}, ${countryName}`;
        return { Name: name, COUNTRY: countryCode, COUNTRYNAME: countryName };
      })
      .filter((a) => a.Name);
  } catch {
    return [];
  }
}
// latest changes