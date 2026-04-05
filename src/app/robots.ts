import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/host/', '/api/', '/auth/'],
    },
    sitemap: 'https://www.quizotic.live/sitemap.xml',
  }
}
