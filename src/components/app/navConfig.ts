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
  UserPlus,
  UserCheck,
  Search,
  AlertTriangle,
  CircleDollarSign,
  Ban,
  CheckSquare,
  Kanban,
} from 'lucide-react';
import {
  ADMIN_COMMAND_PAGES,
  CREW_PANEL_COMMAND_PAGES,
  SUPERADMIN_COMMAND_PAGES,
  type CommandPalettePage,
} from '../../config/commandPalette';

export type AppPortal = 'admin' | 'crew' | 'superadmin';

export interface NavChild {
  icon?: LucideIcon;
  label: string;
  path: string;
}

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  /** Exact match for path (dashboard roots). */
  end?: boolean;
  children?: NavChild[];
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
    {
      icon: Users,
      label: 'Crew',
      path: '/crew',
      children: [
        { icon: UserPlus, label: 'Available', path: '/crew?view=available' },
        { icon: UserCheck, label: 'In Project', path: '/crew?view=inProject' },
        { icon: CalendarRange, label: 'Search Availability', path: '/crew?view=availability' },
      ],
    },
    {
      icon: Plane,
      label: 'Flight Bookings',
      path: '/tickets',
      children: [
        { icon: Ticket, label: 'Active Bookings', path: '/tickets?tab=all' },
        { icon: Search, label: 'Search Flights', path: '/tickets?tab=search' },
        { icon: AlertTriangle, label: 'Pending Approval', path: '/tickets?tab=pending' },
        { icon: Ban, label: 'Cancelled', path: '/tickets?tab=cancelled' },
        { icon: CircleDollarSign, label: 'Report Spends', path: '/tickets?tab=spends' },
      ],
    },
    {
      icon: Anchor,
      label: 'Projects',
      path: '/projects',
      children: [
        { icon: FolderKanban, label: 'All Projects', path: '/projects?status=all' },
        { icon: CheckSquare, label: 'Active', path: '/projects?status=active' },
        { icon: AlertTriangle, label: 'At Risk', path: '/projects?status=at-risk' },
        { icon: BadgeCheck, label: 'Completed', path: '/projects?status=completed' },
        { icon: Kanban, label: 'Board view', path: '/projects?status=all&layout=board' },
      ],
    },
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

function pathOnly(path: string): string {
  return path.split('?')[0] ?? path;
}

export function titleForPath(config: PortalNavConfig, pathname: string, search = ''): string {
  for (const item of config.items) {
    if (item.children) {
      const child = item.children.find((c) => {
        const [p, q] = c.path.split('?');
        if (p !== pathname) return false;
        if (!q) return true;
        const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        const expected = new URLSearchParams(q);
        for (const [k, v] of expected.entries()) {
          if (params.get(k) !== v) return false;
        }
        return true;
      });
      if (child) return child.label;
    }
  }
  const exact = config.items.find((item) => item.end && pathname === pathOnly(item.path));
  if (exact) return exact.label;
  const match = config.items
    .filter((item) => !item.end && (pathname === pathOnly(item.path) || pathname.startsWith(`${pathOnly(item.path)}/`)))
    .sort((a, b) => pathOnly(b.path).length - pathOnly(a.path).length)[0];
  return match?.label ?? config.brand;
}
