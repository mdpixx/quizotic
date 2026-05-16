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
      tldr={[
        'Works for Classes 6–12 — all NCERT subjects including Math, Science, Social, English, and Hindi.',
        'Upload any NCERT chapter PDF for chapter-precise questions, or start from just the chapter name.',
        'Every question is Bloom-tagged: Remember → Create coverage in one quiz.',
        'Free plan: 30 AI-generated questions/month (~3 full quizzes). No credit card.',
        'Students join on any phone at quizotic.live/join with a 6-digit PIN — no app install.',
      ]}
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
      audienceCards={[
        { title: 'CBSE School Teachers', description: 'Run chapter-wise quizzes after every class. Generate from the NCERT textbook PDF; launch a live game in 10 minutes.', href: '/for/teachers' },
        { title: 'JEE/NEET Coaching', description: 'Bloom-tagged MCQs from NCERT chapters, assertion-reasoning format, PDF import from PYQ handouts.', href: '/for/coaching-institutes' },
        { title: 'ICSE & State Boards', description: 'Upload any textbook chapter PDF — works for ICSE, Maharashtra, Karnataka, and other state boards.', href: '/for/schools' },
        { title: 'Parent-led Home Tutors', description: 'Generate and run a 10-question quiz from tonight\'s chapter in under 5 minutes.', href: '/quiz-maker' },
      ]}
      comparisonSection={{
        heading: 'Quizotic vs other NCERT quiz tools',
        rows: [
          { feature: 'Free quiz generation', quizotic: 'Yes — 30 Qs/month free', competitor: 'Diksha: free but limited; Embibe/Vedantu: paid', winner: 'tie' },
          { feature: 'Upload own chapter PDF', quizotic: 'Yes', competitor: 'Diksha: No; Embibe: No; Vedantu: No', winner: 'quizotic' },
          { feature: 'Live multiplayer quiz with PIN', quizotic: 'Yes — Kahoot-style', competitor: 'None support live multiplayer', winner: 'quizotic' },
          { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Built-in', competitor: 'None', winner: 'quizotic' },
          { feature: 'CBSE assertion-reasoning format', quizotic: 'Yes', competitor: 'Diksha: Limited; Embibe: Yes (paid)', winner: 'tie' },
          { feature: 'INR billing + UPI', quizotic: 'Yes', competitor: 'Diksha: free; Embibe/Vedantu: USD-centric', winner: 'quizotic' },
          { feature: 'Offline app', quizotic: 'No — browser only', competitor: 'Diksha: Yes', winner: 'competitor' },
        ],
      }}
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
        {
          question: 'Which NCERT classes are supported?',
          answer: 'All classes from 6 to 12. For Class 6–8 (middle school): Science, Social Science, Math, English, Hindi. For Class 9–10: Physics, Chemistry, Biology, History, Geography, Civics, Economics, Math, English. For Class 11–12: Physics, Chemistry, Biology/Biotechnology, Math, History, Political Science, Economics, Accountancy, Business Studies.',
        },
        {
          question: 'Can I generate assertion-reasoning questions?',
          answer: 'Yes. CBSE has added assertion-reasoning MCQs to Class 10 and 12 exams. Select the \'CBSE-style\' option in the AI generator and the output will include assertion-reasoning format questions for suitable chapters.',
        },
        {
          question: 'Does it work for Class 12 board exam preparation?',
          answer: 'Yes. Upload a Class 12 chapter PDF (Physics, Chemistry, Math, etc.) and the AI generates MCQs, assertion-reasoning, and case-based questions matching CBSE 2024–25 pattern. Questions include explanations and Bloom levels.',
        },
        {
          question: 'Can I generate quizzes in Hindi?',
          answer: 'Yes. Type the chapter name in Hindi or upload a Hindi-medium NCERT PDF. The output can be in Hindi, and students can join with their preferred language display.',
        },
        {
          question: 'What is the difference between the NCERT Quiz Generator and the PDF to Quiz tool?',
          answer: 'The NCERT Quiz Generator has India-curriculum presets — you just pick class, subject, and chapter; no PDF needed. The PDF to Quiz tool works for any document, including non-NCERT textbooks and coaching handouts. Both are AI-powered.',
        },
        {
          question: 'Can I get a per-student report after the quiz?',
          answer: 'Yes. After every live session, Quizotic generates a full session report: per-student accuracy, Bloom level distribution, Confidence Grid (correctly confident, incorrectly confident, correctly uncertain, incorrectly uncertain), and spaced-retrieval queue.',
        },
        {
          question: 'How many students can join on the free plan?',
          answer: 'The free plan supports up to 10 participants per live session. Pro (₹499/month) supports up to 200. For full classes or batch-level coaching, Pro is the right fit.',
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
