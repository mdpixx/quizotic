'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  index: number
  text: string
}

interface ReflectionMomentProps {
  gameCode: string
  participantName: string
  questions: Question[]
}

type Step = 'intro' | 'question' | 'confidence' | 'note' | 'done'
type ConfidenceLevel = 'low' | 'medium' | 'high'

export function ReflectionMoment({ gameCode, participantName, questions }: ReflectionMomentProps) {
  const [step, setStep] = useState<Step>('intro')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!selectedQuestion || !confidence) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/sessions/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode,
          participantName,
          questionIndex: selectedQuestion.index,
          confidenceLevel: confidence,
          revisitNote: note.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const confidenceOptions: { value: ConfidenceLevel; label: string; desc: string; color: string; bg: string }[] = [
    { value: 'high', label: 'Got it', desc: 'I understood this well', color: '#16A34A', bg: '#F0FDF4' },
    { value: 'medium', label: 'Mostly', desc: 'I got it but need more practice', color: '#D97706', bg: '#FFFBEB' },
    { value: 'low', label: 'Confused', desc: 'I need to revisit this', color: '#DC2626', bg: '#FEF2F2' },
  ]

  return (
    <div className="mt-6 rounded-2xl overflow-hidden border" style={{ borderColor: '#DBEAFE', background: '#F0F4FF' }}>
      {/* Header strip */}
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'var(--color-primary)' }}>
        <span className="text-white text-lg">🪞</span>
        <p className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          Reflection Moment
        </p>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">

          {/* Step: Intro */}
          {step === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <p className="text-sm mb-1 font-bold" style={{ color: '#1B2559' }}>Take a moment to reflect</p>
              <p className="text-xs mb-4" style={{ color: '#4A5568' }}>
                Which question made you think the hardest? Your feedback helps you (and your teacher) learn better.
              </p>
              <button
                onClick={() => setStep('question')}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--brand-gradient)' }}
              >
                Start reflection →
              </button>
            </motion.div>
          )}

          {/* Step: Pick question */}
          {step === 'question' && (
            <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>Step 1 of 3</p>
              <p className="text-sm font-bold mb-3" style={{ color: '#1B2559' }}>Which question made you think the most?</p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {questions.map(q => (
                  <button
                    key={q.index}
                    onClick={() => { setSelectedQuestion(q); setStep('confidence') }}
                    className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-all hover:border-blue-400"
                    style={{
                      background: '#fff',
                      borderColor: '#DBEAFE',
                      color: '#1B2559',
                    }}
                  >
                    <span className="font-bold mr-2" style={{ color: 'var(--color-primary)' }}>Q{q.index + 1}</span>
                    {q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Confidence */}
          {step === 'confidence' && selectedQuestion && (
            <motion.div key="confidence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>Step 2 of 3</p>
              <p className="text-sm font-bold mb-1" style={{ color: '#1B2559' }}>How confident were you?</p>
              <p className="text-xs mb-3 line-clamp-2" style={{ color: '#6B7280' }}>
                Q{selectedQuestion.index + 1}: {selectedQuestion.text}
              </p>
              <div className="space-y-2">
                {confidenceOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setConfidence(opt.value); setStep('note') }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all hover:scale-[1.01]"
                    style={{ background: opt.bg, borderColor: opt.color + '40' }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                    <div>
                      <p className="font-bold text-left" style={{ color: opt.color }}>{opt.label}</p>
                      <p className="text-xs text-left" style={{ color: '#6B7280' }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('question')} className="mt-3 text-xs" style={{ color: '#94A3B8' }}>← Back</button>
            </motion.div>
          )}

          {/* Step: Note */}
          {step === 'note' && (
            <motion.div key="note" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>Step 3 of 3</p>
              <p className="text-sm font-bold mb-1" style={{ color: '#1B2559' }}>Anything you want to revisit?</p>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Optional — jot a quick note for yourself</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. I need to review photosynthesis steps…"
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:border-blue-400"
                style={{ borderColor: '#DBEAFE', background: '#fff', color: '#1B2559' }}
              />
              <p className="text-right text-xs mb-3" style={{ color: '#CBD5E1' }}>{note.length}/300</p>
              {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('confidence')} className="text-xs px-4 py-2 rounded-xl border" style={{ color: '#6B7280', borderColor: '#E2E8F0' }}>
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--brand-gradient)' }}
                >
                  {submitting ? 'Saving…' : 'Submit reflection'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-black text-base mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                Reflection saved!
              </p>
              <p className="text-xs" style={{ color: '#64748B' }}>
                Great work, {participantName}. Your teacher can see what to revisit.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
