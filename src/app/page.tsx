import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { StickyNav } from '@/components/landing/StickyNav'
import { Hero } from '@/components/landing/Hero'
import { ProductShowcase } from '@/components/landing/ProductShowcase'
import { SlideTypeShowcase } from '@/components/landing/SlideTypeShowcase'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { InteractiveDemo } from '@/components/landing/InteractiveDemo'
import { LearningScience } from '@/components/landing/LearningScience'
import { BentoFeatures } from '@/components/landing/BentoFeatures'
import { UseCases } from '@/components/landing/UseCases'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/host')

  return (
    <>
      <StickyNav />
      <main>
        <Hero />
        <ProductShowcase />
        <SlideTypeShowcase />
        <HowItWorks />
        <InteractiveDemo />
        <LearningScience />
        <BentoFeatures />
        <UseCases />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
