'use client'

import Link from 'next/link'
import { QuizoticLogo } from '@/components/QuizoticLogo'

const FOOTER_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '#methodology', label: 'Methodology' },
  { href: '/auth/signin', label: 'Sign In' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

const COMPARE_LINKS = [
  { href: '/vs/slido', label: 'vs Slido' },
  { href: '/vs/mentimeter', label: 'vs Mentimeter' },
  { href: '/vs/kahoot', label: 'vs Kahoot' },
  { href: '/vs/quizizz', label: 'vs Quizizz' },
  { href: '/vs/ahaslides', label: 'vs AhaSlides' },
]

const RESOURCE_LINKS = [
  { href: '/learn', label: 'Learn' },
  { href: '/templates', label: 'Templates' },
  { href: '/alternatives/slido', label: 'Slido alternatives' },
  { href: '/alternatives/kahoot', label: 'Kahoot alternatives' },
  { href: '/alternatives/quizizz', label: 'Quizizz alternatives' },
  { href: '/alternatives/mentimeter', label: 'Mentimeter alternatives' },
  { href: '/alternatives/poll-everywhere', label: 'Poll Everywhere alternatives' },
  { href: '/alternatives/ahaslides', label: 'AhaSlides alternatives' },
]

// Audience landing pages — give Google a clear signal that we serve each
// segment, and surface them within 1 click of the home page.
const FOR_LINKS = [
  { href: '/for/teachers', label: 'For Teachers' },
  { href: '/for/schools', label: 'For Schools' },
  { href: '/for/coaching-institutes', label: 'For Coaching Institutes' },
  { href: '/for/colleges', label: 'For Colleges' },
  { href: '/for/corporate-trainers', label: 'For Corporate Trainers' },
  { href: '/for/event-hosts', label: 'For Event Hosts' },
]

// Solution landing pages — high-intent product keywords. Each has its own
// SEO page; without a footer link they were 2+ clicks deep and Google
// deprioritized crawling them.
const SOLUTION_LINKS = [
  { href: '/live-quiz', label: 'Live Quiz' },
  { href: '/interactive-presentation', label: 'Interactive Presentation' },
  { href: '/ai-quiz-generator', label: 'AI Quiz Generator' },
  { href: '/gamified-learning', label: 'Gamified Learning' },
  { href: '/live-polling', label: 'Live Polling' },
  { href: '/quiz-maker', label: 'Quiz Maker' },
  { href: '/pdf-to-quiz', label: 'PDF to Quiz' },
  { href: '/ncert-quiz-generator', label: 'NCERT Quiz Generator' },
]

// Hand-picked /learn articles with the strongest India-market search
// intent. The full /learn index is still linked above for crawlers to
// reach the long tail.
const GUIDE_LINKS = [
  { href: '/learn/how-to-run-a-live-quiz-cbse-classroom', label: 'Live quiz in CBSE class' },
  { href: '/learn/best-quiz-app-jee-neet-coaching-institutes', label: 'Best quiz app for coaching' },
  { href: '/learn/how-to-create-quiz-from-pdf', label: 'Make a quiz from a PDF' },
  { href: '/learn/cbse-class-10-free-quiz-questions', label: 'CBSE Class 10 quiz bank' },
  { href: '/learn/how-to-make-interactive-presentation', label: 'Interactive presentation guide' },
  { href: '/learn/slido-alternatives-india-2026', label: 'Slido alternatives' },
  { href: '/learn/compliance-training-quiz-tool-india', label: 'Compliance training quizzes' },
  { href: '/learn/kahoot-pricing-india-vs-alternatives', label: 'Kahoot pricing vs alternatives' },
]

export function Footer() {
  return (
    <footer style={{ background: '#0F1B3D', borderTop: '2px solid #F5E642', padding: 'clamp(36px, 7vw, 48px) 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* Wordmark */}
        <QuizoticLogo variant="onDark" className="text-2xl" markSize={38} />

        {/* Links */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          {FOOTER_LINKS.map(l => (
            l.href.startsWith('#')
              ? <a key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = '#F5E642'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.65)'}>{l.label}</a>
              : <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </div>

        {/* Compare row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Compare
          </span>
          {COMPARE_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Resources row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Resources
          </span>
          {RESOURCE_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* For (audience) row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            For
          </span>
          {FOR_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Solutions row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Solutions
          </span>
          {SOLUTION_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Popular guides row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Popular guides
          </span>
          {GUIDE_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Science line */}
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 600, lineHeight: 1.6 }}>
          Built on Bloom&apos;s Taxonomy, Confidence Grid &amp; Spaced Retrieval — peer-reviewed learning science.
        </p>

        {/* Copyright */}
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2025 Quizotic · quizotic.live
        </p>
      </div>
    </footer>
  )
}
