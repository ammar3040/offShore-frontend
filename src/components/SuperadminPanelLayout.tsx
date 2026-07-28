import { type ReactNode } from 'react';
import { AppShell } from './app/AppShell';
import { SUPERADMIN_NAV } from './app/navConfig';

interface SuperadminPanelLayoutProps {
  children?: ReactNode;
}

/** Superadmin panel — shared AppShell (same theme/UX as Admin & Crew). */
const SuperadminPanelLayout = ({ children }: SuperadminPanelLayoutProps) => {
  return <AppShell config={SUPERADMIN_NAV}>{children}</AppShell>;
};

export default SuperadminPanelLayout;
