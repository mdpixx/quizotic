import { Bricolage_Grotesque, Inter } from 'next/font/google'

const storyDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-story-display',
  display: 'swap',
})

const storyBody = Inter({
  subsets: ['latin'],
  variable: '--font-story-body',
  display: 'swap',
})

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${storyDisplay.variable} ${storyBody.variable}`}>{children}</div>
}
