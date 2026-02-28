/**
 * Currency conversion utilities.
 * Rates are GBP-based: rates.GBP === 1, rates.USD = units of USD per 1 GBP, etc.
 * Uses fawazahmed0 currency API.
 */

export type CurrencyCode = 'GBP' | 'USD' | 'INR';

export async function fetchRates(): Promise<Record<CurrencyCode, number>> {
  const response = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/gbp.json',
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch currency rates (${response.status})`);
  }

  const data = await response.json();
  const gbp = data?.gbp;

  if (!gbp?.usd || !gbp?.inr) {
    throw new Error('Invalid currency rates response');
  }

  return {
    GBP: 1,
    USD: gbp.usd,
    INR: gbp.inr,
  };
}

/**
 * Convert amount from one currency to another using GBP-based rates.
 * rates[X] = units of currency X per 1 GBP.
 */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>
): number {
  if (from === to) return amount;

  if (!rates[from] || !rates[to]) {
    throw new Error(`Missing rate for ${!rates[from] ? from : to}`);
  }

  // Convert from 'from' to GBP first
  const amountInGBP = amount / rates[from];
  // Then convert from GBP to 'to'
  return amountInGBP * rates[to];
}
