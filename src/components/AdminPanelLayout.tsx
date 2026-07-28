import { AppShell } from './app/AppShell';
import { ADMIN_NAV } from './app/navConfig';

/** Admin CRM layout — shared AppShell with labeled sidebar. */
export default function AdminPanelLayout() {
  return <AppShell config={ADMIN_NAV} />;
}
