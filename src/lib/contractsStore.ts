const DRAFTS_KEY = 'offshore-contract-drafts';

export interface ContractDraft {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  body: string;
  crewIds: string[];
  status: 'draft' | 'sent';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
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

export const DEFAULT_CONTRACT_DRAFT_TEMPLATE = `PROJECT ASSIGNMENT AGREEMENT

This Project Assignment Agreement ("Agreement") is entered between Offshore CRM Operations and the assigned crew member.

1. Assignment Scope
The crew member agrees to perform duties on the assigned project in accordance with site procedures, supervisor direction, and applicable maritime regulations.

2. Term
Assignment period is as defined in the project schedule. The contract end date reflects scheduled project completion unless extended in writing by operations.

3. Safety & Compliance
The crew member shall follow all HSE policies, permit-to-work requirements, PPE standards, and incident reporting obligations while on assignment.

4. Reporting & Availability
Daily activity reporting, timesheet submission, and availability updates must be maintained through the crew portal for the duration of the assignment.

5. Compensation
Compensation is governed by the payroll rate configured for this project assignment and applicable company pay policies.

6. Confidentiality
Operational data, client information, and safety reports must be handled as confidential and not disclosed outside authorized channels.

7. Acceptance
By checking "I agree to the terms and conditions" and selecting Accept and sign, the crew member confirms they have read this Agreement and accept assignment to the project.`;

/** Fallback contract text when no admin-drafted body is attached on the invite. */
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

function readDrafts(): ContractDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(items: ContractDraft[]): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(items));
}

export function getContractDrafts(): ContractDraft[] {
  return readDrafts().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getContractDraftById(id: string): ContractDraft | null {
  return readDrafts().find((d) => d.id === id) ?? null;
}

export function saveContractDraft(
  input: Pick<ContractDraft, 'title' | 'projectId' | 'projectTitle' | 'body' | 'crewIds' | 'status'> & {
    id?: string;
  }
): ContractDraft {
  const now = new Date().toISOString();
  const items = readDrafts();
  const existing = input.id ? items.find((d) => d.id === input.id) : undefined;

  const record: ContractDraft = {
    id: existing?.id ?? crypto.randomUUID(),
    title: input.title.trim() || input.projectTitle || 'Untitled contract',
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    body: input.body,
    crewIds: input.crewIds,
    status: input.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sentAt: input.status === 'sent' ? existing?.sentAt ?? now : existing?.sentAt,
  };

  const next = items.filter((d) => d.id !== record.id);
  next.push(record);
  writeDrafts(next);
  return record;
}

export function markContractDraftSent(id: string): ContractDraft | null {
  const items = readDrafts();
  const idx = items.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const updated: ContractDraft = {
    ...items[idx],
    status: 'sent',
    updatedAt: now,
    sentAt: now,
  };
  items[idx] = updated;
  writeDrafts(items);
  return updated;
}

export function deleteContractDraft(id: string): void {
  writeDrafts(readDrafts().filter((d) => d.id !== id));
}
