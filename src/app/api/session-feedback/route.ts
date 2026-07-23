// Receives the one-tap post-session smiley rating (1–5) from the
// SessionFeedbackPrompt shown to hosts and participants at the end of a
// live/self-paced session. Kept small and self-contained: Zod validation,
// best-effort persist to SessionFeedback, and — only when there's something
// actionable (a typed comment or a low score) — a best-effort ops email.
//
// PRIVACY: participant submissions are ANONYMOUS. We never accept or store a
// participant name/id here — only role, rating, optional chips/comment, and an
// optional session reference. This keeps participant rows clean under India's
// DPDP Act even when the player is a minor.

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import {
  SessionFeedbackSchema,
  SESSION_FEEDBACK_FACES as FACE,
  normalizeSessionFeedback,
  isActionable,
} from '@/lib/session-feedback'

// Minimal in-memory rate limit — the persistent Node server (server.mjs) keeps
// this module state alive, and the client already guards once-per-session via
// localStorage. This only blunts obvious floods. Cloudflare fronts Railway.
const HITS = new Map<string, { n: number; ts: number }>()
const WINDOW_MS = 10_000
const MAX_PER_WINDOW = 8
function limited(ip: string): boolean {
  const now = Date.now()
  const cur = HITS.get(ip)
  if (!cur || now - cur.ts > WINDOW_MS) {
    HITS.set(ip, { n: 1, ts: now })
    return false
  }
  cur.n += 1
  return cur.n > MAX_PER_WINDOW
}

const FEEDBACK_TO = process.env.FEEDBACK_TO_EMAIL || 'info@quizotic.live'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  if (limited(ip)) {
    // 200 with ok:true so the UI never shows an error for a harmless retry.
    return NextResponse.json({ ok: true, throttled: true })
  }

  const body = await req.json().catch(() => null)
  const parsed = SessionFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join('; ') },
      { status: 400 },
    )
  }
  const n = normalizeSessionFeedback(parsed.data)

  // Resolve the room code to a GameSession id when we can, so the report view
  // can roll up sentiment. Best-effort — never block the write on it.
  let resolvedSessionId: string | null = n.sessionId
  if (!resolvedSessionId && n.sessionCode) {
    try {
      const gs = await prisma.gameSession.findUnique({
        where: { code: n.sessionCode },
        select: { id: true },
      })
      resolvedSessionId = gs?.id ?? null
    } catch {
      // ignore — we still store the code below
    }
  }

  try {
    await prisma.sessionFeedback.create({
      data: {
        sessionId: resolvedSessionId,
        sessionCode: n.sessionCode,
        role: n.role,
        rating: n.rating,
        reasons: n.reasons,
        comment: n.comment,
        email: n.email,
      },
    })
  } catch (err) {
    console.warn('[session-feedback] db persist failed:', err instanceof Error ? err.message : err)
  }

  console.log(
    `[session-feedback] role=${n.role} rating=${n.rating} code=${n.sessionCode ?? 'n/a'} comment=${n.comment ? JSON.stringify(n.comment.slice(0, 160)) : 'none'}`,
  )

  // Only email ops when there's something to act on: a typed comment or a
  // low score. A silent flood of 5-star taps shouldn't hit the inbox.
  if (isActionable(n)) {
    const safeComment = n.comment ? escapeHtml(n.comment).replace(/\n/g, '<br>') : '(no comment)'
    const safeReasons = n.reasons.length ? escapeHtml(n.reasons.join(', ')) : '(none)'
    const sessionRef = escapeHtml(n.sessionCode ?? resolvedSessionId ?? 'n/a')
    const html = `
      <h2 style="font-family:sans-serif;color:#0F1B3D;">Session feedback · ${FACE[n.rating]}</h2>
      <p style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1F2937;white-space:pre-wrap;">${safeComment}</p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:18px 0;">
      <table style="font-family:sans-serif;font-size:13px;color:#4B5563;">
        <tr><td style="padding-right:12px;"><b>Rating:</b></td><td>${n.rating}/5 — ${escapeHtml(FACE[n.rating])}</td></tr>
        <tr><td style="padding-right:12px;"><b>Role:</b></td><td>${n.role}</td></tr>
        <tr><td style="padding-right:12px;"><b>Reasons:</b></td><td>${safeReasons}</td></tr>
        <tr><td style="padding-right:12px;"><b>Session:</b></td><td>${sessionRef}</td></tr>
      </table>`
    const text = `Session feedback ${n.rating}/5 (${FACE[n.rating]})\nrole: ${n.role}\nreasons: ${n.reasons.join(', ') || '(none)'}\nsession: ${n.sessionCode ?? resolvedSessionId ?? 'n/a'}\n\n${n.comment ?? '(no comment)'}\n`
    const result = await sendEmail({
      to: FEEDBACK_TO,
      subject: `[Quizotic session feedback] ${n.rating}/5 ${n.comment ? '· ' + n.comment.slice(0, 48) : ''}`.trim(),
      html,
      text,
      replyTo: n.email ?? undefined,
      category: 'feedback',
      userId: null,
      metadata: { role: n.role, rating: n.rating, sessionCode: n.sessionCode },
    }).catch(() => ({ ok: false as const, error: 'threw' }))
    if (!result.ok) console.warn('[session-feedback] email failed (non-blocking)')
  }

  return NextResponse.json({ ok: true })
}
