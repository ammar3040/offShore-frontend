import type { VevoFetchInput } from '../api/visa';

/** Default country of document — same as VEVO Burp capture. */
export const VEVO_DEFAULT_COUNTRY = 'GBR';
export const VEVO_DEFAULT_COUNTRY_LABEL = 'UNITED KINGDOM - BRITISH CITIZEN';

/**
 * Default VEVO form applicant (client sample credential from Burp / VEVO enquiry).
 * @see https://online.immi.gov.au/evo/firstParty
 */
export const VEVO_DEFAULT_APPLICANT: Required<VevoFetchInput> = {
  fullName: 'John Ross Dingwall',
  dateOfBirth: '1984-03-14',
  grantNumber: '0289500084806',
  passportNumber: '142828174',
  country: VEVO_DEFAULT_COUNTRY,
};

/**
 * Multi-user batch sample — paste more records in this format for bulk validity checks.
 * Country defaults to GBR when omitted by the parser.
 */
export const VEVO_DEFAULT_RAW_TEXT = `Record 1:
- Name: John Ross Dingwall
- Date of Birth: 14 March 1984
- Grant Number: 0289500084806
- Passport Number: 142828174
- Country: GBR

Record 2:
- Name: Scott Archibald
- Date of Birth: 12 January 1981
- Grant Number: 0289584963243
- Passport Number: 151662015
- Country: GBR

Record 3:
- Name: Clive Mercer
- Date of Birth: 3 November 1978
- Grant Number: 0289584959964
- Passport Number: 151730613
- Country: GBR

Record 4:
- Name: Darryl Keen
- Date of Birth: 26 November 1976
- Grant Number: 0289584959969
- Passport Number: 124777283
- Country: GBR
`;
