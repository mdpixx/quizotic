import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'assets/brand/quizotic-mark.svg')
const checkOnly = process.argv.includes('--check')

const targets = {
  iconSvg: join(root, 'src/app/icon.svg'),
  publicSvg: join(root, 'public/brand/quizotic-mark.svg'),
  favicon: join(root, 'src/app/favicon.ico'),
  apple: join(root, 'src/app/apple-icon.png'),
  pwa192: join(root, 'public/icons/icon-192.png'),
  pwa512: join(root, 'public/icons/icon-512.png'),
  maskable512: join(root, 'public/icons/icon-maskable-512.png'),
}

const source = await readFile(sourcePath)

async function png(size) {
  return sharp(source, { density: 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function maskablePng(size) {
  const safeSize = Math.round(size * 0.8)
  const safeMark = await sharp(source, { density: 512 })
    .resize(safeSize, safeSize)
    .png({ compressionLevel: 9 })
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#FBD13B',
    },
  })
    .composite([{ input: safeMark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

function ico(images) {
  const headerSize = 6
  const entrySize = 16
  const directorySize = headerSize + entrySize * images.length
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = directorySize
  const entries = images.map(({ size, buffer }) => {
    const entry = Buffer.alloc(entrySize)
    entry.writeUInt8(size === 256 ? 0 : size, 0)
    entry.writeUInt8(size === 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += buffer.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map(({ buffer }) => buffer)])
}

const faviconImages = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, buffer: await png(size) })),
)

const outputs = new Map([
  [targets.iconSvg, source],
  [targets.publicSvg, source],
  [targets.favicon, ico(faviconImages)],
  [targets.apple, await png(180)],
  [targets.pwa192, await png(192)],
  [targets.pwa512, await png(512)],
  [targets.maskable512, await maskablePng(512)],
])

let stale = false

for (const [path, expected] of outputs) {
  if (checkOnly) {
    const current = await readFile(path).catch(() => null)
    if (!current?.equals(expected)) {
      console.error(`Out of date: ${path.slice(root.length + 1)}`)
      stale = true
    }
    continue
  }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, expected)
  console.log(`Wrote ${path.slice(root.length + 1)}`)
}

if (stale) process.exitCode = 1
