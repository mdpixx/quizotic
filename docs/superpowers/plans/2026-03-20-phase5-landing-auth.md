# Phase 5 — Landing Page + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full marketing landing page (superr.ai-inspired, 8 sections), Google OAuth sign-in, User table in PostgreSQL via Prisma, and middleware that protects `/host/*` routes.

**Architecture:** NextAuth v5 (beta) handles Google OAuth with JWT sessions — no DB session table needed. On first sign-in, the `jwt` callback upserts the User record into PostgreSQL via Prisma. Next.js middleware (`middleware.ts`) intercepts `/host/*` requests and redirects unauthenticated visitors to `/signin`. The landing page is a server-rendered page composed of 8 focused section components, each self-contained and independently testable.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind v4 · NextAuth v5 beta · Prisma ORM · PostgreSQL · `next/font/google` (Nunito) · IntersectionObserver (scroll reveals)

**Spec:** `docs/superpowers/specs/2026-03-20-phase5-landing-auth-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | User model — single source of truth for DB schema |
| `src/lib/prisma.ts` | Prisma client singleton (prevents connection pool exhaustion in dev) |
| `src/lib/auth.ts` | NextAuth config — providers, JWT/session callbacks, authorized callback |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth HTTP handler (GET + POST) |
| `src/app/signin/page.tsx` | Sign-in page — Google OAuth button, warm cream design |
| `middleware.ts` | Route guard — redirects `/host/*` to `/signin` if no session |
| `src/components/landing/Nav.tsx` | Sticky nav — logo, links, auth-aware CTA (server component) |
| `src/components/landing/Hero.tsx` | Hero section — headline, sub, CTA buttons, quiz card mockup |
| `src/components/landing/HowItWorks.tsx` | How it Works — scroll-scrubbed video placeholder + 4 steps |
| `src/components/landing/Features.tsx` | 4 feature deep-dive cards |
| `src/components/landing/Pricing.tsx` | 3-tier pricing grid — Free / Pro / Institute |
| `src/components/landing/Testimonials.tsx` | 3 teacher quotes + stats strip |
| `src/components/landing/Faq.tsx` | 6-item accordion FAQ (client component for open/close) |
| `src/components/landing/CtaFooter.tsx` | CTA banner + 4-column footer |
| `src/components/RevealOnScroll.tsx` | Client wrapper — IntersectionObserver scroll reveal |

### Modified files

| File | What changes |
|------|-------------|
| `src/app/page.tsx` | Full replacement — was "coming soon" placeholder |
| `src/app/layout.tsx` | Add Nunito font variable |
| `src/app/globals.css` | Add `.reveal` / `.revealed` animation classes + `.font-display` |
| `next.config.ts` | Add `@prisma/client` to `serverExternalPackages` |
| `.env.example` | Uncomment auth + DB env vars |

---

## Task 1: Install dependencies + update next.config.ts

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `next.config.ts`

- [ ] **Step 1: Install NextAuth v5 and Prisma**

Run from `projects/Quizotic/`:
```bash
npm install next-auth@beta
npm install @prisma/client
npm install --save-dev prisma
```

Expected: All packages install without error. `node_modules/next-auth` exists.

- [ ] **Step 2: Verify next-auth version**
```bash
node -e "console.log(require('./node_modules/next-auth/package.json').version)"
```
Expected: prints a version starting with `5.` (e.g., `5.0.0-beta.x`)

- [ ] **Step 3: Update next.config.ts to externalize Prisma**

Current content:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
```

Replace with:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@prisma/client', 'prisma'],
};

export default nextConfig;
```

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json next.config.ts
git commit -m "feat: install next-auth v5 + prisma for phase 5"
```

---

## Task 2: Prisma schema + client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Initialise Prisma**
```bash
npx prisma init --datasource-provider postgresql
```
Expected: Creates `prisma/schema.prisma` and adds `DATABASE_URL` comment to `.env`.

- [ ] **Step 2: Replace schema.prisma with the User-only model**

Replace the generated `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Create the Prisma client singleton**

Create `src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Why: Next.js hot-reload creates new module instances. Without the singleton, dev mode opens hundreds of DB connections.

- [ ] **Step 4: Generate the Prisma client**
```bash
npx prisma generate
```
Expected: prints "Generated Prisma Client" — `node_modules/@prisma/client` is populated.

- [ ] **Step 5: Verify TypeScript is happy**
```bash
npx tsc --noEmit
```
Expected: no errors on the new files.

- [ ] **Step 6: Commit**
```bash
git add prisma/schema.prisma src/lib/prisma.ts
git commit -m "feat: add prisma schema (User model) + client singleton"
```

---

## Task 3: NextAuth configuration

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    // Called by middleware — return false to redirect to /signin
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected = nextUrl.pathname.startsWith('/host')
      if (isProtected && !isLoggedIn) return false
      return true
    },
    // Runs on every sign-in — upsert user into DB, store id in token
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
          create: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          },
        })
        token.uid = dbUser.id
      }
      return token
    },
    // Puts the DB user id into the session object accessible in components
    session({ session, token }) {
      if (token.uid && typeof token.uid === 'string') {
        session.user.id = token.uid
      }
      return session
    },
  },
})
```

- [ ] **Step 2: Extend the Session type so `session.user.id` doesn't error**

Create `src/types/next-auth.d.ts`:
```ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 3: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors. If you see "Property 'uid' does not exist on type 'JWT'", add to the types file:
```ts
declare module 'next-auth/jwt' {
  interface JWT { uid?: string }
}
```

- [ ] **Step 4: Commit**
```bash
git add src/lib/auth.ts src/types/next-auth.d.ts
git commit -m "feat: add nextauth config with google oauth + user upsert"
```

---

## Task 4: NextAuth API route + sign-in page

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/signin/page.tsx`

- [ ] **Step 1: Create the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

This wires up `/api/auth/callback/google`, `/api/auth/session`, `/api/auth/csrf`, etc. automatically.

- [ ] **Step 2: Create the sign-in page**

Create `src/app/signin/page.tsx`:
```tsx
import { auth, signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await auth()
  if (session) redirect((await searchParams).callbackUrl ?? '/host')

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fdfbf9]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-10 text-center">
        {/* Logo */}
        <div className="font-display font-black text-3xl tracking-tight text-[#171717] mb-2">
          Quiz<span className="text-[#84cc16]">otic</span>
        </div>
        <p className="text-sm text-gray-400 mb-8">The quiz platform built for Indian classrooms</p>

        {/* Google sign-in form — server action */}
        <form
          action={async () => {
            'use server'
            const { callbackUrl } = await searchParams
            await signIn('google', { redirectTo: callbackUrl ?? '/host' })
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-full py-3 px-6 text-sm font-semibold text-[#171717] hover:bg-gray-50 transition-colors shadow-sm"
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6">
          No credit card. Free to start. Works on any school WiFi.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/app/api/auth src/app/signin
git commit -m "feat: add nextauth route handler + sign-in page"
```

---

## Task 5: Middleware + layout font update

**Files:**
- Create: `middleware.ts` (at project root, beside `package.json`)
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `.env.example`

- [ ] **Step 1: Create middleware.ts**

Create `middleware.ts` at the project root (same level as `package.json`):
```ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/host/:path*'],
}
```

This tells Next.js to run the `auth` function as middleware on every `/host/*` request. NextAuth's `authorized` callback (in `auth.ts`) returns `false` for unauthenticated users, which redirects them to `/signin`.

- [ ] **Step 2: Add Nunito font to layout.tsx**

Current `layout.tsx` imports Geist. Add Nunito:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
});

export const metadata: Metadata = {
  title: "Quizotic — India's Live Quiz Platform",
  description: "Live interactive quizzes for Indian schools, coaching institutes, and corporates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Background />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add scroll reveal + font-display CSS to globals.css**

Append to `src/app/globals.css`:
```css
/* Display font (Nunito) — used by landing page headings */
.font-display {
  font-family: var(--font-nunito), ui-rounded, 'Helvetica Neue', sans-serif;
}

/* Scroll reveal animation */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}

.reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 4: Update .env.example — uncomment auth + DB vars**

In `.env.example`, uncomment the auth and DB lines:
```env
# Server
PORT=3000
NODE_ENV=development

# Domains (production only)
HOST_DOMAIN=https://quizotic.in
JOIN_DOMAIN=https://quizotic.net

# Database
DATABASE_URL=postgresql://user:password@host:5432/quizotic

# Auth — NextAuth
NEXTAUTH_SECRET=your-32-char-random-secret-here
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Payments (Phase 6 — Razorpay)
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=

# Email (Phase 6 — Resend)
# RESEND_API_KEY=

# AI Generation (OpenRouter)
OPENROUTER_API_KEY=
QUIZ_AI_MODEL=google/gemini-2.0-flash-001
```

Also add the actual vars to the live `.env` file (symlinked to secrets vault). Add:
```
DATABASE_URL=<Railway PostgreSQL connection string>
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

**How to get Google OAuth credentials:**
1. Go to https://console.cloud.google.com/
2. Create project → APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorised redirect URIs: `http://localhost:3001/api/auth/callback/google`
5. Copy Client ID and Client Secret into `.env`

- [ ] **Step 5: Run the dev server and verify middleware**
```bash
PORT=3001 node server.mjs
```
Open `http://localhost:3001/host` in a browser (not signed in).
Expected: redirected to `http://localhost:3001/signin?callbackUrl=%2Fhost`

- [ ] **Step 6: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**
```bash
git add middleware.ts src/app/layout.tsx src/app/globals.css .env.example
git commit -m "feat: add route protection middleware + nunito font + scroll reveal css"
```

---

## Task 6: Scroll reveal component + landing Nav

**Files:**
- Create: `src/components/RevealOnScroll.tsx`
- Create: `src/components/landing/Nav.tsx`

- [ ] **Step 1: Create RevealOnScroll client component**

Create `src/components/RevealOnScroll.tsx`:
```tsx
'use client'

import { useEffect, useRef } from 'react'

export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (delay) el.style.transitionDelay = `${delay}ms`

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create Nav component**

Create `src/components/landing/Nav.tsx`:
```tsx
import { auth, signIn, signOut } from '@/lib/auth'

export async function Nav() {
  const session = await auth()

  return (
    <nav
      style={{ background: 'rgba(253,251,249,0.88)', backdropFilter: 'blur(12px)' }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-black/5"
    >
      {/* Logo */}
      <a href="/" className="font-display font-black text-xl tracking-tight text-[#171717]">
        Quiz<span className="text-[#84cc16]">otic</span>
      </a>

      {/* Links */}
      <ul className="hidden md:flex gap-8 text-sm font-medium text-gray-500 list-none">
        <li><a href="#features" className="hover:text-[#171717] transition-colors">Features</a></li>
        <li><a href="#pricing" className="hover:text-[#171717] transition-colors">Pricing</a></li>
        <li><a href="#faq" className="hover:text-[#171717] transition-colors">FAQ</a></li>
      </ul>

      {/* Auth CTA */}
      {session ? (
        <div className="flex items-center gap-3">
          <a
            href="/host"
            className="text-sm font-semibold bg-[#171717] text-white px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors"
          >
            Go to Dashboard
          </a>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/host' }) }}>
          <button
            type="submit"
            className="text-sm font-semibold bg-[#171717] text-white px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors"
          >
            Sign in with Google
          </button>
        </form>
      )}
    </nav>
  )
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/RevealOnScroll.tsx src/components/landing/Nav.tsx
git commit -m "feat: add RevealOnScroll component + landing Nav"
```

---

## Task 7: Landing Hero section

**Files:**
- Create: `src/components/landing/Hero.tsx`

- [ ] **Step 1: Create Hero.tsx**

Create `src/components/landing/Hero.tsx`:
```tsx
import { auth, signIn } from '@/lib/auth'

export async function Hero() {
  const session = await auth()

  return (
    <section
      className="relative min-h-screen flex items-center pt-28 pb-20 px-8 overflow-hidden"
      style={{ background: '#fdfbf9' }}
    >
      {/* Background blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -100, right: -200, width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(132,204,22,0.10) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: -150, left: -100, width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* Left: Copy */}
        <div>
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full mb-6"
            style={{ background: '#f0ffd4', color: '#4d7c0f' }}
          >
            Made for India 🇮🇳
          </div>

          <h1
            className="font-display font-black leading-[1.05] tracking-tight mb-6 text-[#171717]"
            style={{ fontSize: 'clamp(42px, 5vw, 72px)', letterSpacing: '-2px' }}
          >
            The quiz platform<br />
            built for{' '}
            <span style={{ color: '#84cc16' }}>Indian</span><br />
            classrooms
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
            Run live, scored quizzes your students actually look forward to.
            AI-powered, low-bandwidth, ₹299/mo.
          </p>

          <div className="flex gap-4 items-center flex-wrap">
            {session ? (
              <a
                href="/host"
                className="inline-flex items-center gap-2 bg-[#171717] text-white text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-[#333] transition-colors"
              >
                Go to Dashboard →
              </a>
            ) : (
              <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/host' }) }}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-[#171717] text-white text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-[#333] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Get Started Free
                </button>
              </form>
            )}
            <a href="#how-it-works" className="text-sm font-semibold text-gray-400 underline underline-offset-4 hover:text-gray-600 transition-colors">
              Watch a live demo →
            </a>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4 mt-12">
            <div className="flex">
              {['👩‍🏫', '👨‍🏫', '🧑‍🏫', '👩‍💼'].map((emoji, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-base"
                  style={{
                    marginLeft: i === 0 ? 0 : -10,
                    background: ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca'][i],
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 leading-snug">
              <strong className="text-[#171717]">500+ teachers</strong> across India already using Quizotic<br />
              Free forever for up to 20 students
            </p>
          </div>
        </div>

        {/* Right: Quiz card mockup */}
        <div className="relative">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#fff',
              boxShadow: '0 32px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#171717]">
              <div className="flex items-center gap-2.5">
                <span className="font-display font-black text-sm text-white">
                  Quiz<span className="text-[#ccff00]">otic</span>
                </span>
                <span className="text-xs text-white/40">Class 10 · Science</span>
              </div>
              <div className="bg-[#ccff00] text-[#171717] font-black text-xs px-3 py-1 rounded-full font-display">
                ⏱ 18s
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-3">Question 3 of 8</p>
              <p className="font-display font-black text-[#171717] text-lg leading-snug mb-5">
                Which organelle is known as the "powerhouse of the cell"?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'A', text: 'Nucleus', correct: false },
                  { label: 'B', text: 'Mitochondria', correct: true },
                  { label: 'C', text: 'Ribosome', correct: false },
                  { label: 'D', text: 'Golgi Body', correct: false },
                ].map(opt => (
                  <div
                    key={opt.label}
                    className="rounded-xl px-3.5 py-3 text-sm font-semibold"
                    style={
                      opt.correct
                        ? { background: '#f0ffd4', border: '2px solid #84cc16', color: '#3a6e00' }
                        : { background: '#f5f5f5', border: '2px solid transparent', color: '#444' }
                    }
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-black mr-1.5"
                      style={opt.correct ? { background: '#84cc16', color: '#fff' } : { background: '#e0e0e0', color: '#777' }}
                    >
                      {opt.label}
                    </span>
                    {opt.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                34 students live
              </div>
              <span className="text-xs text-gray-400">28 answered · 6 remaining</span>
            </div>
          </div>

          {/* Floating badges */}
          <div
            className="absolute flex items-center gap-2 bg-white rounded-2xl px-3.5 py-2.5 text-xs font-bold shadow-lg border border-black/5"
            style={{ top: -16, right: -16 }}
          >
            ✨ AI-generated in 4s
          </div>
          <div
            className="absolute flex items-center gap-2 bg-white rounded-2xl px-3.5 py-2.5 text-sm font-bold shadow-lg border border-black/5"
            style={{ bottom: 20, left: -28 }}
          >
            🏆 <span style={{ color: '#f97316' }}>Rahul leads — 2400 pts</span>
          </div>
        </div>

      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/landing/Hero.tsx
git commit -m "feat: add landing Hero section"
```

---

## Task 8: HowItWorks + Features sections

**Files:**
- Create: `src/components/landing/HowItWorks.tsx`
- Create: `src/components/landing/Features.tsx`

- [ ] **Step 1: Create HowItWorks.tsx**

Create `src/components/landing/HowItWorks.tsx`:
```tsx
import { RevealOnScroll } from '@/components/RevealOnScroll'

const steps = [
  { num: '01', title: 'Type a topic', body: 'Or paste a URL, upload a PDF. AI generates 10 questions in seconds.' },
  { num: '02', title: 'Share the code', body: 'Students open Quizotic.net on any phone — no app, no login needed.' },
  { num: '03', title: 'Go live', body: 'Questions appear on screen. Students tap answers. Leaderboard updates live.' },
  { num: '04', title: 'See the report', body: 'Full session report — per-student, per-question breakdown. Download as PDF.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" style={{ background: '#0f0f0f' }}>
      {/* Header */}
      <div className="text-center px-8 pt-24 pb-12">
        <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">See it in action</p>
        <h2
          className="font-display font-black text-white leading-tight"
          style={{ fontSize: 'clamp(30px, 4vw, 52px)', letterSpacing: '-1.5px' }}
        >
          From topic to <span style={{ color: '#ccff00' }}>live quiz</span><br />
          in under 60 seconds
        </h2>
      </div>

      {/* Video placeholder — replace src with AI-generated video when ready */}
      <div className="px-8 pb-8">
        <div
          className="relative mx-auto rounded-2xl overflow-hidden"
          style={{
            maxWidth: 900,
            aspectRatio: '16/9',
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
          }}
        >
          {/*
            VIDEO PLACEHOLDER
            When AI video is ready, replace this div with:
            <video
              src="/videos/quizotic-demo.mp4"
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
              id="how-it-works-video"
            />
            Then implement scroll-scrubbing via ScrollVideo component.
          */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/20">
            <div className="text-5xl">▶</div>
            <p className="text-sm font-medium">Demo video coming soon</p>
          </div>

          {/* Static quiz mockup shown until video is ready */}
          <div className="absolute inset-0 flex flex-col bg-[#0f0f0f]">
            <div className="flex items-center justify-between px-6 py-4 bg-[#171717] border-b border-white/5">
              <span className="font-display font-black text-base text-white">
                Quiz<span style={{ color: '#ccff00' }}>otic</span>
              </span>
              <div style={{ background: '#ccff00', color: '#171717' }} className="font-black text-sm px-4 py-1 rounded-full font-display">
                ⏱ 15s
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <p className="font-display font-black text-xl text-white text-center max-w-lg leading-snug">
                Which organelle is called the "powerhouse of the cell"?
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  { text: 'Nucleus', color: '#e74c3c' },
                  { text: 'Mitochondria ✓', color: '#2ecc71' },
                  { text: 'Ribosome', color: '#3498db' },
                  { text: 'Golgi Body', color: '#f39c12' },
                ].map(opt => (
                  <div
                    key={opt.text}
                    className="rounded-xl py-4 text-center font-bold text-white text-sm"
                    style={{ background: opt.color }}
                  >
                    {opt.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-3 text-center text-white/30 text-xs">
              34 students live · 28 answered · Scroll through the full flow ↓
            </div>
          </div>
        </div>
      </div>

      {/* 4 steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 mx-8 mb-16 rounded-2xl overflow-hidden">
        {steps.map((step, i) => (
          <RevealOnScroll key={step.num} delay={i * 80} className="bg-[#0f0f0f] p-8">
            <div
              className="font-display font-black text-4xl mb-3"
              style={{ color: `rgba(204,255,0,${0.25 + i * 0.25})` }}
            >
              {step.num}
            </div>
            <div className="font-display font-black text-base text-white mb-2">{step.title}</div>
            <div className="text-sm text-white/40 leading-relaxed">{step.body}</div>
          </RevealOnScroll>
        ))}
      </div>

      {/* Feature strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 px-8 py-5 border-t border-white/5">
        {['Works on 1 Mbps', 'No app install needed', 'UPI & card payments', 'Built in India 🇮🇳', 'Free tier forever'].map(item => (
          <div key={item} className="flex items-center gap-2 text-sm font-medium text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00]" />
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Features.tsx**

Create `src/components/landing/Features.tsx`:
```tsx
import { RevealOnScroll } from '@/components/RevealOnScroll'

const features = [
  {
    icon: '✨',
    iconBg: '#f0ffd4',
    title: 'AI Quiz Generator',
    body: 'Type a topic, paste a URL, or upload a PDF — get 10 MCQ questions in seconds. Each question has a difficulty level, timer, and point value. Powered by Google Gemini.',
    bullets: ['Topic, URL, or document upload', 'Bloom\'s level auto-tagged', 'Retry on bad generation'],
  },
  {
    icon: '🏆',
    iconBg: '#fff7ed',
    title: 'Live Leaderboard',
    body: 'Real-time scoring visible to every student. Points awarded for correct answers weighted by speed. The leaderboard animates between questions — naturally competitive.',
    bullets: ['Speed-weighted scoring (500–2000 pts)', 'Per-question stats for the host', 'Full session report at end'],
  },
  {
    icon: '🧠',
    iconBg: '#eff6ff',
    title: 'Learning Science Built In',
    body: 'Tag every question to a Bloom\'s Taxonomy level — Remember, Understand, Apply, Analyse, Evaluate, Create. Track cognitive depth across your sessions.',
    bullets: ['6 Bloom\'s levels', 'Per-session breakdown', 'Practice mode (unscored)'],
  },
  {
    icon: '₹',
    iconBg: '#f5f3ff',
    title: 'India-First Pricing',
    body: '₹299/mo for Pro teachers. ₹999/mo for institutes with up to 10 teacher seats. Pay via UPI, debit card, or net banking. GST invoice on request.',
    bullets: ['Razorpay — UPI, cards, net banking', 'GST-compliant invoice', 'Cancel anytime'],
  },
]

export function Features() {
  return (
    <section id="features" className="px-8 py-24" style={{ background: '#fdfbf9' }}>
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll>
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">Why Quizotic</p>
          <h2
            className="font-display font-black text-[#171717] leading-tight mb-16"
            style={{ fontSize: 'clamp(30px, 4vw, 52px)', letterSpacing: '-1.5px' }}
          >
            Everything your classroom needs.<br />
            <span style={{ color: '#84cc16' }}>Nothing it doesn&apos;t.</span>
          </h2>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feat, i) => (
            <RevealOnScroll key={feat.title} delay={i * 80}>
              <div
                className="bg-white rounded-2xl p-8 h-full"
                style={{ border: '1px solid #f0f0f0' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-5"
                  style={{ background: feat.iconBg }}
                >
                  {feat.icon}
                </div>
                <h3 className="font-display font-black text-lg text-[#171717] mb-3">{feat.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{feat.body}</p>
                <ul className="flex flex-col gap-2">
                  {feat.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="text-[#84cc16] font-black mt-0.5">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/landing/HowItWorks.tsx src/components/landing/Features.tsx
git commit -m "feat: add HowItWorks + Features landing sections"
```

---

## Task 9: Pricing + Testimonials sections

**Files:**
- Create: `src/components/landing/Pricing.tsx`
- Create: `src/components/landing/Testimonials.tsx`

- [ ] **Step 1: Create Pricing.tsx**

Create `src/components/landing/Pricing.tsx`:
```tsx
import { RevealOnScroll } from '@/components/RevealOnScroll'

const plans = [
  {
    name: 'Free',
    tagline: 'Perfect for trying it out. No credit card.',
    price: '0',
    period: 'forever',
    cta: 'Get started free',
    popular: false,
    features: [
      { text: 'Up to 20 students per session', included: true },
      { text: '5 quizzes saved', included: true },
      { text: 'AI generation — 10 uses/month', included: true },
      { text: 'Live leaderboard', included: true },
      { text: 'Session reports', included: false },
      { text: "Bloom's tagging", included: false },
      { text: 'Custom branding', included: false },
    ],
  },
  {
    name: 'Pro',
    tagline: 'For active teachers who quiz regularly.',
    price: '299',
    period: 'per month',
    cta: 'Start Pro free — 14 days',
    popular: true,
    features: [
      { text: 'Unlimited students per session', included: true },
      { text: 'Unlimited quizzes', included: true },
      { text: 'AI generation — unlimited', included: true },
      { text: 'Live leaderboard + session reports', included: true },
      { text: "Bloom's taxonomy tagging", included: true },
      { text: 'PDF report download', included: true },
      { text: 'Custom branding', included: false },
    ],
  },
  {
    name: 'Institute',
    tagline: 'For schools, colleges & coaching institutes.',
    price: '999',
    period: 'per month · up to 10 teachers',
    cta: 'Contact us',
    popular: false,
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Up to 10 teacher accounts', included: true },
      { text: 'Custom branding (logo + colours)', included: true },
      { text: 'Admin dashboard', included: true },
      { text: 'Priority support (WhatsApp)', included: true },
      { text: 'Bulk student import (CSV)', included: true },
      { text: 'Invoice for GST billing', included: true },
    ],
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="px-8 py-24 text-center" style={{ background: '#fdfbf9' }}>
      <RevealOnScroll>
        <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">Pricing</p>
        <h2
          className="font-display font-black text-[#171717] leading-tight mb-14"
          style={{ fontSize: 'clamp(30px, 4vw, 52px)', letterSpacing: '-1.5px' }}
        >
          Start free. Scale when<br />
          you&apos;re <span style={{ color: '#84cc16' }}>ready.</span>
        </h2>
      </RevealOnScroll>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
        {plans.map((plan, i) => (
          <RevealOnScroll key={plan.name} delay={i * 80}>
            <div
              className="rounded-2xl p-8 h-full flex flex-col relative"
              style={
                plan.popular
                  ? { border: '2px solid #171717', background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', transform: 'scale(1.03)' }
                  : { border: '1.5px solid #f0f0f0', background: '#fff' }
              }
            >
              {plan.popular && (
                <div
                  className="absolute left-1/2 -top-3.5 -translate-x-1/2 text-xs font-black px-4 py-1 rounded-full whitespace-nowrap"
                  style={{ background: '#171717', color: '#ccff00' }}
                >
                  Most Popular
                </div>
              )}
              <div className="font-display font-black text-lg text-[#171717] mb-1">{plan.name}</div>
              <div className="text-sm text-gray-400 leading-snug mb-6">{plan.tagline}</div>
              <div
                className="font-display font-black text-[#171717] leading-none mb-1"
                style={{ fontSize: 42, letterSpacing: '-2px' }}
              >
                <span style={{ fontSize: 24, verticalAlign: 'super' }}>₹</span>{plan.price}
              </div>
              <div className="text-sm text-gray-400 mb-7">{plan.period}</div>
              <button
                className="w-full py-3 rounded-full text-sm font-bold mb-7 transition-colors"
                style={
                  plan.popular
                    ? { background: '#171717', color: '#fdfbf9' }
                    : { border: '1.5px solid #e0e0e0', color: '#171717', background: 'transparent' }
                }
              >
                {plan.cta}
              </button>
              <ul className="flex flex-col gap-2.5 mt-auto">
                {plan.features.map(f => (
                  <li key={f.text} className="flex gap-2 items-start text-sm leading-snug"
                    style={{ color: f.included ? '#555' : '#ccc' }}
                  >
                    <span className="font-black mt-0.5" style={{ color: f.included ? '#84cc16' : '#ccc' }}>
                      {f.included ? '✓' : '—'}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </RevealOnScroll>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-400">
        <span>🔒 Secure payment via Razorpay</span>
        <span>💳 UPI · Debit card · Net banking</span>
        <span>🧾 GST invoice on request</span>
        <span>❌ Cancel anytime</span>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Testimonials.tsx**

Create `src/components/landing/Testimonials.tsx`:
```tsx
import { RevealOnScroll } from '@/components/RevealOnScroll'

const quotes = [
  {
    stars: 5,
    quote: '"My Class 9 students were glued to the screen. I\'ve never seen them that competitive about a science quiz. Quizotic changed my Friday revision class completely."',
    name: 'Priya Sharma',
    school: 'Science Teacher · Delhi Public School, Noida',
    emoji: '👩‍🏫',
    bg: '#fde68a',
  },
  {
    stars: 5,
    quote: '"The AI generation is magic. I uploaded our textbook chapter as a PDF on Monday and ran a quiz on Tuesday. It worked on the school\'s 2 Mbps WiFi without any issues."',
    name: 'Rajesh Kumar',
    school: 'Maths & Physics · Aakash Institute, Bangalore',
    emoji: '👨‍🏫',
    bg: '#bbf7d0',
  },
  {
    stars: 5,
    quote: '"₹299 is honestly nothing for what you get. The session report helped me identify 3 students who were struggling silently. That alone is worth it."',
    name: 'Anita Joshi',
    school: 'HOD English · St. Mary\'s School, Pune',
    emoji: '👩‍💼',
    bg: '#bfdbfe',
  },
]

const stats = [
  { number: '500+', label: 'Teachers active' },
  { number: '40K+', label: 'Students engaged' },
  { number: '4.9★', label: 'Average rating' },
]

export function Testimonials() {
  return (
    <section style={{ background: '#171717' }} className="px-8 py-24">
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll>
          <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">What teachers say</p>
          <h2
            className="font-display font-black text-white leading-tight mb-14"
            style={{ fontSize: 'clamp(30px, 4vw, 52px)', letterSpacing: '-1.5px' }}
          >
            Word&apos;s getting<br />around <span style={{ color: '#ccff00' }}>fast.</span>
          </h2>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
          {quotes.map((q, i) => (
            <RevealOnScroll key={q.name} delay={i * 80}>
              <div
                className="rounded-2xl p-7 h-full flex flex-col"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-[#f59e0b] mb-4 tracking-widest">{'★'.repeat(q.stars)}</div>
                <p className="text-sm text-white/75 leading-relaxed italic flex-1 mb-6">{q.quote}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: q.bg }}
                  >
                    {q.emoji}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{q.name}</div>
                    <div className="text-xs text-white/35 mt-0.5">{q.school}</div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* Stats strip */}
        <RevealOnScroll>
          <div
            className="grid grid-cols-3 divide-x max-w-2xl mx-auto rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', divideColor: 'rgba(255,255,255,0.06)' }}
          >
            {stats.map(stat => (
              <div key={stat.label} className="py-7 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="font-display font-black leading-none mb-1.5"
                  style={{ fontSize: 40, color: '#ccff00', letterSpacing: '-2px' }}
                >
                  {stat.number}
                </div>
                <div className="text-sm text-white/35">{stat.label}</div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/landing/Pricing.tsx src/components/landing/Testimonials.tsx
git commit -m "feat: add Pricing + Testimonials landing sections"
```

---

## Task 10: FAQ + CtaFooter sections

**Files:**
- Create: `src/components/landing/Faq.tsx`
- Create: `src/components/landing/CtaFooter.tsx`

- [ ] **Step 1: Create Faq.tsx (client component — needs open/close state)**

Create `src/components/landing/Faq.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { RevealOnScroll } from '@/components/RevealOnScroll'

const faqs = [
  {
    q: 'Do students need to create an account?',
    a: 'No. Students go to Quizotic.net and enter the 6-digit game code. No sign-up, no app install — works on any phone with a browser.',
  },
  {
    q: 'Does it work on slow school WiFi?',
    a: 'Yes. The student join page is under 100KB and designed for 1–2 Mbps connections. Real-time events are under 1KB each over WebSocket.',
  },
  {
    q: 'What AI model powers quiz generation?',
    a: 'Google Gemini 2.0 Flash via OpenRouter. Generate from a topic name, a URL, or by uploading a PDF or Word document (up to 5MB).',
  },
  {
    q: 'Can I use it for JEE/NEET/UPSC coaching?',
    a: "Absolutely. Create quizzes manually or via AI for any subject. Bloom's taxonomy tagging helps track higher-order thinking questions separately from recall.",
  },
  {
    q: 'Can I get a GST invoice?',
    a: 'Yes. Pro and Institute plans include a GST-compliant invoice. Institute plan invoices can be addressed to the school or institute directly.',
  },
  {
    q: 'What happens to my quizzes if I downgrade to Free?',
    a: 'Your quizzes are saved. You can still view and edit them, but sessions are limited to 20 students until you re-upgrade.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 py-6">
      <button
        className="w-full flex items-center justify-between gap-4 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="font-display font-black text-base text-[#171717]">{q}</span>
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0 transition-transform"
          style={{
            background: '#f0f0f0',
            transform: open ? 'rotate(45deg)' : 'none',
            fontSize: 16,
          }}
        >
          +
        </span>
      </button>
      {open && (
        <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-xl">{a}</p>
      )}
    </div>
  )
}

export function Faq() {
  return (
    <section id="faq" className="px-8 py-24" style={{ background: '#fdfbf9' }}>
      <div className="max-w-2xl mx-auto">
        <RevealOnScroll>
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">FAQ</p>
          <h2
            className="font-display font-black text-[#171717] leading-tight mb-12"
            style={{ fontSize: 'clamp(30px, 4vw, 48px)', letterSpacing: '-1.5px' }}
          >
            Questions you<br />might have
          </h2>
        </RevealOnScroll>
        {faqs.map(faq => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create CtaFooter.tsx**

Create `src/components/landing/CtaFooter.tsx`:
```tsx
import { auth, signIn } from '@/lib/auth'

const footerLinks = {
  Product: ['Features', 'Pricing', 'AI Quiz Builder', 'For Schools', 'Changelog'],
  Company: ['About', 'Blog', 'Contact', 'WhatsApp Support'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Refund Policy', 'Cookie Policy'],
}

export async function CtaFooter() {
  const session = await auth()

  return (
    <>
      {/* CTA Banner */}
      <div className="mx-8 mb-16">
        <div
          className="relative rounded-3xl px-16 py-20 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden"
          style={{ background: '#171717' }}
        >
          {/* Glow blob */}
          <div
            className="absolute pointer-events-none"
            style={{
              right: -80, top: -80, width: 360, height: 360, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(204,255,0,0.12) 0%, transparent 70%)',
            }}
          />
          <div className="relative">
            <h2
              className="font-display font-black text-white leading-tight mb-3"
              style={{ fontSize: 'clamp(26px, 3vw, 42px)', letterSpacing: '-1.5px' }}
            >
              Your next class quiz<br />
              starts <span style={{ color: '#ccff00' }}>right here.</span>
            </h2>
            <p className="text-sm text-white/45 max-w-md leading-relaxed">
              Free to start. No credit card. Works on any school WiFi. Your students will thank you.
            </p>
          </div>
          <div className="relative flex flex-col items-end gap-3 flex-shrink-0">
            {session ? (
              <a
                href="/host"
                className="text-sm font-black px-8 py-3.5 rounded-full whitespace-nowrap"
                style={{ background: '#ccff00', color: '#171717' }}
              >
                Go to Dashboard →
              </a>
            ) : (
              <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/host' }) }}>
                <button
                  type="submit"
                  className="text-sm font-black px-8 py-3.5 rounded-full whitespace-nowrap"
                  style={{ background: '#ccff00', color: '#171717' }}
                >
                  Get Started Free →
                </button>
              </form>
            )}
            <p className="text-xs text-white/25">
              Already have an account?{' '}
              <a href="/signin" className="text-white/40 underline underline-offset-2">Sign in</a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#0f0f0f' }} className="px-8 pt-14 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="font-display font-black text-2xl text-white mb-3 tracking-tight">
                Quiz<span style={{ color: '#ccff00' }}>otic</span>
              </div>
              <p className="text-sm text-white/30 leading-relaxed max-w-xs">
                Live interactive quizzes for Indian classrooms. Built for teachers who care about engagement and learning outcomes.
              </p>
            </div>
            {/* Link columns */}
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <div className="text-xs font-bold tracking-widest uppercase text-white/20 mb-4">{heading}</div>
                <ul className="flex flex-col gap-2.5">
                  {links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs text-white/20">© 2026 Quizotic. All rights reserved.</p>
            <p className="text-xs text-white/20">🇮🇳 &nbsp;Designed and built in India</p>
          </div>
        </div>
      </footer>
    </>
  )
}
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/landing/Faq.tsx src/components/landing/CtaFooter.tsx
git commit -m "feat: add FAQ + CTA Banner + Footer landing sections"
```

---

## Task 11: Wire the landing page (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with the full landing page**

Replace `src/app/page.tsx`:
```tsx
import { Nav } from '@/components/landing/Nav'
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { Testimonials } from '@/components/landing/Testimonials'
import { Faq } from '@/components/landing/Faq'
import { CtaFooter } from '@/components/landing/CtaFooter'

export default function HomePage() {
  return (
    <div style={{ background: '#fdfbf9' }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Testimonials />
      <Faq />
      <CtaFooter />
    </div>
  )
}
```

- [ ] **Step 2: Run the dev server and verify the landing page**
```bash
PORT=3001 node server.mjs
```
Open `http://localhost:3001` and check:
- [ ] Warm cream background visible (not the dark quiz background)
- [ ] Nav is sticky at top
- [ ] Hero headline, sub-copy, and quiz card mockup render
- [ ] Scroll down — HowItWorks dark section appears
- [ ] Scroll further — Features cards appear
- [ ] Pricing three-tier grid renders
- [ ] Testimonials dark section renders
- [ ] FAQ accordion items render and open on click
- [ ] CTA Banner + Footer at bottom

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add src/app/page.tsx
git commit -m "feat: wire full landing page — all 8 sections"
```

---

## Task 12: End-to-end auth + database verification

> This task requires `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` to be set in `.env`.

- [ ] **Step 1: Run the database migration**
```bash
npx prisma db push
```
Expected: "Your database is now in sync with your Prisma schema." — User table created in PostgreSQL.

- [ ] **Step 2: Verify User table exists**
```bash
npx prisma studio
```
Opens Prisma Studio at `http://localhost:5555`. Check that the `User` table exists and is empty.

- [ ] **Step 3: Test the full auth flow**
```bash
PORT=3001 node server.mjs
```
1. Open `http://localhost:3001` — landing page shows, "Sign in with Google" in nav
2. Click "Get Started Free" — redirects to `/signin`
3. Click "Continue with Google" — Google OAuth consent screen
4. Sign in — redirects to `/host`
5. Check Prisma Studio — a User record should now exist with your email

- [ ] **Step 4: Test protected route redirect**
1. Open a fresh incognito window
2. Navigate directly to `http://localhost:3001/host`
3. Expected: redirected to `/signin?callbackUrl=%2Fhost`
4. Sign in → redirected back to `/host`

- [ ] **Step 5: Test sign-out**
1. Click "Sign out" in nav
2. Expected: redirected to `/`
3. Navigate to `/host` → redirected to `/signin` again

- [ ] **Step 6: Full build check**
```bash
npm run build
```
Expected: build completes with no errors. Warnings about server actions are acceptable.

- [ ] **Step 7: Final commit**
```bash
git add -A
git commit -m "feat: phase 5 complete — landing page + google oauth + user db + protected routes"
```

---

## Verification Checklist

- [ ] Landing page renders on `http://localhost:3001` with cream background
- [ ] All 8 sections visible when scrolling
- [ ] Scroll reveal animations trigger on scroll
- [ ] "Get Started Free" / "Sign in with Google" → `/signin`
- [ ] Sign-in page → "Continue with Google" → OAuth flow completes
- [ ] After sign-in → redirected to `/host`
- [ ] Visiting `/host` without session → redirected to `/signin?callbackUrl=%2Fhost`
- [ ] User record created in PostgreSQL User table on first sign-in
- [ ] Revisiting `/host` with active session → no redirect
- [ ] Sign-out → session cleared → `/host` redirects again
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → completes successfully

---

## Notes for the Implementer

**This is Next.js 16, not 14.** Read `AGENTS.md` before writing any Next.js code. The App Router conventions may differ from your training data.

**NextAuth v5 (beta) API differences from v4:**
- Import providers: `import Google from 'next-auth/providers/google'` (not from `next-auth/providers/google`)
- Export: `export const { handlers, auth, signIn, signOut } = NextAuth(config)`
- Route handler: `export const { GET, POST } = handlers`
- Middleware: `export { auth as middleware } from '@/lib/auth'`
- Sign-in server action: call `signIn('google')` inside `'use server'` function

**The `<Background />` component** is a fixed dot-grid already in the root layout at `z-index: -10`. The landing page sections have explicit background colours that cover it — do not remove Background from the layout, it is still used by the quiz builder and session pages.

**Video section:** `HowItWorks.tsx` has a clearly marked placeholder where the scroll-scrubbed video goes. When Mahesh provides the AI-generated video file, place it at `public/videos/quizotic-demo.mp4` and replace the placeholder div with the `<video>` element. Then add a `ScrollVideo` client component that drives `video.currentTime` via scroll position.

**Google Cloud Console setup** (needed before Task 12):
1. Create project at https://console.cloud.google.com
2. Enable "Google+ API" or "Google Identity"
3. OAuth 2.0 Client ID → Web application
4. Add redirect URI: `http://localhost:3001/api/auth/callback/google`
5. For production add: `https://quizotic.in/api/auth/callback/google`
