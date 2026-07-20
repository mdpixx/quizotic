import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { extensionForImageMime, type TestimonialImageMime } from '@/lib/testimonials'

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

function getR2Config(): R2Config {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  }
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.publicUrl) {
    throw new Error('Testimonial photo storage is not configured')
  }
  return config as R2Config
}

function client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

export async function uploadTestimonialPhoto(args: {
  bytes: Uint8Array
  mime: TestimonialImageMime
}): Promise<{ key: string; url: string }> {
  const config = getR2Config()
  const key = `testimonials/${randomUUID()}.${extensionForImageMime(args.mime)}`
  const storage = client(config)
  try {
    await storage.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: args.bytes,
      ContentType: args.mime,
      CacheControl: 'no-store, max-age=0',
    }))
  } catch (uploadError) {
    // A transport failure can occur after R2 accepted the object. The key is
    // already known locally, so make a best-effort cleanup before surfacing it.
    await storage.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })).catch(() => undefined)
    throw uploadError
  }
  return { key, url: `${config.publicUrl.replace(/\/$/, '')}/${key}` }
}

export async function deleteTestimonialPhoto(key: string): Promise<void> {
  const config = getR2Config()
  await client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}
