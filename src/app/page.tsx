import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { JsonLd } from '@/components/seo/JsonLd'
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

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  logo: 'https://www.quizotic.live/icon.svg',
  description: 'India-first live quiz and interactive presentation platform for schools, coaching institutes, colleges, and corporate trainers. Free to start, INR billing, UPI payments.',
  foundingLocation: {
    '@type': 'Place',
    addressCountry: 'IN',
  },
  sameAs: [],
}

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/host')

  return (
    <>
      <JsonLd data={[jsonLd, organizationLd]} />
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
