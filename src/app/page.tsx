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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  description:
    'Free live quiz and interactive presentation platform. AI-powered quiz generation, real-time leaderboards, polls, word clouds. INR billing with UPI.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    description: 'Free tier available',
  },
}

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/host')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
