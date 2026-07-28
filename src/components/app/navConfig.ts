import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Plane,
  Anchor,
  Ship,
  CalendarDays,
  Wallet,
  FileText,
  Receipt,
  BadgeCheck,
  FolderKanban,
  CalendarRange,
  User,
  Settings,
  Ticket,
  ClipboardList,
} from 'lucide-react';
import {
  ADMIN_COMMAND_PAGES,
  CREW_PANEL_COMMAND_PAGES,
  SUPERADMIN_COMMAND_PAGES,
  type CommandPalettePage,
} from '../../config/commandPalette';

export type AppPortal = 'admin' | 'crew' | 'superadmin';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  /** Exact match for path (dashboard roots). */
  end?: boolean;
}

export interface PortalNavConfig {
  portal: AppPortal;
  brand: string;
  roleLabel: string;
  homePath: string;
  loginPath: string;
  items: NavItem[];
  commandPages: CommandPalettePage[];
  loadCommandEntities?: boolean;
}

export const ADMIN_NAV: PortalNavConfig = {
  portal: 'admin',
  brand: 'Offshore CRM',
  roleLabel: 'Admin',
  homePath: '/',
  loginPath: '/login',
  loadCommandEntities: true,
  commandPages: ADMIN_COMMAND_PAGES,
  items: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', end: true },
    { icon: Users, label: 'Crew', path: '/crew' },
    { icon: Plane, label: 'Flight Bookings', path: '/tickets' },
    { icon: Anchor, label: 'Projects', path: '/projects' },
    { icon: Ship, label: 'Rigs', path: '/rig' },
    { icon: CalendarDays, label: 'Timeline', path: '/timeline' },
    { icon: Wallet, label: 'Payroll', path: '/payroll' },
    { icon: FileText, label: 'Contracts', path: '/contracts' },
    { icon: Receipt, label: 'Bills', path: '/bills' },
    { icon: BadgeCheck, label: 'Documents & Certs', path: '/documents' },
  ],
};

export const CREW_NAV: PortalNavConfig = {
  portal: 'crew',
  brand: 'Offshore CRM',
  roleLabel: 'Crew',
  homePath: '/panel/crew/dashboard',
  loginPath: '/login',
  commandPages: CREW_PANEL_COMMAND_PAGES,
  items: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/crew/dashboard', end: true },
    { icon: FolderKanban, label: 'Enrolled Projects', path: '/panel/crew/enrolled-projects' },
    { icon: CalendarRange, label: 'Availability', path: '/panel/crew/availability' },
    { icon: User, label: 'Profile', path: '/panel/crew/profile' },
    { icon: Settings, label: 'Settings', path: '/panel/crew/settings' },
    { icon: Ticket, label: 'Tickets', path: '/panel/crew/tickets' },
    { icon: ClipboardList, label: 'Timesheet', path: '/panel/crew/timesheet' },
  ],
};

export const SUPERADMIN_NAV: PortalNavConfig = {
  portal: 'superadmin',
  brand: 'Offshore CRM',
  roleLabel: 'Superadmin',
  homePath: '/panel/superadmin/dashboard',
  loginPath: '/login',
  commandPages: SUPERADMIN_COMMAND_PAGES,
  items: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/superadmin/dashboard', end: true },
    { icon: Users, label: 'Admins', path: '/panel/superadmin/admins' },
    { icon: Ticket, label: 'Crew Tickets', path: '/panel/superadmin/tickets' },
    { icon: Receipt, label: 'Admin Invoices', path: '/panel/superadmin/admin-invoice' },
  ],
};

export function titleForPath(config: PortalNavConfig, pathname: string): string {
  const exact = config.items.find((item) => item.end && pathname === item.path);
  if (exact) return exact.label;
  const match = config.items
    .filter((item) => !item.end && (pathname === item.path || pathname.startsWith(`${item.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? config.brand;
}
