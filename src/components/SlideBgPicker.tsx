'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Slide } from '@/lib/presentation-types'

interface SlideBgPickerProps {
  slide: Slide
  onChange: (next: Slide) => void
}

const PRESETS = [
  '#0F1B3D', '#1E293B', '#FFFFFF', '#FAFAF8',
  '#E8F0FE', '#F3E8FF', '#DCFCE7', '#FEE2E2',
  '#FEF3C7', '#E0F2FE', '#FFE4E6', '#EEF2FF',
]

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (0 <= hp && hp < 1) { r = c; g = x; b = 0 }
  else if (1 <= hp && hp < 2) { r = x; g = c; b = 0 }
  else if (2 <= hp && hp < 3) { r = 0; g = c; b = x }
  else if (3 <= hp && hp < 4) { r = 0; g = x; b = c }
  else if (4 <= hp && hp < 5) { r = x; g = 0; b = c }
  else if (5 <= hp && hp < 6) { r = c; g = 0; b = x }
  const m = v - c
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v)
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return { h: 0, s: 0, v: 1 }
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * (((b - r) / d) + 2)
    else h = 60 * (((r - g) / d) + 4)
  }
  if (h < 0) h += 360
  return { h, s, v }
}

const RING_OUTER = 90
const RING_INNER = 72
const RING_TRACK = (RING_OUTER + RING_INNER) / 2
const SQUARE_HALF = 44

export function SlideBgPicker({ slide, onChange }: SlideBgPickerProps) {
  const initialHsv = useMemo(
    () => hexToHsv(slide.bgColor || '#2563EB'),
    // intentionally only on mount; we update via setHsv elsewhere
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [hsv, setHsv] = useState(initialHsv)
  const [hexInput, setHexInput] = useState('')
  const [wheelExpanded, setWheelExpanded] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragMode = useRef<'hue' | 'sv' | null>(null)

  useEffect(() => {
    if (!slide.bgColor) return
    const current = hsvToHex(hsv.h, hsv.s, hsv.v)
    if (current.toUpperCase() !== slide.bgColor.toUpperCase()) {
      setHsv(hexToHsv(slide.bgColor))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.bgColor])

  const emit = useCallback(
    (next: { h: number; s: number; v: number }) => {
      setHsv(next)
      onChange({ ...slide, bgColor: hsvToHex(next.h, next.s, next.v) } as Slide)
    },
    [slide, onChange],
  )

  const pointFromEvent = useCallback((e: React.PointerEvent<SVGSVGElement> | PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const scale = 200 / rect.width
    return {
      x: (e.clientX - rect.left) * scale - 100,
      y: (e.clientY - rect.top) * scale - 100,
    }
  }, [])

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragMode.current) return
      const { x, y } = pointFromEvent(e)
      if (dragMode.current === 'hue') {
        const angle = (Math.atan2(y, x) * 180) / Math.PI
        const h = (angle + 360 + 90) % 360
        emit({ ...hsv, h })
      } else {
        const s = clamp((x + SQUARE_HALF) / (SQUARE_HALF * 2), 0, 1)
        const v = clamp(1 - (y + SQUARE_HALF) / (SQUARE_HALF * 2), 0, 1)
        emit({ ...hsv, s, v })
      }
    },
    [hsv, emit, pointFromEvent],
  )

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = pointFromEvent(e)
    const r = Math.hypot(x, y)
    if (r > RING_INNER - 2 && r < RING_OUTER + 2) {
      dragMode.current = 'hue'
    } else if (Math.abs(x) <= SQUARE_HALF && Math.abs(y) <= SQUARE_HALF) {
      dragMode.current = 'sv'
    } else {
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    handlePointer(e)
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragMode.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const hueRad = ((hsv.h - 90) * Math.PI) / 180
  const hueThumb = {
    x: Math.cos(hueRad) * RING_TRACK,
    y: Math.sin(hueRad) * RING_TRACK,
  }
  const svThumb = {
    x: hsv.s * (SQUARE_HALF * 2) - SQUARE_HALF,
    y: (1 - hsv.v) * (SQUARE_HALF * 2) - SQUARE_HALF,
  }
  const pureHueHex = hsvToHex(hsv.h, 1, 1)

  const isAutoActive = !slide.bgColor || (slide.type === 'title' && slide.bgColor === '#FAFAF8')

  const resetAuto = () => {
    const copy = { ...slide }
    if (slide.type === 'title') {
      onChange({ ...copy, bgColor: '#FAFAF8' } as Slide)
    } else {
      delete (copy as Record<string, unknown>).bgColor
      onChange(copy as Slide)
    }
  }

  const hueStops = [0, 60, 120, 180, 240, 300, 360].map(deg => hsvToHex(deg, 1, 1))

  return (
    <div className="border-t pt-4 space-y-3" style={{ borderColor: '#E2E8F0' }}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Background</label>
        <button
          type="button"
          onClick={resetAuto}
          className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all"
          style={
            isAutoActive
              ? { background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }
              : { background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }
          }
        >
          Auto
        </button>
      </div>

      <div className={`${wheelExpanded ? 'flex' : 'hidden'} justify-center`}>
        <svg
          ref={svgRef}
          viewBox="-100 -100 200 200"
          className="w-[200px] h-[200px] select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={handlePointer}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <linearGradient id="sv-sat" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor={pureHueHex} />
            </linearGradient>
            <linearGradient id="sv-val" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000000" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="1" />
            </linearGradient>
            {hueStops.map((hex, i) => (
              <linearGradient
                key={i}
                id={`hue-seg-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={Math.cos(((i * 60 - 90) * Math.PI) / 180) * RING_TRACK}
                y1={Math.sin(((i * 60 - 90) * Math.PI) / 180) * RING_TRACK}
                x2={Math.cos((((i + 1) * 60 - 90) * Math.PI) / 180) * RING_TRACK}
                y2={Math.sin((((i + 1) * 60 - 90) * Math.PI) / 180) * RING_TRACK}
              >
                <stop offset="0" stopColor={hex} />
                <stop offset="1" stopColor={hueStops[(i + 1) % hueStops.length]} />
              </linearGradient>
            ))}
          </defs>

          {Array.from({ length: 6 }).map((_, i) => {
            const a0 = ((i * 60 - 90) * Math.PI) / 180
            const a1 = (((i + 1) * 60 - 90) * Math.PI) / 180
            const x0o = Math.cos(a0) * RING_OUTER
            const y0o = Math.sin(a0) * RING_OUTER
            const x1o = Math.cos(a1) * RING_OUTER
            const y1o = Math.sin(a1) * RING_OUTER
            const x0i = Math.cos(a0) * RING_INNER
            const y0i = Math.sin(a0) * RING_INNER
            const x1i = Math.cos(a1) * RING_INNER
            const y1i = Math.sin(a1) * RING_INNER
            const d = [
              `M ${x0o} ${y0o}`,
              `A ${RING_OUTER} ${RING_OUTER} 0 0 1 ${x1o} ${y1o}`,
              `L ${x1i} ${y1i}`,
              `A ${RING_INNER} ${RING_INNER} 0 0 0 ${x0i} ${y0i}`,
              'Z',
            ].join(' ')
            return <path key={i} d={d} fill={`url(#hue-seg-${i})`} />
          })}

          <circle
            cx={hueThumb.x}
            cy={hueThumb.y}
            r={7}
            fill={pureHueHex}
            stroke="#fff"
            strokeWidth={2.5}
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))' }}
          />

          <rect x={-SQUARE_HALF} y={-SQUARE_HALF} width={SQUARE_HALF * 2} height={SQUARE_HALF * 2} rx={6} fill="url(#sv-sat)" />
          <rect x={-SQUARE_HALF} y={-SQUARE_HALF} width={SQUARE_HALF * 2} height={SQUARE_HALF * 2} rx={6} fill="url(#sv-val)" />

          <circle
            cx={svThumb.x}
            cy={svThumb.y}
            r={6}
            fill="none"
            stroke="#fff"
            strokeWidth={2.5}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center items-center">
        {PRESETS.map(color => {
          const isActive = slide.bgColor?.toUpperCase() === color.toUpperCase()
          return (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => {
                setHsv(hexToHsv(color))
                onChange({ ...slide, bgColor: color } as Slide)
              }}
              className="w-7 h-7 rounded-full transition-all hover:scale-110"
              style={{
                background: color,
                border: isActive ? '2.5px solid #0F1B3D' : '1.5px solid #CBD5E1',
                boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px #0F1B3D` : undefined,
                outline: color === '#FFFFFF' || color === '#FAFAF8' ? '1px solid #E2E8F0' : undefined,
              }}
            />
          )
        })}
        <button
          type="button"
          onClick={() => setWheelExpanded(x => !x)}
          title={wheelExpanded ? 'Hide color wheel' : 'Show custom color wheel'}
          className="px-2 h-7 rounded-full text-[10px] font-bold transition-all"
          style={{
            background: wheelExpanded ? '#0F1B3D' : '#fff',
            color: wheelExpanded ? '#F5E642' : '#64748B',
            border: `1.5px solid ${wheelExpanded ? '#0F1B3D' : '#CBD5E1'}`,
          }}
        >
          {wheelExpanded ? '▾ Custom' : '▸ Custom'}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
        <label className="w-5 h-5 rounded flex-shrink-0 cursor-pointer overflow-hidden relative" style={{ border: '1px solid #CBD5E1' }}>
          <div className="absolute inset-0" style={{ background: slide.bgColor || '#ffffff' }} />
          <input
            type="color"
            value={slide.bgColor || '#ffffff'}
            onChange={e => {
              setHsv(hexToHsv(e.target.value))
              onChange({ ...slide, bgColor: e.target.value } as Slide)
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <span className="text-xs font-mono font-bold" style={{ color: '#94A3B8' }}>#</span>
        <input
          type="text"
          maxLength={6}
          value={hexInput !== '' ? hexInput : (slide.bgColor || '#ffffff').replace('#', '').toUpperCase()}
          onFocus={() => setHexInput((slide.bgColor || '#ffffff').replace('#', '').toUpperCase())}
          onBlur={() => setHexInput('')}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
            setHexInput(raw.toUpperCase())
            if (raw.length === 6) {
              const next = `#${raw}`
              setHsv(hexToHsv(next))
              onChange({ ...slide, bgColor: next } as Slide)
              setHexInput('')
            }
          }}
          className="flex-1 bg-transparent text-xs font-mono font-bold outline-none uppercase"
          style={{ color: '#374151' }}
          placeholder="000000"
        />
      </div>
    </div>
  )
}

export default SlideBgPicker
