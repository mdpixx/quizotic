import { StickyNav } from '@/components/landing/StickyNav'
import { Hero } from '@/components/landing/Hero'
import { InteractiveDemo } from '@/components/landing/InteractiveDemo'
import { AIBuilderSection } from '@/components/landing/AIBuilderSection'
import { CTASection } from '@/components/landing/CTASection'
import { LearningScience } from '@/components/landing/LearningScience'
import { Footer } from '@/components/landing/Footer'
import { WaveDivider } from '@/components/landing/WaveDivider'

// Section background colors — keep in sync with each section's bg
const C = {
  bg:      '#FAFAFE',  // Hero + InteractiveDemo
  white:   '#ffffff',
  surface: '#F3EEFF',  // AIBuilderSection gradient start
  cta:     '#F3EEFF',  // CTASection
  darkest: '#0D0B1E',  // Footer
}

export default function Home() {
  return (
    <>
      <StickyNav />
      <main>
        <Hero />

        {/* BG → White */}
        <WaveDivider above={C.bg} below={C.white} shape="gentle" height={110} />
        <InteractiveDemo />

        {/* White → Surface violet */}
        <WaveDivider above={C.white} below={C.surface} shape="scallop" height={120} />
        <LearningScience />

        {/* Surface → Surface (flat transition into AI builder) */}
        <AIBuilderSection />

        {/* Surface → CTA */}
        <WaveDivider above={C.surface} below={C.cta} shape="soft" height={110} flip />
        <CTASection />

        {/* CTA → Footer darkest */}
        <WaveDivider above={C.cta} below={C.darkest} shape="gentle" height={90} flip />
      </main>
      <Footer />
    </>
  )
}
