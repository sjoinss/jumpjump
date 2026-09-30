/**
 * 고정 기본 도트 아이콘(말랑이)으로 PWA 아이콘 PNG를 만든다. 외부 라이브러리 없이 zlib만 쓴다.
 * 실행: node scripts/make-icons.mts  (Node 23.6+ 타입 제거 지원 필요)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { HERO_MALLANG } from "../src/game/presets.ts";

const BG = [0xec, 0xe8, 0xfd]; // --color-primary-soft

type Icon = { file: string; size: number; cell: number };

const ICONS: Icon[] = [
  { file: "icon-192.png", size: 192, cell: 8 },
  { file: "apple-touch-icon.png", size: 180, cell: 8 },
  { file: "icon-512.png", size: 512, cell: 22 },
  // maskable은 가운데 80% 원 안에 들어가도록 작게
  { file: "icon-maskable-512.png", size: 512, cell: 16 },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size: number, rgb: Uint8Array) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    rgb.subarray(y * size * 3, (y + 1) * size * 3).forEach((v, i) => (raw[y * (size * 3 + 1) + 1 + i] = v));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function render({ size, cell }: Icon) {
  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0; i < size * size; i++) rgb.set(BG, i * 3);
  const { width, height, pixels } = HERO_MALLANG;
  const ox = Math.floor((size - width * cell) / 2);
  const oy = Math.floor((size - height * cell) / 2);
  pixels.forEach((color, i) => {
    if (!color) return;
    const n = parseInt(color.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const px = ox + (i % width) * cell;
    const py = oy + Math.floor(i / width) * cell;
    for (let y = py; y < py + cell; y++) for (let x = px; x < px + cell; x++) rgb.set(c, (y * size + x) * 3);
  });
  return encodePng(size, rgb);
}

mkdirSync("public/icons", { recursive: true });
for (const icon of ICONS) {
  writeFileSync(`public/icons/${icon.file}`, render(icon));
  console.log(`public/icons/${icon.file}`);
}
