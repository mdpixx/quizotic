import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";

// Self-hosted via next/font (served from our own origin → CSP `font-src 'self'`
// covers it, no Google CDN dependency). display:'swap' avoids invisible text on
// slow classroom networks. CSS vars are consumed by globals.css.
// Inter matches Slido's clean, neutral typographic feel.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-loaded",
  display: "swap",
});
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { FloatingFeedbackButton } from "@/components/FloatingFeedbackButton";

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

// Verification meta tags are only emitted when the env vars are set.
// Set NEXT_PUBLIC_GSC_VERIFICATION + NEXT_PUBLIC_BING_VERIFICATION on Railway after
// creating the Search Console / Bing Webmaster properties.
const GSC_TOKEN = process.env.NEXT_PUBLIC_GSC_VERIFICATION;
const BING_TOKEN = process.env.NEXT_PUBLIC_BING_VERIFICATION;
if (GSC_TOKEN || BING_TOKEN) {
  metadata.verification = {
    ...(GSC_TOKEN ? { google: GSC_TOKEN } : {}),
    ...(BING_TOKEN ? { other: { 'msvalidate.01': BING_TOKEN } } : {}),
  };
}

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

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
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        {GA4_ID ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}', { send_page_view: true });`,
              }}
            />
          </>
        ) : null}
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ServiceWorkerRegister />
        <AuthProvider>
          <PostHogProvider>
            <ThemeProvider>
              <Background />
              {children}
              <FloatingFeedbackButton />
            </ThemeProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
