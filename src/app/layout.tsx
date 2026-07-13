import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";

// Self-hosted via next/font (served from our own origin → CSP `font-src 'self'`
// covers it, no Google CDN dependency). display:'swap' avoids invisible text on
// slow classroom networks. CSS vars are consumed by globals.css.
//
// Quiz type voice — Poppins. A rounded geometric sans that stays crisp on a
// projector at the back of a classroom while feeling friendly and energetic
// (replacing Plus Jakarta Sans + Bricolage Grotesque, which read as too plain
// on the quiz pages). Used for BOTH body and the big projected moments so the
// question, options, numbers, and winner all share one cohesive family. Exposed
// under the existing --font-*-loaded variable names so every globals.css
// consumer picks it up unchanged.
const bodyFont = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter-loaded",
  display: "swap",
});

const displayFont = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap",
});
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { FeedbackProvider } from "@/components/FeedbackProvider";

export const metadata: Metadata = {
  title: {
    default: 'Quizotic — Free Live Quiz & Presentation Platform',
    template: '%s | Quizotic',
  },
  description:
    'Create live quizzes and interactive presentations in seconds. AI-powered quiz generation, real-time leaderboards, word clouds, polls. Free to start. No app install needed.',
  keywords: [
    'live quiz', 'quiz platform', 'kahoot alternative',
    'mentimeter alternative', 'interactive presentation', 'classroom quiz',
    'AI quiz generator', 'live polling', 'word cloud', 'quiz app',
    'free quiz maker', 'online quiz', 'quiz for teachers', 'quiz for training',
    'interactive classroom', 'real-time quiz',
    'quizotic', 'live quiz platform',
  ],
  authors: [{ name: 'Quizotic' }],
  creator: 'Quizotic',
  // No default `alternates.canonical` here: it would be inherited verbatim by
  // every page that doesn't set its own, silently canonicalizing them to the
  // homepage and telling Google not to index them. Each page declares its own.
  metadataBase: new URL('https://www.quizotic.live'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.quizotic.live',
    siteName: 'Quizotic',
    title: 'Quizotic — Free Live Quiz & Presentation Platform',
    description:
      'Create live quizzes and interactive presentations in seconds. AI-powered, real-time, free to start. No app install.',
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
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <head>
        {/*
          Google Translate (and similar in-page translators) swap text nodes out
          from under React. When React's reconciler later calls removeChild /
          insertBefore on a node Translate already moved, the browser throws
          "NotFoundError: Failed to execute 'removeChild'..." and the page white-
          screens. This was our #2 error source (46× on /host/quizzes). Guarding
          the two DOM methods to no-op on a mismatched parent is the standard,
          battle-tested fix and is harmless to normal rendering. Must run before
          hydration, so it's inline at the top of <head>.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof Node!=='function'||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){return c;}return r.apply(this,arguments);};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return n;}return i.apply(this,arguments);};})();`,
          }}
        />
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
              <FeedbackProvider>
                {children}
              </FeedbackProvider>
            </ThemeProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
