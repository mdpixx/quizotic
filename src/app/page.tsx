import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { JsonLd } from '@/components/seo/JsonLd'
import { BRAND, BRAND_SAME_AS } from '@/content/brand'
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
import { WhatIsQuizotic } from '@/components/landing/WhatIsQuizotic'
import { TopicClusters } from '@/components/landing/TopicClusters'
import { HomepageFAQ } from '@/components/landing/HomepageFAQ'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: BRAND.name,
  url: BRAND.url,
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
  '@id': `${BRAND.url}/#organization`,
  name: BRAND.name,
  url: BRAND.url,
  logo: BRAND.logo,
  description: BRAND.description,
  slogan: BRAND.slogan,
  foundingDate: BRAND.foundingDate,
  foundingLocation: BRAND.foundingLocation,
  knowsAbout: BRAND.knowsAbout,
  sameAs: BRAND_SAME_AS,
}

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${BRAND.url}/#website`,
  name: BRAND.name,
  url: BRAND.url,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BRAND.url}/templates?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/host')

  return (
    <>
      <JsonLd data={[jsonLd, organizationLd, websiteLd]} />
      <StickyNav />
      <main>
        <Hero />
        <WhatIsQuizotic />
        <QuizVsPresentation />
        <HowItWorks />
        <LearningScience />
        <SlideTypeShowcase />
        <ProductShowcase />
        <BrandRecall />
        <TopicClusters />
        <HomepageFAQ />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
