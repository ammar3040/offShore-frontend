import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderKanban, Ship, Ticket, Percent, Plus, BadgeDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { getSuperadminAnalytics, updateSuperadminSettings } from '../api/superadmin';
import { fetchRates, convert, type CurrencyCode } from '../lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import './SuperadminDashboard.css';

const CURRENCY_LABELS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'INR', label: 'INR', symbol: '₹' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCY_LABELS.find((c) => c.value === code)?.symbol ?? code;
}

const SuperadminDashboard = () => {
  const [settings, setSettings] = useState<{
    baseCurrency: CurrencyCode;
    markupGBP: number | null;
    cashbackGBP: number | null;
  }>({ baseCurrency: 'GBP', markupGBP: null, cashbackGBP: null });
  const [rates, setRates] = useState<Record<CurrencyCode, number> | null>(null);
  const [showMarkupForm, setShowMarkupForm] = useState(false);
  const [markupInput, setMarkupInput] = useState('');
  const [markupSaving, setMarkupSaving] = useState(false);
  const [showCashbackForm, setShowCashbackForm] = useState(false);
  const [cashbackInput, setCashbackInput] = useState('');
  const [cashbackSaving, setCashbackSaving] = useState(false);
  const [analytics, setAnalytics] = useState<import('../api/superadmin').AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fallbackRates: Record<CurrencyCode, number> = { GBP: 1, USD: 1.27, INR: 105 };
    Promise.all([
      getSuperadminAnalytics(),
      fetchRates().catch(() => fallbackRates),
    ])
      .then(([analyticsData, ratesData]) => {
        if (!cancelled) {
          setAnalytics(analyticsData);
          setRates(ratesData);
          setSettings({
            baseCurrency: analyticsData.baseCurrency ?? 'GBP',
            markupGBP: analyticsData.markup ?? null,
            cashbackGBP: analyticsData.cashback ?? null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setAnalytics({
            totalAdmins: 0,
            activeAdmins: 0,
            totalProjects: 0,
            totalCrew: 0,
            totalTickets: 0,
          });
          setRates(fallbackRates);
          setSettings({ baseCurrency: 'GBP', markupGBP: null, cashbackGBP: null });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCurrencyChange = useCallback((newCurrency: CurrencyCode) => {
    if (!settings) return;
    if (settings.baseCurrency === newCurrency) return;
    setSettings((s) => ({ ...s, baseCurrency: newCurrency }));
  }, [settings]);

  const stats = [
    {
      icon: Users,
      label: 'TOTAL ADMINS',
      value: loading ? '…' : (analytics?.totalAdmins ?? 0),
      iconClass: 'superadmin-dash-icon--amber',
    },
    {
      icon: Users,
      label: 'ACTIVE ADMINS',
      value: loading ? '…' : (analytics?.activeAdmins ?? 0),
      iconClass: 'superadmin-dash-icon--green',
    },
    {
      icon: FolderKanban,
      label: 'TOTAL PROJECTS',
      value: loading ? '…' : (analytics?.totalProjects ?? 0),
      iconClass: 'superadmin-dash-icon--blue',
    },
    {
      icon: Ship,
      label: 'TOTAL CREW',
      value: loading ? '…' : (analytics?.totalCrew ?? 0),
      iconClass: 'superadmin-dash-icon--purple',
    },
    {
      icon: Ticket,
      label: 'TOTAL TICKETS',
      value: loading ? '…' : (analytics?.totalTickets ?? 0),
      iconClass: 'superadmin-dash-icon--orange',
    },
  ];

  const adminsByActivity = analytics?.adminsByActivity ?? [];
  const symbol = getCurrencySymbol(settings.baseCurrency);

  const displayMarkup = rates && settings.markupGBP != null
    ? convert(settings.markupGBP, 'GBP', settings.baseCurrency, rates)
    : settings.markupGBP;
  const displayCashback = rates && settings.cashbackGBP != null
    ? convert(settings.cashbackGBP, 'GBP', settings.baseCurrency, rates)
    : settings.cashbackGBP;

  const handleSaveMarkup = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(markupInput.trim());
    if (isNaN(value) || value < 0) {
      toast.error('Invalid markup', { description: 'Please enter a valid positive number.' });
      return;
    }
    if (!rates) return;
    const gbpValue = convert(value, settings.baseCurrency, 'GBP', rates);
    setMarkupSaving(true);
    try {
      const res = await updateSuperadminSettings({ markup: gbpValue });
      setSettings((s) => ({ ...s, markupGBP: res?.superAdmin?.markup ?? gbpValue }));
      setShowMarkupForm(false);
      setMarkupInput('');
      toast.success('Markup updated', { description: 'Markup saved successfully.' });
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Failed to update markup.' });
    } finally {
      setMarkupSaving(false);
    }
  };

  const handleSaveCashback = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(cashbackInput.trim());
    if (isNaN(value) || value < 0) {
      toast.error('Invalid cashback', { description: 'Please enter a valid positive number.' });
      return;
    }
    if (!rates) return;
    const gbpValue = convert(value, settings.baseCurrency, 'GBP', rates);
    setCashbackSaving(true);
    try {
      const res = await updateSuperadminSettings({ cashback: gbpValue });
      setSettings((s) => ({ ...s, cashbackGBP: res?.superAdmin?.cashback ?? gbpValue }));
      setShowCashbackForm(false);
      setCashbackInput('');
      toast.success('Cashback updated', { description: 'Cashback saved successfully.' });
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Failed to update cashback.' });
    } finally {
      setCashbackSaving(false);
    }
  };

  const openMarkupForm = () => {
    if (rates && settings.markupGBP != null) {
      setMarkupInput(String(convert(settings.markupGBP, 'GBP', settings.baseCurrency, rates)));
    } else {
      setMarkupInput('');
    }
    setShowMarkupForm(true);
  };

  const openCashbackForm = () => {
    if (rates && settings.cashbackGBP != null) {
      setCashbackInput(String(convert(settings.cashbackGBP, 'GBP', settings.baseCurrency, rates)));
    } else {
      setCashbackInput('');
    }
    setShowCashbackForm(true);
  };

  return (
    <div className="superadmin-dashboard">
      <header className="superadmin-dashboard-header">
        <div>
          <h1 className="superadmin-dashboard-greeting">{getGreeting()}, Superadmin</h1>
          <p className="superadmin-dashboard-date">Today is {formatDate(new Date())}.</p>
        </div>
        {rates && (
          <div className="superadmin-base-currency">
            <label htmlFor="base-currency" className="superadmin-base-currency-label">
              Base currency
            </label>
            <Select value={settings.baseCurrency} onValueChange={(v) => handleCurrencyChange(v as CurrencyCode)}>
              <SelectTrigger id="base-currency" className="w-[180px]">
                <SelectValue placeholder="Base currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LABELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="superadmin-base-currency-hint">All values in this currency</span>
          </div>
        )}
      </header>

      {error && (
        <div className="superadmin-dashboard-error" role="alert">
          {error}
        </div>
      )}

      <div className="superadmin-dashboard-cards">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="superadmin-dash-card">
              <div className={`superadmin-dash-card-icon ${s.iconClass}`}>
                <Icon size={24} />
              </div>
              <div className="superadmin-dash-card-content">
                <span className="superadmin-dash-card-value">{s.value}</span>
                <span className="superadmin-dash-card-label">{s.label}</span>
              </div>
            </Card>
          );
        })}
        <Card className="superadmin-dash-card superadmin-dash-card-markup">
          <div className="superadmin-dash-card-icon superadmin-dash-icon--teal">
            <Percent size={24} />
          </div>
          <div className="superadmin-dash-card-content">
            {showMarkupForm ? (
              <form className="superadmin-markup-form" onSubmit={handleSaveMarkup}>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={markupInput}
                  onChange={(e) => setMarkupInput(e.target.value)}
                  placeholder={`e.g. 15.50 in ${settings.baseCurrency}`}
                  className="superadmin-markup-input"
                  autoFocus
                  disabled={markupSaving}
                />
                <span className="superadmin-input-currency-hint">{symbol} {settings.baseCurrency}</span>
                <div className="superadmin-markup-actions">
                  <Button type="submit" size="sm" disabled={markupSaving}>
                    {markupSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowMarkupForm(false); setMarkupInput(''); }}
                    disabled={markupSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <span className="superadmin-dash-card-value">
                  {displayMarkup != null ? `${symbol}${displayMarkup.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
                <span className="superadmin-dash-card-label">MARKUP</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="superadmin-markup-add-btn"
                  onClick={openMarkupForm}
                  title="Add markup"
                  aria-label="Add markup"
                >
                  <Plus size={14} />
                  Add Markup
                </Button>
              </>
            )}
          </div>
        </Card>
        <Card className="superadmin-dash-card superadmin-dash-card-cashback">
          <div className="superadmin-dash-card-icon superadmin-dash-icon--emerald">
            <BadgeDollarSign size={24} />
          </div>
          <div className="superadmin-dash-card-content">
            {showCashbackForm ? (
              <form className="superadmin-markup-form" onSubmit={handleSaveCashback}>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cashbackInput}
                  onChange={(e) => setCashbackInput(e.target.value)}
                  placeholder={`e.g. 5.00 in ${settings.baseCurrency}`}
                  className="superadmin-markup-input superadmin-cashback-input"
                  autoFocus
                  disabled={cashbackSaving}
                />
                <span className="superadmin-input-currency-hint superadmin-input-currency-hint--cashback">{symbol} {settings.baseCurrency}</span>
                <div className="superadmin-markup-actions">
                  <Button type="submit" size="sm" className="superadmin-cashback-save" disabled={cashbackSaving}>
                    {cashbackSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowCashbackForm(false); setCashbackInput(''); }}
                    disabled={cashbackSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <span className="superadmin-dash-card-value">
                  {displayCashback != null ? `${symbol}${displayCashback.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
                <span className="superadmin-dash-card-label">CASHBACK</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="superadmin-markup-add-btn superadmin-cashback-add-btn"
                  onClick={openCashbackForm}
                  title="Add cashback"
                  aria-label="Add cashback"
                >
                  <Plus size={14} />
                  Add Cashback
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="superadmin-dashboard-panels">
        <Card className="superadmin-dashboard-panel">
          <div className="superadmin-panel-header">
            <h2 className="superadmin-panel-title">Admins by Activity</h2>
            <Link to="/panel/superadmin/admins" className="superadmin-panel-view-all">
              View All Admins
            </Link>
          </div>
          <div className="superadmin-panel-body">
            {loading ? (
              <p className="superadmin-panel-empty">Loading…</p>
            ) : adminsByActivity.length === 0 ? (
              <p className="superadmin-panel-empty">
                No admin activity data yet. Admins will appear here as they manage projects and crew.
              </p>
            ) : (
              <ul className="superadmin-admins-list">
                {adminsByActivity.slice(0, 8).map((a) => (
                  <li key={a.adminId} className="superadmin-admin-item">
                    <span className="superadmin-admin-email">{a.email}</span>
                    <div className="superadmin-admin-stats">
                      <span className="superadmin-admin-stat">{a.projectsCount} projects</span>
                      <span className="superadmin-admin-stat">{a.crewCount} crew</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="superadmin-dashboard-panel">
          <div className="superadmin-panel-header">
            <h2 className="superadmin-panel-title">Quick Actions</h2>
          </div>
          <div className="superadmin-panel-body">
            <nav className="superadmin-quick-actions">
              <Link to="/panel/superadmin/admins" className="superadmin-quick-link">
                <Users size={20} />
                Create Admin
              </Link>
              <Link to="/panel/superadmin/tickets" className="superadmin-quick-link">
                <Ticket size={20} />
                View Crew Tickets
              </Link>
            </nav>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SuperadminDashboard;
