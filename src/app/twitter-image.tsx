import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Quizotic — Free Live Quiz & Presentation Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Same OG image for Twitter cards
export { default } from './opengraph-image'
