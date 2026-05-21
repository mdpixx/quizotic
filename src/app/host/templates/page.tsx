'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QUIZ_TEMPLATES, type TemplateAudience } from '@/lib/quiz-templates'
import { saveQuiz } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

const AUDIENCE_COLORS: Record<TemplateAudience, { bg: string; text: string; border: string }> = {
  Schools:   { bg: '#F3F4F6', text: '#4338CA', border: '#C7D2FE' },
  Corporate: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Both:      { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
}

const TYPE_FILTERS: Array<TemplateAudience | 'All'> = ['All', 'Schools', 'Corporate', 'Both']

export default function TemplatesPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<TemplateAudience | 'All'>('All')
  const [loading, setLoading] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewTemplate = previewId ? QUIZ_TEMPLATES.find(t => t.id === previewId) : null

  const filtered = filter === 'All'
    ? QUIZ_TEMPLATES
    : QUIZ_TEMPLATES.filter(t => t.audience === filter)

  function applyTemplate(templateId: string) {
    setLoading(templateId)
    const template = QUIZ_TEMPLATES.find(t => t.id === templateId)
    if (!template) { setLoading(null); return }

    const now = new Date().toISOString()
    const newQuiz: Quiz = {
      ...template.quiz,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      // Remap question IDs to fresh UUIDs
      questions: template.quiz.questions.map(q => ({ ...q, id: crypto.randomUUID() })),
    }
    saveQuiz(newQuiz)
    router.push(`/host/create?edit=${newQuiz.id}`)
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>

      {/* Header */}
      <div className="border-b" style={{ borderColor: '#DBEAFE', background: '#fff' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/host"
              className="text-sm font-semibold transition-opacity hover:opacity-60"
              style={{ color: '#9CA3AF' }}>
              ← Dashboard
            </Link>
            <span style={{ color: '#DBEAFE' }}>|</span>
            <h1 className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
              Template Gallery
            </h1>
          </div>
          <Link href="/host/create"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
            + Blank Quiz
          </Link>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-8">

        {/* Intro */}
        <div className="mb-8">
          <p className="text-base max-w-lg" style={{ color: '#6B7280' }}>
            Start from a pre-built template. One click loads it into the editor — edit questions to fit your content.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TYPE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all"
              style={{
                background: filter === f ? '#0F1B3D' : '#fff',
                color: filter === f ? '#fff' : '#6B7280',
                borderColor: filter === f ? '#0F1B3D' : '#DBEAFE',
              }}
            >
              {f}
              <span className="ml-1.5 text-xs font-normal opacity-70">
                {f === 'All' ? QUIZ_TEMPLATES.length : QUIZ_TEMPLATES.filter(t => t.audience === f).length}
              </span>
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(template => {
            const badge = AUDIENCE_COLORS[template.audience]
            const previewQs = template.quiz.questions.slice(0, 2)
            const isLoading = loading === template.id

            return (
              <div key={template.id}
                className="rounded-2xl border flex flex-col overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: '#fff', borderColor: '#DBEAFE' }}>

                {/* Card top */}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-black text-base leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
                      {template.title}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                      {template.audience}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed mb-4" style={{ color: '#6B7280' }}>
                    {template.description}
                  </p>

                  {/* Question count */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>
                      {template.questionCount} questions · {template.subject}
                    </span>
                  </div>

                  {/* Question preview */}
                  <div className="space-y-2">
                    {previewQs.map((q, i) => (
                      <div key={i} className="rounded-lg px-3 py-2" style={{ background: '#F3F4F6' }}>
                        <p className="text-xs font-medium leading-snug" style={{ color: '#4B5563' }}>
                          <span className="font-bold" style={{ color: '#0F1B3D' }}>Q{i + 1}.</span>{' '}
                          {q.text.length > 72 ? q.text.slice(0, 72) + '…' : q.text}
                        </p>
                      </div>
                    ))}
                    {template.questionCount > 2 && (
                      <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                        +{template.questionCount - 2} more
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5 flex gap-2">
                  <button
                    onClick={() => setPreviewId(template.id)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all hover:bg-gray-50"
                    style={{ borderColor: '#DBEAFE', color: '#6B7280' }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => applyTemplate(template.id)}
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
                  >
                    {isLoading ? 'Loading…' : 'Use →'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPreviewId(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b flex items-center justify-between"
              style={{ borderColor: '#DBEAFE' }}>
              <div>
                <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
                  {previewTemplate.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {previewTemplate.questionCount} questions · {previewTemplate.subject}
                </p>
              </div>
              <button onClick={() => setPreviewId(null)}
                className="text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                style={{ color: '#9CA3AF' }}>
                &times;
              </button>
            </div>
            <div className="p-5 space-y-3">
              {previewTemplate.quiz.questions.map((q, i) => (
                <div key={i} className="rounded-xl p-4 border" style={{ borderColor: '#DBEAFE' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: '#1E1B4B' }}>
                    <span style={{ color: '#0F1B3D' }}>Q{i + 1}.</span> {q.text}
                  </p>
                  {q.options && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {q.options.map((opt, j) => {
                        const optText = typeof opt === 'string' ? opt : opt.text
                        const isCorrect = q.correctAnswer === String(j)
                        return (
                          <div key={j} className="text-xs rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 overflow-hidden"
                            style={{
                              background: isCorrect ? '#DCFCE7' : '#F3F4F6',
                              color: isCorrect ? '#16A34A' : '#4B5563',
                              fontWeight: isCorrect ? 700 : 400,
                            }}>
                            {isCorrect && <span className="flex-shrink-0">✓</span>}
                            <span className="min-w-0 break-words">{optText}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#0F1B3D' }}>
                      {q.type}
                    </span>
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{q.timerSeconds}s · {q.points}pts</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white p-5 border-t" style={{ borderColor: '#DBEAFE' }}>
              <button
                onClick={() => { setPreviewId(null); applyTemplate(previewTemplate.id) }}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
              >
                Use This Template →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
