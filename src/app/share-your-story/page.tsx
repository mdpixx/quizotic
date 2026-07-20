import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { loadTestimonialInvite } from '@/lib/testimonial-invites'
import { TestimonialForm } from './TestimonialForm'

export const metadata: Metadata = {
  title: 'Share your Quizotic story',
  description: 'Share how Quizotic has made quizzes better for you.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}
export const revalidate = 0

function MessageCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-xl rounded-[28px] border-2 border-[#0F1B3D] bg-white p-8 text-center shadow-[8px_8px_0_#FBD13B] sm:p-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-[#0F1B3D]" style={{ fontFamily: 'var(--font-story-display)' }}>{title}</h1>
      <div className="mt-4 text-[15px] leading-7 text-[#4B5563]">{children}</div>
    </section>
  )
}

export default async function ShareYourStoryPage() {
  const cookieStore = await cookies()
  const inviteToken = cookieStore.get('quizotic_testimonial_page')?.value || ''
  const state = await loadTestimonialInvite(inviteToken)

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-4 py-6 text-[#0F1B3D] sm:px-6 sm:py-10" style={{ fontFamily: 'var(--font-story-body)' }}>
      <div className="mx-auto max-w-6xl">
        <a href="https://www.quizotic.live" className="inline-flex rounded-lg p-1 outline-none focus:ring-4 focus:ring-[#FBD13B]" aria-label="Go to Quizotic">
          <QuizoticLogo variant="onLight" showMark markSize={38} className="text-2xl" />
        </a>

        <header className="mx-auto mb-8 mt-10 max-w-3xl text-center sm:mb-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#E07A5F]">Real people · real quiz moments</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#0F1B3D] sm:text-6xl" style={{ fontFamily: 'var(--font-story-display)' }}>Tell us what changed in the room.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">Your experience can help another teacher, trainer, or facilitator discover a better way to make learning stick.</p>
        </header>

        {state.status === 'active' ? (
          <TestimonialForm defaultName={state.name} defaultOrganization={state.organization} />
        ) : state.status === 'submitted' ? (
          <MessageCard title="Your story is already with us"><p>Thank you—we have your response and will contact you if it is selected.</p></MessageCard>
        ) : state.status === 'expired' ? (
          <MessageCard title="This invitation has expired"><p>Email <a className="font-bold underline" href="mailto:info@quizotic.live">info@quizotic.live</a> and we will send you a fresh link.</p></MessageCard>
        ) : (
          <MessageCard title="This invitation is not valid"><p>Check that you opened the complete link from your email, or contact <a className="font-bold underline" href="mailto:info@quizotic.live">info@quizotic.live</a>.</p></MessageCard>
        )}
      </div>
    </main>
  )
}
