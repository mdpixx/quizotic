import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  // Prisma 7 uses engine type "client", which requires a driver adapter on the
  // constructor. Always pass the adapter — the pg Pool connects lazily, so this
  // is safe even when DATABASE_URL is unset (e.g. during `next build` page-data
  // collection). Queries only run when the DB is actually configured.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, log: ['error'] })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
