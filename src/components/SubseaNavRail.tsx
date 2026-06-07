import { useNavigate } from 'react-router-dom';
import {
  Anchor,
  BadgeCheck,
  Bell,
  CalendarDays,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Radio,
  Receipt,
  Settings,
  Ship,
  Users,
  Wallet,
} from 'lucide-react';
import { useCommandPaletteOpen } from './CommandPalette';
import { SubseaProfileMenu } from './SubseaProfileMenu';

export type SubseaNavModule =
  | 'dashboard'
  | 'crew'
  | 'rigs'
  | 'tickets'
  | 'payroll'
  | 'contracts'
  | 'documents'
  | 'projects'
  | 'timeline'
  | 'bills';

type NavItem =
  | { divider: true }
  | {
      icon: typeof LayoutDashboard;
      label: string;
      module?: SubseaNavModule;
      path?: string;
      badge?: boolean;
      action?: 'commandPalette';
    };

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard' },
  { icon: Users, label: 'Crew Management', path: '/crew', module: 'crew', badge: true },
  { icon: Ship, label: 'Rigs', path: '/rig', module: 'rigs' },
  { icon: Plane, label: 'Flight Bookings', path: '/tickets', module: 'tickets' },
  { icon: Wallet, label: 'Payroll', path: '/payroll', module: 'payroll' },
  { icon: FileText, label: 'Contracts', path: '/contracts', module: 'contracts' },
  { icon: Receipt, label: 'Bills', path: '/bills', module: 'bills' },
  { icon: BadgeCheck, label: 'Documents & Certs', path: '/documents', module: 'documents', badge: true },
  { divider: true },
  { icon: Radio, label: 'Command Center', action: 'commandPalette' },
  { divider: true },
  { icon: Anchor, label: 'Projects', path: '/projects', module: 'projects' },
  { icon: CalendarDays, label: 'Timeline & Calendar', path: '/timeline', module: 'timeline' },
  { divider: true },
  { icon: Bell, label: 'Notifications' },
];

interface SubseaNavRailProps {
  activeModule?: SubseaNavModule;
}

export function SubseaNavRail({ activeModule }: SubseaNavRailProps) {
  const navigate = useNavigate();
  const openCommandPalette = useCommandPaletteOpen();

  return (
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
        {NAV_ITEMS.map((item, index) => {
          if ('divider' in item) return <span key={`divider-${index}`} className="subsea-nav-sep" />;
          const Icon = item.icon;
          const isActive = item.module != null && item.module === activeModule;
          return (
            <button
              key={item.label}
              type="button"
              className={`subsea-ni${isActive ? ' active' : ''}`}
              aria-label={item.label}
              onClick={() => {
                if (item.action === 'commandPalette') {
                  openCommandPalette();
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
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
        <SubseaProfileMenu />
      </div>
    </nav>
  );
}
