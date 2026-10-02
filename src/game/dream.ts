import { drawClouds, drawShape, drawSparkles, drawStars, MOON_SHAPE, wrapY } from "./background";
import type { DecorFn } from "./themes";

/**
 * 꿈나라: 잠든 방(커튼·창문 달·떠오르는 Zzz) → 양 세는 언덕(폴짝 넘어가는 양) → 무지개 구름 → 은하수(별의 강·별똥별).
 * 지역 높이는 기본과 같고(난이도 그대로) 이름·장식만 꿈 속 이야기로.
 */

const Z = ["#####", "...#.", "..#..", ".#...", "#####"];
const WINDOW = 9; // 창문 한 변(칸)
const SHEEP = [
  "..######..",
  ".########.",
  "##########",
  "##########",
  ".########.",
  "..#....#..",
];

/** 잠든 방: 양옆 물결 커튼, 창문 너머 달, 머리 위로 떠오르는 Zzz */
const bedroom: DecorFn = (ctx, p, w, h, s) => {
  const cell = 8;
  const off = s.cameraY * 0.5;
  const shift = ((off % cell) + cell) % cell;
  const start = Math.floor(off / cell);
  for (let r = -1; r < Math.ceil(h / cell) + 2; r++) {
    const n = start - r;
    const y = Math.round(r * cell + shift);
    // 커튼 주름: 줄마다 폭이 물결치듯
    const wave = Math.round(Math.sin(n * 0.35) * 1.2);
    ctx.fillStyle = "#e3b8f0";
    ctx.fillRect(0, y, (3 + wave) * cell, cell);
    ctx.fillRect(w - (3 - wave) * cell, y, (3 - wave) * cell, cell);
    ctx.fillStyle = "#f5d9ff";
    for (const x of [cell, w - 2 * cell]) ctx.fillRect(x, y, 3, cell);
  }
  // 창문 (천천히 흘러간다)
  const c = 5;
  const wx = Math.round(w * 0.6);
  const wy = wrapY(h * 0.18, s.cameraY * 0.15, h, 80);
  ctx.fillStyle = "#4a4598";
  ctx.fillRect(wx, wy, WINDOW * c, WINDOW * c);
  ctx.fillStyle = "#fff4c7";
  ctx.fillRect(wx - c, wy - c, (WINDOW + 2) * c, c);
  ctx.fillRect(wx - c, wy + WINDOW * c, (WINDOW + 2) * c, c);
  ctx.fillRect(wx - c, wy, c, WINDOW * c);
  ctx.fillRect(wx + WINDOW * c, wy, c, WINDOW * c);
  ctx.fillRect(wx + 4 * c, wy, c, WINDOW * c);
  drawShape(ctx, MOON_SHAPE, wx + c, wy + c, 3, p.moon);
  // Zzz: 작은 것부터 비스듬히 떠오른다
  for (let k = 0; k < 3; k++) {
    const rise = s.reducedMotion ? 0 : s.time * 14;
    const size = 2 + k;
    const x = Math.round(w * 0.3 + k * 18 + (s.reducedMotion ? 0 : Math.sin(s.time + k) * 4));
    drawShape(ctx, Z, x, wrapY(h * (0.62 - k * 0.12) - rise, s.cameraY * 0.25, h), size, "rgba(255,255,255,0.85)");
  }
  drawSparkles(ctx, p, w, h, s, Math.round(4 * p.sparkleDensity), 0.3);
};

/** 양 세는 언덕: 구름 사이로 양이 폴짝폴짝 지나간다 */
const sheepHill: DecorFn = (ctx, p, w, h, s) => {
  drawClouds(ctx, p, w, h, s, 4, 0.2);
  const cell = 4;
  const sw = SHEEP[0].length * cell;
  for (const [fx, fy, speed] of [
    [0.1, 0.3, 26],
    [0.55, 0.55, 20],
    [0.85, 0.78, 32],
  ] as const) {
    const span = w + sw * 2;
    const t = s.reducedMotion ? 0 : s.time * speed;
    const x = Math.round((((fx * span + t) % span) + span) % span) - sw;
    // 한 번에 sw만큼 가며 한 번 뛴다
    const hop = s.reducedMotion ? 0 : Math.round(Math.abs(Math.sin((t / sw) * Math.PI)) * 10);
    const y = wrapY(fy * h, s.cameraY * 0.2, h) - hop;
    drawShape(ctx, SHEEP, x, y, cell, "#ffffff");
    // 얼굴·발은 진한 색 (오른쪽을 본다)
    ctx.fillStyle = "#4a4598";
    ctx.fillRect(x + sw - cell * 2, y + cell, cell * 2, cell * 2);
    ctx.fillRect(x + cell * 2, y + cell * 5, cell, cell);
    ctx.fillRect(x + cell * 7, y + cell * 5, cell, cell);
  }
};

const RAINBOW = ["#ffb3c7", "#ffd29a", "#fff1a8", "#bff0c8", "#b5d8ff", "#cbb8ff"];

/** 무지개 구름: 큰 도트 무지개 + 구름 */
const rainbowClouds: DecorFn = (ctx, p, w, h, s) => {
  const cell = 6;
  const cx = Math.round(w / 2);
  const cy = wrapY(h * 0.6, s.cameraY * 0.12, h, 200);
  const outer = Math.round(Math.min(w * 0.45, 180) / cell);
  RAINBOW.forEach((color, band) => {
    const r = outer - band;
    ctx.fillStyle = color;
    // 띠 한 줄 = 반지름 r과 r-1 사이 (세로로 빈틈없이 채운다)
    const arc = (rr: number, dx: number) => (Math.abs(dx) > rr ? 0 : Math.round(Math.sqrt(rr * rr - dx * dx)));
    for (let dx = -r; dx <= r; dx++) {
      const top = arc(r, dx);
      const inner = arc(r - 1, dx);
      ctx.fillRect(cx + dx * cell, cy - top * cell, cell, Math.max(1, top - inner) * cell);
    }
  });
  drawClouds(ctx, p, w, h, s, 6, 0.35);
};

/** 은하수: 별 + 비스듬한 별의 강 + 가끔 지나가는 별똥별 */
const galaxy: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, p, w, h, s);
  ctx.fillStyle = "rgba(255,214,245,0.55)";
  for (let k = 0; k < 60; k++) {
    const f = (k * 0.618) % 1;
    const x = Math.round(f * w);
    const spread = ((k * 0.37) % 1) * 46 - 23;
    ctx.fillRect(x, wrapY(h * 0.7 - f * h * 0.5 + spread, s.cameraY * 0.06, h, 120), 2, 2);
  }
  drawShape(ctx, MOON_SHAPE, Math.round(w * 0.74), wrapY(h * 0.1, s.cameraY * 0.05, h), 5, p.moon);
  if (!s.reducedMotion) {
    const cycle = s.time % 5;
    if (cycle < 0.8) {
      const t = cycle / 0.8;
      const x = Math.round(w * (0.15 + t * 0.6));
      const y = Math.round(h * (0.08 + t * 0.25));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 4, 4);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let k = 1; k <= 4; k++) ctx.fillRect(x - k * 6, y - k * 3, 3, 3);
    }
  }
};

export const DREAM_DECOR: Record<string, DecorFn> = { bedroom, sheep: sheepHill, rainbow: rainbowClouds, galaxy };
