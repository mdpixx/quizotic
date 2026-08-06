'use client'

/**
 * Dev-only preview for the scheduled (self-paced) quiz surfaces.
 * No auth, no socket, no DB — static samples, same convention as
 * /dev/slide-preview.
 *
 * Exists because the real screens are hard to reach safely: the player needs a
 * published session and a live attempt, and the scheduler sits behind host
 * OAuth — and this project runs against a single production database, so
 * "just publish a test quiz" writes real rows.
 *
 * URL: http://localhost:4000/dev/scheduled-preview
 */

import { useState } from 'react'
import { OptionGrid } from '@/components/async/OptionGrid'
import { MultiSelectGrid } from '@/components/async/MultiSelectGrid'
import { DialDateTimeField } from '@/components/host/DialDateTimeField'
import type { QuizQuestion } from '@/components/async/types'

const FOUR_OPTION: QuizQuestion = {
  type: 'mcq',
  text: 'Which planet is closest to the Sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  index: 0,
  ordinal: 1,
  total: 4,
}

const LONG_TEXT: QuizQuestion = {
  type: 'mcq',
  text: 'Which of these best describes the water cycle?',
  options: [
    'Evaporation, condensation, precipitation and collection repeating continuously',
    'Water freezing at the poles and never returning to the atmosphere',
    'Rain falling only over oceans and never over land masses',
    'Rivers flowing uphill during the monsoon season',
  ],
  index: 1,
  ordinal: 2,
  total: 4,
}

const TWO_OPTION: QuizQuestion = {
  type: 'truefalse',
  text: 'The Earth is round.',
  options: ['True', 'False'],
  index: 2,
  ordinal: 3,
  total: 4,
}

const MULTI: QuizQuestion = {
  type: 'multiselect',
  text: 'Which of these are noble gases?',
  options: ['Helium', 'Oxygen', 'Neon', 'Argon'],
  index: 3,
  ordinal: 4,
  total: 4,
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: '#FBD13B' }}>{label}</h2>
      {children}
    </section>
  )
}

export default function ScheduledPreviewPage() {
  const [opens, setOpens] = useState('2026-08-10T09:00')
  const [closes, setCloses] = useState('2026-08-17T18:30')
  // Two stand-in participants so the per-participant option jumble is visible
  // side by side, and a switch to prove the identity path still works.
  const [shuffle, setShuffle] = useState(true)
  const [pid, setPid] = useState('participant-one')

  return (
    <div className="min-h-svh" style={{ background: '#0F1B3D' }}>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        <header>
          <h1 className="text-2xl font-black text-white">Scheduled quiz — preview</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            Answer tiles render on the player&apos;s dark stage. Resize past 1280px to see the 2&times;2 quadrant.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />
            Shuffle options
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            Participant
            <select
              value={pid}
              onChange={e => setPid(e.target.value)}
              className="rounded-lg px-2 py-1 text-sm"
              style={{ background: '#fff', color: '#0F1B3D' }}
            >
              <option value="participant-one">one</option>
              <option value="participant-two">two</option>
              <option value="participant-three">three</option>
            </select>
          </label>
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            Switch participant — the tiles below re-order, the answer text stays put.
          </span>
        </div>

        <Panel label="MCQ — 4 options">
          <OptionGrid question={FOUR_OPTION} disabled={false} onSubmit={() => {}} shuffleOptions={shuffle} participantId={pid} />
        </Panel>

        <Panel label="MCQ — long answers">
          <OptionGrid question={LONG_TEXT} disabled={false} onSubmit={() => {}} shuffleOptions={shuffle} participantId={pid} />
        </Panel>

        <Panel label="True / false — 2 options stay vertical">
          <OptionGrid question={TWO_OPTION} disabled={false} onSubmit={() => {}} shuffleOptions={shuffle} participantId={pid} />
        </Panel>

        <Panel label="Multi-select — checkbox glyph + hint">
          <MultiSelectGrid question={MULTI} disabled={false} onSubmit={() => {}} shuffleOptions={shuffle} participantId={pid} />
        </Panel>

        <Panel label="Locked state (feedback showing)">
          <OptionGrid question={FOUR_OPTION} disabled onSubmit={() => {}} />
        </Panel>

        <Panel label="Scheduling dial — on the host's white modal surface">
          <div className="rounded-2xl p-6 space-y-3" style={{ background: '#fff', maxWidth: 512 }}>
            <div>
              <label className="text-xs font-bold block mb-1.5" style={{ color: '#0F1B3D' }}>Opens</label>
              <DialDateTimeField ariaLabel="Quiz opens at" value={opens} onChange={setOpens} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1.5" style={{ color: '#0F1B3D' }}>Closes</label>
              <DialDateTimeField ariaLabel="Quiz closes at" value={closes} onChange={setCloses} />
            </div>
            <p className="text-xs font-mono" style={{ color: '#64748B' }}>{opens} &rarr; {closes}</p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
