import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

// Every admin mutation writes one row to AdminAuditLog. Read-only after
// insert. The actor's id and email are both stored — id for joins, email
// denormalised so the trail survives the actor user being deleted later.
//
// Failures here log to console but never throw; an audit failure should
// not block a successful business operation. The action itself is the
// source of truth, the audit row is a defence-in-depth artefact.

export interface WriteAuditLogArgs {
  req: NextRequest | Request
  actor: { id: string; email: string }
  action: string
  targetType?: string
  targetId?: string
  payload: Record<string, unknown>
  beforeState?: unknown
  afterState?: unknown
  reason: string
}

export async function writeAuditLog(args: WriteAuditLogArgs): Promise<void> {
  try {
    const headers = args.req.headers
    const ipAddress = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? headers.get('x-real-ip')
      ?? null
    const userAgent = headers.get('user-agent') ?? null

    await prisma.adminAuditLog.create({
      data: {
        actorId: args.actor.id,
        actorEmail: args.actor.email,
        action: args.action,
        targetType: args.targetType ?? null,
        targetId: args.targetId ?? null,
        payload: sanitisePayload(args.payload) as Prisma.InputJsonValue,
        beforeState: args.beforeState !== undefined
          ? (args.beforeState as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        afterState: args.afterState !== undefined
          ? (args.afterState as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        reason: args.reason,
        ipAddress,
        userAgent,
      },
    })
  } catch (err) {
    console.error('[admin-audit] failed to write audit row:', err instanceof Error ? err.message : err, {
      actor: args.actor.email,
      action: args.action,
      target: `${args.targetType}/${args.targetId}`,
    })
  }
}

// Strip anything that looks like a secret before persisting. Defensive
// against future endpoint authors who forget to scrub tokens out of the
// payload they pass in.
function sanitisePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = /(password|secret|token|key|auth|cookie)/i
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (SENSITIVE.test(k)) {
      out[k] = '[redacted]'
    } else {
      out[k] = v
    }
  }
  return out
}
