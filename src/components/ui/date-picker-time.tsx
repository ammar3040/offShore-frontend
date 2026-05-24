"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

/** Parse YYYY-MM-DD to Date, or undefined */
function parseDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined
  try {
    const d = parseISO(value)
    return isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}

/** Format Date to YYYY-MM-DD */
function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export interface DatePickerTimeProps {
  /** YYYY-MM-DD */
  date?: string
  /** HH:mm */
  time?: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  dateLabel?: string
  timeLabel?: string
  datePlaceholder?: string
  timePlaceholder?: string
  /** If false, hide the time input */
  showTime?: boolean
  idPrefix?: string
  className?: string
  /** Optional clear callback - if provided, shows clear button when date/time has value */
  onClear?: () => void
  hasValue?: boolean
  /** Disable dates before today in the calendar */
  disablePastDates?: boolean
  /** Extra classes for the portaled calendar popover */
  popoverContentClassName?: string
  /** Extra classes for the date trigger button */
  triggerClassName?: string
}

export function DatePickerTime({
  date,
  time,
  onDateChange,
  onTimeChange,
  dateLabel = "Date",
  timeLabel = "Time",
  datePlaceholder = "Select date",
  timePlaceholder = "HH:mm",
  showTime = true,
  idPrefix = "date-picker",
  className,
  onClear,
  hasValue,
  disablePastDates = false,
  popoverContentClassName,
  triggerClassName,
}: DatePickerTimeProps) {
  const [open, setOpen] = React.useState(false)
  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const dateObj = parseDate(date)
  const showClear = hasValue ?? (!!date?.trim() || !!time?.trim())

  return (
    <FieldGroup className={cn("flex-row flex-wrap gap-4", className)}>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-date`}>{dateLabel}</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id={`${idPrefix}-date`}
              className={cn(
                "admin-tickets-search-control w-full min-w-[140px] justify-between font-normal",
                "bg-white text-[#111827] border-[#dde1e8] shadow-none",
                "hover:bg-[#f7f8fa] hover:text-[#111827]",
                "dark:bg-white dark:text-[#111827] dark:border-[#dde1e8] dark:hover:bg-[#f7f8fa]",
                triggerClassName
              )}
            >
              {dateObj ? format(dateObj, "PPP") : datePlaceholder}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn("w-auto overflow-hidden p-0", popoverContentClassName)}
            align="start"
          >
            <Calendar
              mode="single"
              selected={dateObj}
              defaultMonth={dateObj ?? new Date()}
              disabled={disablePastDates ? { before: today } : undefined}
              onSelect={(d) => {
                if (d) {
                  onDateChange(toDateString(d))
                  setOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      {showTime && (
        <Field className="min-w-[100px] flex-1">
          <FieldLabel htmlFor={`${idPrefix}-time`}>{timeLabel}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              id={`${idPrefix}-time`}
              value={time ?? ""}
              onChange={(e) => onTimeChange(e.target.value)}
              placeholder={timePlaceholder}
              className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
            {onClear && showClear && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onClear}
                title="Clear"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Field>
      )}
    </FieldGroup>
  )
}
