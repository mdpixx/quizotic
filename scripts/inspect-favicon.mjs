import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const icoPath = process.argv[2] ?? '/tmp/prod-favicon.ico';
const buf = await readFile(icoPath);

const count = buf.readUInt16LE(4);
console.log(`ICO has ${count} images`);

for (let i = 0; i < count; i++) {
  const off = 6 + i * 16;
  const w = buf.readUInt8(off) || 256;
  const h = buf.readUInt8(off + 1) || 256;
  const size = buf.readUInt32LE(off + 8);
  const dataOff = buf.readUInt32LE(off + 12);
  const slice = buf.subarray(dataOff, dataOff + size);
  const head = slice.subarray(0, 8).toString('hex');
  const isPng = head === '89504e470d0a1a0a';
  const outPath = `/tmp/favicon-${w}x${h}.png`;
  if (isPng) {
    await writeFile(outPath, slice);
  } else {
    console.log(`  [${i}] ${w}x${h} is NOT PNG (header ${head}); skipping`);
    continue;
  }
  const upscaled = `/tmp/favicon-${w}x${h}-zoom.png`;
  await sharp(slice).resize(256, 256, { kernel: 'nearest' }).png().toFile(upscaled);
  console.log(`  [${i}] ${w}x${h}: wrote ${outPath} + zoomed ${upscaled}`);
}

// Also render the SVG directly at 256px for comparison
const svg = await readFile('/Users/mahesh/Claude/claude-zector/projects/Quizotic/src/app/icon.svg');
await sharp(svg, { density: 1024 }).resize(256, 256).png().toFile('/tmp/icon-svg-256.png');
console.log('  wrote /tmp/icon-svg-256.png from icon.svg directly');
