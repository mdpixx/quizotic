import { JsonLd } from '@/components/seo/JsonLd'

const FAQS = [
  {
    question: 'What is Quizotic?',
    answer: 'Quizotic is a free AI quiz generator and live quiz platform. It combines Kahoot-style competitive quizzes with Mentimeter-style interactive presentations — polls, word clouds, Q&A — in one browser-based tool. No app install for participants.',
  },
  {
    question: 'How is Quizotic different from Kahoot, Quizizz, or Slido?',
    answer: 'Quizotic supports 11 question types (vs Kahoot\'s 4), includes AI quiz generation on the free plan, and adds Bloom\'s Taxonomy tagging and Confidence Grid diagnostics. Unlike Slido, it includes a full competitive quiz engine. Unlike Quizizz, it pairs AI generation with per-student Bloom-level reporting so you can see exactly where learners need work.',
  },
  {
    question: 'Can I generate quizzes from a PDF or textbook chapter?',
    answer: 'Yes. Upload any text-based PDF — textbook chapter, coaching handout, corporate compliance document — and get a Bloom-tagged, ready-to-launch quiz in under 60 seconds. The AI generator also offers class/subject/chapter presets so you don\'t even need to upload a PDF.',
  },
  {
    question: 'Does Quizotic work for corporate training?',
    answer: 'Yes. Corporate trainers use Quizotic for gamified onboarding, compliance quizzes, live workshop polls, and audience Q&A. Team plans include multi-trainer accounts, shared quiz libraries, and bulk-export reports.',
  },
  {
    question: 'What does Quizotic cost?',
    answer: 'Quizotic is free to use right now: unlimited quizzes, all interaction types, and AI-generated questions, with no credit card required. Paid Pro and Team plans for larger audiences and team libraries are coming soon.',
  },
  {
    question: 'How does the AI quiz generator work?',
    answer: 'Type a topic ("Class 10 Chemistry — Acids, Bases and Salts"), upload a PDF, or paste text. Quizotic reads the source, identifies key concepts, and produces multiple-choice questions tagged to Bloom\'s Taxonomy levels (Remember → Create). You review and edit, then launch live or share self-paced.',
  },
  {
    question: 'Does Quizotic integrate with Google Classroom or Moodle?',
    answer: 'Quiz results export to CSV for import into any LMS gradebook. Participants join with a 6-digit PIN — no platform login required, compatible with Google Classroom, Moodle, or standalone use. Native LMS sync is on the 2026 roadmap.',
  },
  {
    question: 'Is there a free plan?',
    answer: 'Yes. The free plan includes unlimited quiz creation, live sessions, all 11 question types, AI generation, Bloom tagging, and session reports. No credit card required. Paid plans for larger audiences are coming soon.',
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
      <section style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: 'clamp(40px, 8vw, 64px) 24px' }}>
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
                <p className="prose-justify" style={{ fontSize: 14, lineHeight: 1.75, color: '#4B5563', marginTop: 12 }}>
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
