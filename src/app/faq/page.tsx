import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description:
    'Common questions about Quizotic: free plan limits, Kahoot comparison, question types, AI generation, participant experience, payments, and low-bandwidth support.',
  alternates: { canonical: '/faq' },
}

const FAQS = [
  {
    q: 'Is Quizotic really free?',
    a: 'Yes — completely free right now. No credit card required, no time limit. You can run live sessions with up to 50 participants, create up to 5 quizzes, and use AI generation (30 questions/month). We are not charging currently as a gesture of learning enablement while we grow.',
  },
  {
    q: 'How is Quizotic different from Kahoot?',
    a: 'Kahoot is primarily a quiz game. Quizotic is built on learning science — Bloom\'s Taxonomy, Confidence Grid, and Spaced Retrieval. We have 11 question types versus Kahoot\'s 4, including word clouds, case studies, drawing, and live Q&A. We also offer interactive presentation mode (like Mentimeter). And unlike Kahoot, we are India-first: INR billing, UPI support, and optimised for low-bandwidth classroom connections.',
  },
  {
    q: 'How is Quizotic different from Mentimeter?',
    a: 'Mentimeter is strong on presentations and polls, but limited on quiz and assessment features. Quizotic combines both: full live quiz engine with competitive scoring AND rich interactive presentation slides. You can mix quiz questions, polls, word clouds, and drawing slides in a single session.',
  },
  {
    q: 'Do participants need to download an app?',
    a: 'No. Participants join using a 6-digit code in any web browser — Chrome, Safari, Firefox, on a phone, tablet, or laptop. Nothing to install. This is a deliberate design principle: we never want an app download to be a barrier in a classroom.',
  },
  {
    q: 'How many participants can join a session?',
    a: 'Up to 50 participants on the free plan. This covers most classroom and training scenarios. If you run larger groups regularly, email us at info@quizotic.live — we personally read every request.',
  },
  {
    q: 'What question types does Quizotic support?',
    a: 'Eleven types: Multiple Choice (MCQ), Multi-Select, True/False, Poll, Open-Ended, Word Cloud, Live Q&A, Rating Scale, Ranking, Case Study, and Drawing Canvas. Each type is designed for a different kind of cognitive engagement.',
  },
  {
    q: 'How does AI quiz generation work?',
    a: 'You can paste a topic, type your own notes, or upload a PDF or Word document. Quizotic generates a full quiz in seconds — questions with options, correct answers, explanations, and Bloom\'s Taxonomy level tags. You can edit everything before going live. The free plan includes 30 AI-generated questions per month.',
  },
  {
    q: 'What is Bloom\'s Taxonomy and why does it matter?',
    a: 'Bloom\'s Taxonomy (Anderson & Krathwohl, 2001) is a framework for classifying educational objectives by cognitive level: Remember, Understand, Apply, Analyse, Evaluate, Create. In Quizotic, you can tag each question to a level. After a session, you get a Bloom\'s distribution report — so you know whether your quiz is testing surface recall or building deep understanding.',
  },
  {
    q: 'What is the Confidence Grid?',
    a: 'Before answering each question, participants can rate their confidence (Low / Medium / High). After the session, the Confidence Grid report reveals "confident but wrong" answers — the most dangerous learning gaps, where learners have misconceptions they do not know they have.',
  },
  {
    q: 'What is Spaced Retrieval?',
    a: 'Spaced Retrieval is a technique where questions that learners struggled with are re-surfaced in future sessions at increasing intervals. Research shows this is the single most effective method for long-term retention. Quizotic tracks which questions participants got wrong and resurfaces them automatically in your next session.',
  },
  {
    q: 'What are the different session modes?',
    a: 'Four modes: Competitive (live leaderboard, speed scoring — maximum energy), Reflection (no scores, open discussion format), Self-Paced (each participant moves at their own speed), and Assessment (formal evaluation with shuffled questions and score reports).',
  },
  {
    q: 'Does Quizotic work on slow internet connections?',
    a: 'Yes. We designed Quizotic specifically for Indian classrooms where 1–2 Mbps connections are common. The participant page is extremely lightweight (under 100KB initial load). The host view is heavier but optimised for standard broadband.',
  },
  {
    q: 'Can I export session results?',
    a: 'Yes. You can export session reports as XLSX (Excel) with per-participant scores, question-level accuracy, time taken, and Bloom\'s distribution. Google Sheets export is also available. PDF export is a paid feature.',
  },
  {
    q: 'Can I add images to questions?',
    a: 'Yes. You can add images to question text and to individual answer options. Images are hosted on Cloudflare CDN for fast delivery. The free plan includes 20 image uploads per month.',
  },
  {
    q: 'Is there a Hindi language option?',
    a: 'The participant interface supports Hindi for question text and answers. The host dashboard is currently English-only. We are working on expanding language support based on user demand.',
  },
  {
    q: 'How do payments and subscriptions work?',
    a: 'Quizotic is free right now — there are no paid plans available yet. When we introduce paid plans, they will be in Indian Rupees (INR) via Razorpay, with UPI, net banking, and card support. GST (18%) will apply for Indian customers. We will give existing users ample notice before any changes.',
  },
  {
    q: 'How do I delete my account and data?',
    a: 'Email info@quizotic.live with your account email and request account deletion. We will delete all your data within 7 days. Participant data (display names and responses from your sessions) is also deleted.',
  },
  {
    q: 'What data does Quizotic collect?',
    a: 'For hosts: name, email, and profile picture (via Google OAuth or email sign-in). For participants: only the display name they choose — no account required, no personal data collected. See our Privacy Policy for the full picture.',
  },
  {
    q: 'Can I use Quizotic for competitive exam coaching (JEE, NEET, UPSC)?',
    a: 'Absolutely. Quizotic is widely used in coaching institutes for JEE, NEET, UPSC, and other competitive exams. The Assessment session mode, Case Study question type, Bloom\'s level tagging, and Confidence Grid are particularly useful for rigorous exam preparation. AI generation from NCERT-aligned content works well too.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email info@quizotic.live. We personally read every message and aim to respond within 24 hours on working days.',
  },
]

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: a,
    },
  })),
}

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'FAQ', href: '/faq' },
            ]} />
          </div>

          <h1
            className="text-3xl font-black mb-2"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Frequently Asked Questions
          </h1>
          <p className="text-sm mb-10" style={{ color: '#6B7280' }}>
            Can&apos;t find what you need?{' '}
            <a href="mailto:info@quizotic.live" style={{ color: '#0F1B3D', fontWeight: 600 }}>
              Email us
            </a>{' '}
            — we read every message.
          </p>

          <div className="space-y-6">
            {FAQS.map(({ q, a }) => (
              <section key={q}>
                <h2 className="text-base font-bold mb-2" style={{ color: '#0F1B3D' }}>
                  {q}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                  {a}
                </p>
                <hr className="mt-6" style={{ borderColor: '#F3F4F6' }} />
              </section>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/auth/signin"
              className="inline-block font-bold px-8 py-3 rounded-lg text-sm"
              style={{
                background: '#FBD13B',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
                boxShadow: '3px 3px 0 #0D0D0D',
              }}
            >
              Start free →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
