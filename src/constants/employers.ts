/** Mirrors backend employer enum (MD Section 6). */
export const EMPLOYER_OPTIONS = [
  'Subseaquence',
  'GES',
  'SBS',
  'RTC',
  'Ogenus',
  'Synnrgi',
  'SUB-C',
  // TODO: confirm with client — see MD Section 9 #1
  'Direct with Operator',
  'Self-Employed',
  'Other',
] as const;

export type EmployerOption = (typeof EMPLOYER_OPTIONS)[number];

export const KNOWN_EMPLOYERS = new Set<string>(EMPLOYER_OPTIONS);

export function isKnownEmployer(value: string): boolean {
  return KNOWN_EMPLOYERS.has(value);
}
