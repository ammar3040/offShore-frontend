import type { VevoFetchInput } from '../api/visa';

/** Default demo applicant for VEVO forms (matches backend mock grant records). */
export const VEVO_DEFAULT_APPLICANT: Required<VevoFetchInput> = {
  fullName: 'Scott Archibald',
  dateOfBirth: '1981-01-12',
  grantNumber: '0289584963243',
  passportNumber: '151662015',
  country: 'AUS',
};

/** Sample raw text for batch/parse tab demos. */
export const VEVO_DEFAULT_RAW_TEXT = `Record 1:
- Name: Scott Archibald
- Date of Birth: 12 January 1981
- Grant Number: 0289584963243
- Passport Number: 151662015
- Country: AUS

Record 2:
- Name: Clive Mercer
- Date of Birth: 3 November 1978
- Grant Number: 0289584959964
- Passport Number: 151730613
- Country: AUS

Record 3:
- Date of Birth: 27 October 1974
- Grant Number: 0289584946860
- Passport Number: 133951532
- Country: AUS
`;
