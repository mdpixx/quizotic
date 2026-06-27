'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

// iOS-style spinning-wheel date + time picker for the quiz scheduler.
//
// Six scroll-snap drums — Day · Month · Year · Hour · Minute · AM/PM — that you
// flick with trackpad/mouse wheel (and arrow keys). Mobile keeps the native
// <input type="datetime-local"> because the OS wheel is already excellent on
// touch and stays featherweight (Quizotic participant/host modals stay light).
//
// The value contract is identical to the old native input: a local
// `YYYY-MM-DDTHH:mm` string (empty string when unset), so every piece of
// scheduling logic upstream — preset chips, validation, the UTC-ISO submit — is
// unchanged. Pure CSS scroll-snap, no new dependency.

// useLayoutEffect avoids the wheels flashing at item 0 before snapping to the
// selected value on mount. No-op on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface DialDateTimeFieldProps {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

const ITEM_H = 40 // px — every drum row is exactly this tall
const VISIBLE = 5 // rows visible at once; the middle row is the selection
const PAD = ITEM_H * Math.floor(VISIBLE / 2) // lets the first/last row reach the center

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function formatDisplay(p: Parts): string {
  return new Date(p.year, p.month, p.day, p.hour, p.minute).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

interface WheelProps {
  items: string[]
  index: number
  onIndex: (i: number) => void
  label: string
}

// A single scroll-snap drum. Scroll (or arrow keys) moves the selection; the
// center row is the chosen value.
function Wheel({ items, index, onIndex, label }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(index)

  // Keep the scroll position in sync when the index changes from outside
  // (initial mount, preset chips, clamping after a month/year change).
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
      className="dial-wheel relative flex-1 min-w-0 focus-within:outline-none"
      role="group"
      aria-label={label}
    >
      {/* Center selection band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-md"
        style={{ top: PAD, height: ITEM_H, background: 'rgba(251,209,59,0.20)', borderTop: '2px solid #FBD13B', borderBottom: '2px solid #FBD13B' }}
      />
      {/* Edge fades so rows dissolve as they leave the center */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-12 z-10" style={{ background: 'linear-gradient(#fff 10%, rgba(255,255,255,0))' }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 z-10" style={{ background: 'linear-gradient(rgba(255,255,255,0), #fff 90%)' }} />
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
              className="flex items-center justify-center"
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
            >
              <span
                className="text-sm font-bold transition-colors"
                style={{ color: i === index ? '#0F1B3D' : '#94A3B8' }}
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

  // Mobile: the OS wheel is already a great, lightweight dial — keep it.
  if (isMobile) {
    return (
      <input
        type="datetime-local"
        value={value}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 text-sm rounded-lg outline-none focus:ring-2 focus:ring-yellow-200"
        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F1B3D' }}
      />
    )
  }

  const parts = parseValue(value)
  const displayHour12 = (parts.hour % 12) || 12
  const period = parts.hour < 12 ? 'AM' : 'PM'

  const nowYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => nowYear + i) // current → +5
  const days = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => String(i + 1))
  const hours12 = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i))
  const periods = ['AM', 'PM']

  function setPart(patch: Partial<Parts>): void {
    onChange(compose({ ...parts, ...patch }))
  }
  // Switching month/year can shorten the month — clamp the day so we never emit
  // an impossible date (e.g. Mar 31 → Feb 28).
  function setMonth(month: number): void {
    const dim = daysInMonth(parts.year, month)
    setPart({ month, day: Math.min(parts.day, dim) })
  }
  function setYear(year: number): void {
    const dim = daysInMonth(year, parts.month)
    setPart({ year, day: Math.min(parts.day, dim) })
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
    <div className="rounded-xl p-3" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
      {/* Hide scrollbars on the drums (Firefox via inline style; Webkit here) */}
      <style>{`.dial-wheel::-webkit-scrollbar{display:none}`}</style>
      <div className="flex items-stretch gap-1" style={{ height: ITEM_H * VISIBLE }}>
        <Wheel label="Day" items={days} index={parts.day - 1} onIndex={i => setPart({ day: i + 1 })} />
        <Wheel label="Month" items={MONTHS} index={parts.month} onIndex={setMonth} />
        <Wheel label="Year" items={years.map(String)} index={Math.max(0, years.indexOf(parts.year))} onIndex={i => setYear(years[i])} />
        <div aria-hidden className="w-px self-stretch mx-1" style={{ background: '#E2E8F0' }} />
        <Wheel label="Hour" items={hours12} index={displayHour12 - 1} onIndex={i => setHour12(i + 1)} />
        <Wheel label="Minute" items={minutes} index={parts.minute} onIndex={i => setPart({ minute: i })} />
        <Wheel label="AM or PM" items={periods} index={period === 'PM' ? 1 : 0} onIndex={i => setPeriod(periods[i])} />
      </div>
      <div className="mt-2 text-center text-xs font-semibold" style={{ color: '#0F1B3D' }}>
        → {formatDisplay(parts)}
      </div>
    </div>
  )
}
