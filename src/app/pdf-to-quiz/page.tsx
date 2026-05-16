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
      tldr={[
        'Upload a text-based PDF (textbook chapter, notes, handout, research paper) — no size limit.',
        'AI reads the full document and produces Bloom-balanced MCQs with explanations in under 60 seconds.',
        'Works for NCERT chapters, CBSE handouts, JEE/NEET material, corporate compliance docs.',
        'Edit any question before launching live or assigning as self-paced homework.',
        'Your PDFs are private — not shared or used to train external models.',
      ]}
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
      comparisonSection={{
        heading: 'PDF to Quiz — how Quizotic compares',
        rows: [
          { feature: 'AI reads full document (not just first page)', quizotic: 'Yes', competitor: 'Most tools: Only first ~10 pages', winner: 'quizotic' },
          { feature: 'Bloom-tagged output', quizotic: 'Yes — every question tagged R/U/Ap/An/E/C', competitor: 'No other tool does this', winner: 'quizotic' },
          { feature: 'Live quiz from the output (same platform)', quizotic: 'Yes — one click', competitor: 'Export then re-import required', winner: 'quizotic' },
          { feature: 'Explanation per question', quizotic: 'Yes — auto-generated with page context', competitor: 'Most tools: No', winner: 'quizotic' },
          { feature: 'Scanned PDF support (OCR)', quizotic: 'Yes (lower quality than digital PDF)', competitor: 'Varies', winner: 'tie' },
          { feature: 'Free monthly limit', quizotic: '30 Qs/month free', competitor: 'Most charge from Q1', winner: 'quizotic' },
          { feature: 'INR billing + UPI', quizotic: 'Yes', competitor: 'All USD-billed', winner: 'quizotic' },
        ],
      }}
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
        {
          question: 'What is the maximum PDF file size?',
          answer: 'Up to 50MB per file. For textbooks, split by chapter for faster processing and better-focused questions.',
        },
        {
          question: 'Does it work for Hindi or regional-language PDFs?',
          answer: 'Yes for digitally-created Hindi PDFs. Machine-printed Devanagari text in PDF format processes well. Handwritten Hindi scans don\'t work yet.',
        },
        {
          question: 'Can I generate assertion-reasoning questions from a PDF?',
          answer: 'Yes — select \'CBSE-style\' in the question format option. The AI will produce assertion-reasoning MCQs from the PDF content where the structure allows.',
        },
        {
          question: 'What if the AI generates wrong questions?',
          answer: 'Always review before launching. The editor lets you rewrite, delete, or add questions. For technical/numerical content (JEE Math, Chemistry equations), edit the AI output to ensure formula precision.',
        },
        {
          question: 'Can I generate quizzes from NCERT PDFs?',
          answer: 'Yes. NCERT chapter PDFs work very well. See /ncert-quiz-generator for the NCERT-specific flow with class/subject/chapter presets — it\'s faster if you know the chapter.',
        },
        {
          question: 'Does it work for corporate training materials?',
          answer: 'Yes. HR handbooks, compliance documents, SOPs, product training manuals — all convert well. Useful for compliance quiz automation.',
        },
        {
          question: 'Can multiple teachers on the same plan share a generated quiz?',
          answer: 'Yes on Team plans. Generate a quiz from a PDF, then co-authors can view and edit it. Share the finished quiz link with other teachers in the team.',
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
