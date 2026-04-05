import type { Metadata } from "next";
import { Nunito, Fredoka } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { PostHogProvider } from "@/components/PostHogProvider";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Quizotic — Live Quiz & Presentation Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quizotic — Free Live Quiz Platform',
    description:
      'AI-powered live quizzes & interactive presentations. Free to start.',
    images: ['/og-image.png'],
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
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
