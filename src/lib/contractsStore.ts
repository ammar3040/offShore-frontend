const PENDING_KEY = 'offshore-contract-pending';
const SIGNED_KEY = 'offshore-contracts-signed';

export interface PendingContractInvite {
  crewId: string;
  projectId: string;
  projectTitle: string;
  contractMessage: string;
  invitedAt: string;
}

export interface SignedProjectContract {
  id: string;
  crewId: string;
  crewName: string;
  projectId: string;
  projectTitle: string;
  contractEndDate: string;
  signedAt: string;
}

export function buildContractInviteMessage(projectTitle: string): string {
  return `You have been invited to join "${projectTitle}". Open the project contract to read the full terms, agree below, then accept and sign to enroll.`;
}

export interface ContractDocumentInput {
  projectTitle: string;
  projectDescription?: string;
  startDate?: string;
  endDate?: string;
  summaryMessage?: string;
}

function formatContractDate(iso?: string): string {
  if (!iso) return 'To be confirmed';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Full contract text shown in the crew contract review overlay. */
export function buildFullContractDocument(input: ContractDocumentInput): string {
  const period =
    input.startDate || input.endDate
      ? `${formatContractDate(input.startDate)} through ${formatContractDate(input.endDate)}`
      : 'As defined in the project assignment schedule';

  const intro =
    input.summaryMessage ??
    `This Project Assignment Agreement ("Agreement") is entered between Offshore CRM Operations and the assigned crew member for participation on ${input.projectTitle}.`;

  return [
    intro,
    '',
    '1. Assignment Scope',
    `The crew member agrees to perform duties on ${input.projectTitle} in accordance with site procedures, supervisor direction, and applicable maritime regulations.`,
    input.projectDescription ? `Project notes: ${input.projectDescription}` : '',
    '',
    '2. Term',
    `Assignment period: ${period}. The contract end date reflects the scheduled project completion unless extended in writing by operations.`,
    '',
    '3. Safety & Compliance',
    'The crew member shall follow all HSE policies, permit-to-work requirements, PPE standards, and incident reporting obligations while on assignment.',
    '',
    '4. Reporting & Availability',
    'Daily activity reporting, timesheet submission, and availability updates must be maintained through the crew portal for the duration of the assignment.',
    '',
    '5. Compensation',
    'Compensation is governed by the payroll rate configured for this project assignment and applicable company pay policies.',
    '',
    '6. Confidentiality',
    'Operational data, client information, and safety reports must be handled as confidential and not disclosed outside authorized channels.',
    '',
    '7. Acceptance',
    'By checking "I agree to the terms and conditions" and selecting Accept and sign, the crew member confirms they have read this Agreement and accept assignment to the project.',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
}

function contractKey(crewId: string, projectId: string): string {
  return `${crewId}:${projectId}`;
}

function readPending(): PendingContractInvite[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(items: PendingContractInvite[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

function readSigned(): SignedProjectContract[] {
  try {
    const raw = localStorage.getItem(SIGNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSigned(items: SignedProjectContract[]): void {
  localStorage.setItem(SIGNED_KEY, JSON.stringify(items));
}

export function recordContractInvite(params: {
  crewId: string;
  projectId: string;
  projectTitle: string;
}): void {
  const key = contractKey(params.crewId, params.projectId);
  const next: PendingContractInvite = {
    crewId: params.crewId,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    contractMessage: buildContractInviteMessage(params.projectTitle),
    invitedAt: new Date().toISOString(),
  };
  const items = readPending().filter((p) => contractKey(p.crewId, p.projectId) !== key);
  items.push(next);
  writePending(items);
}

export function recordContractInvites(
  crewIds: string[],
  projectId: string,
  projectTitle: string
): void {
  for (const crewId of crewIds) {
    recordContractInvite({ crewId, projectId, projectTitle });
  }
}

export function getContractInviteMessage(crewId: string, projectId: string): string | null {
  const item = readPending().find(
    (p) => contractKey(p.crewId, p.projectId) === contractKey(crewId, projectId)
  );
  return item?.contractMessage ?? null;
}

export function removePendingContractInvite(crewId: string, projectId: string): void {
  const key = contractKey(crewId, projectId);
  writePending(readPending().filter((p) => contractKey(p.crewId, p.projectId) !== key));
}

export function resolveContractEndDate(projectEndDate?: string): string {
  if (projectEndDate) {
    try {
      const d = new Date(projectEndDate);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    } catch {
      /* fall through */
    }
  }
  const end = new Date();
  end.setMonth(end.getMonth() + 6);
  return end.toISOString();
}

export function signProjectContract(params: {
  crewId: string;
  crewName: string;
  projectId: string;
  projectTitle: string;
  contractEndDate: string;
}): SignedProjectContract {
  const key = contractKey(params.crewId, params.projectId);
  const signedAt = new Date().toISOString();
  const record: SignedProjectContract = {
    id: crypto.randomUUID(),
    crewId: params.crewId,
    crewName: params.crewName,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    contractEndDate: params.contractEndDate,
    signedAt,
  };
  const items = readSigned().filter((s) => contractKey(s.crewId, s.projectId) !== key);
  items.push(record);
  writeSigned(items);
  removePendingContractInvite(params.crewId, params.projectId);
  return record;
}

export function getSignedContracts(): SignedProjectContract[] {
  return readSigned().sort(
    (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
  );
}
