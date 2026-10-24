/* Generates real PNG icons (dark bg + gold ring) for the PWA manifest, using
 * only Node built-ins (zlib). Run: node scripts/make-icons.mjs
 * Replace with branded artwork when available (keep same filenames/sizes).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, draw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = draw(x, y);
      const o = 1 + x * 4;
      row[o] = r; row[o + 1] = g; row[o + 2] = b; row[o + 3] = a;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const bg = [14, 14, 16];
const gold = [212, 175, 55];
const ring = (size, maskable) => (x, y) => {
  const cx = size / 2; const cy = size / 2;
  const r = Math.hypot(x - cx, y - cy) / (size / 2); // 0..1
  const inner = maskable ? 0.30 : 0.34; // smaller content for maskable safe zone
  const outer = maskable ? 0.40 : 0.44;
  if (r > 1) return [0, 0, 0, 0];
  if (r >= inner && r <= outer) return [...gold, 255];
  if (r < inner && Math.abs(Math.hypot(x - cx, (y - cy) * 1.9)) < inner * 0.8) return [...gold, 255]; // abstract "scissors" mark
  return [...bg, 255];
};

mkdirSync(join(root, 'img'), { recursive: true });
writeFileSync(join(root, 'img', 'icon-192.png'), png(192, ring(192, false)));
writeFileSync(join(root, 'img', 'icon-512.png'), png(512, ring(512, false)));
writeFileSync(join(root, 'img', 'icon-maskable-512.png'), png(512, ring(512, true)));
console.log('PNG icons written to img/.');
