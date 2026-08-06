'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

// Compact date + time picker for the quiz scheduler, styled after the iOS wheel.
//
// Four scroll-snap drums — Date · Hour · Minute · AM/PM — that you flick with a
// trackpad/mouse wheel (or arrow keys). Mobile keeps the native
// <input type="datetime-local"> because the OS wheel is already excellent on
// touch and stays featherweight.
//
// Two deliberate choices keep this small enough that the Schedule tab fits on a
// laptop without the modal scrolling:
//   • ONE date drum ("Sat 28 Jun") instead of separate day/month/year drums.
//     Six columns became four, so each is roughly twice as wide and legible.
//   • Minutes in 5-minute steps. Nobody schedules a quiz for 9:37, and a 60-row
//     drum is the single most tedious thing to scroll. An off-step value that
//     arrives from elsewhere is spliced into the list rather than silently
//     rounded — rescheduling must never move a window the host didn't touch.
//
// The value contract is unchanged from the native input: a local
// `YYYY-MM-DDTHH:mm` string (empty string when unset), so every piece of
// scheduling logic upstream — preset chips, validation, the UTC-ISO submit — is
// untouched. Pure CSS scroll-snap, no new dependency.

// useLayoutEffect avoids the wheels flashing at item 0 before snapping to the
// selected value on mount. No-op on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface DialDateTimeFieldProps {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

const ITEM_H = 34 // px — every drum row is exactly this tall
const VISIBLE = 3 // rows visible at once; the middle row is the selection
const PAD = ITEM_H * Math.floor(VISIBLE / 2) // lets the first/last row reach the center

const MINUTE_STEP = 5
const DAYS_AHEAD = 366 // how far the date drum runs past today

// Apple-ish neutrals. Slim hairlines, no colour — the selection reads from the
// grey band plus the ink/grey text contrast, not from a saturated border.
const INK = '#1D1D1F'
const MUTED = '#AEAEB2'
const HAIRLINE = '#E5E5EA'
const BAND = '#F2F2F7'
const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'

const pad = (n: number): string => String(n).padStart(2, '0')

interface Parts {
  year: number
  month: number // 0-11
  day: number
  hour: number // 0-23
  minute: number
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// Parse the local `YYYY-MM-DDTHH:mm` contract, clamping the day to the valid
// range for its month so the value can never describe an impossible date
// (e.g. Apr 31 → Apr 30) — `new Date('2025-04-31')` would otherwise roll to
// May 1 and silently shift the whole schedule.
export function parseValue(value: string): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2]) - 1
    const day = Math.min(Number(m[3]), daysInMonth(year, month))
    return { year, month, day, hour: Number(m[4]), minute: Number(m[5]) }
  }
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() }
}

export function compose(p: Parts): string {
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Midnight of the given date, in local time. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole days between two local midnights. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/**
 * The rows of the date drum: one entry per day, from today (or the selected
 * day, whichever is earlier — an already-saved schedule must stay reachable)
 * out to a year ahead.
 */
export function buildDateItems(today: Date, selected: Date): { label: string; date: Date }[] {
  const first = startOfDay(selected < today ? selected : today)
  const lastByRange = new Date(startOfDay(today).getTime() + DAYS_AHEAD * 86400000)
  const last = startOfDay(selected) > lastByRange ? startOfDay(selected) : lastByRange
  const count = daysBetween(first, last) + 1
  const todayIndex = daysBetween(first, startOfDay(today))

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)
    let label: string
    if (i === todayIndex) label = 'Today'
    else if (i === todayIndex + 1) label = 'Tomorrow'
    else {
      label = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      // Only spell out the year once the drum crosses into a new one — showing
      // it on every row is noise for the 99% of scheduling that is weeks away.
      if (date.getFullYear() !== today.getFullYear()) label += ` ${date.getFullYear()}`
    }
    return { label, date }
  })
}

/**
 * Minute rows: 0, 5, 10 … 55, plus `current` itself when it is off-step so an
 * existing schedule is never rounded behind the host's back.
 */
export function buildMinuteItems(current: number): number[] {
  const stepped = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP)
  if (stepped.includes(current)) return stepped
  return [...stepped, current].sort((a, b) => a - b)
}

interface WheelProps {
  items: string[]
  index: number
  onIndex: (i: number) => void
  label: string
  /** Flex weight — the date column needs more room than AM/PM. */
  grow: number
}

// A single scroll-snap drum. Scroll (or arrow keys) moves the selection; the
// center row is the chosen value.
function Wheel({ items, index, onIndex, label, grow }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(index)

  // Keep the scroll position in sync when the index changes from outside
  // (initial mount, preset chips, clamping after a date change).
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
    last.current = index
  }, [index, items.length])

  function settle() {
    const el = ref.current
    if (!el) return
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
    if (i !== last.current) {
      last.current = i
      onIndex(i)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onIndex(Math.min(items.length - 1, last.current + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onIndex(Math.max(0, last.current - 1))
    }
  }

  return (
    <div
      className="dial-wheel relative min-w-0 focus-within:outline-none"
      style={{ flex: `${grow} 1 0%` }}
      role="group"
      aria-label={label}
    >
      {/* Edge fades so rows dissolve as they leave the center. The colour comes
          from --dial-surface so the field isn't locked to a white background. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: ITEM_H, background: 'linear-gradient(var(--dial-surface) 25%, transparent)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10" style={{ height: ITEM_H, background: 'linear-gradient(transparent, var(--dial-surface) 75%)' }} />
      <div
        ref={ref}
        tabIndex={0}
        onScroll={settle}
        onKeyDown={onKeyDown}
        className="overflow-y-auto outline-none"
        style={{ height: ITEM_H * VISIBLE, scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label={label}
        aria-valuenow={index + 1}
      >
        <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
          {items.map((it, i) => (
            <div
              key={it}
              className="flex items-center justify-center px-1"
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
            >
              <span
                className="truncate text-[13px] transition-colors tabular-nums"
                style={{
                  color: i === index ? INK : MUTED,
                  fontWeight: i === index ? 600 : 400,
                  letterSpacing: '-0.01em',
                }}
              >
                {it}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DialDateTimeField({ value, onChange, ariaLabel }: DialDateTimeFieldProps) {
  const isMobile = useIsMobile()

  const parts = parseValue(value)
  // Recomputed only when the calendar day changes, not on every keystroke —
  // this builds ~370 rows.
  const today = useMemo(() => startOfDay(new Date()), [])
  const dateItems = useMemo(
    () => (isMobile ? [] : buildDateItems(today, new Date(parts.year, parts.month, parts.day))),
    [isMobile, today, parts.year, parts.month, parts.day],
  )

  // Mobile: the OS wheel is already a great, lightweight dial — keep it.
  if (isMobile) {
    return (
      <input
        type="datetime-local"
        value={value}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 text-sm rounded-lg outline-none focus:ring-2 focus:ring-yellow-200"
        style={{ background: '#F8FAFC', border: `1px solid ${HAIRLINE}`, color: INK }}
      />
    )
  }

  const displayHour12 = (parts.hour % 12) || 12
  const period = parts.hour < 12 ? 'AM' : 'PM'

  const dateIndex = Math.max(
    0,
    dateItems.findIndex(d =>
      d.date.getFullYear() === parts.year && d.date.getMonth() === parts.month && d.date.getDate() === parts.day,
    ),
  )
  const hours12 = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const minuteItems = buildMinuteItems(parts.minute)
  const periods = ['AM', 'PM']

  function setPart(patch: Partial<Parts>): void {
    onChange(compose({ ...parts, ...patch }))
  }
  function setDate(i: number): void {
    const d = dateItems[i]?.date
    if (!d) return
    setPart({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() })
  }
  function setHour12(h12: number): void {
    let h = h12 % 12
    if (period === 'PM') h += 12
    setPart({ hour: h })
  }
  function setPeriod(p: string): void {
    let h = displayHour12 % 12
    if (p === 'PM') h += 12
    setPart({ hour: h })
  }

  return (
    <div
      className="rounded-xl p-2"
      style={{
        background: '#fff',
        border: `1px solid ${HAIRLINE}`,
        fontFamily: SYSTEM_FONT,
        '--dial-surface': '#fff',
      } as React.CSSProperties}
    >
      {/* Hide scrollbars on the drums (Firefox via inline style; Webkit here) */}
      <style>{`.dial-wheel::-webkit-scrollbar{display:none}`}</style>
      <div className="relative" style={{ height: ITEM_H * VISIBLE }}>
        {/* Center selection band — one rounded grey rect spanning all four
            drums, the way the iOS picker does it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 rounded-lg"
          style={{ top: PAD, height: ITEM_H, background: BAND }}
        />
        <div className="relative flex items-stretch h-full">
          <Wheel grow={5} label="Date" items={dateItems.map(d => d.label)} index={dateIndex} onIndex={setDate} />
          <div aria-hidden className="w-px self-center mx-1" style={{ height: ITEM_H, background: HAIRLINE }} />
          <Wheel grow={2} label="Hour" items={hours12} index={displayHour12 - 1} onIndex={i => setHour12(i + 1)} />
          <Wheel grow={2} label="Minute" items={minuteItems.map(pad)} index={Math.max(0, minuteItems.indexOf(parts.minute))} onIndex={i => setPart({ minute: minuteItems[i] })} />
          <Wheel grow={2} label="AM or PM" items={periods} index={period === 'PM' ? 1 : 0} onIndex={i => setPeriod(periods[i])} />
        </div>
      </div>
    </div>
  )
}
