import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';
import {
  type CommandPaletteEntity,
  type CommandPalettePage,
  entitySearchValue,
  getModKeyLabel,
  pageSearchValue,
} from '../config/commandPalette';
import { getCrewList } from '../api/crew';
import { getProjects } from '../api/project';
import { getRigs } from '../api/rig';
import './CommandPalette.css';

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPaletteOpen(): () => void {
  const ctx = useContext(CommandPaletteContext);
  return ctx?.open ?? (() => {});
}

function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onOpen]);
}

interface CommandPaletteProps {
  pages: CommandPalettePage[];
  entities?: CommandPaletteEntity[];
  entitiesLoading?: boolean;
  searchPlaceholder?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CommandPalette({
  pages,
  entities = [],
  entitiesLoading = false,
  searchPlaceholder = 'Search...',
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback(
    (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange]
  );

  const entityGroups = useMemo(() => {
    const groups = new Map<CommandPaletteEntity['group'], CommandPaletteEntity[]>();
    for (const entity of entities) {
      const list = groups.get(entity.group) ?? [];
      list.push(entity);
      groups.set(entity.group, list);
    }
    return groups;
  }, [entities]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="command-palette-dialog"
      commandClassName="command-palette-command"
      overlayClassName="command-palette-overlay"
    >
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.path}
                value={pageSearchValue(page)}
                onSelect={() => handleSelect(page.path)}
              >
                <Icon />
                <span>{page.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {(entitiesLoading || entities.length > 0) && (
          <>
            <CommandSeparator />
            {entitiesLoading ? (
              <div className="command-palette-loading flex items-center justify-center gap-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading crew, projects, and rigs...
              </div>
            ) : (
              Array.from(entityGroups.entries()).map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((entity) => (
                    <CommandItem
                      key={`${group}-${entity.id}`}
                      value={entitySearchValue(entity)}
                      onSelect={() => handleSelect(entity.path)}
                    >
                      <span>{entity.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

interface CommandPaletteProviderProps {
  pages: CommandPalettePage[];
  loadEntities?: boolean;
  searchPlaceholder?: string;
  children: ReactNode;
}

export function CommandPaletteProvider({
  pages,
  loadEntities = false,
  searchPlaceholder = 'Search pages...',
  children,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<CommandPaletteEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const entitiesLoadedRef = useRef(false);

  const openPalette = useCallback(() => setOpen(true), []);
  useCommandPaletteShortcut(openPalette);

  useEffect(() => {
    if (!open || !loadEntities || entitiesLoadedRef.current) return;

    let cancelled = false;
    setEntitiesLoading(true);

    Promise.all([getCrewList(), getProjects(), getRigs()])
      .then(([crewRes, projectsRes, rigsRes]) => {
        if (cancelled) return;
        const items: CommandPaletteEntity[] = [
          ...crewRes.crew.map((crew) => ({
            id: crew.id,
            label: `${crew.firstname} ${crew.lastname}`.trim(),
            path: `/crew/${crew.id}`,
            group: 'Crew' as const,
            keywords: crew.email,
          })),
          ...projectsRes.projects.map((project) => ({
            id: project.id,
            label: project.title,
            path: `/projects/${project.id}`,
            group: 'Projects' as const,
            keywords: project.description,
          })),
          ...rigsRes.rigs.map((rig) => ({
            id: rig.id,
            label: rig.name,
            path: `/rig/${rig.id}`,
            group: 'Rigs' as const,
            keywords: rig.address,
          })),
        ];
        setEntities(items);
        entitiesLoadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEntitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loadEntities]);

  const contextValue = useMemo(() => ({ open: openPalette }), [openPalette]);

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        pages={pages}
        entities={loadEntities ? entities : undefined}
        entitiesLoading={loadEntities ? entitiesLoading : false}
        searchPlaceholder={searchPlaceholder}
        open={open}
        onOpenChange={setOpen}
      />
    </CommandPaletteContext.Provider>
  );
}

export { getModKeyLabel };
