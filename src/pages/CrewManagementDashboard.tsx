import {
  AlertTriangle,
  Anchor,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import './CrewManagementDashboard.css';

const fleetRows = [
  ['MV Poseidon Rex', 'FPSO', "12°04'N 44°02'E", '18/22', 'Understaffed', 'Jun 3, Djibouti'],
  ['MV Deepwater Alpha', 'DSV', "56°08'N 03°10'E", '24/24', 'Full Crew', 'Jun 8, Aberdeen'],
  ['MV Atlantic Pioneer', 'PSV', "61°30'N 02°05'E", '16/16', 'Full Crew', 'Jun 11, Bergen'],
  ['MV Gulf Endeavour', 'OSV', "29°10'N 88°15'W", '14/14', 'In Transit', 'Jun 5, Houston'],
  ['MV Nordic Surveyor', 'CSV', "70°22'N 24°30'E", '20/20', 'Full Crew', 'Jun 14, Tromsø'],
];

const crewChanges = [
  ['Capt. James Okafor', 'Master', 'MV Deepwater Alpha', 'Sign-On', 'Jun 01', 'LHR→ABZ'],
  ['Erik Haugen', 'Chief Officer', 'MV Nordic Surveyor', 'Sign-Off', 'Jun 02', 'TOS→OSL'],
  ['Priya Nair', '2nd Engineer', 'MV Poseidon Rex', 'Sign-On', 'Jun 03', 'Pending'],
  ['Carlos Mendez', 'DP Operator', 'MV Atlantic Pioneer', 'Sign-On', 'Jun 05', 'GRU→BGO'],
  ['Amir Khalil', 'Chief Engineer', 'MV Gulf Endeavour', 'Sign-Off', 'Jun 07', 'IAH→DXB'],
];

const kpis = [
  { label: 'Total Crew', value: '284', meta: '+12 this month', tone: 'up', bar: '71%', color: 'blue', icon: true },
  { label: 'On Board', value: '198', meta: 'Across 11 vessels', tone: 'flat', bar: '70%', color: 'teal' },
  { label: 'On Leave', value: '62', meta: '22% of fleet', tone: 'flat', bar: '22%', color: 'amber' },
  { label: 'Cert Expiring', value: '14', meta: '3 critical', tone: 'down', bar: '14%', color: 'red' },
  { label: 'Flights Booked', value: '31', meta: 'Next 14 days', tone: 'up', bar: '55%', color: 'teal' },
];

const activity = [
  { icon: Plane, color: 'green', text: 'Capt. Okafor flight confirmed LHR→ABZ · BA1474', meta: '8 min ago · Jun 1, 06:40 dep.' },
  { icon: BadgeCheck, color: 'red', text: 'Erik Haugen STCW Basic Safety cert expires in 18 days', meta: '22 min ago · Renewal due by Jun 19' },
  { icon: Users, color: 'amber', text: 'MV Poseidon Rex crew gap — DP Operator vacancy unfilled', meta: '1 hr ago · Rotation Jun 03' },
  { icon: CircleDollarSign, color: 'blue', text: 'May payroll processed — 284 crew · $1.84M disbursed', meta: '2 hr ago · via Citibank Wire' },
  { icon: FileText, color: 'teal', text: 'Carlos Mendez contract renewed — 9-month extension signed', meta: '4 hr ago · Expires Feb 2026' },
];

const certs = [
  ['18d', 'red', 'Erik Haugen — STCW Basic Safety', 'Jun 19'],
  ['22d', 'red', 'Priya Nair — Medical Fitness', 'Jun 23'],
  ['28d', 'amber', 'Capt. Okafor — GMDSS GOC', 'Jun 29'],
  ['31d', 'amber', 'Carlos Mendez — DP Unlimited', 'Jul 02'],
];

const CrewManagementDashboard = () => {
  return (
    <div className="subsea-shell">
      <nav className="subsea-nav" aria-label="Subseacore modules">
        <button type="button" className="subsea-brand" aria-label="Subseacore">
          <span className="subsea-mark">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17l4-8 4 4 4-6 4 10" />
              <circle cx="12" cy="5" r="2" />
            </svg>
          </span>
        </button>
        <div className="subsea-nav-items">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Users, label: 'Crew Management', badge: true },
            { icon: Ship, label: 'Vessels' },
            { icon: Plane, label: 'Flight Bookings' },
            { icon: Wallet, label: 'Payroll' },
            { icon: FileText, label: 'Contracts' },
            { icon: BadgeCheck, label: 'Documents & Certs', badge: true },
            { divider: true },
            { icon: Radio, label: 'Command Center' },
            { divider: true },
            { icon: Anchor, label: 'Projects' },
            { icon: CalendarDays, label: 'Timeline & Calendar' },
            { divider: true },
            { icon: Bell, label: 'Notifications' },
          ].map((item, index) => {
            if ('divider' in item) return <span key={`divider-${index}`} className="subsea-nav-sep" />;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`subsea-ni${item.active ? ' active' : ''}`}
                aria-label={item.label}
              >
                <Icon size={17} />
                {item.badge && <span className="subsea-ni-badge" />}
                <span className="subsea-ni-tip">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="subsea-nav-foot">
          <button type="button" className="subsea-ni" aria-label="Settings">
            <Settings size={17} />
            <span className="subsea-ni-tip">Settings</span>
          </button>
          <button type="button" className="subsea-ni" aria-label="Help">
            <HelpCircle size={17} />
            <span className="subsea-ni-tip">Help</span>
          </button>
          <div className="subsea-avatar">SK</div>
        </div>
      </nav>

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Dashboard</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search crew, vessels..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link active">
            <LayoutDashboard size={13} /> Fleet Overview <span className="subsea-sb-count">Live</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <Ship size={13} /> Vessel Fleet <span className="subsea-sb-count">11</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <Users size={13} /> Crew Roster <span className="subsea-sb-count">284</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <Plane size={13} /> Flight Bookings <span className="subsea-sb-count">31</span>
          </button>
          <div className="subsea-sb-group">Compliance</div>
          <button type="button" className="subsea-sb-link">
            <BadgeCheck size={13} /> Certifications <span className="subsea-sb-count subsea-sb-count-red">14</span>
          </button>
          <button type="button" className="subsea-sb-link">
            <ShieldCheck size={13} /> Audit Logs
          </button>
          <div className="subsea-sb-group">Projects</div>
          <button type="button" className="subsea-sb-link">
            <Anchor size={13} /> Active Projects <span className="subsea-sb-count">9</span>
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Dashboard</span>
          </div>
          <div className="subsea-sync-pill"><span className="subsea-sync-dot" />GMDSS Online · 14:32 UTC</div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm">
              <Plus size={12} /> New
            </button>
            <span className="subsea-vr" />
            <div className="subsea-avatar subsea-avatar-sm">SK</div>
          </div>
        </div>

        <main className="subsea-content">
          <section className="subsea-welcome">
            <div className="subsea-wb-left">
              <div className="subsea-wb-greeting">Good morning</div>
              <div className="subsea-wb-name">Welcome back, <span>Pranav</span> 👋</div>
              <div className="subsea-wb-sub">Here's what's happening across your fleet today — Monday, 19 May 2025</div>
              <div className="subsea-wb-chips">
                <span className="subsea-wb-chip subsea-wb-chip-amber"><AlertTriangle size={12} />5 items need attention</span>
                <span className="subsea-wb-chip subsea-wb-chip-green"><Ship size={12} />11 vessels operational</span>
                <span className="subsea-wb-chip subsea-wb-chip-blue"><Radio size={12} />Open Command Center</span>
              </div>
            </div>
            <div className="subsea-wb-right">
              <div className="subsea-wb-date-block">
                <div className="subsea-wb-date">--:-- UTC</div>
                <div className="subsea-wb-time">Coordinated Universal Time</div>
              </div>
              <div className="subsea-wb-status-row">
                <span className="subsea-wb-status-dot" />
                <span>GMDSS Online · All systems nominal</span>
              </div>
            </div>
          </section>

          <div className="subsea-alert subsea-alert-warn">
            <AlertTriangle size={15} />
            <span><strong>5 items need attention:</strong> 3 crew certifications expiring within 30 days · 1 vessel understaffed (MV Poseidon Rex) · 1 overdue payroll run.</span>
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">Review</button>
          </div>

          <section className="subsea-kpi-strip">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="subsea-kpi">
                <div className="subsea-kpi-label">{kpi.label}</div>
                <div className="subsea-kpi-value">{kpi.value}</div>
                <div className={`subsea-kpi-meta ${kpi.tone}`}>
                  {kpi.icon && <ArrowUpRight size={11} />} {kpi.meta}
                </div>
                <div className="subsea-kpi-bar">
                  <span className={`subsea-kpi-fill ${kpi.color}`} style={{ width: kpi.bar }} />
                </div>
              </article>
            ))}
          </section>

          <section className="subsea-grid-main">
            <div>
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div>
                    <div className="subsea-pane-title">Fleet Status</div>
                    <div className="subsea-pane-sub">11 vessels · live positions</div>
                  </div>
                  <div className="subsea-pane-actions">
                    <span className="subsea-badge subsea-b-teal subsea-b-dot">All systems nominal</span>
                    <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">View Fleet</button>
                  </div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr><th>Vessel</th><th>Type</th><th>Location</th><th>Crew</th><th>Status</th><th>Next Port Call</th></tr>
                    </thead>
                    <tbody>
                      {fleetRows.map(([vessel, type, location, crew, status, port], index) => (
                        <tr key={vessel}>
                          <td className="strong"><Ship size={12} className={`subsea-table-icon subsea-tone-${index % 4}`} />{vessel}</td>
                          <td>{type}</td>
                          <td className="mono">{location}</td>
                          <td><span className={index === 0 ? 'subsea-text-red' : 'subsea-text-green'}>{crew}</span></td>
                          <td><span className={`subsea-badge ${status === 'Understaffed' ? 'subsea-b-amber' : status === 'In Transit' ? 'subsea-b-teal' : 'subsea-b-green'}`}>{status}</span></td>
                          <td className="muted">{port}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Upcoming Crew Changes</div>
                  <div className="subsea-pane-sub">Next 14 days · sign-on / sign-off</div>
                </div>
                <div className="subsea-table-wrap">
                  <table className="subsea-table">
                    <thead>
                      <tr><th>Crew Member</th><th>Rank</th><th>Vessel</th><th>Type</th><th>Date</th><th>Flight</th></tr>
                    </thead>
                    <tbody>
                      {crewChanges.map(([name, rank, vessel, type, date, flight]) => (
                        <tr key={`${name}-${date}`}>
                          <td className="strong">{name}</td>
                          <td>{rank}</td>
                          <td>{vessel}</td>
                          <td><span className={`subsea-badge ${type === 'Sign-Off' ? 'subsea-b-amber' : 'subsea-b-green'}`}>{type}</span></td>
                          <td className="mono">{date}</td>
                          <td><span className={`subsea-badge ${flight === 'Pending' ? 'subsea-b-orange' : 'subsea-b-blue'}`}>{flight}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Live Activity</div>
                  <span className="subsea-badge subsea-b-teal subsea-b-dot">Real-time</span>
                </div>
                <div className="subsea-feed">
                  {activity.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="subsea-feed-item">
                        <div className={`subsea-feed-icon ${item.color}`}><Icon size={13} /></div>
                        <div>
                          <div className="subsea-feed-text">{item.text}</div>
                          <div className="subsea-feed-meta">{item.meta}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="subsea-pane">
                <div className="subsea-pane-head">
                  <div className="subsea-pane-title">Cert Expiry Watchlist</div>
                  <span className="subsea-badge subsea-b-red">14 expiring</span>
                </div>
                <div className="subsea-cert-list">
                  {certs.map(([days, color, name, expires]) => (
                    <div key={name} className="subsea-cert-row">
                      <span className={`subsea-badge subsea-b-${color}`}>{days}</span>
                      <span className="subsea-cert-name">{name}</span>
                      <span className="subsea-cert-expires">{expires}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default CrewManagementDashboard;
