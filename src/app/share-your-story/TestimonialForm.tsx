'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  defaultName: string
  defaultOrganization: string
}

const fieldClass = 'mt-2 w-full rounded-xl border-2 border-[#D9E1ED] bg-white px-4 py-3 text-[15px] text-[#0F1B3D] outline-none transition focus:border-[#0F1B3D] focus:ring-4 focus:ring-[#FBD13B]/25'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'Q'
}

export function TestimonialForm({ defaultName, defaultOrganization }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [quote, setQuote] = useState('')
  const [name, setName] = useState(defaultName)
  const [designation, setDesignation] = useState('')
  const [organization, setOrganization] = useState(defaultOrganization)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  function choosePhoto(file: File | undefined) {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(file ? URL.createObjectURL(file) : null)
  }

  function removePhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    if (photoInputRef.current) photoInputRef.current.value = ''
    setPhotoUrl(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Your story could not be saved. Please try again.')
      setSubmitted(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Your story could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="mx-auto max-w-xl rounded-[28px] border-2 border-[#0F1B3D] bg-white p-8 text-center shadow-[8px_8px_0_#FBD13B] sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#16A34A] text-2xl font-black text-white" aria-hidden>✓</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0F1B3D]" style={{ fontFamily: 'var(--font-story-display)' }}>Your story is with us</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-[#4B5563]">Thank you for sharing it. We read every response and will contact you before making any material change.</p>
        <a href="https://www.quizotic.live" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0F1B3D] px-6 py-3 font-bold text-white outline-none transition hover:-translate-y-0.5 focus:ring-4 focus:ring-[#FBD13B] motion-reduce:transform-none">Return to Quizotic</a>
      </section>
    )
  }

  const byline = [designation.trim(), organization.trim()].filter(Boolean).join(', ') || 'Your designation'

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.88fr)]">
      <form ref={formRef} onSubmit={submit} className="rounded-[28px] border-2 border-[#0F1B3D] bg-white p-5 shadow-[8px_8px_0_#FBD13B] sm:p-8" noValidate={false}>
        <div className="mb-7 flex items-center justify-between gap-4 border-b border-[#D9E1ED] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E07A5F]">One honest answer</p>
            <p className="mt-1 text-sm text-[#6B7280]">Usually takes less than two minutes.</p>
          </div>
          <span className="rounded-full bg-[#F4F7FB] px-3 py-1.5 text-xs font-bold text-[#0F1B3D]">Optional photo</span>
        </div>

        <label htmlFor="quote" className="block text-xl font-extrabold leading-7 text-[#0F1B3D]" style={{ fontFamily: 'var(--font-story-display)' }}>
          How has Quizotic made hosting or participating in quizzes better for you?
        </label>
        <p id="quote-help" className="mt-2 text-sm leading-6 text-[#6B7280]">A specific moment, result, or favourite feature makes the strongest story.</p>
        <textarea
          id="quote"
          name="quote"
          value={quote}
          onChange={event => setQuote(event.target.value)}
          minLength={40}
          maxLength={800}
          rows={7}
          required
          aria-describedby="quote-help quote-count"
          placeholder="Quizotic helped us…"
          className={`${fieldClass} resize-y`}
        />
        <p id="quote-count" className="mt-1 text-right text-xs tabular-nums text-[#6B7280]">{quote.length}/800</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#0F1B3D]">
            Your name
            <input id="name" name="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" className={fieldClass} />
          </label>
          <label className="block text-sm font-bold text-[#0F1B3D]">
            Designation
            <input name="designation" value={designation} onChange={event => setDesignation(event.target.value)} minLength={2} maxLength={120} required placeholder="Teacher, L&amp;D Manager…" className={fieldClass} />
          </label>
        </div>

        <label className="mt-4 block text-sm font-bold text-[#0F1B3D]">
          Organisation <span className="font-normal text-[#6B7280]">(optional)</span>
          <input name="organization" value={organization} onChange={event => setOrganization(event.target.value)} maxLength={160} autoComplete="organization" className={fieldClass} />
        </label>

        <div className="mt-5">
          <label htmlFor="photo" className="block text-sm font-bold text-[#0F1B3D]">Photograph <span className="font-normal text-[#6B7280]">(optional)</span></label>
          <div className="mt-2 flex items-center gap-4 rounded-xl border-2 border-dashed border-[#D9E1ED] bg-[#F8FAFC] p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0F1B3D] font-extrabold text-[#FBD13B]">
              {photoUrl ? <img src={photoUrl} alt="Selected portrait preview" className="h-full w-full object-cover" /> : initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <input ref={photoInputRef} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-[#4B5563] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0F1B3D] file:px-3 file:py-2 file:font-bold file:text-white" onChange={event => choosePhoto(event.target.files?.[0])} />
              <p className="mt-1 text-xs text-[#6B7280]">JPEG, PNG, or WebP · maximum 5 MB</p>
              <button type="button" disabled={!photoUrl} onClick={removePhoto} className="mt-2 text-xs font-bold text-[#B4533E] underline underline-offset-2 disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline">Remove photograph</button>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl bg-[#F4F7FB] p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#374151]">
            <input name="publicationConsent" type="checkbox" value="true" required className="mt-1 h-5 w-5 shrink-0 accent-[#0F1B3D]" />
            <span><strong className="text-[#0F1B3D]">Permission to publish.</strong> Quizotic may publish this testimonial with my name, designation, organisation, and submitted photograph on its website and marketing channels.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#374151]">
            <input name="editingAllowed" type="checkbox" value="true" className="mt-1 h-5 w-5 shrink-0 accent-[#0F1B3D]" />
            <span>Quizotic may lightly edit my testimonial for clarity, grammar, or length without changing its meaning.</span>
          </label>
        </div>

        <p aria-live="polite" className={`mt-4 min-h-6 text-sm font-semibold ${error ? 'text-[#DC2626]' : 'text-transparent'}`}>{error || 'No error'}</p>
        <button type="submit" disabled={submitting} className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-[#0F1B3D] bg-[#FBD13B] px-5 py-3 font-extrabold text-[#0F1B3D] shadow-[3px_3px_0_#0F1B3D] outline-none transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0F1B3D] focus:ring-4 focus:ring-[#E07A5F]/40 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none">
          {submitting ? 'Sharing your story…' : 'Share my Quizotic story'}
        </button>
      </form>

      <aside className="lg:sticky lg:top-8" aria-label="Testimonial preview">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#6B7280]">Preview on Quizotic</p>
        <div className="relative overflow-hidden rounded-[28px] bg-[#0F1B3D] p-6 text-white shadow-[8px_8px_0_#E07A5F] sm:p-8">
          <span className="absolute -right-3 -top-8 text-[150px] font-black leading-none text-[#FBD13B]/10" aria-hidden>“</span>
          <p className="relative min-h-28 text-lg font-semibold leading-8" style={{ fontFamily: 'var(--font-story-display)' }}>
            “{quote.trim() || 'Your Quizotic story will appear here as you write.'}”
          </p>
          <div className="relative mt-7 flex items-center gap-3 border-t border-white/15 pt-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#FBD13B] bg-white/10 font-extrabold text-[#FBD13B]">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-extrabold">{name.trim() || 'Your name'}</p>
              <p className="truncate text-sm text-white/65">{byline}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#6B7280]">We read every response. Submitting does not guarantee publication, and material changes are always confirmed with you first.</p>
      </aside>
    </div>
  )
}
