import { REGION_IDS, type RegionId } from "./regions";
import type { ScenePalette } from "./themes";

/**
 * 배경 렌더러 (기획서 3-5).
 * 지역마다 하늘 색 + 장식이 있고, 경계에서는 두 지역을 섞는다 (blend = 0.5면 동굴·지상 반반).
 * 그라데이션 대신 계단식 색 띠를 써서 밴딩이 없고 도트 느낌이 나게 한다.
 * 장식은 카메라보다 느리게 움직여(패럴랙스) 깊이감을 준다.
 */

type RGB = [number, number, number];

const INK: RGB = [61, 44, 94];
const WHITE: RGB = [255, 255, 255];

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c: RGB) {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

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

const CLOUD_SHAPE = ["..####..", ".######.", "########", "########"];
const MOON_SHAPE = ["..####..", ".####...", "####....", "####....", "####....", ".####...", "..####.."];
const PLANET_SHAPE = [
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
  const last = REGION_IDS.length - 1;
  const b = Math.max(0, Math.min(last, s.blend));
  const i = Math.floor(b);
  const j = Math.min(last, i + 1);
  const t = b - i;
  const a = REGION_IDS[i];
  const c = REGION_IDS[j];

  // 하늘: 두 지역의 색을 섞은 계단식 띠
  const top = mixRgb(hex(p.regions[a].top), hex(p.regions[c].top), t);
  const bottom = mixRgb(hex(p.regions[a].bottom), hex(p.regions[c].bottom), t);
  const band = h / BAND_COUNT;
  for (let k = 0; k < BAND_COUNT; k++) {
    ctx.fillStyle = css(mixRgb(top, bottom, k / (BAND_COUNT - 1)));
    ctx.fillRect(0, Math.floor(k * band), w, Math.ceil(band) + 1);
  }

  // 장식: 지금 지역은 진하게, 다음 지역은 섞이는 만큼만
  drawRegionDecor(ctx, p, a, w, h, s, 1 - t);
  if (t > 0 && c !== a) drawRegionDecor(ctx, p, c, w, h, s, t);
}

function drawRegionDecor(
  ctx: CanvasRenderingContext2D,
  p: ScenePalette,
  region: RegionId,
  w: number,
  h: number,
  s: BackgroundState,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  switch (region) {
    case "cave":
      drawCave(ctx, p, w, h, s);
      break;
    case "ground":
      drawClouds(ctx, p, w, h, s, 3, 0.15);
      drawBirds(ctx, w, h, s);
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
function wrapY(baseY: number, offset: number, h: number, margin = 60) {
  const span = h + margin * 2;
  return Math.round((((baseY + offset + margin) % span) + span) % span) - margin;
}

function drawShape(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, cell: number, color: string) {
  ctx.fillStyle = color;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === "#") ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
    }
  });
}

function drawSparkles(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState, count: number, parallax: number) {
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
  const base = hex(p.regions.cave.top);
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

function drawClouds(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState, count: number, parallax: number) {
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

function drawBirds(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState) {
  const flap = s.reducedMotion || Math.floor(s.time * 4) % 2 === 0;
  for (const [fx, fy, speed] of [
    [0.2, 0.25, 18],
    [0.6, 0.4, 12],
  ] as const) {
    const span = w + 40;
    const x = ((((fx * span + (s.reducedMotion ? 0 : s.time * speed)) % span) + span) % span) - 20;
    drawShape(ctx, flap ? BIRD_UP : BIRD_DOWN, Math.round(x), wrapY(fy * h, s.cameraY * 0.2, h), 3, "rgba(61,44,94,0.55)");
  }
}

function drawStars(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
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

function drawPlanet(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
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
