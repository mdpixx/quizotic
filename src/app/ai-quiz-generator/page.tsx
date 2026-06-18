import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'AI Quiz Generator — From Topic, PDF, or Notes in Seconds',
  description:
    'Generate a full quiz from any topic, PDF, or study notes. Questions are tagged to Bloom\'s Taxonomy with explanations included. Free to start, built for any classroom.',
  alternates: { canonical: '/ai-quiz-generator' },
  keywords: [
    'ai quiz generator',
    'ai quiz maker',
    'quiz generator from pdf',
    'ai question generator',
    'auto quiz generator',
    'free quiz generator',
  ],
}

export default function AiQuizGeneratorPage() {
  return (
    <SolutionPageLayout
      slug="ai-quiz-generator"
      h1="AI Quiz Generator"
      tagline="Turn a topic, a PDF, or your study notes into a ready-to-launch quiz in seconds — with Bloom's Taxonomy tags and explanations included."
      intro="Quizotic's AI quiz generator reads your source material and produces balanced quizzes across Bloom's cognitive levels — from basic recall to higher-order application and analysis. Upload a PDF, paste your notes, or just describe a topic; within seconds you get a full quiz with explanations, difficulty tags, and answer keys. Every question is editable before you launch, so you stay in control of what your class sees."
      features={[
        { title: 'Upload PDF, DOCX, or text', description: 'Drop in a chapter, lecture notes, or an article. The AI reads, summarises, and generates questions.' },
        { title: 'Bloom-balanced output', description: 'Questions are tagged Remember, Understand, Apply, Analyse, Evaluate, Create — so your quiz tests depth, not just recall.' },
        { title: 'Explanations included', description: 'Every AI question comes with a short explanation you can reveal after the reveal — great for learning.' },
        { title: 'Mix of question types', description: 'MCQ, multi-select, true/false, and open-ended — matched to the depth of your content.' },
        { title: 'Edit before you launch', description: 'Change wording, swap answers, drop questions — full control before the quiz goes live.' },
        { title: 'Free tier included', description: '30 AI-generated questions per month on the free plan. Pro and Team unlock more.' },
      ]}
      steps={[
        { title: 'Give the AI a source', description: 'Upload a PDF, paste text, or type a topic like "Class 10 Chemistry — Acids and Bases".' },
        { title: 'Review generated questions', description: 'Quizotic returns a full draft quiz with Bloom tags and explanations. Edit anything you want to change.' },
        { title: 'Launch live or assign', description: 'Run the quiz in live mode with a game PIN, or share a self-paced link for async use.' },
      ]}
      faqs={[
        {
          question: 'Which LLM powers the AI quiz generator?',
          answer: 'Quizotic uses frontier Claude and Gemini models behind the scenes, selected per task for best question quality and factual accuracy.',
        },
        {
          question: 'Can I generate quizzes from my textbook or coaching PDF?',
          answer: 'Yes. Textbook chapters, coaching handouts, and reference books are common input sources. See /ncert-quiz-generator for a curriculum-specific flow.',
        },
        {
          question: 'How many questions per quiz?',
          answer: 'Default is 10 questions; you can configure up to 30 per generation. Regenerate as often as you need within your plan limits.',
        },
        {
          question: 'Are the questions good enough for assessments?',
          answer: 'AI generations are drafts. For formal assessments, Quizotic expects you to review and refine — edit wording, verify answers, and adjust difficulty before publishing.',
        },
        {
          question: 'Do I retain copyright on generated quizzes?',
          answer: 'Yes. Quizzes you generate belong to you. Quizotic does not use your uploaded content to train external models.',
        },
      ]}
      related={[
        { title: 'PDF to Quiz', href: '/pdf-to-quiz', description: 'Upload a PDF and get a quiz — step-by-step guide.' },
        { title: 'NCERT Quiz Generator', href: '/ncert-quiz-generator', description: 'Chapter-wise quizzes for NCERT textbooks.' },
        { title: 'Quiz Maker', href: '/quiz-maker', description: 'Build quizzes manually with the full editor.' },
        { title: 'Live Quiz', href: '/live-quiz', description: 'Run your generated quiz as a live multiplayer game.' },
        { title: 'Pricing', href: '/pricing', description: 'AI generation limits on Free, Pro, and Team plans.' },
      ]}
      ctaLabel="Generate your first AI quiz free →"
    />
  )
}
