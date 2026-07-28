import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5', className)}>
      <div className="space-y-1 border-b border-border pb-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface FormStickyActionsProps {
  children: ReactNode;
  className?: string;
}

/** Sticky save/cancel bar for long forms. */
export function FormStickyActions({ children, className }: FormStickyActionsProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}
