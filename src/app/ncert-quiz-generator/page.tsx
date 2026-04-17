import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'NCERT Quiz Generator — Chapter-Wise Quizzes for CBSE Classes',
  description:
    'Generate chapter-wise quizzes from NCERT textbooks. Works for classes 6–12 across Science, Maths, Social Studies, and English. Bloom-tagged, CBSE-aligned, INR pricing.',
  alternates: { canonical: '/ncert-quiz-generator' },
  keywords: [
    'ncert quiz generator',
    'ncert quiz',
    'cbse quiz generator',
    'class 10 quiz',
    'class 12 quiz',
    'ncert mcq generator',
    'chapter wise quiz',
  ],
}

export default function NcertQuizGeneratorPage() {
  return (
    <SolutionPageLayout
      slug="ncert-quiz-generator"
      h1="NCERT Quiz Generator"
      tagline="Chapter-wise quizzes from NCERT textbooks — Classes 6 to 12, every major subject, CBSE-aligned."
      intro="Quizotic's NCERT quiz generator is built for Indian teachers and coaching instructors. Pick a class, subject, and chapter; Quizotic produces a Bloom-balanced quiz aligned to CBSE learning outcomes. Upload a specific NCERT PDF for chapter-precise questions, or start from the chapter name alone. Every quiz is editable and ready to launch live or assign as homework."
      features={[
        { title: 'Classes 6–12 coverage', description: 'Works across primary, middle, and senior secondary. Math, Science, Social, English, and more.' },
        { title: 'CBSE-aligned', description: 'Questions match CBSE-style patterns — MCQ, assertion-reasoning, case-based, short answer.' },
        { title: 'Chapter-wise quizzes', description: 'Pick a single chapter or bundle multiple chapters for a unit test or term revision.' },
        { title: 'Bloom\'s Taxonomy', description: 'Every question tagged to a Bloom level — so you can see depth coverage across Remember → Create.' },
        { title: 'Live or assessment mode', description: 'Run as a live multiplayer quiz in class, assign as self-paced homework, or run a formal test.' },
        { title: 'Free tier', description: 'Generate quizzes on the free plan. Pro and Team unlock higher volumes for coaching institutes.' },
      ]}
      steps={[
        { title: 'Pick class, subject, chapter', description: 'Example: Class 10, Science, Chapter 2 — Acids, Bases and Salts.' },
        { title: 'Upload NCERT PDF (optional)', description: 'For maximum alignment, upload the chapter PDF. Otherwise, AI uses its knowledge of the NCERT curriculum.' },
        { title: 'Launch or assign', description: 'Review the generated quiz, edit if needed, then run live or share a self-paced link.' },
      ]}
      faqs={[
        {
          question: 'Is this officially affiliated with NCERT?',
          answer: 'No. Quizotic is an independent platform; we generate quizzes aligned to the NCERT curriculum but are not affiliated with NCERT or CBSE. NCERT is a trademark of its owner.',
        },
        {
          question: 'Which subjects does it cover?',
          answer: 'All major NCERT subjects across Classes 6–12 — Maths, Science (Physics, Chemistry, Biology), Social Science (History, Geography, Civics, Economics), English, Hindi, Political Science, Business Studies, Accountancy.',
        },
        {
          question: 'Can I use it for coaching class quizzes?',
          answer: 'Yes. Coaching institutes use Quizotic for daily chapter quizzes, weekly revisions, and mock test prep. Team plans include bulk seats and admin dashboards.',
        },
        {
          question: 'Does it support CBSE assertion-reasoning questions?',
          answer: 'Yes. The AI generator produces CBSE-style question patterns including MCQ, assertion-reasoning, case-based, and short-answer formats.',
        },
        {
          question: 'Can students take the quiz on their phones?',
          answer: 'Yes. Students join at quizotic.live/join with a 6-digit game PIN — no app install needed. Works on any phone browser, even on low-bandwidth connections.',
        },
      ]}
      related={[
        { title: 'PDF to Quiz', href: '/pdf-to-quiz', description: 'Upload any PDF — NCERT or other — and generate a quiz.' },
        { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'General-purpose AI quiz generation.' },
        { title: 'Quiz Maker', href: '/quiz-maker', description: 'Manual quiz builder for custom questions.' },
        { title: 'Live Quiz', href: '/live-quiz', description: 'Run quizzes as live multiplayer games.' },
        { title: 'Pricing', href: '/pricing', description: 'Plans and limits in INR with UPI.' },
      ]}
      ctaLabel="Generate your first NCERT quiz free →"
    />
  )
}
