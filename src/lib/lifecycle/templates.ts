// Nudge email templates. Design spec §3.
//
// Deliberately plainer than the welcome email. That one is a celebration and
// earns its gradient; these are an interruption of someone who did not ask to
// hear from us, and the tone has to match. Short, one idea, one link, a real
// question at the end — the reply-to is a monitored human inbox and a reply is
// a better outcome than a click.
//
// Every template carries a visible unsubscribe link in the footer as well as
// the List-Unsubscribe header. The header satisfies the mail client; the
// footer link is what a person actually looks for, and its absence is what
// makes people reach for the spam button instead.

import type { Campaign, CampaignKey } from './campaigns'
import { appBaseUrl } from './unsubscribe'

export interface RenderContext {
  unsubscribeUrl: string
  firstName?: string | null
}

interface Body {
  heading: string
  paragraphs: string[]
  ctaLabel: string
  ctaPath: string
  signoff: string
}

const BODIES: Record<CampaignKey, Body> = {
  'activation.host_first_session': {
    heading: 'Your quiz is built. Want to run it?',
    paragraphs: [
      'You put a quiz together but have not hosted it yet — which is the only part that is actually different from every other quiz tool.',
      'Hosting takes one click. Your audience joins on their phones with a six-digit code, no app and no accounts, and you watch the answers land live.',
      'If something stopped you — a feature you needed, a room that would not cooperate — just reply to this email and tell me. It comes straight to me.',
    ],
    ctaLabel: 'Host your quiz',
    ctaPath: '/host',
    signoff: 'Mahesh, Quizotic',
  },
  'activation.create_first_quiz': {
    heading: 'A quiz in about five minutes',
    paragraphs: [
      'You signed up but have not built anything yet, so here is the shortest possible path: pick a topic, let the AI draft the questions, edit the ones you do not like.',
      'Most people have something they can run with a real group inside five minutes. You do not need to prepare anything first.',
      'If you are not sure it fits what you teach, reply and tell me what you are running — I will tell you honestly whether this is the right tool.',
    ],
    ctaLabel: 'Build your first quiz',
    ctaPath: '/host/build',
    signoff: 'Mahesh, Quizotic',
  },
  'activation.last_touch': {
    heading: 'Anything we can help with?',
    paragraphs: [
      'You signed up for Quizotic a little while ago and have not got a session running yet. That usually means one of two things: it was not the right fit, or something got in the way.',
      'Either answer is useful to me. If it was not a fit, tell me what was missing. If something got in the way, tell me what — I will fix it or walk you through it.',
      'This is the last of these you will get from us either way.',
    ],
    ctaLabel: 'Open Quizotic',
    ctaPath: '/host',
    signoff: 'Mahesh, Quizotic',
  },
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function renderNudgeEmail(
  campaign: Campaign,
  ctx: RenderContext,
): { html: string; text: string } {
  const body = BODIES[campaign.key]
  const base = appBaseUrl()
  const ctaUrl = `${base}${body.ctaPath}`
  const greeting = ctx.firstName ? `Hi ${ctx.firstName},` : 'Hi,'

  return { html: html(body, ctx, greeting, ctaUrl), text: text(body, ctx, greeting, ctaUrl) }
}

function html(body: Body, ctx: RenderContext, greeting: string, ctaUrl: string): string {
  const paragraphs = body.paragraphs
    .map(
      p =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#334155;">${escapeHtml(p)}</p>`,
    )
    .join('\n          ')

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 20px;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,27,61,0.08);max-width:520px;width:100%;">
      <tr><td style="background:#0F1B3D;padding:22px 32px;">
        <span style="font-weight:800;font-size:20px;color:#ffffff;letter-spacing:-0.4px;">Quizotic</span>
      </td></tr>
      <tr><td style="background:#FBD13B;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#334155;">${escapeHtml(greeting)}</p>
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;color:#0F1B3D;letter-spacing:-0.4px;line-height:1.3;">${escapeHtml(body.heading)}</h1>
          ${paragraphs}
      </td></tr>
      <tr><td style="padding:8px 32px 32px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#0F1B3D;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 26px;font-size:15px;font-weight:700;">${escapeHtml(body.ctaLabel)}</a>
        <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#475569;">— ${escapeHtml(body.signoff)}</p>
      </td></tr>
      <tr><td style="background:#F8FAFC;padding:18px 32px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94A3B8;">
          You are getting this because you signed up for Quizotic. We send at most two of these a month, and never after you have run your first session.<br>
          <a href="${ctx.unsubscribeUrl}" style="color:#64748B;">Unsubscribe</a> — you will still get sign-in links and anything about your own sessions.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function text(body: Body, ctx: RenderContext, greeting: string, ctaUrl: string): string {
  return [
    greeting,
    '',
    body.heading,
    '',
    ...body.paragraphs.flatMap(p => [p, '']),
    `${body.ctaLabel}: ${ctaUrl}`,
    '',
    `— ${body.signoff}`,
    '',
    '---',
    'You are getting this because you signed up for Quizotic. We send at most two of these a month, and never after you have run your first session.',
    `Unsubscribe: ${ctx.unsubscribeUrl}`,
    'You will still get sign-in links and anything about your own sessions.',
  ].join('\n')
}

export const __test__ = { BODIES }
