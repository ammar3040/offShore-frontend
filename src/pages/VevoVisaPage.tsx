import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileStack,
  Globe2,
  Hash,
  IdCard,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  batchFetchVisaDetails,
  fetchVisaDetails,
  parseVisaRawText,
  type VevoApiResponse,
  type VevoBatchFetchResponse,
  type VevoFetchInput,
} from '../api/visa';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { VEVO_DEFAULT_APPLICANT, VEVO_DEFAULT_RAW_TEXT } from '../constants/vevoDefaults';
import { downloadPdfFromDataUri } from '../lib/downloadPdf';
import { toast } from 'sonner';
import './RigsPage.css';
import './VevoVisaPage.css';

const VEVO_PORTAL_URL = 'https://online.immi.gov.au/evo/firstParty?actionType=query';

function statusBadgeClass(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'subsea-b-green';
  if (s === 'expired') return 'subsea-b-red';
  if (s.includes('not')) return 'subsea-b-amber';
  return 'subsea-b-gray';
}

function statusTone(status?: string): 'active' | 'expired' | 'other' {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'expired') return 'expired';
  return 'other';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

const emptyForm: VevoFetchInput = { ...VEVO_DEFAULT_APPLICANT };

type Mode = 'single' | 'batch';

const VevoVisaPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('single');
  const [form, setForm] = useState<VevoFetchInput>(emptyForm);
  const [rawText, setRawText] = useState(VEVO_DEFAULT_RAW_TEXT);
  const [singleLoading, setSingleLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<VevoApiResponse | null>(null);
  const [batchResult, setBatchResult] = useState<VevoBatchFetchResponse | null>(null);
  const [parsedRecords, setParsedRecords] = useState<VevoFetchInput[]>([]);

  const resultRows = useMemo(() => batchResult?.results ?? [], [batchResult]);
  const tone = statusTone(singleResult?.data?.visaStatus);

  const onField = (key: keyof VevoFetchInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSingleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.grantNumber.trim() || !form.passportNumber.trim() || !form.dateOfBirth.trim()) {
      toast.error('Grant number, passport number, and date of birth are required');
      return;
    }
    setSingleLoading(true);
    setSingleResult(null);
    try {
      const response = await fetchVisaDetails({
        fullName: form.fullName?.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim(),
        grantNumber: form.grantNumber.trim(),
        passportNumber: form.passportNumber.trim(),
        country: (form.country || 'AUS').trim().toUpperCase(),
      });
      setSingleResult(response);
      if (response.success) toast.success(response.message);
      else toast.error(response.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'VEVO fetch failed');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Paste raw applicant text first');
      return;
    }
    setParseLoading(true);
    try {
      const response = await parseVisaRawText(rawText);
      const records = response.records ?? [];
      setParsedRecords(records);
      toast.success(response.message || `Parsed ${records.length} record(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setParseLoading(false);
    }
  };

  const handleBatchFetch = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const payload =
        parsedRecords.length > 0
          ? { records: parsedRecords }
          : rawText.trim()
            ? { rawText }
            : null;
      if (!payload) {
        toast.error('Parse raw text or provide records before batch fetch');
        return;
      }
      const response = await batchFetchVisaDetails(payload);
      setBatchResult(response);
      toast.success(response.message || 'Batch complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Batch fetch failed');
    } finally {
      setBatchLoading(false);
    }
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
            <span className="subsea-crumb-active">VEVO Visa</span>
          </div>
          <div className="subsea-top-actions">
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <section className="vevo-hero">
            <div className="vevo-hero-kicker">
              <ShieldCheck size={14} /> Home Affairs entitlement check
            </div>
            <h1>VEVO Visa Grant</h1>
            <p>
              Verify work rights, subclass, and expiry in one place — then download the entitlement certificate for crew
              files.
            </p>
            <div className="vevo-hero-actions">
              <button type="button" className="vevo-hero-btn solid" onClick={() => setMode('single')}>
                <IdCard size={15} /> Single check
              </button>
              <button type="button" className="vevo-hero-btn" onClick={() => setMode('batch')}>
                <FileStack size={15} /> Batch / parse
              </button>
              <a href={VEVO_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="vevo-hero-btn">
                <ExternalLink size={15} /> Official portal
              </a>
            </div>
          </section>

          <div className="vevo-layout">
            <section className="vevo-panel">
              <div className="vevo-panel-head">
                <div>
                  <h2>{mode === 'single' ? 'Applicant details' : 'Parse & batch'}</h2>
                  <span>{mode === 'single' ? 'Required fields marked with *' : 'Paste grant notices, then run batch'}</span>
                </div>
                <div className="vevo-tabs" role="tablist" aria-label="VEVO mode">
                  <button
                    type="button"
                    className={`vevo-tab${mode === 'single' ? ' active' : ''}`}
                    onClick={() => setMode('single')}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    className={`vevo-tab${mode === 'batch' ? ' active' : ''}`}
                    onClick={() => setMode('batch')}
                  >
                    Batch
                  </button>
                </div>
              </div>

              <div className="vevo-panel-body">
                {mode === 'single' ? (
                  <form onSubmit={(e) => void handleSingleFetch(e)}>
                    <div className="vevo-fields">
                      <div className="vevo-field full">
                        <label htmlFor="vevoFullName">
                          Full name <em>(optional)</em>
                        </label>
                        <div className="vevo-input-wrap">
                          <UserRound size={15} />
                          <input
                            id="vevoFullName"
                            value={form.fullName ?? ''}
                            onChange={(e) => onField('fullName', e.target.value)}
                            placeholder="e.g. Scott Archibald"
                            autoComplete="name"
                          />
                        </div>
                      </div>

                      <div className="vevo-field">
                        <label htmlFor="vevoDob">Date of birth *</label>
                        <div className="vevo-input-wrap">
                          <CalendarDays size={15} />
                          <input
                            id="vevoDob"
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) => onField('dateOfBirth', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="vevo-field">
                        <label htmlFor="vevoCountry">Country</label>
                        <div className="vevo-input-wrap">
                          <Globe2 size={15} />
                          <input
                            id="vevoCountry"
                            value={form.country ?? 'AUS'}
                            onChange={(e) => onField('country', e.target.value.toUpperCase())}
                            maxLength={3}
                            placeholder="AUS"
                          />
                        </div>
                      </div>

                      <div className="vevo-field">
                        <label htmlFor="vevoGrant">Grant number *</label>
                        <div className="vevo-input-wrap">
                          <Hash size={15} />
                          <input
                            id="vevoGrant"
                            value={form.grantNumber}
                            onChange={(e) => onField('grantNumber', e.target.value)}
                            placeholder="0289584963243"
                            required
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      <div className="vevo-field">
                        <label htmlFor="vevoPassport">Passport number *</label>
                        <div className="vevo-input-wrap">
                          <IdCard size={15} />
                          <input
                            id="vevoPassport"
                            value={form.passportNumber}
                            onChange={(e) => onField('passportNumber', e.target.value)}
                            placeholder="151662015"
                            required
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="vevo-actions">
                      <button type="submit" className="vevo-btn vevo-btn-primary" disabled={singleLoading}>
                        {singleLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        {singleLoading ? 'Checking entitlements…' : 'Fetch VEVO details'}
                      </button>
                      <button
                        type="button"
                        className="vevo-btn vevo-btn-ghost"
                        onClick={() => {
                          setForm({ ...VEVO_DEFAULT_APPLICANT });
                          setSingleResult(null);
                        }}
                      >
                        Reset defaults
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="vevo-field full">
                      <label htmlFor="vevoRaw">Raw applicant text</label>
                      <div className="vevo-input-wrap">
                        <FileStack size={15} style={{ top: 14 }} />
                        <textarea
                          id="vevoRaw"
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          placeholder={`Record 1:\n- Date of Birth: 27 October 1974\n- Grant Number: 0289584946860\n- Passport Number: 133951532`}
                        />
                      </div>
                    </div>

                    <div className="vevo-actions">
                      <button type="button" className="vevo-btn vevo-btn-ghost" onClick={() => void handleParse()} disabled={parseLoading}>
                        {parseLoading ? <Loader2 size={16} className="animate-spin" /> : <FileStack size={16} />}
                        {parseLoading ? 'Parsing…' : 'Parse text'}
                      </button>
                      <button type="button" className="vevo-btn vevo-btn-primary" onClick={() => void handleBatchFetch()} disabled={batchLoading}>
                        {batchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        {batchLoading ? 'Running batch…' : 'Batch fetch VEVO'}
                      </button>
                    </div>

                    {parsedRecords.length > 0 && (
                      <div className="vevo-chip-row">
                        <span className="vevo-chip">
                          <CheckCircle2 size={13} /> {parsedRecords.length} record(s) ready
                        </span>
                      </div>
                    )}
                    <p className="vevo-hint">Tip: parse first to preview records, then run batch fetch.</p>
                  </>
                )}
              </div>
            </section>

            <aside className="vevo-panel vevo-result">
              <div className="vevo-panel-head">
                <div>
                  <h2>Verification result</h2>
                  <span>Live entitlement snapshot</span>
                </div>
              </div>

              {!singleResult ? (
                <div className="vevo-result-empty">
                  <div>
                    <div className="vevo-result-empty-icon">
                      <ShieldCheck size={24} />
                    </div>
                    <strong>No check yet</strong>
                    <p>Submit an applicant on the left to see status, subclass, expiry, and work rights here.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`vevo-status-banner ${tone}`}>
                    <div className="vevo-status-orb">
                      {tone === 'active' ? (
                        <CheckCircle2 size={20} />
                      ) : tone === 'expired' ? (
                        <XCircle size={20} />
                      ) : (
                        <AlertTriangle size={20} />
                      )}
                    </div>
                    <div>
                      <h3>{singleResult.data?.visaStatus ?? (singleResult.success ? 'Verified' : 'Failed')}</h3>
                      <p>{singleResult.message}</p>
                    </div>
                  </div>

                  <div className="vevo-metrics">
                    <div className="vevo-metric">
                      <label>Applicant</label>
                      <strong>{singleResult.data?.applicantName ?? '—'}</strong>
                    </div>
                    <div className="vevo-metric">
                      <label>Subclass</label>
                      <strong>{singleResult.data?.visaSubclass ?? '—'}</strong>
                    </div>
                    <div className="vevo-metric">
                      <label>Visa class</label>
                      <strong>{singleResult.data?.visaClass ?? '—'}</strong>
                    </div>
                    <div className="vevo-metric">
                      <label>Expiry</label>
                      <strong>{formatDate(singleResult.data?.expiryDate)}</strong>
                    </div>
                    <div className="vevo-metric">
                      <label>Grant (API)</label>
                      <strong>{singleResult.data?.grantNumber ?? '—'}</strong>
                    </div>
                    <div className="vevo-metric">
                      <label>Passport (API)</label>
                      <strong>{singleResult.data?.passportNumber ?? '—'}</strong>
                    </div>
                  </div>

                  <div className="vevo-rights">
                    <label>Work entitlements</label>
                    <p>{singleResult.data?.workEntitlements ?? '—'}</p>
                  </div>

                  {singleResult.errors?.length ? (
                    <div className="vevo-rights" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
                      <label>API errors</label>
                      <p>{singleResult.errors.join(' ')}</p>
                    </div>
                  ) : null}

                  <div className="vevo-result-actions">
                    {singleResult.data?.pdfStream && (
                      <button
                        type="button"
                        className="vevo-btn vevo-btn-primary"
                        onClick={() => {
                          try {
                            downloadPdfFromDataUri(
                              singleResult.data!.pdfStream!,
                              `vevo-${singleResult.data!.grantNumber || 'certificate'}.pdf`
                            );
                            toast.success('PDF downloaded');
                          } catch {
                            toast.error('Could not download PDF');
                          }
                        }}
                      >
                        <Download size={15} /> Download PDF
                      </button>
                    )}
                    {singleResult.data?.visaStatus && (
                      <span className={`subsea-badge ${statusBadgeClass(singleResult.data.visaStatus)}`}>
                        {singleResult.data.visaStatus}
                      </span>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>

          {resultRows.length > 0 && (
            <div className="vevo-batch-table-wrap">
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Batch results ({resultRows.length})</div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Grant</th>
                        <th>Passport</th>
                        <th>HTTP</th>
                        <th>Status</th>
                        <th>Subclass</th>
                        <th>Expiry</th>
                        <th>Work rights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultRows.map((row, idx) => {
                        const data = row.vevoResponse.data;
                        return (
                          <tr key={`${row.inputPayload.grantNumber}-${idx}`}>
                            <td>{row.inputPayload.fullName || data?.applicantName || '—'}</td>
                            <td>{row.inputPayload.grantNumber}</td>
                            <td>{row.inputPayload.passportNumber}</td>
                            <td>{row.httpStatusCode}</td>
                            <td>
                              <span className={`subsea-badge ${statusBadgeClass(data?.visaStatus)}`}>
                                {data?.visaStatus ?? '—'}
                              </span>
                            </td>
                            <td>{data?.visaSubclass ?? '—'}</td>
                            <td>{formatDate(data?.expiryDate)}</td>
                            <td style={{ maxWidth: 240 }}>{data?.workEntitlements ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default VevoVisaPage;
