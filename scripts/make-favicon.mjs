import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const svgPath = '/Users/mahesh/Claude/claude-zector/projects/Quizotic/src/app/icon.svg';
const outPath = '/Users/mahesh/Claude/claude-zector/projects/Quizotic/src/app/favicon.ico';
const sizes = [16, 32, 48];

const svg = await readFile(svgPath);

const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
  )
);

const headerSize = 6;
const entrySize = 16;
const dirSize = headerSize + entrySize * sizes.length;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);        // reserved
header.writeUInt16LE(1, 2);        // type = icon
header.writeUInt16LE(sizes.length, 4);

let offset = dirSize;
const entries = sizes.map((size, i) => {
  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2);                       // color count
  entry.writeUInt8(0, 3);                       // reserved
  entry.writeUInt16LE(1, 4);                    // color planes
  entry.writeUInt16LE(32, 6);                   // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8);       // image size
  entry.writeUInt32LE(offset, 12);              // image offset
  offset += pngs[i].length;
  return entry;
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
await writeFile(outPath, ico);
console.log(`wrote ${outPath} (${ico.length} bytes, sizes: ${sizes.join(', ')})`);
