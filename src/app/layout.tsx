import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: 'Quizotic — Free Live Quiz & Presentation Platform',
    template: '%s | Quizotic',
  },
  description:
    'Create live quizzes and interactive presentations in seconds. AI-powered quiz generation, real-time leaderboards, word clouds, polls. Free to start, INR billing, UPI payments. No app install needed.',
  keywords: [
    'live quiz', 'quiz platform', 'kahoot alternative', 'kahoot alternative india',
    'mentimeter alternative', 'interactive presentation', 'classroom quiz',
    'AI quiz generator', 'live polling', 'word cloud', 'quiz app',
    'free quiz maker', 'online quiz', 'quiz for teachers', 'quiz for training',
    'interactive classroom', 'real-time quiz', 'UPI quiz platform',
    'quizotic', 'live quiz platform india',
  ],
  authors: [{ name: 'Quizotic' }],
  creator: 'Quizotic',
  metadataBase: new URL('https://www.quizotic.live'),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://www.quizotic.live',
    siteName: 'Quizotic',
    title: 'Quizotic — Free Live Quiz & Presentation Platform',
    description:
      'Create live quizzes and interactive presentations in seconds. AI-powered, real-time, INR billing. No app install.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quizotic — Free Live Quiz Platform',
    description:
      'AI-powered live quizzes & interactive presentations. Free to start.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Quizotic',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D0D0D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ServiceWorkerRegister />
        <AuthProvider>
          <PostHogProvider>
            <ThemeProvider>
              <Background />
              {children}
            </ThemeProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
