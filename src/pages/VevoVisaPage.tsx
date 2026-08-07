import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardCopy,
  ExternalLink,
  FileStack,
  Globe2,
  Hash,
  IdCard,
  ListChecks,
  PlayCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  UserRound,
} from 'lucide-react';
import { getCrewList, crewApiToFormData, updateCrewMember, type CrewMemberApi } from '../api/crew';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { AccessibleDateField } from '../components/AccessibleDateField';
import { VEVO_DEFAULT_APPLICANT, VEVO_DEFAULT_COUNTRY_LABEL } from '../constants/vevoDefaults';
import {
  getVevoProviderStatus,
  runLiveVevoBatch,
  runLiveVevoCheck,
  type LiveCheckInput,
  type VevoExpiry,
  type VevoMetadata,
  type VevoFetchInput,
  type VevoProviderStatus,
} from '../api/visa';
import {
  addManualVevoRecords,
  copyApplicantForVevo,
  deleteManualVevoRecord,
  listManualVevoRecords,
  normalizeVevoDate,
  parseBulkApplicants,
  upsertManualVevoRecord,
  type ManualVevoRecord,
  type ManualVevoResult,
  type ManualVevoStatus,
} from '../lib/vevoManualStore';
import { toast } from 'sonner';
import './RigsPage.css';
import './VevoVisaPage.css';

const VEVO_PORTAL_URL = 'https://online.immi.gov.au/evo/firstParty?actionType=query';

const emptyResult = (): ManualVevoResult => ({
  visaStatus: 'In Effect',
  visaClass: '',
  visaSubclass: '',
  visaStream: '',
  grantDate: '',
  expiryDate: '',
  workEntitlements: '',
  visaConditions: '',
  periodOfStay: '',
  notes: '',
  verifiedAt: new Date().toISOString().slice(0, 10),
});

function statusBadgeClass(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('effect') || s === 'active') return 'subsea-b-green';
  if (s.includes('expir')) return 'subsea-b-red';
  if (s.includes('not')) return 'subsea-b-amber';
  return 'subsea-b-gray';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

const COUNTRY_CODES: Record<string, string> = {
  'united kingdom': 'GBR',
  uk: 'GBR',
  britain: 'GBR',
  british: 'GBR',
  gb: 'GBR',
  australia: 'AUS',
  'united states': 'USA',
  usa: 'USA',
  'new zealand': 'NZL',
  canada: 'CAN',
  ireland: 'IRL',
  india: 'IND',
  philippines: 'PHL',
};

function countryToCode(value?: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_CODES[raw.toLowerCase()] ?? '';
}

function metadataToResult(metadata: VevoMetadata): ManualVevoResult {
  const status: ManualVevoStatus =
    metadata.visaStatus === 'Active'
      ? 'In Effect'
      : metadata.visaStatus === 'Expired'
        ? 'Expired'
        : metadata.visaStatus === 'Not Found'
          ? 'Not Found'
          : 'Other';

  return {
    visaStatus: status,
    visaClass: metadata.visaClass ?? '',
    visaSubclass: metadata.visaSubclass ?? '',
    visaStream: metadata.visaStream ?? '',
    grantDate: metadata.grantDate ?? '',
    expiryDate: metadata.expiryDate ?? '',
    workEntitlements: metadata.workEntitlements ?? '',
    visaConditions: metadata.visaConditions ?? '',
    periodOfStay: metadata.periodOfStay ?? '',
    notes: '',
    verifiedAt: (metadata.verifiedAt || new Date().toISOString()).slice(0, 10),
  };
}

function verdictLabel(expiry?: VevoExpiry): string {
  if (!expiry || expiry.verdict === 'unknown') return 'No expiry returned';
  if (expiry.verdict === 'expired') return `Expired ${Math.abs(expiry.daysRemaining ?? 0)} days ago`;
  if (expiry.verdict === 'expiring') return `Expires in ${expiry.daysRemaining} days`;
  return `Valid — ${expiry.daysRemaining} days left`;
}

interface CrewCandidate {
  crew: CrewMemberApi;
  applicant: VevoFetchInput;
  missing: string[];
}

function toCrewCandidate(crew: CrewMemberApi): CrewCandidate {
  const applicant: VevoFetchInput = {
    fullName: `${crew.firstname ?? ''} ${crew.lastname ?? ''}`.trim(),
    dateOfBirth: normalizeVevoDate(crew.dateOfBirth ?? ''),
    grantNumber: (crew.visa_details?.vevo_reference_number ?? '').trim(),
    passportNumber: (crew.passport?.passport_number ?? '').trim(),
    country:
      countryToCode(crew.visa_details?.visa_country) ||
      countryToCode(crew.visa_country) ||
      countryToCode(crew.nationality) ||
      'GBR',
  };

  const missing: string[] = [];
  if (!applicant.dateOfBirth) missing.push('DOB');
  if (!applicant.grantNumber) missing.push('grant no.');
  if (!applicant.passportNumber) missing.push('passport');

  return { crew, applicant, missing };
}

const VevoVisaPage = () => {
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState<VevoFetchInput>({ ...VEVO_DEFAULT_APPLICANT });
  const [result, setResult] = useState<ManualVevoResult>(emptyResult());
  const [records, setRecords] = useState<ManualVevoRecord[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [crewList, setCrewList] = useState<CrewMemberApi[]>([]);
  const [crewId, setCrewId] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [intakeMode, setIntakeMode] = useState<'paste' | 'crew'>('paste');
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [queueFilter, setQueueFilter] = useState<'pending' | 'done' | 'all'>('pending');
  const [provider, setProvider] = useState<VevoProviderStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [batchChecking, setBatchChecking] = useState(false);
  const [lastVerdict, setLastVerdict] = useState<VevoExpiry | null>(null);

  const refresh = () => setRecords(listManualVevoRecords());

  useEffect(() => {
    refresh();
    void getCrewList()
      .then((res) => setCrewList(res.crew ?? []))
      .catch(() => setCrewList([]));
    void getVevoProviderStatus()
      .then(setProvider)
      .catch(() => setProvider(null));
  }, []);

  const verifiedCount = useMemo(() => records.filter((r) => r.result).length, [records]);
  const pendingRecords = useMemo(() => records.filter((r) => !r.result), [records]);
  const parsedBulk = useMemo(() => parseBulkApplicants(bulkText), [bulkText]);
  const parsedReady = useMemo(() => parsedBulk.filter((row) => row.applicant), [parsedBulk]);
  const parsedBad = useMemo(() => parsedBulk.filter((row) => !row.applicant), [parsedBulk]);

  const crewCandidates = useMemo(() => crewList.map(toCrewCandidate), [crewList]);
  const readyCrewIds = useMemo(
    () => crewCandidates.filter((c) => c.missing.length === 0).map((c) => c.crew.id),
    [crewCandidates]
  );

  const visibleRecords = useMemo(() => {
    if (queueFilter === 'pending') return records.filter((r) => !r.result);
    if (queueFilter === 'done') return records.filter((r) => r.result);
    return records;
  }, [records, queueFilter]);

  const progressPercent = records.length ? Math.round((verifiedCount / records.length) * 100) : 0;
  const liveEnabled = provider?.configured === true;

  const onApplicant = (key: keyof VevoFetchInput, value: string) => {
    setApplicant((prev) => ({ ...prev, [key]: value }));
  };

  const onResult = (key: keyof ManualVevoResult, value: string) => {
    setResult((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopyFields = async () => {
    if (!applicant.grantNumber.trim() || !applicant.passportNumber.trim() || !applicant.dateOfBirth.trim()) {
      toast.error('Fill grant number, passport, and date of birth first');
      return;
    }
    try {
      await navigator.clipboard.writeText(copyApplicantForVevo(applicant));
      toast.success('Copied fields for VEVO form');
    } catch {
      toast.error('Could not copy — select text manually');
    }
  };

  const handleOpenVevo = () => {
    window.open(VEVO_PORTAL_URL, '_blank', 'noopener,noreferrer');
    toast.message('Complete the enquiry on VEVO, then paste results below');
  };

  const applyLiveResult = (
    target: VevoFetchInput,
    metadata: VevoMetadata,
    expiry: VevoExpiry | undefined,
    recordId?: string,
    linkedCrewId?: string
  ) => {
    const mapped = metadataToResult(metadata);
    upsertManualVevoRecord(target, mapped, linkedCrewId, recordId);
    return { mapped, expiry };
  };

  /** Runs the check through the provider API — no portal, no copy-paste. */
  const handleDirectCheck = async () => {
    if (!applicant.passportNumber.trim() || !applicant.dateOfBirth.trim()) {
      toast.error('Passport number and date of birth are required for a live check');
      return;
    }

    setChecking(true);
    try {
      const payload: LiveCheckInput = { ...applicant, crewId: crewId || undefined };
      const response = await runLiveVevoCheck(payload);

      if (!response.data) {
        setLastVerdict(null);
        toast.error(response.message || 'VEVO check did not return visa details');
        return;
      }

      const { mapped } = applyLiveResult(applicant, response.data, response.expiry, editingId, crewId || undefined);
      setResult(mapped);
      setLastVerdict(response.expiry ?? null);
      refresh();

      const verdict = verdictLabel(response.expiry);
      if (response.expiry?.verdict === 'expired') toast.error(`${applicant.fullName || 'Applicant'}: ${verdict}`);
      else toast.success(`${applicant.fullName || 'Applicant'}: ${verdict}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Live VEVO check failed');
    } finally {
      setChecking(false);
    }
  };

  /** Runs every pending person in the queue through the provider in one go. */
  const handleCheckAllPending = async () => {
    if (pendingRecords.length === 0) {
      toast.message('Nothing pending to check');
      return;
    }

    setBatchChecking(true);
    try {
      const response = await runLiveVevoBatch({
        records: pendingRecords.map((record) => ({
          ...record.applicant,
          crewId: record.crewId,
          clientRef: record.id,
        })),
      });

      (response.results ?? []).forEach((row) => {
        if (!row.data) return;
        const recordId = row.applicant.clientRef;
        const source = pendingRecords.find((record) => record.id === recordId);
        applyLiveResult(source?.applicant ?? row.applicant, row.data, row.expiry, recordId, row.crewId ?? undefined);
      });
      refresh();

      const summary = response.summary;
      if (summary) {
        const parts = [`${summary.valid} valid`, `${summary.expiring} expiring`, `${summary.expired} expired`];
        if (summary.failed) parts.push(`${summary.failed} failed`);
        toast.success(`Checked ${summary.total}: ${parts.join(' · ')}`);
        setQueueFilter('done');
      } else {
        toast.message(response.message);
      }

      const firstFailure = (response.results ?? []).find((row) => !row.success && row.message);
      if (firstFailure?.message) toast.error(firstFailure.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch VEVO check failed');
    } finally {
      setBatchChecking(false);
    }
  };

  const handleAddBulk = () => {
    if (parsedReady.length === 0) {
      toast.error('Nothing to add — check the format of each line');
      return;
    }
    const { added, skipped } = addManualVevoRecords(parsedReady.map((row) => ({ applicant: row.applicant! })));
    refresh();
    setBulkText('');
    setQueueFilter('pending');
    toast.success(`Added ${added} to queue${skipped ? ` · ${skipped} already queued` : ''}`);
  };

  const toggleCrewSelection = (id: string) => {
    setSelectedCrewIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleImportSelectedCrew = () => {
    const chosen = crewCandidates.filter(
      (candidate) => selectedCrewIds.includes(candidate.crew.id) && candidate.missing.length === 0
    );
    if (chosen.length === 0) {
      toast.error('Select crew that have DOB, grant number, and passport on file');
      return;
    }
    const { added, skipped } = addManualVevoRecords(
      chosen.map((candidate) => ({ applicant: candidate.applicant, crewId: candidate.crew.id }))
    );
    refresh();
    setSelectedCrewIds([]);
    setQueueFilter('pending');
    toast.success(`Added ${added} crew to queue${skipped ? ` · ${skipped} already queued` : ''}`);
  };

  const startCheck = async (record: ManualVevoRecord) => {
    setApplicant({ ...record.applicant });
    setResult(record.result ? { ...record.result } : emptyResult());
    setEditingId(record.id);
    setCrewId(record.crewId || '');

    try {
      await navigator.clipboard.writeText(copyApplicantForVevo(record.applicant));
      toast.success('Fields copied — paste into VEVO, then record the result here');
    } catch {
      toast.message('Loaded applicant — copy the fields manually into VEVO');
    }
    window.open(VEVO_PORTAL_URL, '_blank', 'noopener,noreferrer');
  };

  const checkRecordLive = async (record: ManualVevoRecord) => {
    setChecking(true);
    setApplicant({ ...record.applicant });
    setEditingId(record.id);
    setCrewId(record.crewId ?? '');
    try {
      const response = await runLiveVevoCheck({ ...record.applicant, crewId: record.crewId });
      if (!response.data) {
        toast.error(response.message || 'VEVO check did not return visa details');
        return;
      }
      const { mapped } = applyLiveResult(record.applicant, response.data, response.expiry, record.id, record.crewId);
      setResult(mapped);
      setLastVerdict(response.expiry ?? null);
      refresh();
      const verdict = verdictLabel(response.expiry);
      if (response.expiry?.verdict === 'expired') toast.error(`${record.applicant.fullName || 'Applicant'}: ${verdict}`);
      else toast.success(`${record.applicant.fullName || 'Applicant'}: ${verdict}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Live VEVO check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckNextPending = () => {
    const next = pendingRecords[pendingRecords.length - 1];
    if (!next) {
      toast.message('Queue is fully checked');
      return;
    }
    void startCheck(next);
  };

  const handleSave = async () => {
    if (!applicant.grantNumber.trim() || !applicant.passportNumber.trim() || !applicant.dateOfBirth.trim()) {
      toast.error('Applicant grant, passport, and DOB are required');
      return;
    }
    if (!result.visaStatus) {
      toast.error('Enter the visa status from VEVO');
      return;
    }

    setSaving(true);
    try {
      const saved = upsertManualVevoRecord(
        applicant,
        {
          ...result,
          verifiedAt: result.verifiedAt || new Date().toISOString().slice(0, 10),
        },
        crewId || undefined,
        editingId
      );

      if (crewId) {
        const crew = crewList.find((c) => c.id === crewId);
        if (!crew) throw new Error('Selected crew not found');
        const formData = crewApiToFormData(crew);
        formData.vevoDocumentType = 'Passport';
        formData.vevoReferenceType = 'Visa Grant Number';
        formData.vevoReferenceNumber = applicant.grantNumber.trim();
        formData.visaSubclass = [result.visaClass, result.visaSubclass].filter(Boolean).join(' / ');
        formData.visaExpiryDate = result.expiryDate || formData.visaExpiryDate;
        formData.visaIssueDate = result.grantDate || formData.visaIssueDate;
        formData.visaConditions = [result.workEntitlements, result.visaConditions, result.periodOfStay, result.notes]
          .filter(Boolean)
          .join('\n');
        formData.lastVevoCheckedAt = result.verifiedAt || new Date().toISOString().slice(0, 10);
        formData.visaCountry =
          applicant.country === 'GBR' ? 'United Kingdom' : formData.visaCountry || applicant.country || '';

        const response = await updateCrewMember(crewId, formData);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to update crew (${response.status})`);
        }
        toast.success('Saved real VEVO result to crew profile');
      } else {
        toast.success('Saved verification in VEVO queue');
      }

      setEditingId(saved.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const loadRecord = (record: ManualVevoRecord) => {
    setApplicant({ ...record.applicant });
    setResult(record.result ? { ...record.result } : emptyResult());
    setEditingId(record.id);
    setCrewId(record.crewId || '');
    toast.message('Loaded record — edit and save again if needed');
  };

  const handleAddAnother = () => {
    setApplicant({
      fullName: '',
      dateOfBirth: '',
      grantNumber: '',
      passportNumber: '',
      country: 'GBR',
    });
    setResult(emptyResult());
    setEditingId(undefined);
    setCrewId('');
  };

  return (
    <div className="subsea-shell vevo-page">
      <SubseaNavRail activeModule="visa" />

      <div className="subsea-main">
        <div className="subsea-topbar">
          <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} className="mr-1.5" /> Back
          </button>
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">VEVO Manual Verify</span>
          </div>
          <div className="subsea-top-actions">
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <section className="vevo-hero">
            <div className="vevo-hero-kicker">
              <ShieldCheck size={14} /> Real VEVO data (manual official check)
            </div>
            <h1>Verify crew on official VEVO</h1>
            <p>
              {liveEnabled
                ? 'Load crew into the queue and run the checks straight from here — visa status, expiry and conditions come back from Home Affairs via the provider API and save onto the crew record.'
                : 'Direct checks need provider credentials. Until they are set, load the queue and verify each person on the official portal, recording the real result here.'}{' '}
              Default country: {VEVO_DEFAULT_COUNTRY_LABEL}.
            </p>
            <div className="vevo-hero-actions">
              {liveEnabled ? (
                <button
                  type="button"
                  className="vevo-hero-btn solid"
                  disabled={batchChecking || pendingRecords.length === 0}
                  onClick={() => void handleCheckAllPending()}
                >
                  <PlayCircle size={15} />
                  {batchChecking ? 'Checking…' : `Check all pending (${pendingRecords.length})`}
                </button>
              ) : (
                <button type="button" className="vevo-hero-btn solid" onClick={handleCheckNextPending}>
                  <PlayCircle size={15} /> Check next pending ({pendingRecords.length})
                </button>
              )}
              <button type="button" className="vevo-hero-btn" onClick={() => void handleCopyFields()}>
                <ClipboardCopy size={15} /> Copy fields for VEVO
              </button>
              <button type="button" className="vevo-hero-btn" onClick={handleOpenVevo}>
                <ExternalLink size={15} /> Open VEVO portal
              </button>
              <button type="button" className="vevo-hero-btn" onClick={handleAddAnother}>
                <Plus size={15} /> New applicant
              </button>
            </div>
            {records.length > 0 && (
              <div className="vevo-progress">
                <div className="vevo-progress-bar">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="vevo-progress-label">
                  {verifiedCount} of {records.length} checked
                </span>
              </div>
            )}
          </section>

          {provider && (
            <div className={`vevo-provider-banner ${liveEnabled ? 'live' : 'offline'}`}>
              <ShieldCheck size={16} />
              {liveEnabled ? (
                <p>
                  Direct checks are live via <strong>{provider.provider}</strong> ({provider.environment}). Results are
                  pulled from Home Affairs and written to the crew record automatically.
                </p>
              ) : (
                <p>
                  Direct checks are switched off because the provider is not configured. Add{' '}
                  {provider.missingSettings.length > 0
                    ? provider.missingSettings.map((setting, index) => (
                        <span key={setting}>
                          {index > 0 && ', '}
                          <code>{setting}</code>
                        </span>
                      ))
                    : 'the provider credentials'}{' '}
                  to the backend environment and this page becomes one-click. Meanwhile the portal flow below still
                  records real results.
                </p>
              )}
            </div>
          )}

          <section className="vevo-panel vevo-intake">
            <div className="vevo-panel-head">
              <div>
                <h2>1. Load the queue</h2>
                <span>Add several people at once, then check them one by one</span>
              </div>
              <div className="vevo-tabs">
                <button
                  type="button"
                  className={`vevo-tab ${intakeMode === 'paste' ? 'active' : ''}`}
                  onClick={() => setIntakeMode('paste')}
                >
                  Paste list
                </button>
                <button
                  type="button"
                  className={`vevo-tab ${intakeMode === 'crew' ? 'active' : ''}`}
                  onClick={() => setIntakeMode('crew')}
                >
                  From crew ({readyCrewIds.length})
                </button>
              </div>
            </div>
            <div className="vevo-panel-body">
              {intakeMode === 'paste' ? (
                <>
                  <div className="vevo-field full">
                    <label htmlFor="vevo-bulk">
                      One person per line <em>— name, date of birth, grant number, passport number, country</em>
                    </label>
                    <div className="vevo-input-wrap">
                      <textarea
                        id="vevo-bulk"
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`John Ross Dingwall 14 Mar 84 Grant No:- 0289500084806 Passport:- 142828174\nJane Smith, 02/09/1990, 0298400012345, 501234567, GBR\n# lines starting with # are ignored`}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  {bulkText.trim() && (
                    <div className="vevo-chip-row">
                      <span className="vevo-chip">{parsedReady.length} ready</span>
                      {parsedBad.length > 0 && (
                        <span className="vevo-chip vevo-chip-bad">{parsedBad.length} need fixing</span>
                      )}
                    </div>
                  )}
                  {parsedBad.length > 0 && (
                    <ul className="vevo-parse-errors">
                      {parsedBad.slice(0, 6).map((row) => (
                        <li key={row.lineNumber}>
                          <strong>Line {row.lineNumber}:</strong> {row.error} — <code>{row.raw}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="vevo-actions">
                    <button
                      type="button"
                      className="vevo-btn vevo-btn-primary"
                      disabled={parsedReady.length === 0}
                      onClick={handleAddBulk}
                    >
                      <ListChecks size={16} /> Add {parsedReady.length || ''} to queue
                    </button>
                    <button
                      type="button"
                      className="vevo-btn vevo-btn-ghost"
                      disabled={!bulkText}
                      onClick={() => setBulkText('')}
                    >
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {crewCandidates.length === 0 ? (
                    <p className="vevo-hint" style={{ marginTop: 0 }}>
                      No crew loaded yet.
                    </p>
                  ) : (
                    <>
                      <div className="vevo-crew-list">
                        {crewCandidates.map(({ crew, applicant, missing }) => {
                          const ready = missing.length === 0;
                          return (
                            <label key={crew.id} className={`vevo-crew-row ${ready ? '' : 'disabled'}`}>
                              <input
                                type="checkbox"
                                checked={selectedCrewIds.includes(crew.id)}
                                disabled={!ready}
                                onChange={() => toggleCrewSelection(crew.id)}
                              />
                              <span className="vevo-crew-name">
                                {crew.firstname} {crew.lastname}
                              </span>
                              <span className="vevo-crew-meta">
                                {ready
                                  ? `${applicant.grantNumber} · ${applicant.passportNumber} · ${applicant.country}`
                                  : `Missing ${missing.join(', ')}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="vevo-actions">
                        <button
                          type="button"
                          className="vevo-btn vevo-btn-primary"
                          disabled={selectedCrewIds.length === 0}
                          onClick={handleImportSelectedCrew}
                        >
                          <Users size={16} /> Add {selectedCrewIds.length || ''} selected to queue
                        </button>
                        <button
                          type="button"
                          className="vevo-btn vevo-btn-ghost"
                          onClick={() =>
                            setSelectedCrewIds(selectedCrewIds.length === readyCrewIds.length ? [] : readyCrewIds)
                          }
                        >
                          {selectedCrewIds.length === readyCrewIds.length ? 'Clear all' : 'Select all eligible'}
                        </button>
                      </div>
                      <p className="vevo-hint">
                        Crew are eligible once their date of birth, passport number, and VEVO grant number are on the
                        profile. Results saved from the queue write straight back to that crew member.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          <div className="vevo-layout">
            <section className="vevo-panel">
              <div className="vevo-panel-head">
                <div>
                  <h2>2. Applicant being checked</h2>
                  <span>Same fields as the VEVO enquiry form</span>
                </div>
              </div>
              <div className="vevo-panel-body">
                <div className="vevo-fields">
                  <div className="vevo-field full">
                    <label>Full name</label>
                    <div className="vevo-input-wrap">
                      <UserRound size={15} />
                      <input
                        value={applicant.fullName ?? ''}
                        onChange={(e) => onApplicant('fullName', e.target.value)}
                        placeholder="e.g. John Ross Dingwall"
                      />
                    </div>
                  </div>
                  <div className="vevo-field">
                    <label>Date of birth *</label>
                    <AccessibleDateField
                      mode="birth"
                      required
                      value={applicant.dateOfBirth}
                      onChange={(iso) => onApplicant('dateOfBirth', iso)}
                      hint="Type DD/MM/YYYY"
                    />
                  </div>
                  <div className="vevo-field">
                    <label>Country of document *</label>
                    <div className="vevo-input-wrap">
                      <Globe2 size={15} />
                      <select
                        value={applicant.country ?? 'GBR'}
                        onChange={(e) => onApplicant('country', e.target.value)}
                        style={{ paddingLeft: 38, appearance: 'auto' }}
                      >
                        <option value="GBR">UNITED KINGDOM - BRITISH CITIZEN</option>
                        <option value="AUS">AUSTRALIA</option>
                        <option value="USA">UNITED STATES OF AMERICA</option>
                        <option value="NZL">NEW ZEALAND</option>
                        <option value="CAN">CANADA</option>
                        <option value="IRL">IRELAND</option>
                        <option value="IND">INDIA</option>
                        <option value="PHL">PHILIPPINES</option>
                      </select>
                    </div>
                  </div>
                  <div className="vevo-field">
                    <label>Visa grant number *</label>
                    <div className="vevo-input-wrap">
                      <Hash size={15} />
                      <input
                        value={applicant.grantNumber}
                        onChange={(e) => onApplicant('grantNumber', e.target.value)}
                        placeholder="0289500084806"
                      />
                    </div>
                  </div>
                  <div className="vevo-field">
                    <label>Passport number *</label>
                    <div className="vevo-input-wrap">
                      <IdCard size={15} />
                      <input
                        value={applicant.passportNumber}
                        onChange={(e) => onApplicant('passportNumber', e.target.value)}
                        placeholder="142828174"
                      />
                    </div>
                  </div>
                </div>

                <div className="vevo-actions">
                  <button
                    type="button"
                    className="vevo-btn vevo-btn-primary"
                    disabled={checking || !liveEnabled}
                    title={liveEnabled ? 'Query VEVO through the provider API' : 'Provider credentials required'}
                    onClick={() => void handleDirectCheck()}
                  >
                    <PlayCircle size={16} /> {checking ? 'Checking VEVO…' : 'Run check now'}
                  </button>
                  <button type="button" className="vevo-btn vevo-btn-ghost" onClick={() => void handleCopyFields()}>
                    <ClipboardCopy size={16} /> Copy for VEVO
                  </button>
                  <button type="button" className="vevo-btn vevo-btn-ghost" onClick={handleOpenVevo}>
                    <ExternalLink size={16} /> Open official VEVO
                  </button>
                </div>
                {lastVerdict && (
                  <div className={`vevo-verdict ${lastVerdict.verdict}`}>
                    <strong>{verdictLabel(lastVerdict)}</strong>
                    {lastVerdict.expiryDate && <span>Expiry {formatDate(lastVerdict.expiryDate)}</span>}
                  </div>
                )}
                <p className="vevo-hint">
                  On VEVO: Document type = Passport · Reference = Visa Grant Number · Country = UNITED KINGDOM - BRITISH
                  CITIZEN (default).
                </p>
              </div>
            </section>

            <aside className="vevo-panel">
              <div className="vevo-panel-head">
                <div>
                  <h2>3. Record the VEVO result</h2>
                  <span>Enter what the official site shows</span>
                </div>
              </div>
              <div className="vevo-panel-body">
                <div className="vevo-fields">
                  <div className="vevo-field">
                    <label>Visa status *</label>
                    <select
                      value={result.visaStatus}
                      onChange={(e) => onResult('visaStatus', e.target.value as ManualVevoStatus)}
                      className="accessible-date-input"
                      style={{ minHeight: 42 }}
                    >
                      <option value="In Effect">In Effect</option>
                      <option value="Expired">Expired</option>
                      <option value="Not Found">Not Found</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="vevo-field">
                    <label>Verified on</label>
                    <AccessibleDateField mode="any" value={result.verifiedAt} onChange={(iso) => onResult('verifiedAt', iso)} />
                  </div>
                  <div className="vevo-field">
                    <label>Visa class</label>
                    <input className="accessible-date-input" value={result.visaClass} onChange={(e) => onResult('visaClass', e.target.value)} placeholder="e.g. GA" />
                  </div>
                  <div className="vevo-field">
                    <label>Subclass</label>
                    <input className="accessible-date-input" value={result.visaSubclass} onChange={(e) => onResult('visaSubclass', e.target.value)} placeholder="e.g. 400" />
                  </div>
                  <div className="vevo-field full">
                    <label>Visa stream</label>
                    <input className="accessible-date-input" value={result.visaStream} onChange={(e) => onResult('visaStream', e.target.value)} placeholder="e.g. Highly Specialised Work" />
                  </div>
                  <div className="vevo-field">
                    <label>Grant date</label>
                    <AccessibleDateField mode="any" value={result.grantDate} onChange={(iso) => onResult('grantDate', iso)} />
                  </div>
                  <div className="vevo-field">
                    <label>Expiry date</label>
                    <AccessibleDateField mode="any" value={result.expiryDate} onChange={(iso) => onResult('expiryDate', iso)} />
                  </div>
                  <div className="vevo-field full">
                    <label>Work entitlements</label>
                    <textarea className="accessible-date-input" rows={2} value={result.workEntitlements} onChange={(e) => onResult('workEntitlements', e.target.value)} placeholder="e.g. Limited Work Entitlements" />
                  </div>
                  <div className="vevo-field full">
                    <label>Conditions (e.g. 8107)</label>
                    <textarea className="accessible-date-input" rows={3} value={result.visaConditions} onChange={(e) => onResult('visaConditions', e.target.value)} />
                  </div>
                  <div className="vevo-field full">
                    <label>Period of stay</label>
                    <input className="accessible-date-input" value={result.periodOfStay} onChange={(e) => onResult('periodOfStay', e.target.value)} />
                  </div>
                  <div className="vevo-field full">
                    <label>Link to crew (optional)</label>
                    <select className="accessible-date-input" value={crewId} onChange={(e) => setCrewId(e.target.value)} style={{ minHeight: 42 }}>
                      <option value="">Save in VEVO queue only</option>
                      {crewList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstname} {c.lastname} · {c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="vevo-actions">
                  <button type="button" className="vevo-btn vevo-btn-primary" disabled={saving} onClick={() => void handleSave()}>
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save real VEVO result'}
                  </button>
                </div>
              </div>
            </aside>
          </div>

          <div className="vevo-batch-table-wrap">
            <div className="subsea-pane">
              <div className="subsea-pane-head">
                <div className="subsea-pane-title">
                  <FileStack size={14} style={{ display: 'inline', marginRight: 6 }} />
                  Check queue ({verifiedCount}/{records.length} checked)
                </div>
                <div className="vevo-tabs">
                  {(['pending', 'done', 'all'] as const).map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={`vevo-tab ${queueFilter === key ? 'active' : ''}`}
                      onClick={() => setQueueFilter(key)}
                    >
                      {key === 'pending'
                        ? `Pending (${pendingRecords.length})`
                        : key === 'done'
                          ? `Checked (${verifiedCount})`
                          : `All (${records.length})`}
                    </button>
                  ))}
                </div>
              </div>
              {visibleRecords.length === 0 ? (
                <div className="subsea-empty-cell">
                  {records.length === 0
                    ? 'Queue is empty. Paste a list of crew above or import them from crew profiles.'
                    : queueFilter === 'pending'
                      ? 'Nothing pending — every person in the queue has a recorded result.'
                      : 'No records in this view yet.'}
                </div>
              ) : (
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Grant</th>
                        <th>Passport</th>
                        <th>Country</th>
                        <th>Status</th>
                        <th>Subclass</th>
                        <th>Expiry</th>
                        <th>Crew</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.map((row) => (
                        <tr key={row.id} className={editingId === row.id ? 'vevo-row-active' : undefined}>
                          <td>{row.applicant.fullName || '—'}</td>
                          <td>{row.applicant.grantNumber}</td>
                          <td>{row.applicant.passportNumber}</td>
                          <td>{row.applicant.country || 'GBR'}</td>
                          <td>
                            {row.result ? (
                              <span className={`subsea-badge ${statusBadgeClass(row.result.visaStatus)}`}>
                                {row.result.visaStatus}
                              </span>
                            ) : (
                              <span className="subsea-badge subsea-b-gray">Pending</span>
                            )}
                          </td>
                          <td>
                            {row.result
                              ? [row.result.visaClass, row.result.visaSubclass].filter(Boolean).join(' / ') || '—'
                              : '—'}
                          </td>
                          <td>{formatDate(row.result?.expiryDate)}</td>
                          <td>
                            {row.crewId
                              ? (() => {
                                  const linked = crewList.find((c) => c.id === row.crewId);
                                  return linked ? `${linked.firstname} ${linked.lastname}` : 'Linked';
                                })()
                              : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {liveEnabled ? (
                                <button
                                  type="button"
                                  className="subsea-btn subsea-btn-primary subsea-btn-xs"
                                  disabled={checking || batchChecking}
                                  onClick={() => void checkRecordLive(row)}
                                  title="Query VEVO through the provider API"
                                >
                                  {row.result ? 'Re-check' : 'Check now'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="subsea-btn subsea-btn-primary subsea-btn-xs"
                                  onClick={() => void startCheck(row)}
                                  title="Copy fields, open VEVO, and load this person into the form"
                                >
                                  {row.result ? 'Re-check' : 'Check on VEVO'}
                                </button>
                              )}
                              <button type="button" className="subsea-btn subsea-btn-default subsea-btn-xs" onClick={() => loadRecord(row)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="subsea-btn subsea-btn-default subsea-btn-xs"
                                onClick={() => {
                                  deleteManualVevoRecord(row.id);
                                  refresh();
                                  toast.success('Removed');
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <p className="vevo-hint" style={{ marginTop: 12 }}>
            For automatic live checks later: get Home Affairs org API access or a paid provider (RapidID), then we can
            replace this manual step.
          </p>
        </main>
      </div>
    </div>
  );
};

export default VevoVisaPage;
