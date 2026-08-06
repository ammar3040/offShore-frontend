import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import './AccessibleDateField.css';

export type DateFieldMode = 'birth' | 'any' | 'future';

type AccessibleDateFieldProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  mode?: DateFieldMode;
  /** Visible helper under the field */
  hint?: string;
  error?: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parse typed dates: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD */
export function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (
      d.getFullYear() === Number(iso[1]) &&
      d.getMonth() === Number(iso[2]) - 1 &&
      d.getDate() === Number(iso[3])
    ) {
      return toIsoLocal(d);
    }
    return null;
  }

  const slash = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return toIsoLocal(d);
    }
    return null;
  }

  const ymd = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return toIsoLocal(d);
    }
    return null;
  }

  return null;
}

function isoToDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function rangeForMode(mode: DateFieldMode): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear();
  if (mode === 'birth') {
    return { start: new Date(y - 100, 0, 1), end: now };
  }
  if (mode === 'future') {
    return { start: new Date(y - 1, 0, 1), end: new Date(y + 30, 11, 31) };
  }
  return { start: new Date(y - 80, 0, 1), end: new Date(y + 30, 11, 31) };
}

/**
 * Accessible date control: type YYYY-MM-DD (or DD/MM/YYYY) + optional calendar with year dropdown.
 * Avoids scrolling decades in a month picker for DOB / far dates.
 */
export function AccessibleDateField({
  id,
  name,
  value,
  onChange,
  required,
  disabled,
  placeholder = 'YYYY-MM-DD or DD/MM/YYYY',
  className,
  inputClassName,
  mode = 'any',
  hint,
  error,
}: AccessibleDateFieldProps) {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const { start, end } = useMemo(() => rangeForMode(mode), [mode]);
  const selected = isoToDate(value);

  useEffect(() => {
    setText(value || '');
    setInvalid(false);
  }, [value]);

  const commitText = (raw: string) => {
    const parsed = parseFlexibleDate(raw);
    if (parsed === '') {
      setInvalid(false);
      onChange('');
      setText('');
      return;
    }
    if (parsed == null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
    setText(parsed);
  };

  return (
    <div className={cn('accessible-date-field', className)}>
      <div className="accessible-date-row">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => commitText(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitText(text);
            }
          }}
          aria-invalid={error || invalid || undefined}
          className={cn(
            'accessible-date-input',
            (error || invalid) && 'accessible-date-input-error',
            inputClassName
          )}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="accessible-date-cal-btn"
              aria-label="Open calendar"
              title="Pick from calendar"
            >
              <CalendarIcon size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
            <div className="accessible-date-popover-hint">
              Or type the date in the field — year dropdown jumps decades fast.
            </div>
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={selected}
              defaultMonth={selected ?? (mode === 'birth' ? new Date(new Date().getFullYear() - 25, 0) : undefined)}
              startMonth={start}
              endMonth={end}
              disabled={
                mode === 'birth'
                  ? { after: new Date() }
                  : mode === 'future'
                    ? { before: new Date(new Date().getFullYear() - 1, 0, 1) }
                    : undefined
              }
              onSelect={(date) => {
                if (!date) return;
                const iso = toIsoLocal(date);
                onChange(iso);
                setText(iso);
                setInvalid(false);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {(hint || invalid) && (
        <p className={cn('accessible-date-hint', invalid && 'accessible-date-hint-error')}>
          {invalid ? 'Use YYYY-MM-DD or DD/MM/YYYY' : hint}
        </p>
      )}
    </div>
  );
}

export default AccessibleDateField;
