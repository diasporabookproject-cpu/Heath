// Génère les icônes PWA (PNG) sans dépendance externe.
// Dessine un fond teal arrondi + une assiette blanche + fourchette/couteau.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const TEAL = [15, 118, 110];
const WHITE = [255, 255, 255];
const MINT = [94, 234, 212];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.20; // rayon coins
  const set = (x, y, [cr, cg, cb], a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = cr;
    buf[i + 1] = cg;
    buf[i + 2] = cb;
    buf[i + 3] = a;
  };
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x < r ? r - x : x > size - r ? x - (size - r) : 0;
    const dy = y < r ? r - y : y > size - r ? y - (size - r) : 0;
    void cx; void cy;
    return dx * dx + dy * dy <= r * r;
  };

  const cx = size / 2;
  const cy = size * 0.52;
  const plateR = size * 0.27;
  const utensilW = size * 0.035;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x, y)) {
        set(x, y, [0, 0, 0], 0);
        continue;
      }
      let color = TEAL;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= plateR * plateR) color = WHITE;
      // fourchette (gauche) : manche
      const forkX = cx - size * 0.09;
      if (Math.abs(x - forkX) <= utensilW && y > size * 0.3 && y < size * 0.74) color = TEAL;
      // prongs fourchette
      if (y > size * 0.3 && y < size * 0.42) {
        for (const off of [-2, 0, 2]) {
          if (Math.abs(x - (forkX + off * utensilW)) <= utensilW * 0.5) color = TEAL;
        }
      }
      // couteau (droite)
      const knifeX = cx + size * 0.09;
      if (Math.abs(x - knifeX) <= utensilW && y > size * 0.3 && y < size * 0.74) color = TEAL;
      set(x, y, color);
    }
  }
  // pastille mint en bas
  const dotR = size * 0.04;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if ((x - cx) ** 2 + (y - size * 0.84) ** 2 <= dotR * dotR && inRounded(x, y)) set(x, y, MINT);

  return buf;
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, draw(size));
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png);
  console.log(`icon-${size}.png (${png.length} octets)`);
}
