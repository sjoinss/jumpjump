import { CONFIG } from "./config";
import { css, hex, INK, mixRgb, WHITE, type RGB } from "./color";
import { drawTiles } from "./tiles";
import type { RegionKey, ScenePalette } from "./themes";

/**
 * 배경 렌더러 (기획서 3-5).
 * 지역마다 하늘 색 + 장식이 있고, 경계에서는 두 지역을 섞는다 (blend = 0.5면 첫째·둘째 반반).
 * 테마 방식(themes.ts SceneStyle)에 따라 바다(실제 수면)·블록(세상의 단면)을 그 위에 더 그린다.
 * 그라데이션 대신 계단식 색 띠를 써서 밴딩이 없고 도트 느낌이 나게 한다.
 * 장식은 카메라보다 느리게 움직여(패럴랙스) 깊이감을 준다.
 */

const BAND_COUNT = 9;

/** 반짝이 위치(0~1 비율)와 박자. 매번 같은 배치가 나오게 고정값 */
const SPARKLES = [
  [0.12, 0.1, 0],
  [0.8, 0.07, 1.3],
  [0.55, 0.2, 0.6],
  [0.25, 0.33, 2.1],
  [0.9, 0.3, 0.2],
  [0.4, 0.47, 1.7],
  [0.72, 0.52, 0.9],
  [0.08, 0.6, 1.1],
  [0.32, 0.06, 0.4],
  [0.63, 0.12, 2.4],
  [0.18, 0.22, 1.9],
  [0.86, 0.18, 0.7],
  [0.5, 0.36, 1.2],
  [0.95, 0.45, 2.7],
  [0.28, 0.5, 0.3],
  [0.6, 0.62, 1.5],
  [0.04, 0.8, 0.8],
  [0.44, 0.74, 2.2],
  [0.76, 0.86, 1.6],
  [0.2, 0.92, 0.1],
] as const;

export const CLOUD_SHAPE = ["..####..", ".######.", "########", "########"];
export const MOON_SHAPE = ["..####..", ".####...", "####....", "####....", "####....", ".####...", "..####.."];
export const PLANET_SHAPE = [
  "....####....",
  "..########..",
  ".##########.",
  "############",
  "############",
  ".##########.",
  "..########..",
  "....####....",
];
const CRYSTAL_SHAPE = [".#.", "###", "###", "###", ".#."];
const BIRD_UP = ["#...#", ".#.#.", "..#.."];
const BIRD_DOWN = ["..#..", ".#.#.", "#...#"];

export type BackgroundState = {
  /** 지역 섞임 위치 (0 = 동굴, 1 = 지상, 1.5 = 지상·하늘 반반 …) */
  blend: number;
  /** 카메라 높이 (패럴랙스용) */
  cameraY: number;
  time: number;
  reducedMotion: boolean;
};

export function drawBackground(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  const list = p.regions;
  const last = list.length - 1;
  // 바다: 물 위로 보이는 하늘은 둘째 지역(수면)부터 — 물속 색은 아래 drawWater가 따로 칠한다
  const min = p.style === "ocean" ? 1 : 0;
  const b = Math.max(min, Math.min(last, s.blend));
  const i = Math.floor(b);
  const j = Math.min(last, i + 1);
  const t = b - i;
  const a = list[i];
  const c = list[j];

  // 하늘: 두 지역의 색을 섞은 계단식 띠
  bands(ctx, mixRgb(hex(a.top), hex(c.top), t), mixRgb(hex(a.bottom), hex(c.bottom), t), w, 0, h);

  // 장식: 지금 지역은 진하게, 다음 지역은 섞이는 만큼만
  drawRegionDecor(ctx, p, a.key, w, h, s, 1 - t);
  if (t > 0 && c !== a) drawRegionDecor(ctx, p, c.key, w, h, s, t);

  if (p.style === "ocean") drawWater(ctx, p, w, h, s);
  else if (p.tiles) drawTiles(ctx, p, p.tiles, w, h, s);
}

/** 계단식 색 띠 (y0부터 높이 hh) */
function bands(ctx: CanvasRenderingContext2D, top: RGB, bottom: RGB, w: number, y0: number, hh: number) {
  const band = hh / BAND_COUNT;
  for (let k = 0; k < BAND_COUNT; k++) {
    ctx.fillStyle = css(mixRgb(top, bottom, k / (BAND_COUNT - 1)));
    ctx.fillRect(0, Math.floor(y0 + k * band), w, Math.ceil(band) + 1);
  }
}

/** 세계 높이(px) → 화면 y. 카메라 cameraY = 화면 맨 아래의 세계 높이 */
const worldToScreen = (y: number, h: number, s: BackgroundState) => h - (y - s.cameraY);

function drawRegionDecor(
  ctx: CanvasRenderingContext2D,
  p: ScenePalette,
  region: RegionKey,
  w: number,
  h: number,
  s: BackgroundState,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  // 테마 전용 장식이 있으면 그것 (예: 과자 나라의 솜사탕 구름)
  const custom = p.decor?.[region];
  if (custom) {
    custom(ctx, p, w, h, s);
    ctx.globalAlpha = 1;
    return;
  }
  switch (region) {
    case "cave":
      drawCave(ctx, p, w, h, s);
      break;
    case "ground":
    case "surface":
    case "overworld":
      drawClouds(ctx, p, w, h, s, 3, 0.15);
      drawBirds(ctx, w, h, s, region === "surface" ? "rgba(43,92,143,0.6)" : "rgba(61,44,94,0.55)");
      break;
    case "sky":
      drawClouds(ctx, p, w, h, s, 7, 0.35);
      break;
    case "space":
      drawStars(ctx, p, w, h, s);
      drawShape(ctx, MOON_SHAPE, Math.round(w * 0.74), wrapY(h * 0.1, s.cameraY * 0.05, h), 5, p.moon);
      drawPlanet(ctx, p, w, h, s);
      break;
  }
  ctx.globalAlpha = 1;
}

/** 카메라가 오를수록 아래로 흘러가고, 화면 밖으로 나가면 위에서 다시 나온다 */
export function wrapY(baseY: number, offset: number, h: number, margin = 60) {
  const span = h + margin * 2;
  return Math.round((((baseY + offset + margin) % span) + span) % span) - margin;
}

export function drawShape(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, cell: number, color: string) {
  ctx.fillStyle = color;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === "#") ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
    }
  });
}

export function drawSparkles(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState, count: number, parallax: number) {
  for (let k = 0; k < Math.min(count, SPARKLES.length); k++) {
    const [fx, fy, phase] = SPARKLES[k];
    const on = s.reducedMotion || Math.sin(s.time * 2.2 + phase * 3) > -0.2;
    const x = Math.round(fx * w);
    const y = wrapY(fy * h, s.cameraY * parallax, h);
    ctx.fillStyle = p.sparkle;
    ctx.fillRect(x, y - 3, 3, 9);
    ctx.fillRect(x - 3, y, 9, 3);
    if (on) {
      ctx.fillStyle = p.sparkleCore;
      ctx.fillRect(x, y, 3, 3);
    }
  }
}

/** 동굴: 양옆 울퉁불퉁한 바위벽 + 반짝이는 수정 */
function drawCave(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  const base = hex((p.regions.find((r) => r.key === "cave") ?? p.regions[0]).top);
  const wall = css(mixRgb(base, INK, 0.22));
  const wallLight = css(mixRgb(base, WHITE, 0.25));
  const cell = 8;
  const off = s.cameraY * 0.5;
  const rows = Math.ceil(h / cell) + 2;
  const shift = ((off % cell) + cell) % cell;
  const startRow = Math.floor(off / cell);
  for (let r = -1; r < rows; r++) {
    const y = Math.round(r * cell + shift);
    const n = startRow - r;
    // 줄마다 두께가 조금씩 다른 벽 (고정된 규칙이라 흔들리지 않는다)
    const left = 2 + ((n * 7) % 3 + 3) % 3 + (((n * 13) % 5 + 5) % 5 === 0 ? 2 : 0);
    const right = 2 + ((n * 5) % 3 + 3) % 3 + (((n * 11) % 7 + 7) % 7 === 0 ? 2 : 0);
    ctx.fillStyle = wall;
    ctx.fillRect(0, y, left * cell, cell);
    ctx.fillRect(w - right * cell, y, right * cell, cell);
    ctx.fillStyle = wallLight;
    ctx.fillRect(left * cell - 2, y, 2, cell);
    ctx.fillRect(w - right * cell, y, 2, cell);
  }
  // 수정 (벽에 붙어 있음)
  for (const [fx, fy] of [
    [0.06, 0.22],
    [0.92, 0.46],
    [0.08, 0.7],
    [0.9, 0.9],
  ] as const) {
    const y = wrapY(fy * h, off, h);
    drawShape(ctx, CRYSTAL_SHAPE, Math.round(fx * w) - 4, y, 4, p.accent);
    ctx.fillStyle = p.sparkleCore;
    ctx.fillRect(Math.round(fx * w), y + 4, 4, 4);
  }
  drawSparkles(ctx, p, w, h, s, Math.round(6 * p.sparkleDensity), 0.3);
}

export function drawClouds(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState, count: number, parallax: number) {
  for (let k = 0; k < count; k++) {
    const fx = (k * 0.37 + 0.1) % 1;
    const fy = (k * 0.29 + 0.12) % 1;
    const cell = 3 + (k % 3);
    const speed = 4 + (k % 4) * 2;
    const cloudW = CLOUD_SHAPE[0].length * cell;
    const span = w + cloudW;
    const x = ((((fx * span + (s.reducedMotion ? 0 : s.time * speed)) % span) + span) % span) - cloudW;
    drawShape(ctx, CLOUD_SHAPE, Math.round(x), wrapY(fy * h, s.cameraY * parallax, h), cell, p.cloud);
  }
  drawSparkles(ctx, p, w, h, s, Math.round(3 * p.sparkleDensity), parallax);
}

export function drawBirds(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, color: string) {
  const flap = s.reducedMotion || Math.floor(s.time * 4) % 2 === 0;
  for (const [fx, fy, speed] of [
    [0.2, 0.25, 18],
    [0.6, 0.4, 12],
  ] as const) {
    const span = w + 40;
    const x = ((((fx * span + (s.reducedMotion ? 0 : s.time * speed)) % span) + span) % span) - 20;
    drawShape(ctx, flap ? BIRD_UP : BIRD_DOWN, Math.round(x), wrapY(fy * h, s.cameraY * 0.2, h), 3, color);
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  // 작은 점 별 (많이) + 십자 반짝이
  ctx.fillStyle = p.sparkle;
  for (let k = 0; k < 40; k++) {
    const fx = (k * 0.618) % 1;
    const fy = (k * 0.382 + (k % 7) * 0.03) % 1;
    const twinkle = s.reducedMotion || Math.sin(s.time * 3 + k) > -0.6;
    if (!twinkle) continue;
    const size = k % 5 === 0 ? 3 : 2;
    ctx.fillRect(Math.round(fx * w), wrapY(fy * h, s.cameraY * 0.08, h), size, size);
  }
  drawSparkles(ctx, p, w, h, s, Math.round(10 * p.sparkleDensity), 0.12);
}

export function drawPlanet(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  const x = Math.round(w * 0.12);
  const y = wrapY(h * 0.5, s.cameraY * 0.1, h, 80);
  drawShape(ctx, PLANET_SHAPE, x, y, 5, p.accent);
  // 고리
  ctx.fillStyle = p.moon;
  ctx.fillRect(x - 10, y + 18, 80, 5);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x + 10, y + 5, 10, 5);
}

/**
 * 시작 장면의 바닥: 동글동글한 윗면 + 흙 + 자갈·꽃 도트.
 * @param top 바닥 윗면의 y (논리)
 */
export function drawGround(ctx: CanvasRenderingContext2D, p: ScenePalette, x0: number, w: number, top: number, height: number) {
  const g = p.ground;
  const px = 4; // 도트 한 칸
  ctx.fillStyle = g.soil;
  ctx.fillRect(x0, top + 10, w, height);
  ctx.fillStyle = g.pebble;
  for (let x = x0 + 12, i = 0; x < x0 + w; x += 36, i++) {
    const y = top + 26 + ((i * 17) % 40);
    ctx.fillRect(Math.round(x), y, px * 2, px);
    ctx.fillRect(Math.round(x) + px, y + px, px * 2, px);
  }
  ctx.fillStyle = g.topEdge;
  ctx.fillRect(x0, top + 8, w, px);
  ctx.fillStyle = g.top;
  ctx.fillRect(x0, top, w, 8);
  for (let x = x0, i = 0; x < x0 + w; x += px * 4, i++) {
    ctx.fillStyle = g.top;
    ctx.fillRect(Math.round(x), top + 8, px * 2, px);
    ctx.fillStyle = g.topEdge;
    ctx.fillRect(Math.round(x), top + 12, px * 2, px);
    if (i % 5 === 2) {
      ctx.fillStyle = g.flower;
      ctx.fillRect(Math.round(x) + px, top - px, px, px);
      ctx.fillStyle = g.flowerCore;
      ctx.fillRect(Math.round(x) + px, top - px * 2, px, px);
    }
  }
  ctx.fillStyle = g.highlight;
  ctx.fillRect(x0, top, w, 2);
}

// ── 바다 테마: 실제 수면 ──

const BUBBLE_SHAPE = [".##.", "#..#", "#..#", ".##."];
/** 오른쪽을 보는 물고기 (꼬리가 왼쪽) */
const FISH_SHAPE = ["#..###..", "##.#####", "########", "##.#####", "#..###.."];
const FISH_COLORS = ["#ffb35c", "#ff8fab", "#ffe08a"];

/**
 * 둘째 지역(수면) 시작 높이에 수면이 있다. 그 아래를 물로 덮고 물속 장식(빛줄기·해초·거품·물고기)을 그린다.
 * 올라갈수록 수면이 화면 위에서 내려와 "물 밖으로 나오는" 순간이 생긴다. 물속은 위(수면 쪽)가 밝다.
 */
function drawWater(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  const deep = p.regions[0];
  const sy = Math.round(worldToScreen(p.regions[1].startM * CONFIG.score.pxPerMeter, h, s));
  if (sy >= h) return;
  const top = Math.max(0, sy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, h - top);
  ctx.clip();
  bands(ctx, hex(deep.top), hex(deep.bottom), w, top, h - top);
  drawRays(ctx, w, h, s, top);
  drawSeaweed(ctx, w, h, s);
  drawFish(ctx, w, h, s);
  drawBubbles(ctx, w, h, s);
  ctx.restore();

  // 수면: 밝은 선 + 출렁이는 물결 도트
  if (sy > -8) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(0, sy, w, 3);
    const phase = s.reducedMotion ? 0 : Math.floor(s.time * 3);
    ctx.fillStyle = "#ffffff";
    for (let x = 0, k = 0; x < w; x += 12, k++) {
      if ((k + phase) % 3 === 0) ctx.fillRect(x, sy - 3, 8, 3);
    }
    // 물 위 반짝임
    ctx.fillStyle = p.sparkleCore;
    for (let k = 0; k < 6; k++) {
      if (!s.reducedMotion && Math.sin(s.time * 2.5 + k * 1.7) < 0.3) continue;
      ctx.fillRect(Math.round(((k * 0.37 + 0.08) % 1) * w), sy + 6 + (k % 3) * 5, 6, 2);
    }
  }
}

/** 수면에서 비스듬히 내려오는 빛줄기 */
function drawRays(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, top: number) {
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  const sway = s.reducedMotion ? 0 : Math.sin(s.time * 0.6) * 10;
  for (const fx of [0.2, 0.52, 0.8]) {
    for (let y = top, k = 0; y < h; y += 8, k++) {
      ctx.fillRect(Math.round(fx * w + sway - k * 3), y, 22, 8);
    }
  }
}

/** 양옆 해초 숲: 세로로 이어진 줄기가 살랑거린다 (패럴랙스 0.5) */
function drawSeaweed(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState) {
  const cell = 6;
  const off = s.cameraY * 0.5;
  const shift = ((off % cell) + cell) % cell;
  const startRow = Math.floor(off / cell);
  const rows = Math.ceil(h / cell) + 2;
  const strands = [
    [0.03, "#3fb89a"],
    [0.09, "#2f9a7f"],
    [0.91, "#2f9a7f"],
    [0.97, "#3fb89a"],
  ] as const;
  strands.forEach(([fx, color], k) => {
    ctx.fillStyle = color;
    for (let r = -1; r < rows; r++) {
      const n = startRow - r;
      const sway = Math.round(Math.sin(n * 0.45 + k * 1.3 + (s.reducedMotion ? 0 : s.time * 1.4)) * 1.6);
      const x = Math.round(fx * w) + sway * 3;
      const y = Math.round(r * cell + shift);
      ctx.fillRect(x, y, cell, cell);
      // 잎: 몇 줄마다 옆으로 삐죽
      if (((n % 5) + 5) % 5 === 0) ctx.fillRect(x + (k % 2 ? -cell : cell), y, cell, cell);
    }
  });
}

function drawFish(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState) {
  const cell = 3;
  const fw = FISH_SHAPE[0].length * cell;
  const school: [number, number, number][] = [
    [0.15, 0.3, 22],
    [0.65, 0.55, -16],
    [0.4, 0.8, 12],
  ];
  school.forEach(([fx, fy, speed], k) => {
    const span = w + fw * 2;
    const x = Math.round(((((fx * span + (s.reducedMotion ? 0 : s.time * speed)) % span) + span) % span) - fw);
    const y = wrapY(fy * h, s.cameraY * 0.25, h);
    const rows = speed > 0 ? FISH_SHAPE : FISH_SHAPE.map((r) => [...r].reverse().join(""));
    drawShape(ctx, rows, x, y, cell, FISH_COLORS[k % FISH_COLORS.length]);
    // 눈 (머리 쪽)
    ctx.fillStyle = "#3d2c5e";
    ctx.fillRect(speed > 0 ? x + fw - cell * 2 : x + cell, y + cell, cell, cell);
  });
}

function drawBubbles(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState) {
  for (let k = 0; k < 10; k++) {
    const fx = (k * 0.618 + 0.05) % 1;
    const fy = (k * 0.37) % 1;
    const rise = s.reducedMotion ? 0 : s.time * (18 + (k % 4) * 8);
    const x = Math.round(fx * w + (s.reducedMotion ? 0 : Math.sin(s.time * 2 + k) * 3));
    drawShape(ctx, BUBBLE_SHAPE, x, wrapY(fy * h - rise, s.cameraY * 0.4, h), 2, "rgba(255,255,255,0.7)");
  }
}
