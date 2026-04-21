// Image proxy endpoint — streams R2 objects through our own origin so that
// corporate networks that block Cloudflare's pub-*.r2.dev dev subdomain can
// still see uploaded slide images.
//
// Usage: set R2_PUBLIC_URL=/api/img (relative to origin) instead of
// https://pub-xxxx.r2.dev. Every image URL then looks like
// https://www.quizotic.live/api/img/images/<userId>/<yearMonth>/pptx-xxx.png
// which is same-origin and can't be blocked without also blocking the app
// itself.
//
// We fetch the object from R2 using the S3 API (authenticated) rather than
// the public dev URL, so this works even when the dev subdomain is
// unreachable from the Railway runtime.

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const ALLOWED_PREFIXES = ['images/', 'uploads/']

function isSafeKey(key: string): boolean {
  if (!key || key.includes('..') || key.startsWith('/')) return false
  return ALLOWED_PREFIXES.some(p => key.startsWith(p))
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  const key = path.join('/')

  if (!isSafeKey(key)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 })
  }

  try {
    const r2 = getR2Client()
    const out = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME ?? 'quizotic-uploads',
        Key: key,
      })
    )

    if (!out.Body) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // AWS SDK v3 on Node returns a ReadableStream-compatible stream.
    const stream = out.Body as unknown as ReadableStream

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': out.ContentType ?? 'application/octet-stream',
        'Content-Length': out.ContentLength ? String(out.ContentLength) : '',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    if (code === 404 || code === 403) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    console.error('[img-proxy] failed', { key, err })
    return NextResponse.json({ error: 'upstream error' }, { status: 502 })
  }
}
