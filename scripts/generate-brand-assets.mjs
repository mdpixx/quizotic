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
  publicIconSvg: join(root, 'public/icons/icon.svg'),
  publicFavicon16Svg: join(root, 'public/icons/favicon-16.svg'),
  publicFavicon32Svg: join(root, 'public/icons/favicon-32.svg'),
  publicMaskableSvg: join(root, 'public/icons/icon-maskable.svg'),
  favicon: join(root, 'src/app/favicon.ico'),
  apple: join(root, 'src/app/apple-icon.png'),
  pwa192: join(root, 'public/icons/icon-192.png'),
  pwa512: join(root, 'public/icons/icon-512.png'),
  maskable512: join(root, 'public/icons/icon-maskable-512.png'),
}

const source = await readFile(sourcePath)

const favicon16Svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <title>Quizotic</title>
  <rect width="16" height="16" rx="3.8" fill="#FBD13B"/>
  <path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" fill="#0F1B3D"/>
  <circle cx="8" cy="8" r="2.65" fill="#FBD13B"/>
  <path d="M9.5 9.5 12.5 12.5" fill="none" stroke="#FBD13B" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="8" cy="8" r="1" fill="#0F1B3D"/>
</svg>
`)

const favicon32Svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <title>Quizotic</title>
  <rect width="32" height="32" rx="7.5" fill="#FBD13B"/>
  <rect x="7" y="7" width="18" height="18" rx="4.5" fill="#0F1B3D" transform="rotate(45 16 16)"/>
  <circle cx="16" cy="16" r="5" fill="#FBD13B"/>
  <path d="M19 19 24.5 24.5" fill="none" stroke="#FBD13B" stroke-width="4" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="1.9" fill="#0F1B3D"/>
</svg>
`)

const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <title>Quizotic</title>
  <rect width="64" height="64" fill="#FBD13B"/>
  <rect x="16" y="16" width="32" height="32" rx="8" fill="#0F1B3D" transform="rotate(45 32 32)"/>
  <circle cx="32" cy="32" r="9" fill="#FBD13B"/>
  <path d="M37.4 37.4 47 47" fill="none" stroke="#FBD13B" stroke-width="7.25" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="3.35" fill="#0F1B3D"/>
</svg>
`)

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
  [targets.publicIconSvg, source],
  [targets.publicFavicon16Svg, favicon16Svg],
  [targets.publicFavicon32Svg, favicon32Svg],
  [targets.publicMaskableSvg, maskableSvg],
  [targets.favicon, ico(faviconImages)],
  [targets.apple, await png(180)],
  [targets.pwa192, await png(192)],
  [targets.pwa512, await png(512)],
  [targets.maskable512, await maskablePng(512)],
])

let stale = false

async function matchesExpected(path, current, expected) {
  if (!current) return false
  if (!path.endsWith('.png')) return current.equals(expected)

  // SVG antialiasing and PNG compression vary slightly across the macOS and
  // Linux Sharp/libvips builds. Compare decoded pixels with a very small mean
  // channel tolerance: harmless edge-rendering variance passes, while a real
  // colour, geometry, size, or source-asset change still fails.
  const [currentImage, expectedImage] = await Promise.all([
    sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ])

  const currentInfo = currentImage.info
  const expectedInfo = expectedImage.info
  if (
    currentInfo.width !== expectedInfo.width ||
    currentInfo.height !== expectedInfo.height ||
    currentInfo.channels !== expectedInfo.channels ||
    currentImage.data.length !== expectedImage.data.length
  ) {
    return false
  }

  let totalDelta = 0
  for (let i = 0; i < currentImage.data.length; i++) {
    totalDelta += Math.abs(currentImage.data[i] - expectedImage.data[i])
  }

  return totalDelta / currentImage.data.length <= 0.5
}

for (const [path, expected] of outputs) {
  if (checkOnly) {
    const current = await readFile(path).catch(() => null)
    if (!await matchesExpected(path, current, expected)) {
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
