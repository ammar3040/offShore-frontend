import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataPanelProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Consistent loading / empty / error framing for lists and tables. */
export function DataPanel({
  loading,
  error,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  children,
  className,
}: DataPanelProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-muted-foreground',
          className
        )}
        role="status"
      >
        <Loader2 className="size-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive',
          className
        )}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center',
          className
        )}
      >
        <p className="font-medium text-foreground">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
        ) : null}
        {emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
      </div>
    );
  }

  return <div className={cn(className)}>{children ?? null}</div>;
}
