import { afterEach, describe, expect, it, vi } from 'vitest'

const originalDatabaseUrl = process.env.DATABASE_URL

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
  vi.resetModules()
})

describe('Prisma client construction', () => {
  it('constructs with the Prisma 7 driver adapter when DATABASE_URL is absent', async () => {
    delete process.env.DATABASE_URL
    vi.resetModules()

    const modulePromise = import('../lib/prisma')
    await expect(modulePromise).resolves.toHaveProperty('prisma')

    const { prisma } = await modulePromise
    await prisma.$disconnect()
  })
})
