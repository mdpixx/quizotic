'use client'

// Deck-level settings: the host's logo and hype mode.
//
// Both are properties of the presentation rather than of any one slide, so
// they do not belong in the per-slide editor panel beside them. The theme
// picker already sets that precedent — this is its sibling.
//
// Hype mode in particular needed a home: PR1 added the field and taught the
// stage to honour it, but until now nothing in the product could turn it on,
// which meant the calm default was not a default so much as the only option.

import React from 'react'
import { ImageUpload } from '@/components/ImageUpload'

interface DeckSettingsModalProps {
  open: boolean
  onClose: () => void
  logoUrl?: string
  hypeMode?: boolean
  onChange: (patch: { logoUrl?: string; hypeMode?: boolean }) => void
}

const HYPE_INCLUDES = [
  'Floating reaction emoji',
  'Vote-velocity waveform',
  'Milestone badges and confetti',
  'Join and answer toasts',
]

export function DeckSettingsModal({ open, onClose, logoUrl, hypeMode, onChange }: DeckSettingsModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deck settings"
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>Deck settings</p>
            <p className="text-[11px]" style={{ color: '#94A3B8' }}>Applies to every slide</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: '#64748B' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* ── Host logo ── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Your logo</label>
            <p className="text-[11px] leading-snug" style={{ color: '#94A3B8' }}>
              Shown at the top of every slide and on the participants&rsquo; phones, so the
              session reads as yours rather than as Quizotic&rsquo;s.
            </p>
            <ImageUpload
              imageUrl={logoUrl}
              onUpload={url => onChange({ logoUrl: url })}
              onRemove={() => onChange({ logoUrl: undefined })}
            />
          </div>

          {/* ── Hype mode ── */}
          <div className="space-y-2 border-t pt-5" style={{ borderColor: '#E2E8F0' }}>
            <button
              type="button"
              role="switch"
              aria-checked={!!hypeMode}
              onClick={() => onChange({ hypeMode: !hypeMode })}
              className="w-full flex items-start gap-3 text-left"
            >
              <span
                className="mt-0.5 flex-shrink-0 rounded-full transition-colors"
                style={{
                  width: 38,
                  height: 22,
                  padding: 3,
                  background: hypeMode ? '#0F1B3D' : '#CBD5E1',
                  display: 'inline-flex',
                  justifyContent: hypeMode ? 'flex-end' : 'flex-start',
                }}
              >
                <span
                  className="rounded-full transition-transform"
                  style={{ width: 16, height: 16, background: '#fff' }}
                />
              </span>
              <span>
                <span className="block text-sm font-bold" style={{ color: '#0F1B3D' }}>Hype mode</span>
                <span className="block text-[11px] leading-snug mt-0.5" style={{ color: '#94A3B8' }}>
                  {hypeMode
                    ? 'On — good for classrooms and energisers.'
                    : 'Off — the calm stage. Good for boardrooms and training.'}
                </span>
              </span>
            </button>

            <ul className="pl-[50px] space-y-1">
              {HYPE_INCLUDES.map(item => (
                <li
                  key={item}
                  className="text-[11px] flex items-center gap-1.5"
                  style={{ color: hypeMode ? '#475569' : '#CBD5E1' }}
                >
                  <span
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: 'currentColor' }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t px-5 py-3 flex justify-end" style={{ borderColor: '#E2E8F0' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#0F1B3D', color: '#fff' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
