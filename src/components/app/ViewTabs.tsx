import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ViewTabItem {
  id: string;
  label: string;
  count?: string | number;
  countTone?: 'default' | 'danger';
  icon?: ReactNode;
}

interface ViewTabsProps {
  items: ViewTabItem[];
  value: string;
  onChange: (id: string) => void;
  trailing?: ReactNode;
  className?: string;
}

/** Horizontal filter/view tabs — replaces the old page-local sidebars. */
export function ViewTabs({ items, value, onChange, trailing, className }: ViewTabsProps) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.count != null ? (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : item.countTone === 'danger'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-background/80 text-foreground'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
