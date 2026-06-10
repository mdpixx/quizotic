'use client'

/**
 * QuizSettingsPopover — gear-icon popover in the quiz builder top bar for
 * quiz-wide settings. Today: the self-paced preference (live hosting stays the
 * default) plus its time limit and retry options.
 *
 * Mirrors the QuestionSettingsPopover gear pattern. State lives in
 * use-quiz-builder and is persisted on save.
 */

import { useState } from 'react'

interface QuizSettingsPopoverProps {
  selfPaced: boolean
  setSelfPaced: (v: boolean) => void
  timeLimitMinutes: number | null
  setTimeLimitMinutes: (v: number | null) => void
  allowRetries: boolean
  setAllowRetries: (v: boolean) => void
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-indigo-400 rounded-lg"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-bold" style={{ color: '#0F1B3D' }}>{label}</span>
        {hint && <span className="block text-[11px] mt-0.5" style={{ color: '#64748B' }}>{hint}</span>}
      </span>
      <span
        className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors"
        style={{ background: on ? '#16A34A' : '#CBD5E1' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  )
}

export function QuizSettingsPopover({
  selfPaced, setSelfPaced, timeLimitMinutes, setTimeLimitMinutes, allowRetries, setAllowRetries,
}: QuizSettingsPopoverProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-yellow-200"
        title="Quiz settings"
        aria-label="Quiz settings"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Quiz settings"
            className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl shadow-xl border bg-white p-4 w-[300px]"
            style={{ borderColor: '#E5E7EB' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-2" style={{ color: '#7C3AED' }}>Quiz settings</p>

            <Toggle
              on={selfPaced}
              onChange={setSelfPaced}
              label="Self-paced quiz"
              hint="Off = host live (default). On = also set up for a share link people complete on their own."
            />

            {selfPaced && (
              <div className="mt-2 pl-1 border-l-2 space-y-3" style={{ borderColor: '#EEF2FF' }}>
                <div className="pl-3">
                  <label className="block text-[12px] font-bold mb-1" style={{ color: '#0F1B3D' }}>Time limit</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={timeLimitMinutes ?? ''}
                      placeholder="None"
                      onChange={e => {
                        const v = e.target.value.trim()
                        setTimeLimitMinutes(v === '' ? null : Math.max(0, Math.min(600, Number(v) || 0)) || null)
                      }}
                      className="w-20 text-sm px-2.5 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-200"
                      style={{ borderColor: '#E2E8F0', color: '#0F1B3D' }}
                    />
                    <span className="text-[12px]" style={{ color: '#64748B' }}>minutes (blank = untimed)</span>
                  </div>
                </div>
                <div className="pl-3">
                  <Toggle on={allowRetries} onChange={setAllowRetries} label="Allow retries" hint="Let people attempt more than once." />
                </div>
              </div>
            )}

            <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: '#94A3B8', borderColor: '#F1F5F9' }}>
              Saved with your quiz. Use <strong style={{ color: '#64748B' }}>Share self-paced</strong> on the quiz list to publish a link.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
