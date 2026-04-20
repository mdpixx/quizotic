'use client'

import { useEffect } from 'react'
import { QUIZ_THEMES, QUIZ_THEME_ORDER, type QuizThemeId } from '@/lib/quiz-themes'

interface QuizThemePickerProps {
  open: boolean
  onClose: () => void
  value: QuizThemeId | null | undefined
  onChange: (id: QuizThemeId) => void
  // Optional preview node — rendered inside the currently-selected theme
  // so hosts see their quiz under each theme before committing.
  previewNode?: React.ReactNode
}

// Full-screen modal that lets the host pick a quiz-level theme. Left: 10
// theme cards in a 2-column grid. Right: a live preview panel showing a
// sample question card under the selected theme.
export function QuizThemePicker({ open, onClose, value, onChange, previewNode }: QuizThemePickerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const selected = value ?? 'default'
  const theme = QUIZ_THEMES[selected as QuizThemeId] ?? QUIZ_THEMES.default

  return (
    <div
      role="dialog"
      aria-label="Pick a quiz theme"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,27,61,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] rounded-3xl overflow-hidden flex flex-col md:flex-row bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Left — theme grid */}
        <div className="md:w-[420px] flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                Themes
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Pick a style for your entire quiz</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Close theme picker"
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto p-4 grid grid-cols-2 gap-3">
            {QUIZ_THEME_ORDER.map(id => {
              const t = QUIZ_THEMES[id]
              const isActive = id === selected
              return (
                <button
                  key={id}
                  onClick={() => onChange(id)}
                  className="rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.02]"
                  style={{
                    border: isActive ? '3px solid #0F1B3D' : '1.5px solid #E5E7EB',
                    boxShadow: isActive ? '0 4px 16px rgba(15,27,61,0.2)' : undefined,
                  }}
                >
                  {/* Swatch preview */}
                  <div className="h-24 flex" aria-hidden>
                    {t.swatch.map((c, i) => (
                      <div key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-white">
                    <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>{t.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{t.tagline}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right — live preview under selected theme */}
        <div className="flex-1 min-h-[280px] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Preview — {theme.name}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              Apply & Close
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center p-6 overflow-hidden"
            style={{ background: theme.background }}
          >
            {previewNode ?? (
              <ThemedSamplePreview themeId={selected} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Default preview — a sample question card with 4 options under the chosen theme.
function ThemedSamplePreview({ themeId }: { themeId: QuizThemeId }) {
  const theme = QUIZ_THEMES[themeId]
  return (
    <div className="w-full max-w-2xl space-y-4">
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: theme.surface,
          border: `1.5px solid ${theme.surfaceBorder}`,
          color: theme.textColor,
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.mutedText }}>
          Sample Question
        </p>
        <p className="text-2xl font-black" style={{ color: theme.textColor, fontFamily: 'var(--font-heading)' }}>
          What colour is the Indian flag&rsquo;s middle stripe?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Saffron', color: '#FF9933' },
          { label: 'White', color: '#FFFFFF' },
          { label: 'Green', color: '#138808' },
          { label: 'Blue', color: '#000080' },
        ].map(opt => (
          <div
            key={opt.label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              background: theme.surface,
              border: `1.5px solid ${theme.surfaceBorder}`,
              color: theme.textColor,
            }}
          >
            <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: opt.color, border: '1.5px solid rgba(0,0,0,0.1)' }} />
            <span className="text-base font-semibold">{opt.label}</span>
          </div>
        ))}
      </div>
      <button
        className="w-full py-3 rounded-xl font-bold text-base transition-transform hover:scale-[1.01]"
        style={{ background: theme.accent, color: theme.accentText, fontFamily: 'var(--font-heading)' }}
      >
        Reveal Answer
      </button>
    </div>
  )
}
