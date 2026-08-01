import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { CommandPaletteProvider, getModKeyLabel, useCommandPaletteOpen } from '../CommandPalette';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useAppTheme, type AppTheme } from '@/lib/useAppTheme';
import { clearAccessToken, getAdminUserFromToken } from '@/lib/auth';
import { clearCrewSession, getStoredCrewPanelUser } from '@/lib/crewPanelAuth';
import { clearSuperadminSession } from '@/lib/superadminAuth';
import { titleForPath, type NavItem, type PortalNavConfig } from './navConfig';

interface AppShellProps {
  config: PortalNavConfig;
  children?: ReactNode;
}

function pathOnly(path: string): string {
  return path.split('?')[0] ?? path;
}

function childMatches(childPath: string, pathname: string, search: string): boolean {
  const [p, q] = childPath.split('?');
  if (p !== pathname) return false;
  if (!q) return search === '' || search === '?';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const expected = new URLSearchParams(q);
  for (const [k, v] of expected.entries()) {
    if (params.get(k) !== v) return false;
  }
  return true;
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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-9 gap-2 rounded-full border-border/80 bg-card text-muted-foreground shadow-none sm:inline-flex"
        onClick={openPalette}
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="pointer-events-none rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          {modKey}+K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-full sm:hidden"
        onClick={openPalette}
        aria-label="Open search"
      >
        <Search className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-full"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-card px-2.5 py-1.5 md:flex">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {userLabel.slice(0, 1).toUpperCase()}
        </div>
        <span className="max-w-[120px] truncate text-sm font-medium" title={userLabel}>
          {userLabel}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="h-9 gap-1.5 rounded-full shadow-none"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

function NavDropdownItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const navigate = useNavigate();
  const base = pathOnly(item.path);
  const onSection =
    location.pathname === base || location.pathname.startsWith(`${base}/`);
  const childActive = item.children?.some((c) =>
    childMatches(c.path, location.pathname, location.search)
  );
  const [open, setOpen] = useState(Boolean(onSection || childActive));

  useEffect(() => {
    if (onSection || childActive) setOpen(true);
  }, [onSection, childActive]);

  const Icon = item.icon;
  const parentActive = onSection || childActive;

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !onSection) navigate(item.path);
        }}
        className={cn(
          'group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-all duration-200',
          parentActive
            ? 'bg-white text-primary shadow-sm ring-1 ring-primary/15'
            : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 hover:shadow-sm'
        )}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
            parentActive
              ? 'bg-primary text-white shadow-sm shadow-primary/25'
              : 'bg-slate-100/80 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-200',
            parentActive ? 'text-primary/70' : 'text-slate-400',
            open && 'rotate-180'
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-4 space-y-0.5 border-l-2 border-primary/15 py-1 pl-3">
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const active = childMatches(child.path, location.pathname, location.search);
              return (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150',
                    active
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-500 hover:bg-white/90 hover:text-primary'
                  )}
                >
                  {ChildIcon ? <ChildIcon className="size-3.5 shrink-0 opacity-90" /> : null}
                  <span className="truncate">{child.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared labeled-sidebar shell for Admin, Crew, and Superadmin.
 * Theme: blue / white (v4) — cooler sidebar chrome + dropdowns.
 */
export function AppShell({ config, children }: AppShellProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useAppTheme();
  const pageTitle = titleForPath(config, location.pathname, location.search);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const isActive = (path: string, end?: boolean) => {
    const base = pathOnly(path);
    if (end) return location.pathname === base;
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };

  const sidebar = (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sky-100/80 bg-gradient-to-b from-[#F8FBFF] via-[#F3F7FD] to-[#EEF3FB] text-sidebar-foreground transition-transform duration-200 ease-out lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sky-100/90 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-md shadow-primary/30">
          O
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-tight text-slate-900">{config.brand}</div>
          <div className="text-[11px] font-medium text-primary/80">{config.roleLabel} portal</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="size-4" />
        </Button>
      </div>

      <p className="px-4 pt-4 pb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
        Main menu
      </p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5" aria-label={`${config.roleLabel} navigation`}>
        {config.items.map((item) => {
          if (item.children?.length) {
            return <NavDropdownItem key={item.path} item={item} />;
          }
          const Icon = item.icon;
          const active = isActive(item.path, item.end);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-white text-primary shadow-sm ring-1 ring-primary/15'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 hover:shadow-sm'
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                  active
                    ? 'bg-primary text-white shadow-sm shadow-primary/25'
                    : 'bg-slate-100/80 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-sky-100 bg-white/70 px-3 py-2.5 text-[11px] text-slate-500 shadow-sm backdrop-blur-sm">
        <span className="font-semibold text-primary">Tip:</span> Press{' '}
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">Ctrl+K</kbd> to search
      </div>
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
            className="fixed inset-0 z-30 bg-black/30 transition-opacity lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
        {sidebar}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card/80 px-4 backdrop-blur-sm sm:px-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{pageTitle}</h1>
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
