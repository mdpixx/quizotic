import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { StickyNav } from '@/components/landing/StickyNav'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { FloatingElements } from '@/components/landing/FloatingElements'
import { Hero } from '@/components/landing/Hero'
import { WaveDivider } from '@/components/landing/WaveDivider'
import { ProductShowcase } from '@/components/landing/ProductShowcase'
import { QuizVsPresentation } from '@/components/landing/QuizVsPresentation'
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
      <ScrollProgress />
      <FloatingElements />
      <main>
        <Hero />
        <WaveDivider topColor="#FFFBF5" bottomColor="#fff" variant={1} />
        <LearningScience />
        <WaveDivider topColor="#fff" bottomColor="#fff" variant={2} />
        <ProductShowcase />
        <WaveDivider topColor="#fff" bottomColor="#fff" variant={3} />
        <QuizVsPresentation />
        <WaveDivider topColor="#fff" bottomColor="#FFFBF5" variant={4} />
        <SlideTypeShowcase />
        <WaveDivider topColor="#FFFBF5" bottomColor="#FFFBF5" variant={1} />
        <HowItWorks />
        <WaveDivider topColor="#FFFBF5" bottomColor="#fff" variant={2} />
        <InteractiveDemo />
        <WaveDivider topColor="#fff" bottomColor="#FFFBF5" variant={3} />
        <BentoFeatures />
        <WaveDivider topColor="#FFFBF5" bottomColor="#fff" variant={4} />
        <UseCases />
        <WaveDivider topColor="#fff" bottomColor="#FFFBF5" variant={1} />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
