import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      onboarded: boolean
    } & DefaultSession['user']
  }
}
