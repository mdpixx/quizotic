import { JsonLd } from '@/components/seo/JsonLd'

const FAQS = [
  {
    question: 'What is Quizotic?',
    answer: 'Quizotic is a free AI quiz generator and live quiz platform built in India. It combines Kahoot-style competitive quizzes with Mentimeter-style interactive presentations — polls, word clouds, Q&A — in one browser-based tool. No app install for participants. INR billing with UPI.',
  },
  {
    question: 'How is Quizotic different from Kahoot, Quizizz, or Slido?',
    answer: 'Quizotic supports 11 question types (vs Kahoot\'s 4), includes AI quiz generation on the free plan, adds Bloom\'s Taxonomy tagging and Confidence Grid diagnostics, and prices in INR with UPI. Unlike Slido, it includes a full competitive quiz engine. Unlike Quizizz, it is purpose-built for Indian curriculum (NCERT, CBSE) and priced locally.',
  },
  {
    question: 'Can I generate quizzes from a PDF or NCERT chapter?',
    answer: 'Yes. Upload any text-based PDF — NCERT chapter, coaching handout, corporate compliance document — and get a Bloom-tagged, ready-to-launch quiz in under 60 seconds. The NCERT Quiz Generator has class/subject/chapter presets so you don\'t even need to upload a PDF.',
  },
  {
    question: 'Does Quizotic work for corporate training?',
    answer: 'Yes. Corporate trainers use Quizotic for gamified onboarding, compliance quizzes, live workshop polls, and audience Q&A. Team plans include multi-trainer accounts, shared quiz libraries, and bulk-export reports. INR billing with a domestic GST invoice.',
  },
  {
    question: 'What does Quizotic cost in India?',
    answer: 'Free plan: up to 10 participants per live session, unlimited quizzes, all interaction types, 30 AI-generated questions per month — no credit card required. Pro: ₹499/month for up to 200 participants and unlimited AI generation. Team: ₹1,499/month for 5 host seats with shared libraries and dashboards. All plans accept UPI.',
  },
  {
    question: 'How does the AI quiz generator work?',
    answer: 'Type a topic ("NCERT Class 10 Chapter 2 — Acids, Bases and Salts"), upload a PDF, or paste text. Quizotic reads the source, identifies key concepts, and produces multiple-choice questions tagged to Bloom\'s Taxonomy levels (Remember → Create). You review and edit, then launch live or share self-paced.',
  },
  {
    question: 'Does Quizotic integrate with Google Classroom or Moodle?',
    answer: 'Quiz results export to CSV for import into any LMS gradebook. Participants join with a 6-digit PIN — no platform login required, compatible with Google Classroom, Moodle, or standalone use. Native LMS sync is on the 2026 roadmap.',
  },
  {
    question: 'Is there a free plan?',
    answer: 'Yes. The free plan includes unlimited quiz creation, live sessions with up to 10 participants, all 11 question types, AI generation (30 questions/month), Bloom tagging, and session reports. No credit card required. Upgrade to Pro (₹499/month) for larger audiences.',
  },
]

export function HomepageFAQ() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return (
    <>
      <JsonLd data={faqLd} />
      <section style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '64px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 26,
              fontWeight: 800,
              color: '#0F1B3D',
              marginBottom: 32,
            }}
          >
            Frequently asked
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map(f => (
              <details
                key={f.question}
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px' }}
              >
                <summary style={{ fontWeight: 700, fontSize: 15, cursor: 'pointer', color: '#0F1B3D', lineHeight: 1.5 }}>
                  {f.question}
                </summary>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: '#4B5563', marginTop: 12 }}>
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
