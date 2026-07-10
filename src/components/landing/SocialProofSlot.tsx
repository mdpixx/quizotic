import Link from 'next/link'
import { FOUNDER } from '@/content/brand'

// Reserved slot between the product showcase and the FAQ. We don't fabricate
// testimonials or usage numbers. When real proof exists, it slots in here
// without touching the page layout:
//   - testimonials: real quotes with name + institution (with permission)
//   - usage counters: live aggregates from our own DB (quizzes created,
//     questions answered), cached and above an honesty threshold
// Until then: a founder note — the one piece of social proof that's real today.
export function SocialProofSlot() {
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
