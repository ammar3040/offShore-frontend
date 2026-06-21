"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import "./time-wheel-picker.css"

const ITEM_HEIGHT = 40
const WHEEL_PADDING = 2

export type TimeFilterMode = "before" | "after"

export function hhmmToParts(value: string | undefined): {
  hour12: number
  minute: number
  period: "AM" | "PM"
} {
  const [hourRaw = "12", minuteRaw = "00"] = (value ?? "12:00").split(":")
  let hour24 = Number.parseInt(hourRaw, 10)
  const minute = Number.parseInt(minuteRaw, 10)
  if (Number.isNaN(hour24) || Number.isNaN(minute)) {
    return { hour12: 12, minute: 0, period: "AM" }
  }
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM"
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  return { hour12, minute, period }
}

export function partsToHhmm(
  hour12: number,
  minute: number,
  period: "AM" | "PM"
): string {
  let hour24 = hour12 % 12
  if (period === "PM") hour24 += 12
  if (period === "AM" && hour12 === 12) hour24 = 0
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function formatHhmmDisplay(value: string | undefined): string {
  if (!value?.trim()) return "Select time"
  const { hour12, minute, period } = hhmmToParts(value)
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"]

type WheelColumnProps<T extends string | number> = {
  items: readonly T[]
  value: T
  onChange: (value: T) => void
  formatItem?: (value: T) => string
  ariaLabel: string
}

function WheelColumn<T extends string | number>({
  items,
  value,
  onChange,
  formatItem,
  ariaLabel,
}: WheelColumnProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollEndTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isProgrammaticScroll = React.useRef(false)
  const userInteracted = React.useRef(false)

  const paddedItems = React.useMemo(
    () => [
      ...Array(WHEEL_PADDING).fill(null),
      ...items,
      ...Array(WHEEL_PADDING).fill(null),
    ],
    [items]
  )

  const updateItemStyles = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const center = el.scrollTop + el.clientHeight / 2
    const children = el.querySelectorAll<HTMLElement>("[data-wheel-item]")
    children.forEach((child) => {
      const childCenter = child.offsetTop + child.offsetHeight / 2
      const distance = Math.abs(childCenter - center) / ITEM_HEIGHT
      const opacity = Math.max(0.25, 1 - distance * 0.35)
      const scale = Math.max(0.82, 1 - distance * 0.08)
      child.style.opacity = String(opacity)
      child.style.transform = `scale(${scale})`
    })
  }, [])

  const scrollToIndex = React.useCallback((index: number, smooth = false) => {
    const el = scrollRef.current
    if (!el || index < 0) return
    isProgrammaticScroll.current = true
    el.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: smooth ? "smooth" : "auto",
    })
    window.setTimeout(() => {
      isProgrammaticScroll.current = false
      updateItemStyles()
    }, smooth ? 220 : 0)
  }, [updateItemStyles])

  const snapToNearest = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const index = Math.round(el.scrollTop / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(items.length - 1, index))
    scrollToIndex(clamped, true)
    const next = items[clamped]
    if (next !== value && userInteracted.current) onChange(next)
  }, [items, onChange, scrollToIndex, value])

  React.useEffect(() => {
    userInteracted.current = false
  }, [value])

  React.useEffect(() => {
    const index = items.indexOf(value)
    if (index >= 0) scrollToIndex(index, false)
  }, [items, scrollToIndex, value])

  React.useEffect(() => {
    updateItemStyles()
  }, [updateItemStyles, value])

  const handleScroll = () => {
    if (!isProgrammaticScroll.current) userInteracted.current = true
    updateItemStyles()
    if (isProgrammaticScroll.current) return
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(snapToNearest, 90)
  }

  return (
    <div className="time-wheel-column" aria-label={ariaLabel}>
      <div
        ref={scrollRef}
        className="time-wheel-scroll"
        onScroll={handleScroll}
        role="listbox"
        aria-label={ariaLabel}
      >
        {paddedItems.map((item, index) => (
          <button
            key={`${String(item)}-${index}`}
            type="button"
            data-wheel-item
            className={cn(
              "time-wheel-item",
              item === value && "time-wheel-item-selected"
            )}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => {
              if (item == null) return
              userInteracted.current = true
              const itemIndex = items.indexOf(item)
              if (itemIndex >= 0) {
                onChange(item)
                scrollToIndex(itemIndex, true)
              }
            }}
            tabIndex={item === value ? 0 : -1}
            aria-selected={item === value}
          >
            {item == null ? "" : formatItem ? formatItem(item) : String(item)}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface TimeWheelPickerProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

export function TimeWheelPicker({ value, onChange, className }: TimeWheelPickerProps) {
  const parts = hhmmToParts(value)
  const [hour12, setHour12] = React.useState(parts.hour12)
  const [minute, setMinute] = React.useState(parts.minute)
  const [period, setPeriod] = React.useState<"AM" | "PM">(parts.period)

  React.useEffect(() => {
    const next = hhmmToParts(value)
    setHour12(next.hour12)
    setMinute(next.minute)
    setPeriod(next.period)
  }, [value])

  const emitChange = React.useCallback(
    (nextHour: number, nextMinute: number, nextPeriod: "AM" | "PM", touched = true) => {
      if (touched) onChange(partsToHhmm(nextHour, nextMinute, nextPeriod))
    },
    [onChange]
  )

  return (
    <div className={cn("time-wheel-picker", className)}>
      <div className="time-wheel-highlight" aria-hidden />
      <div className="time-wheel-columns">
        <WheelColumn
          items={HOURS}
          value={hour12}
          onChange={(next) => {
            setHour12(next)
            emitChange(next, minute, period)
          }}
          ariaLabel="Hour"
        />
        <WheelColumn
          items={MINUTES}
          value={minute}
          onChange={(next) => {
            setMinute(next)
            emitChange(hour12, next, period)
          }}
          formatItem={(m) => String(m).padStart(2, "0")}
          ariaLabel="Minute"
        />
        <WheelColumn
          items={PERIODS}
          value={period}
          onChange={(next) => {
            setPeriod(next)
            emitChange(hour12, minute, next)
          }}
          ariaLabel="AM or PM"
        />
      </div>
    </div>
  )
}

export function TimeFilterModeToggle({
  mode,
  onChange,
  kind,
  className,
}: {
  mode: TimeFilterMode
  onChange: (mode: TimeFilterMode) => void
  kind: "departure" | "arrival"
  className?: string
}) {
  const beforeLabel = kind === "departure" ? "Before departure" : "Before arrival"
  const afterLabel = kind === "departure" ? "After departure" : "After arrival"

  return (
    <div className={cn("time-filter-mode-toggle", className)} role="group" aria-label={`${kind} time filter`}>
      <button
        type="button"
        className={cn("time-filter-mode-btn", mode === "before" && "time-filter-mode-btn-active")}
        onClick={() => onChange("before")}
        aria-pressed={mode === "before"}
      >
        {beforeLabel}
      </button>
      <button
        type="button"
        className={cn("time-filter-mode-btn", mode === "after" && "time-filter-mode-btn-active")}
        onClick={() => onChange("after")}
        aria-pressed={mode === "after"}
      >
        {afterLabel}
      </button>
    </div>
  )
}
