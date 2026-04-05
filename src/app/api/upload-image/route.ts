export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

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

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Check plan limits
  const plan = await getUserPlan(user.id)
  const limit = PLAN_LIMITS[plan].maxImageUploads
  if (limit !== Infinity) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const uploadCount = await prisma.usageLog.count({
      where: {
        userId: user.id,
        action: 'image_upload',
        createdAt: { gte: startOfMonth },
      },
    })

    if (uploadCount >= limit) {
      return NextResponse.json(
        { success: false, error: `Image upload limit reached (${limit}/month). Upgrade to Pro for more.` },
        { status: 429 },
      )
    }
  }

  // Parse multipart form data
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
      { status: 400 },
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File too large. Maximum size is 2MB.' },
      { status: 400 },
    )
  }

  // Generate unique key
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const uuid = crypto.randomUUID()
  const key = `images/${user.id}/${yearMonth}/${uuid}.${ext}`

  // Upload to R2
  const buffer = Buffer.from(await file.arrayBuffer())
  const r2 = getR2Client()

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME ?? 'quizotic-uploads',
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  // Build public URL
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

  // Log usage
  await prisma.usageLog.create({
    data: {
      userId: user.id,
      action: 'image_upload',
      metadata: { key, size: file.size, type: file.type },
    },
  })

  return NextResponse.json({ success: true, url: publicUrl })
}
