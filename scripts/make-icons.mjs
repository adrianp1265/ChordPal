// Draws the app icon (three piano keys on blue) as PNGs, no dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

// Same shapes as public/favicon.svg, in a 64-unit box: [x, y, w, h, radius, colour].
const SHAPES = [
  [0, 0, 64, 64, 14, '#2e86ab'],
  [12, 14, 12, 36, 2, '#ffffff'], [26, 14, 12, 36, 2, '#ffffff'], [40, 14, 12, 36, 2, '#ffffff'],
  [20, 14, 8, 21, 1.5, '#1d1d1f'], [36, 14, 8, 21, 1.5, '#1d1d1f'],
];
const inside = (u, v, [x, y, w, h, r]) => {
  if (u < x || v < y || u > x + w || v > y + h) return false;
  const cx = Math.min(Math.max(u, x + r), x + w - r), cy = Math.min(Math.max(v, y + r), y + h - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
};

for (const size of [192, 512]) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      const u = ((px + 0.5) / size) * 64, v = ((py + 0.5) / size) * 64;
      let col = [0, 0, 0, 0];
      for (const s of SHAPES) if (inside(u, v, s)) col = hex(s[5]);
      row.set(col, 1 + px * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(`public/icon-${size}.png`, png);
}
console.log('icons: public/icon-192.png, public/icon-512.png');
