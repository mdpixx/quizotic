'use client'

import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

interface HostWordCloudProps {
  words: string[]
}

// Curated brand palette — harmonized with the navy stage + yellow accent.
// Ordered strongest-first so the most-mentioned words claim the boldest hues;
// the long tail cycles the same palette via a stable per-word hash.
const PALETTE = [
  '#0F1B3D', // navy (primary)
  '#EF5A4C', // coral
  '#0E7490', // teal
  '#F59E0B', // amber
  '#6D44C9', // violet
  '#10B981', // emerald
  '#E84A7F', // rose
  '#3B5BA9', // slate-blue
] as const

// Relative base sizes (in px). A single font-size multiplier (binary-searched
// to fit) is applied on top, so these set the spread between rare and frequent
// words — not the final size.
const MIN_PX = 30
const MAX_PX = 120
// Multiplier bounds. >1 lets a sparse cloud grow; the low floor lets a very
// crowded cloud shrink enough to stay unclipped.
const MIN_MULT = 0.04
const MAX_MULT = 2.4
// Breathing room so per-word jitter / line-height never clips at the edges.
const H_SAFETY = 0.97
const SEARCH_ITERS = 16

const normalize = (w: string) =>
  w.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').trim()

// Stable, non-negative string hash → deterministic per-word color/jitter so a
// word keeps its look across re-renders as new submissions stream in.
const hashString = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface CloudEntry {
  key: string
  display: string
  count: number
}

export function HostWordCloud({ words }: HostWordCloudProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [mult, setMult] = useState(1)

  const { entries, totalWords, uniqueCount } = useMemo(() => {
    const freq = new Map<string, CloudEntry>()
    let total = 0
    for (const w of words) {
      const key = normalize(w)
      if (!key) continue
      total += 1
      const existing = freq.get(key)
      if (existing) existing.count += 1
      else freq.set(key, { key, display: w.trim(), count: 1 })
    }
    const sorted = Array.from(freq.values()).sort((a, b) => b.count - a.count)
    return { entries: sorted, totalWords: total, uniqueCount: freq.size }
  }, [words])

  const maxCount = entries[0]?.count ?? 1

  // Measure-and-fit: the inner wrapper is full-width and wraps words side by
  // side, so it uses the horizontal space and only adds rows when a row fills.
  // We binary-search a single font-size multiplier (applied via the --wc-mult
  // CSS var) for the largest value where the wrapped content still fits the box
  // in BOTH dimensions — packs more words per row when crowded, grows when
  // sparse, and never clips (long phrases shrink via the width check).
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let raf = 0
    const fit = () => {
      const availH = container.clientHeight * H_SAFETY
      if (!container.clientWidth || !availH) return

      const fits = (m: number): boolean => {
        content.style.setProperty('--wc-mult', String(m))
        // Reading scroll* forces a synchronous reflow at this multiplier. The
        // wrapper is full-width, so the height is the real constraint; the
        // width term only catches a single phrase too wide to fit one line
        // (scrollWidth then exceeds the wrapper's own clientWidth).
        return (
          content.scrollHeight <= availH &&
          content.scrollWidth <= content.clientWidth + 1
        )
      }

      let lo = MIN_MULT
      let hi = MAX_MULT
      if (fits(hi)) {
        lo = hi
      } else {
        for (let i = 0; i < SEARCH_ITERS; i++) {
          const mid = (lo + hi) / 2
          if (fits(mid)) lo = mid
          else hi = mid
        }
      }
      content.style.setProperty('--wc-mult', String(lo))
      setMult(prev => (Math.abs(prev - lo) > 0.002 ? lo : prev))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }

    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [entries])

  return (
    <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 bg-white rounded-2xl border border-gray-200 p-5 md:p-7 relative overflow-hidden host-answer-stage host-wordcloud-stage flex flex-col">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex-shrink-0">
        Word cloud · {totalWords} word{totalWords !== 1 ? 's' : ''} from {uniqueCount} unique
      </p>
      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 italic">Waiting for responses…</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="host-wordcloud-words flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        >
          <div
            ref={contentRef}
            className="host-wordcloud-inner"
            style={{ '--wc-mult': mult } as CSSProperties}
          >
            {entries.map((entry, i) => {
              const ratio = Math.sqrt(entry.count / maxCount)
              const basePx = Math.round(MIN_PX + ratio * (MAX_PX - MIN_PX))
              // Top words get the boldest palette hues by rank; the long tail
              // cycles the same palette deterministically by word hash.
              const color =
                i < PALETTE.length ? PALETTE[i] : PALETTE[hashString(entry.key) % PALETTE.length]
              const isTop = i < 3
              // Subtle deterministic vertical jitter → organic layered cloud
              // instead of rigid rows. ±0.05em, stable per word.
              const jitter = ((hashString(entry.key + '·y') % 100) / 100 - 0.5) * 0.1
              return (
                <span
                  key={entry.key}
                  className="host-wordcloud-word"
                  style={{
                    fontSize: `calc(${basePx}px * var(--wc-mult, 1))`,
                    color,
                    fontWeight: isTop ? 900 : 800,
                    transform: `translateY(${jitter.toFixed(3)}em)`,
                    borderBottom: i === 0 ? '0.06em solid #FBD13B' : undefined,
                  }}
                  title={`${entry.display} — ${entry.count}×`}
                >
                  {entry.display}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
