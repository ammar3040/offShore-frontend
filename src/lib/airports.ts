import type { Airport } from '../types/flight';

/**
 * Static airport list for search form (typeahead/combobox).
 * Format: Name includes city and IATA code in brackets for display and search.
 */
export const AIRPORTS: Airport[] = [
  // { Name: 'Mumbai [BOM] - Chhatrapati Shivaji Maharaj International Airport', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Delhi [DEL] - Indira Gandhi International Airport', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Bangalore [BLR] - Kempegowda International Airport', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Chennai [MAA] - Chennai International Airport', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Hyderabad [HYD] - Rajiv Gandhi International Airport', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Kolkata [CCU] - Netaji Subhas Chandra Bose International', COUNTRY: 'IN', COUNTRYNAME: 'India' },
  // { Name: 'Dubai [DXB] - Dubai International Airport', COUNTRY: 'AE', COUNTRYNAME: 'United Arab Emirates' },
  // { Name: 'Abu Dhabi [AUH] - Abu Dhabi International Airport', COUNTRY: 'AE', COUNTRYNAME: 'United Arab Emirates' },
  // { Name: 'Doha [DOH] - Hamad International Airport', COUNTRY: 'QA', COUNTRYNAME: 'Qatar' },
  // { Name: 'London [LHR] - London Heathrow Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'London [LGW] - London Gatwick Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'Singapore [SIN] - Singapore Changi Airport', COUNTRY: 'SG', COUNTRYNAME: 'Singapore' },
  // { Name: 'Hong Kong [HKG] - Hong Kong International Airport', COUNTRY: 'HK', COUNTRYNAME: 'Hong Kong' },
  // { Name: 'Bangkok [BKK] - Suvarnabhumi Airport', COUNTRY: 'TH', COUNTRYNAME: 'Thailand' },
  // { Name: 'Kuala Lumpur [KUL] - Kuala Lumpur International Airport', COUNTRY: 'MY', COUNTRYNAME: 'Malaysia' },
  // { Name: 'New York [JFK] - John F. Kennedy International Airport', COUNTRY: 'US', COUNTRYNAME: 'United States' },
  // { Name: 'Los Angeles [LAX] - Los Angeles International Airport', COUNTRY: 'US', COUNTRYNAME: 'United States' },
  // { Name: 'Amsterdam [AMS] - Amsterdam Schiphol Airport', COUNTRY: 'NL', COUNTRYNAME: 'Netherlands' },
  // { Name: 'Frankfurt [FRA] - Frankfurt Airport', COUNTRY: 'DE', COUNTRYNAME: 'Germany' },
  // { Name: 'Paris [CDG] - Charles de Gaulle Airport', COUNTRY: 'FR', COUNTRYNAME: 'France' },
  // { Name: 'Edinburgh [EDI] - Edinburgh Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'Manchester [MAN] - Manchester Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'Glasgow [GLA] - Glasgow International Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'Birmingham [BHX] - Birmingham Airport', COUNTRY: 'GB', COUNTRYNAME: 'United Kingdom' },
  // { Name: 'Dublin [DUB] - Dublin Airport', COUNTRY: 'IE', COUNTRYNAME: 'Ireland' },
  // { Name: 'Zurich [ZRH] - Zurich Airport', COUNTRY: 'CH', COUNTRYNAME: 'Switzerland' },
  // { Name: 'Munich [MUC] - Munich Airport', COUNTRY: 'DE', COUNTRYNAME: 'Germany' },
  // { Name: 'Toronto [YYZ] - Toronto Pearson International Airport', COUNTRY: 'CA', COUNTRYNAME: 'Canada' },
  // { Name: 'Sydney [SYD] - Sydney Kingsford Smith Airport', COUNTRY: 'AU', COUNTRYNAME: 'Australia' },
  // { Name: 'Melbourne [MEL] - Melbourne Airport', COUNTRY: 'AU', COUNTRYNAME: 'Australia' },
  // { Name: 'Tokyo [NRT] - Narita International Airport', COUNTRY: 'JP', COUNTRYNAME: 'Japan' },
  // { Name: 'Tokyo [HND] - Tokyo Haneda Airport', COUNTRY: 'JP', COUNTRYNAME: 'Japan' },
];

/**
 * Extract IATA code from Name if it matches "[XXX]" pattern.
 */
function getCodeFromName(name: string): string | null {
  const match = name.match(/\s*\[([A-Z0-9]{3})\]\s*/);
  return match ? match[1] : null;
}

/**
 * Find airport by IATA code (e.g. "BOM", "DEL").
 */
export function getAirportByCode(code: string): Airport | undefined {
  const upper = code.toUpperCase();
  return AIRPORTS.find((a) => getCodeFromName(a.Name) === upper);
}

/**
 * Display string for an airport (city/code or full name).
 */
export function getAirportDisplayName(airport: Airport): string {
  const code = getCodeFromName(airport.Name);
  if (code) return `${airport.Name.split(' - ')[0]?.trim() ?? airport.Name}`;
  return airport.Name;
}

/**
 * Filter airports by query (name or country or code).
 */
export function searchAirports(query: string): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS;
  return AIRPORTS.filter(
    (a) =>
      a.Name.toLowerCase().includes(q) ||
      a.COUNTRY.toLowerCase().includes(q) ||
      a.COUNTRYNAME.toLowerCase().includes(q) ||
      getCodeFromName(a.Name)?.toLowerCase().includes(q)
  );
}
