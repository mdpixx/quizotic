import { IBM_Plex_Mono, Inter, Sora } from 'next/font/google'

export const dashboardBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dashboard-body',
  display: 'swap',
})

export const dashboardDisplay = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-dashboard-display',
  display: 'swap',
})

export const dashboardUtility = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-dashboard-utility',
  display: 'swap',
})
