// Brand identity constants — update BRAND_PROFILES with real URLs as profiles are created.
// These flow into Organization.sameAs on the homepage and into llms.txt.

export const BRAND = {
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  logo: 'https://www.quizotic.live/icons/icon-512.png',
  description:
    'Live quiz and interactive presentation platform for schools, coaching institutes, colleges, and corporate trainers. Free to start, built on learning science.',
  slogan: 'Live quizzes. Built on learning science.',
  foundingDate: '2024',
  foundingLocation: { '@type': 'Place', addressCountry: 'IN' },
  knowsAbout: [
    'AI quiz generator',
    'live quiz platform',
    'NCERT quiz',
    'Kahoot alternative India',
    'Quizizz alternative India',
    'Slido alternative India',
    'interactive presentations',
    'corporate training quizzes',
    'CBSE classroom engagement',
  ],
}

// Founder identity — single source for the About page Person schema, the
// homepage Organization.founder property, and the homepage founder card.
// Personal profile links live here, NOT in BRAND_PROFILES (org-level sameAs).
export const FOUNDER = {
  name: 'Mahesh Dhiman',
  title: 'Founder',
  bio: 'Learning & development professional who designs and runs training for 12,000+ employees at one of India’s largest energy companies.',
  url: 'https://www.linkedin.com/in/mdpixx',
  image: 'https://www.quizotic.live/founder/mahesh-dhiman.jpg',
}

// Fill in URLs below as profiles are created (Product Hunt, Crunchbase, LinkedIn, etc.)
// Empty strings are filtered out of sameAs automatically.
export const BRAND_PROFILES = {
  twitter: '',        // e.g. 'https://twitter.com/quizoticlive'
  linkedin: '',       // e.g. 'https://www.linkedin.com/company/quizotic'
  instagram: '',      // e.g. 'https://www.instagram.com/quizotic.live'
  youtube: '',        // e.g. 'https://www.youtube.com/@quizotic'
  producthunt: '',    // e.g. 'https://www.producthunt.com/products/quizotic'
  crunchbase: '',     // e.g. 'https://www.crunchbase.com/organization/quizotic'
  wikidata: '',       // e.g. 'https://www.wikidata.org/wiki/Q...'
}

export const BRAND_SAME_AS = Object.values(BRAND_PROFILES).filter(Boolean)
