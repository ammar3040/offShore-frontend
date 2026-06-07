import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Anchor,
  Ship,
  CalendarDays,
  Plane,
  Wallet,
  FileText,
  Receipt,
  BadgeCheck,
  FolderKanban,
  User,
  Settings,
  Ticket,
  ClipboardList,
  CalendarRange,
} from 'lucide-react';

export interface CommandPalettePage {
  label: string;
  path: string;
  keywords?: string;
  icon: LucideIcon;
}

export interface CommandPaletteEntity {
  id: string;
  label: string;
  path: string;
  group: 'Crew' | 'Projects' | 'Rigs';
  keywords?: string;
}

export const ADMIN_COMMAND_PAGES: CommandPalettePage[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', keywords: 'home overview' },
  { icon: Users, label: 'Crew Management', path: '/crew', keywords: 'crew members people' },
  { icon: Anchor, label: 'Projects', path: '/projects', keywords: 'project jobs' },
  { icon: Ship, label: 'Rigs', path: '/rig', keywords: 'rig vessel offshore' },
  { icon: CalendarDays, label: 'Timeline & Calendar', path: '/timeline', keywords: 'calendar schedule' },
  { icon: Plane, label: 'Flight Bookings', path: '/tickets', keywords: 'flights tickets travel' },
  { icon: Wallet, label: 'Payroll', path: '/payroll', keywords: 'pay salary wages' },
  { icon: FileText, label: 'Contracts', path: '/contracts', keywords: 'agreements documents' },
  { icon: Receipt, label: 'Bills', path: '/bills', keywords: 'invoices billing' },
  { icon: BadgeCheck, label: 'Documents & Certs', path: '/documents', keywords: 'certifications certificates expiry' },
];

export const CREW_PANEL_COMMAND_PAGES: CommandPalettePage[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/crew/dashboard', keywords: 'home overview' },
  { icon: FolderKanban, label: 'Enrolled Projects', path: '/panel/crew/enrolled-projects', keywords: 'projects jobs' },
  { icon: CalendarRange, label: 'Availability', path: '/panel/crew/availability', keywords: 'calendar schedule' },
  { icon: User, label: 'Profile', path: '/panel/crew/profile', keywords: 'account me' },
  { icon: Settings, label: 'Settings', path: '/panel/crew/settings', keywords: 'preferences config' },
  { icon: Ticket, label: 'Tickets', path: '/panel/crew/tickets', keywords: 'flights travel' },
  { icon: ClipboardList, label: 'Timesheet', path: '/panel/crew/timesheet', keywords: 'hours time' },
];

export const SUPERADMIN_COMMAND_PAGES: CommandPalettePage[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/panel/superadmin/dashboard', keywords: 'home overview' },
  { icon: Users, label: 'Admins', path: '/panel/superadmin/admins', keywords: 'administrators users' },
  { icon: Ticket, label: 'Crew Tickets', path: '/panel/superadmin/tickets', keywords: 'flights travel' },
  { icon: Receipt, label: 'Admin Invoices', path: '/panel/superadmin/admin-invoice', keywords: 'billing invoices' },
];

export function getModKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
}

export function pageSearchValue(page: CommandPalettePage): string {
  return [page.label, page.keywords].filter(Boolean).join(' ');
}

export function entitySearchValue(entity: CommandPaletteEntity): string {
  return [entity.label, entity.group, entity.keywords].filter(Boolean).join(' ');
}
