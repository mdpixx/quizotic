'use client'

import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

interface HostWordCloudProps {
  words: string[]
}

// Mentimeter-style palette — soft, cohesive hues with enough weight to stay
// legible as bold text on the white stage. Ordered strongest-first so the
// most-mentioned words claim the lead hues; the long tail cycles the same
// palette via a stable per-word hash. (Kept in sync with the report cloud in
// QuestionResultsView.tsx.)
const PALETTE = [
  '#4F46E5', // indigo
  '#EF5A4C', // coral
  '#0E7490', // teal
  '#D97706', // amber
  '#7C3AED', // violet
  '#059669', // emerald
  '#DB2777', // pink
  '#2563EB', // blue
] as const

// Relative base sizes (in px). A single font-size multiplier (binary-searched
// to fit) is applied on top, so these set the spread between rare and frequent
// words — not the final size. The spread is deliberately gentle (~3.6×) so the
// biggest word reads as prominent, not overwhelming — matching Mentimeter.
const MIN_PX = 22
const MAX_PX = 80
// Multiplier bounds. The low floor lets a very crowded cloud shrink enough to
// stay unclipped; the ceiling is kept modest so a sparse cloud (one or two
// words) grows to fill space without ballooning into an awkward giant.
const MIN_MULT = 0.04
const MAX_MULT = 1.3
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
              // Top words get the lead palette hues by rank; the long tail
              // cycles the same palette deterministically by word hash.
              const color =
                i < PALETTE.length ? PALETTE[i] : PALETTE[hashString(entry.key) % PALETTE.length]
              const isTop = i < 3
              // Frequency-driven depth: the most-mentioned words sit at full
              // strength while the long tail recedes slightly, so the cloud
              // reads with hierarchy instead of a flat wall of color.
              const opacity = Number((0.62 + 0.38 * ratio).toFixed(3))
              // Subtle deterministic vertical jitter → organic layered cloud
              // instead of rigid rows. ±0.035em, stable per word.
              const jitter = ((hashString(entry.key + '·y') % 100) / 100 - 0.5) * 0.07
              return (
                <span
                  key={entry.key}
                  className="host-wordcloud-word"
                  style={{
                    fontSize: `calc(${basePx}px * var(--wc-mult, 1))`,
                    color,
                    opacity,
                    fontWeight: isTop ? 800 : 700,
                    transform: `translateY(${jitter.toFixed(3)}em)`,
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
