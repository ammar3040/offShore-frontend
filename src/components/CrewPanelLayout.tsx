import { type ReactNode } from 'react';
import { AppShell } from './app/AppShell';
import { CREW_NAV } from './app/navConfig';

interface CrewPanelLayoutProps {
  children?: ReactNode;
}

/** Crew panel — shared AppShell (same theme/UX as Admin & Superadmin). */
const CrewPanelLayout = ({ children }: CrewPanelLayoutProps) => {
  return <AppShell config={CREW_NAV}>{children}</AppShell>;
};

export default CrewPanelLayout;
