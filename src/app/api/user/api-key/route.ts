export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { randomBytes } from 'crypto'

function generateKey(): string {
  return 'qz_' + randomBytes(24).toString('hex')
}

// GET /api/user/api-key — return current key (masked) or null
export async function GET() {
  try {
    const user = await requireAuth()
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { apiKey: true },
    })
    const key = record?.apiKey ?? null
    // Mask middle: show prefix + last 4 chars only
    const masked = key ? `${key.slice(0, 6)}${'•'.repeat(key.length - 10)}${key.slice(-4)}` : null
    return NextResponse.json({ success: true, data: { masked, hasKey: !!key } })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST /api/user/api-key — generate (or regenerate) API key, returns the full key ONCE
export async function POST() {
  try {
    const user = await requireAuth()
    const newKey = generateKey()
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: newKey },
    })
    return NextResponse.json({ success: true, data: { key: newKey } })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// DELETE /api/user/api-key — revoke key
export async function DELETE() {
  try {
    const user = await requireAuth()
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: null },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
