import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { createUniqueReferralCode } from '@/lib/referral'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify',
    error: '/auth/error',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS
      ? [Nodemailer({
          server: {
            host: 'smtp.gmail.com',
            port: 587,
            auth: {
              user: process.env.EMAIL_SMTP_USER,
              pass: process.env.EMAIL_SMTP_PASS,
            },
          },
          from: process.env.EMAIL_FROM ?? 'Quizotic <info@quizotic.live>',
        })]
      : []),
  ],
  events: {
    async createUser({ user }) {
      if (user.id && user.name) {
        const code = await createUniqueReferralCode(user.name)
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        })
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { onboarded: true },
        })
        token.onboarded = dbUser?.onboarded ?? false
      }
      // Allow client-side update({ onboarded: true }) to refresh the JWT
      if (trigger === 'update' && session?.onboarded !== undefined) {
        token.onboarded = session.onboarded
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string
        session.user.onboarded = (token.onboarded as boolean) ?? false
      }
      return session
    },
  },
})
