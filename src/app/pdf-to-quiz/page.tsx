import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'PDF to Quiz Converter — Generate a Quiz from Any PDF',
  description:
    'Upload any PDF — textbook chapter, lecture notes, coaching handout — and get a ready-to-launch quiz with Bloom\'s Taxonomy tags and explanations. Free tier, INR pricing.',
  alternates: { canonical: '/pdf-to-quiz' },
  keywords: [
    'pdf to quiz',
    'pdf to quiz converter',
    'generate quiz from pdf',
    'pdf quiz maker',
    'convert pdf to quiz',
  ],
}

export default function PdfToQuizPage() {
  return (
    <SolutionPageLayout
      slug="pdf-to-quiz"
      h1="PDF to Quiz Converter"
      tagline="Upload a PDF. Get a quiz. No copy-paste, no manual question writing — the AI reads, summarises, and generates."
      intro="Textbook chapters, coaching handouts, research papers, lecture notes — any PDF becomes a launchable quiz in minutes. Quizotic reads the full document, identifies key concepts, and produces a Bloom-balanced quiz with MCQs, true/false, and open-ended questions. Every question comes with an explanation you can reveal after the reveal. Edit freely before launching live or sharing as self-paced."
      features={[
        { title: 'Any PDF size', description: 'Works with short handouts and multi-chapter textbooks. Breaks large documents into quizzable sections.' },
        { title: 'Preserves context', description: 'Questions reference figures, formulas, and specific sections — not shallow keyword bingo.' },
        { title: 'Bloom-balanced output', description: 'Mix of Remember, Understand, Apply, Analyse — tagged per question.' },
        { title: 'Explanations included', description: 'Every question gets a short, cited explanation for post-answer learning.' },
        { title: 'Edit before launch', description: 'Change wording, add images, swap answers — you stay in control.' },
        { title: 'Privacy-first', description: 'Uploaded PDFs are processed for your account only. Not used to train external models.' },
      ]}
      steps={[
        { title: 'Upload your PDF', description: 'Drag in the file — textbook chapter, notes, handout, or research paper.' },
        { title: 'AI generates the quiz', description: 'Within seconds, Quizotic returns a full quiz with Bloom tags and explanations.' },
        { title: 'Review and launch', description: 'Edit questions as needed, then run live, share self-paced, or set as formal assessment.' },
      ]}
      faqs={[
        {
          question: 'What PDF types work?',
          answer: 'Text-based PDFs work best (exported from Word, LaTeX, or generated digitally). Scanned PDFs work with OCR but may have lower quality output — prefer a clean text version when possible.',
        },
        {
          question: 'How long does conversion take?',
          answer: 'A single-chapter PDF (20–40 pages) converts in 30–60 seconds. Larger textbooks take a couple of minutes.',
        },
        {
          question: 'Does it work for NCERT chapters?',
          answer: 'Yes. NCERT chapters, CBSE handouts, and ICSE material are common inputs. See /ncert-quiz-generator for the India-specific flow with chapter-wise presets.',
        },
        {
          question: 'Is my uploaded PDF private?',
          answer: 'Yes. PDFs you upload are processed for your account only, stored securely, and never used to train external models or shared with other users.',
        },
        {
          question: 'How many quizzes can I generate on the free plan?',
          answer: 'Free plan includes 30 AI-generated questions per month — enough for ~3 quizzes. Pro and Team unlock higher limits.',
        },
      ]}
      related={[
        { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate from topic, text, or PDF — full flow.' },
        { title: 'NCERT Quiz Generator', href: '/ncert-quiz-generator', description: 'Chapter-wise NCERT quiz generation.' },
        { title: 'Quiz Maker', href: '/quiz-maker', description: 'Manual quiz builder with 11 question types.' },
        { title: 'Live Quiz', href: '/live-quiz', description: 'Run your generated quiz as a live game.' },
        { title: 'Pricing', href: '/pricing', description: 'AI generation limits by plan.' },
      ]}
      ctaLabel="Convert your first PDF free →"
    />
  )
}
