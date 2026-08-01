export const dynamic = 'force-dynamic'

// One-click unsubscribe for the lifecycle email channel.
//
// This route has to work for someone who is not logged in, on a link that may
// be months old, from a mail client that might send GET or POST. Anything less
// and the practical alternative for the recipient is the spam button — which
// is the outcome the entire two-channel split exists to avoid.
//
//   GET   — the visible footer link. Unsubscribes, then renders a page.
//   POST  — RFC 8058 one-click, sent by Gmail and Yahoo from the
//           List-Unsubscribe-Post header. Must answer 200 with no body worth
//           reading.
//
// Both are idempotent: unsubscribing twice is a success, not an error.
//
// Re-subscribing is POST-only, from a form on the confirmation page. It must
// never be reachable by a bare GET, because corporate link scanners follow
// links in mail and would silently undo the opt-out they just performed.
//
// The route deliberately does not require or check a session. Asking someone
// to log in before they can stop receiving mail is the pattern that generates
// spam complaints.

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ token: string }> }

const SUPPRESSION_REASON = 'unsubscribed'
const SUPPRESSION_SOURCE = 'one-click'

type Outcome = 'unsubscribed' | 'already' | 'resubscribed' | 'unknown-token'

async function findUserByToken(token: string) {
  if (!token || token.length > 256) return null
  return prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, lifecycleOptOutAt: true },
  })
}

async function optOut(user: { id: string; email: string; lifecycleOptOutAt: Date | null }): Promise<Outcome> {
  const alreadyOut = user.lifecycleOptOutAt !== null

  // Two records, on purpose. lifecycleOptOutAt is the user's preference and
  // dies with the account; the EmailSuppression row is keyed by address and
  // deliberately outlives it, so re-registering the same address does not
  // quietly resurrect a "stop emailing me".
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: user.id, lifecycleOptOutAt: null },
      data: { lifecycleOptOutAt: new Date() },
    }),
    prisma.emailSuppression.upsert({
      where: { email: user.email.toLowerCase().trim() },
      create: {
        email: user.email.toLowerCase().trim(),
        reason: SUPPRESSION_REASON,
        source: SUPPRESSION_SOURCE,
      },
      // Do not downgrade a hard bounce or a spam complaint to a plain
      // unsubscribe — those carry more weight and must stick.
      update: {},
    }),
  ])

  return alreadyOut ? 'already' : 'unsubscribed'
}

async function optIn(user: { id: string; email: string }): Promise<Outcome> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { lifecycleOptOutAt: null },
    }),
    // Only clear a suppression this route created. A bounce or complaint row
    // means the address is undeliverable or hostile, and a click on a
    // re-subscribe button is not evidence that changed.
    prisma.emailSuppression.deleteMany({
      where: { email: user.email.toLowerCase().trim(), reason: SUPPRESSION_REASON },
    }),
  ])
  return 'resubscribed'
}

// GET — the footer link. Acts immediately; a confirmation step here just
// means people who wanted out are still receiving mail.
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  try {
    const user = await findUserByToken(token)
    if (!user) return htmlResponse(page('unknown-token', token), 404)

    const outcome = await optOut(user)
    return htmlResponse(page(outcome, token, user.email), 200)
  } catch (err) {
    console.warn('[unsubscribe] GET failed:', err instanceof Error ? err.message : err)
    return htmlResponse(page('error', token), 500)
  }
}

// POST — RFC 8058 one-click from the mail client, and the re-subscribe form.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  try {
    const user = await findUserByToken(token)

    // Mail clients POST `List-Unsubscribe=One-Click` as a form body. Reading
    // the body is best-effort: some send nothing at all, and a parse failure
    // must not turn into a failed unsubscribe.
    let intent = ''
    try {
      const form = await req.formData()
      intent = String(form.get('intent') ?? '')
    } catch {
      intent = ''
    }

    if (!user) {
      return intent === 'resubscribe' || intent === 'unsubscribe'
        ? htmlResponse(page('unknown-token', token), 404)
        : new NextResponse(null, { status: 404 })
    }

    if (intent === 'resubscribe') {
      const outcome = await optIn(user)
      return htmlResponse(page(outcome, token, user.email), 200)
    }

    const outcome = await optOut(user)

    // A browser form post gets the page; a mail client gets a bare 200. The
    // one-click spec wants a fast, bodyless success.
    return intent === 'unsubscribe'
      ? htmlResponse(page(outcome, token, user.email), 200)
      : new NextResponse(null, { status: 200 })
  } catch (err) {
    console.warn('[unsubscribe] POST failed:', err instanceof Error ? err.message : err)
    return new NextResponse(null, { status: 500 })
  }
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Never let a proxy or the browser cache the result of a state change.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

interface Copy {
  badge: string
  title: string
  body: string
  showResubscribe: boolean
}

function copyFor(outcome: Outcome | 'error', email?: string): Copy {
  const addr = email ? `<strong style="color:#0F1B3D">${escapeHtml(email)}</strong>` : 'this address'
  switch (outcome) {
    case 'unsubscribed':
    case 'already':
      return {
        badge: 'Done',
        title: "You're unsubscribed",
        body: `We won't send ${addr} any more onboarding or product emails. You'll still get the essentials — sign-in links, receipts, and anything about a session you're running. Those aren't marketing, and turning them off would lock you out of your own account.`,
        showResubscribe: true,
      }
    case 'resubscribed':
      return {
        badge: 'Welcome back',
        title: "You're subscribed again",
        body: `We'll send ${addr} the occasional tip on getting more out of Quizotic. Never more than two a month, and you can leave again any time.`,
        showResubscribe: false,
      }
    case 'unknown-token':
      return {
        badge: 'Link not found',
        title: "We couldn't find that link",
        body: 'It may have already been used from a newer email, or the account may have been deleted. If you are still receiving mail you did not ask for, reply to any of it and we will sort it out by hand.',
        showResubscribe: false,
      }
    default:
      return {
        badge: 'Something broke',
        title: "That didn't go through",
        body: 'Sorry — this is on us. Please try again in a moment, or reply to any Quizotic email and we will unsubscribe you manually.',
        showResubscribe: false,
      }
  }
}

// Deliberately a self-contained HTML string rather than a React page: this
// must render for a logged-out stranger with no JavaScript, no session, and
// no dependency on the app shell booting correctly.
function page(outcome: Outcome | 'error', token: string, email?: string): string {
  const { badge, title, body, showResubscribe } = copyFor(outcome, email)

  const resubscribe = showResubscribe
    ? `<form method="POST" action="/api/unsubscribe/${encodeURIComponent(token)}" style="margin:28px 0 0;">
         <input type="hidden" name="intent" value="resubscribe">
         <button type="submit" style="background:#0F1B3D;color:#ffffff;border:0;border-radius:12px;padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Changed your mind? Re-subscribe</button>
       </form>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} — Quizotic</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:40px 20px;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,27,61,0.10);max-width:520px;width:100%;">
      <tr><td style="background:#0F1B3D;padding:32px;text-align:center;">
        <span style="font-weight:900;font-size:28px;color:#ffffff;letter-spacing:-0.8px;">Quizotic</span>
      </td></tr>
      <tr><td style="background:#FBD13B;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:36px 36px 40px;">
        <div style="display:inline-block;background:#FEF9C3;color:#854D0E;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 11px;border-radius:20px;margin-bottom:18px;">${escapeHtml(badge)}</div>
        <h1 style="margin:0 0 14px;font-size:26px;font-weight:900;color:#0F1B3D;letter-spacing:-0.6px;line-height:1.2;">${escapeHtml(title)}</h1>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#475569;">${body}</p>
        ${resubscribe}
      </td></tr>
      <tr><td style="background:#F8FAFC;padding:18px 36px;border-top:1px solid #E2E8F0;text-align:center;">
        <a href="https://www.quizotic.live" style="color:#64748B;text-decoration:none;font-size:13px;">quizotic.live</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
