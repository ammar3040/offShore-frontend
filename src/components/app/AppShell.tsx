import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { CommandPaletteProvider, getModKeyLabel, useCommandPaletteOpen } from '../CommandPalette';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useAppTheme, type AppTheme } from '@/lib/useAppTheme';
import { clearAccessToken, getAdminUserFromToken } from '@/lib/auth';
import { clearCrewSession, getStoredCrewPanelUser } from '@/lib/crewPanelAuth';
import { clearSuperadminSession } from '@/lib/superadminAuth';
import { titleForPath, type PortalNavConfig } from './navConfig';

interface AppShellProps {
  config: PortalNavConfig;
  children?: ReactNode;
}

function ShellTopActions({
  config,
  theme,
  toggleTheme,
}: {
  config: PortalNavConfig;
  theme: AppTheme;
  toggleTheme: () => void;
}) {
  const openPalette = useCommandPaletteOpen();
  const navigate = useNavigate();
  const modKey = useMemo(() => getModKeyLabel(), []);

  const userLabel = useMemo(() => {
    if (config.portal === 'admin') {
      const user = getAdminUserFromToken();
      return user?.name || user?.email || 'Admin';
    }
    if (config.portal === 'crew') {
      return getStoredCrewPanelUser()?.email || 'Crew';
    }
    return 'Superadmin';
  }, [config.portal]);

  const handleLogout = () => {
    if (config.portal === 'admin') clearAccessToken();
    else if (config.portal === 'crew') clearCrewSession();
    else clearSuperadminSession();
    navigate(config.loginPath);
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden gap-2 text-muted-foreground sm:inline-flex"
        onClick={openPalette}
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="pointer-events-none rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {modKey}+K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="sm:hidden"
        onClick={openPalette}
        aria-label="Open search"
      >
        <Search className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <div className="hidden max-w-[140px] truncate text-sm text-muted-foreground md:block" title={userLabel}>
        {userLabel}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

/**
 * Shared labeled-sidebar shell for Admin, Crew, and Superadmin.
 */
export function AppShell({ config, children }: AppShellProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useAppTheme();
  const pageTitle = titleForPath(config, location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const sidebar = (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight">{config.brand}</span>
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
            {config.roleLabel}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="size-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-1.5" aria-label={`${config.roleLabel} navigation`}>
        {config.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, item.end);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <CommandPaletteProvider
      pages={config.commandPages}
      loadEntities={config.loadCommandEntities}
      searchPlaceholder="Search pages…"
    >
      <div className="flex h-svh overflow-hidden bg-background text-foreground">
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
        {sidebar}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight">{pageTitle}</h1>
            </div>
            <ShellTopActions config={config} theme={theme} toggleTheme={toggleTheme} />
          </header>

          <div className={cn('min-h-0 flex-1 overflow-auto', config.portal !== 'admin' && 'p-4 sm:p-5')}>
            {children ?? <Outlet />}
          </div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

export default AppShell;
