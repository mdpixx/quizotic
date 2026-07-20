import { prisma } from '@/lib/prisma'
import { hashInviteToken, isInviteExpired } from '@/lib/testimonials'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export type TestimonialInvitePageState =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'submitted' }
  | { status: 'active'; name: string; organization: string }

export async function loadTestimonialInvite(
  token: string,
  now = new Date(),
): Promise<TestimonialInvitePageState> {
  if (!TOKEN_PATTERN.test(token)) return { status: 'invalid' }

  const invite = await prisma.testimonialInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      expiresAt: true,
      usedAt: true,
      user: { select: { name: true, organization: true } },
      testimonial: { select: { id: true } },
    },
  })
  if (!invite) return { status: 'invalid' }
  if (invite.usedAt || invite.testimonial) return { status: 'submitted' }
  if (isInviteExpired(invite.expiresAt, now)) return { status: 'expired' }
  return {
    status: 'active',
    name: invite.user.name?.trim() ?? '',
    organization: invite.user.organization?.trim() ?? '',
  }
}
