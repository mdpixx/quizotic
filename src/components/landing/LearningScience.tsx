const PILLARS = [
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="22" fill="#7C3AED" fillOpacity="0.12"/>
        <path d="M24 10 L26.5 17.5 L34 17.5 L28 22.5 L30.5 30 L24 25.5 L17.5 30 L20 22.5 L14 17.5 L21.5 17.5 Z"
          fill="#7C3AED" opacity="0.9"/>
      </svg>
    ),
    tag: 'Retrieval Practice',
    headline: 'Testing beats re-reading',
    body: 'Research shows active recall improves long-term retention by 50–100% vs. passive review. Quizotic sprinkles retrieval moments throughout your session — not just at the end.',
    citation: 'Roediger & Karpicke, 2006 (d ≈ 0.55)',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="22" fill="#EC4899" fillOpacity="0.12"/>
        <circle cx="24" cy="24" r="8" stroke="#EC4899" strokeWidth="2.5" fill="none"/>
        <path d="M24 8 L24 14 M24 34 L24 40 M8 24 L14 24 M34 24 L40 24" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M14.1 14.1 L18.2 18.2 M29.8 29.8 L33.9 33.9 M14.1 33.9 L18.2 29.8 M29.8 18.2 L33.9 14.1" stroke="#EC4899" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    tag: 'Spacing Effect',
    headline: 'Memory fades — until you bring it back',
    body: 'Distributing practice over time doubles long-term retention. After your live session, Quizotic generates a 3-part follow-up series at Day 1, Day 7, and Day 30.',
    citation: 'Cepeda et al., 2008 (effect doubled vs. massed practice)',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="22" fill="#F59E0B" fillOpacity="0.12"/>
        <path d="M12 36 L20 22 L28 30 L36 14" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="20" cy="22" r="3" fill="#F59E0B"/>
        <circle cx="28" cy="30" r="3" fill="#F59E0B"/>
        <circle cx="36" cy="14" r="3" fill="#F59E0B"/>
        <circle cx="12" cy="36" r="3" fill="#F59E0B"/>
      </svg>
    ),
    tag: 'Case-Based Learning',
    headline: 'Decisions sharpen through practice',
    body: 'Real-world scenarios improve judgment and transfer far better than knowledge tests alone. Quizotic\'s Scenario blocks let your team choose, fail safely, and reflect on expert reasoning.',
    citation: 'Williams, 1992 — medical education outcomes study',
  },
]

export function LearningScience() {
  return (
    <section className="py-20 px-6 md:px-12" style={{ background: '#F3EEFF' }}>
      <div className="max-w-[1280px] mx-auto">

        {/* Eyebrow + heading */}
        <div className="mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#7C3AED' }}>
            built on evidence
          </p>
          <h2 className="text-4xl sm:text-5xl font-black lowercase tracking-tight mb-3"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
            why it works
          </h2>
          <p className="text-base max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
            Every Quizotic feature is grounded in learning science — the same research used by top universities and L&D teams worldwide.
          </p>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map(pillar => (
            <div key={pillar.tag}
              className="rounded-3xl p-7 flex flex-col gap-4"
              style={{ background: '#fff', border: '1.5px solid #E9E2FF' }}>

              {/* Icon */}
              <div>{pillar.icon}</div>

              {/* Tag */}
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#7C3AED' }}>
                {pillar.tag}
              </p>

              {/* Headline */}
              <h3 className="text-xl font-black leading-snug"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
                {pillar.headline}
              </h3>

              {/* Body */}
              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-text-muted)' }}>
                {pillar.body}
              </p>

              {/* Citation */}
              <p className="text-xs font-medium" style={{ color: '#C4B5FD' }}>
                {pillar.citation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
