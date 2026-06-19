import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  DollarSign,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import Modal from '../components/Modal';
import { SubseaNavRail } from '../components/SubseaNavRail';
import { SubseaProfileMenu } from '../components/SubseaProfileMenu';
import { getProjects, type ProjectApi } from '../api/project';
import {
  getCrewList,
  getCrewById,
  type CrewMemberApi,
  type CrewAssignedProject,
} from '../api/crew';
import {
  getPayrollRecords,
  upsertPayrollRecord,
  deletePayrollRecord,
  payRateTypeBadgeClass,
  payRateTypeLabel,
  payRateTypeUnitLabel,
  type PayRateType,
  type PayrollRecord,
} from '../api/payroll';
import './RigsPage.css';
import './PayrollPage.css';

interface PayrollRow {
  crewId: string;
  crewName: string;
  projectId: string;
  projectTitle: string;
  startDate?: string;
  endDate?: string;
  payRecord?: PayrollRecord;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatPayAmount(amount?: number): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function projectDates(project: CrewAssignedProject): { startDate?: string; endDate?: string } {
  return {
    startDate: project.duration?.startDate,
    endDate: project.duration?.endDate,
  };
}

function crewFullName(crew: CrewMemberApi): string {
  return `${crew.firstname ?? ''} ${crew.lastname ?? ''}`.trim() || 'Unknown';
}

function entityId(value: { id?: string; _id?: string } | string | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value.id ?? value._id ?? '').trim();
}

function payrollKey(crewId: string, projectId: string): string {
  return `${crewId}:${projectId}`;
}

const PAY_RATE_OPTIONS: Array<{ value: PayRateType; label: string }> = [
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_project', label: 'Per Project' },
];

const PayrollPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'configured' | 'pending'>('all');
  const [page, setPage] = useState(1);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PayrollRow | null>(null);
  const [formCrewId, setFormCrewId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formPayRateType, setFormPayRateType] = useState<PayRateType>('per_hour');
  const [formPayAmount, setFormPayAmount] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pageSize = 8;

  const loadPayrollData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [crewRes, payrollRes, projectsRes] = await Promise.all([
        getCrewList(),
        getPayrollRecords(),
        getProjects().catch(() => ({ projects: [] as ProjectApi[] })),
      ]);
      const crewList = crewRes.crew ?? [];
      const projectTitleById = new Map(
        (projectsRes.projects ?? []).map((p) => [entityId(p), p.title || 'Untitled Project'])
      );
      const crewById = new Map(crewList.map((c) => [entityId(c), c]));
      const payByKey = new Map<string, PayrollRecord>();
      for (const record of payrollRes.payrolls) {
        payByKey.set(payrollKey(record.crewId, record.projectId), record);
      }

      const crewProjects = await Promise.all(
        crewList.map(async (crew) => {
          const crewId = entityId(crew);
          let projects = crew.activeProjects ?? [];
          if (projects.length === 0) {
            try {
              const detail = await getCrewById(crewId);
              projects = detail.projects ?? [];
            } catch {
              projects = [];
            }
          }
          return { crew, crewId, projects };
        })
      );

      const nextRows: PayrollRow[] = [];
      const seenKeys = new Set<string>();

      for (const { crew, crewId, projects } of crewProjects) {
        for (const project of projects) {
          const projectId = entityId(project);
          if (!projectId) continue;
          const key = payrollKey(crewId, projectId);
          seenKeys.add(key);
          const { startDate, endDate } = projectDates(project);
          nextRows.push({
            crewId,
            crewName: crewFullName(crew),
            projectId,
            projectTitle: project.title || projectTitleById.get(projectId) || 'Untitled Project',
            startDate,
            endDate,
            payRecord: payByKey.get(key),
          });
        }
      }

      for (const record of payrollRes.payrolls) {
        const key = payrollKey(record.crewId, record.projectId);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const crew = crewById.get(record.crewId);
        nextRows.push({
          crewId: record.crewId,
          crewName: crew ? crewFullName(crew) : 'Unknown crew',
          projectId: record.projectId,
          projectTitle: projectTitleById.get(record.projectId) || 'Untitled Project',
          payRecord: record,
        });
      }

      nextRows.sort((a, b) => {
        const nameCmp = a.crewName.localeCompare(b.crewName);
        if (nameCmp !== 0) return nameCmp;
        return a.projectTitle.localeCompare(b.projectTitle);
      });

      setRows(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayrollData();
  }, [loadPayrollData]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filter === 'configured') {
      list = list.filter((r) => r.payRecord != null);
    } else if (filter === 'pending') {
      list = list.filter((r) => r.payRecord == null);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.crewName.toLowerCase().includes(q) ||
          r.projectTitle.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const configuredCount = rows.filter((r) => r.payRecord != null).length;
  const pendingCount = rows.length - configuredCount;

  const uniqueCrewOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.crewId, row.crewName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const projectOptionsForCrew = useMemo(() => {
    if (!formCrewId) return [];
    return rows
      .filter((r) => r.crewId === formCrewId)
      .map((r) => ({ id: r.projectId, title: r.projectTitle }));
  }, [rows, formCrewId]);

  const openAddPayModal = () => {
    setEditingRow(null);
    setFormCrewId(uniqueCrewOptions[0]?.id ?? '');
    setFormProjectId('');
    setFormPayRateType('per_hour');
    setFormPayAmount('');
    setSaveError(null);
    setPayModalOpen(true);
  };

  const openEditPayModal = (row: PayrollRow) => {
    setEditingRow(row);
    setFormCrewId(row.crewId);
    setFormProjectId(row.projectId);
    setFormPayRateType(row.payRecord?.rateType ?? 'per_hour');
    setFormPayAmount(row.payRecord != null ? String(row.payRecord.payAmount) : '');
    setSaveError(null);
    setPayModalOpen(true);
  };

  const closePayModal = () => {
    if (!saveLoading) {
      setPayModalOpen(false);
      setSaveError(null);
    }
  };

  useEffect(() => {
    if (!payModalOpen || editingRow) return;
    const projects = rows.filter((r) => r.crewId === formCrewId);
    if (projects.length === 0) {
      setFormProjectId('');
      return;
    }
    if (!projects.some((p) => p.projectId === formProjectId)) {
      setFormProjectId(projects[0]!.projectId);
    }
  }, [payModalOpen, editingRow, formCrewId, formProjectId, rows]);

  const handleSavePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formPayAmount);
    if (!formCrewId || !formProjectId) {
      setSaveError('Select a crew member and project.');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      setSaveError('Enter a valid pay amount.');
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    try {
      await upsertPayrollRecord({
        crewId: formCrewId,
        projectId: formProjectId,
        rateType: formPayRateType,
        payAmount: amount,
      });
      await loadPayrollData();
      closePayModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save pay');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeletePay = async (row: PayrollRow) => {
    const payrollId = row.payRecord?.id;
    if (!payrollId) return;
    if (!window.confirm(`Remove pay configuration for ${row.crewName} on ${row.projectTitle}?`)) return;

    setDeleteLoadingId(payrollId);
    setError(null);
    try {
      await deletePayrollRecord(payrollId);
      await loadPayrollData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pay record');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="payroll" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Payroll</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search crew, projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Status</div>
          <button
            type="button"
            className={`subsea-sb-link${filter === 'all' ? ' active' : ''}`}
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
          >
            <DollarSign size={13} /> All Assignments{' '}
            <span className="subsea-sb-count">{loading ? '…' : rows.length}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${filter === 'configured' ? ' active' : ''}`}
            onClick={() => {
              setFilter('configured');
              setPage(1);
            }}
          >
            <BadgeCheck size={13} /> Pay Configured{' '}
            <span className="subsea-sb-count">{loading ? '…' : configuredCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${filter === 'pending' ? ' active' : ''}`}
            onClick={() => {
              setFilter('pending');
              setPage(1);
            }}
          >
            <Wallet size={13} /> Pending Setup{' '}
            <span className="subsea-sb-count subsea-sb-count-red">{loading ? '…' : pendingCount}</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Payroll</span>
          </div>
          <div className="subsea-sync-pill">
            <span className="subsea-sync-dot" />
            GMDSS Online · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
          </div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openAddPayModal}>
              <Plus size={12} /> Set Pay
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <div className="subsea-page-head">
            <div>
              <h1>Crew Payroll</h1>
              <p>Manage pay rates for crew members across project assignments</p>
            </div>
            <div className="subsea-ph-right">
              <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openAddPayModal}>
                <Plus size={12} /> Set Pay
              </button>
            </div>
          </div>

          <div className="subsea-proj-kpi-strip">
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Total Assignments</div>
              <div className="subsea-kpi-value">{loading ? '…' : rows.length}</div>
              <div className="subsea-kpi-meta flat">Crew × project records</div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Pay Configured</div>
              <div className="subsea-kpi-value">{loading ? '…' : configuredCount}</div>
              <div className="subsea-kpi-meta up">Rates saved</div>
            </div>
            <div className="subsea-kpi">
              <div className="subsea-kpi-label">Pending Setup</div>
              <div className="subsea-kpi-value">{loading ? '…' : pendingCount}</div>
              <div className="subsea-kpi-meta flat">Awaiting pay configuration</div>
            </div>
          </div>

          {error && (
            <div className="subsea-alert subsea-alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="subsea-pane">
            <div className="subsea-pane-head">
              <div className="subsea-pane-title">Project Assignments & Pay</div>
            </div>
            <div className="subsea-table-wrap">
              <table className="subsea-table">
                <thead>
                  <tr>
                    <th>Crew Member</th>
                    <th>Project</th>
                    <th>Start Date</th>
                    <th>Finish Date</th>
                    <th>Rate Type</th>
                    <th>Pay Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="subsea-table-empty">
                        Loading payroll records…
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="subsea-table-empty">
                        {rows.length === 0
                          ? 'No crew project assignments found. Assign crew to projects first.'
                          : 'No records match your search or filter.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={`${row.crewId}:${row.projectId}`}>
                        <td>
                          <button
                            type="button"
                            className="subsea-link-btn"
                            onClick={() => navigate(`/crew/${row.crewId}`)}
                          >
                            {row.crewName}
                          </button>
                        </td>
                        <td>{row.projectTitle}</td>
                        <td>{formatDate(row.startDate)}</td>
                        <td>{formatDate(row.endDate)}</td>
                        <td>
                          {row.payRecord ? (
                            <span
                              className={[
                                'payroll-rate-badge',
                                payRateTypeBadgeClass(row.payRecord.rateType),
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {payRateTypeLabel(row.payRecord.rateType)}
                            </span>
                          ) : (
                            <span className="payroll-empty-pay">Not set</span>
                          )}
                        </td>
                        <td>
                          {row.payRecord ? (
                            <span className="payroll-amount strong">{formatPayAmount(row.payRecord.payAmount)}</span>
                          ) : (
                            <span className="payroll-empty-pay">—</span>
                          )}
                        </td>
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="subsea-btn subsea-btn-default subsea-btn-sm"
                              onClick={() => openEditPayModal(row)}
                            >
                              <Pencil size={12} /> {row.payRecord ? 'Update' : 'Add Pay'}
                            </button>
                            {row.payRecord && (
                              <button
                                type="button"
                                className="subsea-btn subsea-btn-default subsea-btn-sm"
                                disabled={deleteLoadingId === row.payRecord.id}
                                onClick={() => handleDeletePay(row)}
                                aria-label={`Delete pay for ${row.crewName}`}
                              >
                                <Trash2 size={12} /> {deleteLoadingId === row.payRecord.id ? '…' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredRows.length > pageSize && (
              <div className="subsea-pagination">
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="subsea-page-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal
        isOpen={payModalOpen}
        onClose={closePayModal}
        title={editingRow?.payRecord ? 'Update Pay' : 'Set Pay'}
        size="medium"
        variant="subsea"
      >
        <form className="payroll-form-grid" onSubmit={handleSavePay}>
          <div className="payroll-form-field">
            <label htmlFor="payroll-crew">Crew Member</label>
            <select
              id="payroll-crew"
              value={formCrewId}
              disabled={Boolean(editingRow) || saveLoading}
              onChange={(e) => setFormCrewId(e.target.value)}
            >
              {uniqueCrewOptions.length === 0 ? (
                <option value="">No crew available</option>
              ) : (
                uniqueCrewOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="payroll-form-field">
            <label htmlFor="payroll-project">Project</label>
            <select
              id="payroll-project"
              value={formProjectId}
              disabled={Boolean(editingRow) || saveLoading || projectOptionsForCrew.length === 0}
              onChange={(e) => setFormProjectId(e.target.value)}
            >
              {projectOptionsForCrew.length === 0 ? (
                <option value="">No projects for this crew member</option>
              ) : (
                projectOptionsForCrew.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="payroll-form-field">
            <label htmlFor="payroll-rate-type">Rate Type</label>
            <select
              id="payroll-rate-type"
              value={formPayRateType}
              disabled={saveLoading}
              onChange={(e) => setFormPayRateType(e.target.value as PayRateType)}
            >
              {PAY_RATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="payroll-form-field">
            <label htmlFor="payroll-amount">
              Pay Amount ({payRateTypeUnitLabel(formPayRateType)})
            </label>
            <input
              id="payroll-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formPayAmount}
              disabled={saveLoading}
              onChange={(e) => setFormPayAmount(e.target.value)}
              required
            />
          </div>

          {saveError && (
            <div className="subsea-alert subsea-alert-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="payroll-form-actions">
            <button type="button" className="subsea-btn subsea-btn-default" onClick={closePayModal} disabled={saveLoading}>
              Cancel
            </button>
            <button type="submit" className="subsea-btn subsea-btn-primary" disabled={saveLoading}>
              {saveLoading ? 'Saving…' : editingRow?.payRecord ? 'Update Pay' : 'Add Pay'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PayrollPage;
