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

function InlineClearButton({
  onClear,
  label,
}: {
  onClear: () => void
  label: string
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="admin-tickets-search-clear-inline"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onClear()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation()
          e.preventDefault()
          onClear()
        }
      }}
      title="Clear"
      aria-label={label}
    >
      <X className="h-3.5 w-3.5" />
    </span>
  )
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
              <span className="truncate flex-1 text-left min-w-0">
                {dateObj ? format(dateObj, "PPP") : datePlaceholder}
              </span>
              {onClear && showClear ? (
                <InlineClearButton onClear={onClear} label={`Clear ${dateLabel.toLowerCase()}`} />
              ) : null}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
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
          <div className="admin-tickets-datetime-time-wrap">
            <Input
              type="time"
              id={`${idPrefix}-time`}
              value={time ?? ""}
              onChange={(e) => onTimeChange(e.target.value)}
              placeholder={timePlaceholder}
              className="appearance-none bg-background admin-tickets-datetime-time-input [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
            {onClear && showClear ? (
              <InlineClearButton onClear={onClear} label={`Clear ${timeLabel.toLowerCase()}`} />
            ) : null}
          </div>
        </Field>
      )}
    </FieldGroup>
  )
}
