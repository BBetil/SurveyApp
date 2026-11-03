// Uygulama ikonlarını (PNG) ve kullanılan Tabler ikonlarını üretir.
// Kullanım: node scripts/build-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const ICONS = ['arrow-left', 'camera', 'camera-plus', 'chevron-right', 'check', 'clipboard-list', 'gauge', 'library-photo',
  'note', 'photo', 'plus', 'sailboat', 'search', 'settings', 'share', 'trash', 'upload', 'x', 'download', 'pencil', 'photo-plus'];
const out = {};
for (const name of ICONS) {
  const svg = readFileSync(`node_modules/@tabler/icons/icons/outline/${name}.svg`, 'utf8');
  out[name] = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]).filter((d) => d !== 'M0 0h24v24H0z');
}
writeFileSync('src/app/shared/icons.ts', `// scripts/build-assets.mjs tarafından üretildi (Tabler Icons, MIT)\nexport const ICONS: Record<string, string[]> = ${JSON.stringify(out, null, 1)};\n`);

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const SAIL_A = [[.52, .16], [.52, .60], [.80, .60]];
const SAIL_B = [[.46, .26], [.46, .60], [.24, .60]];
const HULL = [[.18, .66], [.86, .66], [.74, .80], [.30, .80]];
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size) {
  const ss = 3, raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    let o = y * (size * 3 + 1) + 1;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let a = 0; a < ss; a++) for (let b = 0; b < ss; b++) {
        const u = (x + (a + .5) / ss) / size, v = (y + (b + .5) / ss) / size;
        if (inPoly(u, v, SAIL_A) || inPoly(u, v, SAIL_B) || inPoly(u, v, HULL)) hit++;
      }
      const k = hit / (ss * ss), bg = [10, 77, 124];
      for (const c of bg) raw[o++] = Math.round(c + (255 - c) * k);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) writeFileSync(`public/icons/icon-${s}x${s}.png`, png(s));
writeFileSync('public/icons/apple-touch-icon.png', png(180));
console.log('ikonlar yazıldı');
