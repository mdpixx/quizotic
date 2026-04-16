import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'src/app/icon.svg')
const outDir = join(root, 'public/icons')
const BRAND_BG = '#F5E642'

const svg = readFileSync(svgPath)
mkdirSync(outDir, { recursive: true })

async function rasterize(size, file) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, file))
  console.log(`  ${file} (${size}x${size})`)
}

async function maskable(size, file) {
  const inner = Math.round(size * 0.8)
  const innerPng = await sharp(svg, { density: 512 })
    .resize(inner, inner)
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: innerPng, gravity: 'center' }])
    .png()
    .toFile(join(outDir, file))
  console.log(`  ${file} (${size}x${size}, maskable)`)
}

console.log('Generating PWA icons…')
await rasterize(192, 'icon-192.png')
await rasterize(512, 'icon-512.png')
await maskable(512, 'icon-maskable-512.png')
console.log('Done.')
