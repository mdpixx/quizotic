import Link from 'next/link'
import { FOUNDER } from '@/content/brand'
import { prisma } from '@/lib/prisma'

// Reserved slot between the product showcase and the FAQ. We don't fabricate
// testimonials or usage numbers. When real proof exists, it slots in here
// without touching the page layout:
//   - testimonials: real quotes with name + institution (with permission)
//   - usage counters: live aggregates from our own DB (quizzes created,
//     questions answered), cached and above an honesty threshold
// Until then: a founder note — the one piece of social proof that's real today.
type PublishedTestimonial = {
  id: string
  quote: string
  displayQuote: string | null
  name: string
  designation: string
  organization: string | null
  photoUrl: string | null
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'Q'
}

function TestimonialCard({ item }: { item: PublishedTestimonial }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border-2 border-[#0F1B3D] bg-white p-6 shadow-[5px_5px_0_#FBD13B]">
      <span className="text-5xl font-black leading-none text-[#E07A5F]" aria-hidden>&ldquo;</span>
      <p className="mt-1 flex-1 text-[15px] leading-7 text-[#374151]">{item.displayQuote ?? item.quote}</p>
      <div className="mt-6 flex items-center gap-3 border-t border-[#D9E1ED] pt-4">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full border-2 border-[#0F1B3D] object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0F1B3D] text-sm font-black text-[#FBD13B]" aria-hidden>{initials(item.name)}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#0F1B3D]">{item.name}</p>
          <p className="truncate text-xs text-[#6B7280]">{[item.designation, item.organization].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </article>
  )
}

export async function SocialProofSlot() {
  let testimonials: PublishedTestimonial[] = []
  try {
    testimonials = await prisma.testimonial.findMany({
      where: { status: 'published', publicationConsent: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        quote: true,
        displayQuote: true,
        name: true,
        designation: true,
        organization: true,
        photoUrl: true,
      },
    })
  } catch (err) {
    console.warn('[homepage] published testimonials unavailable:', err instanceof Error ? err.message : err)
  }

  if (testimonials.length > 0) {
    return (
      <section className="bg-white px-6 py-14" aria-labelledby="testimonial-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#E07A5F]">From the room</p>
            <h2 id="testimonial-heading" className="mt-2 text-3xl font-black tracking-tight text-[#0F1B3D] sm:text-4xl">What Quizotic users changed</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map(item => <TestimonialCard key={item.id} item={item} />)}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="px-6 py-12" style={{ background: '#FFFFFF' }}>
      <div
        className="max-w-2xl mx-auto rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row gap-5 items-start"
        style={{ background: '#F9FAFB', border: '2px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D' }}
      >
        <img
          src="/founder/mahesh-dhiman.jpg"
          alt={`${FOUNDER.name}, founder of Quizotic`}
          width={72}
          height={72}
          className="rounded-full flex-shrink-0"
          style={{ border: '2px solid #0D0D0D', objectFit: 'cover' }}
        />
        <div>
          <p className="text-base leading-relaxed mb-3" style={{ color: '#374151' }}>
            &ldquo;I run corporate training for a living — sessions for thousands of employees a
            year. Quizotic is the tool I wished I had in the room: one that makes learning
            stick, not just slides move.&rdquo;
          </p>
          <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
            — {FOUNDER.name}, founder
            <span style={{ color: '#9CA3AF', fontWeight: 500 }}> · </span>
            <Link href="/about" style={{ color: '#0F1B3D', textDecoration: 'underline' }}>
              About →
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
