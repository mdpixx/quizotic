import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { StickyNav } from '@/components/landing/StickyNav'
import { Hero } from '@/components/landing/Hero'
import { QuizVsPresentation } from '@/components/landing/QuizVsPresentation'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { LearningScience } from '@/components/landing/LearningScience'
import { SlideTypeShowcase } from '@/components/landing/SlideTypeShowcase'
import { ProductShowcase } from '@/components/landing/ProductShowcase'
import { BrandRecall } from '@/components/landing/BrandRecall'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  description:
    'Free live quiz and interactive presentation platform. Built on learning science — Bloom\'s Taxonomy, Confidence Grid & Spaced Retrieval. INR billing with UPI.',
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
        <QuizVsPresentation />
        <HowItWorks />
        <LearningScience />
        <SlideTypeShowcase />
        <ProductShowcase />
        <BrandRecall />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
