import { CONFIG } from "./config";
import type { RegionKey, ScenePalette } from "./themes";

/**
 * 배경 렌더러 (기획서 3-5).
 * 지역마다 하늘 색 + 장식이 있고, 경계에서는 두 지역을 섞는다 (blend = 0.5면 첫째·둘째 반반).
 * 테마 방식(themes.ts SceneStyle)에 따라 바다(실제 수면)·블록(세상의 단면)을 그 위에 더 그린다.
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
  else if (p.style === "blocks") drawBlocks(ctx, p, w, h, s);
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

function drawBirds(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, color: string) {
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

// ── 블록 테마: 세상의 단면 ──

const T = 16;
/** 가운데 뒷벽을 어둡게 하는 정도 (발판보다 뒤에 있어 보이게) */
const BACKWALL = 0.36;

type Material = "nether" | "stone" | "dirt" | "grass" | "trunk" | "leaves";

/** 재질마다 세 가지 명암 (블록마다 하나를 골라 얼룩덜룩하게) */
const MAT: Record<Material, [string, string, string]> = {
  nether: ["#b5464f", "#a63d47", "#c4545c"],
  stone: ["#9a9ba6", "#8d8e99", "#a7a8b2"],
  dirt: ["#9b6a43", "#8e5f3b", "#a8754c"],
  grass: ["#9b6a43", "#8e5f3b", "#a8754c"],
  trunk: ["#7a5232", "#6d4a2c", "#86593a"],
  leaves: ["#4fa83a", "#479a34", "#5cb846"],
};
const GRASS_TOP = "#74c84f";
const ORES = ["#3d3d46", "#e3b07a", "#6fe0e6", "#ffd84a"];
const LAVA = ["#ff8a3d", "#ffb347"];
const GLOW = "#ffe08a";

/** 블록 좌표마다 고정된 무작위 값 (매 프레임 같게) */
function hash(a: number, b: number, c = 0) {
  let x = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1442695041);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * 세상의 단면: 블록 한 줄의 재질은 세계 높이로 정해진다 (둘째 지역 시작 = 네더 → 돌, 셋째 지역 시작 = 지표면).
 * 양옆은 밝은 블록 벽, 가운데는 어두운 뒷벽(파낸 굴)이라 발판과 헷갈리지 않는다. 지표면 위는 하늘 + 양옆 나무.
 * 블록은 세계에 붙어 있어(패럴랙스 없음) 경계가 실제로 지나간다.
 */
function drawBlocks(ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) {
  const ppm = CONFIG.score.pxPerMeter;
  const layout: BlockLayout = {
    nStone: Math.floor((p.regions[1].startM * ppm) / T),
    nSurf: Math.floor((p.regions[2].startM * ppm) / T),
    cols: Math.ceil(w / T),
  };
  const n0 = Math.max(-4, Math.floor(s.cameraY / T) - 1);
  const n1 = Math.floor((s.cameraY + h) / T) + 1;
  if (n0 > layout.nSurf + 8) return; // 나무 꼭대기까지 지나갔으면 하늘뿐

  // 블록은 움직이지 않으니 CHUNK줄씩 한 번 그려 두고 이미지로 붙인다 (매 프레임 수천 칸을 다시 그리지 않게)
  const scale = ctx.getTransform().a || 1;
  const blink = (v: number) => (s.reducedMotion ? 0 : Math.floor(s.time * 2 + (v % 7)) % 2);
  for (let k = Math.floor(n0 / CHUNK); k <= Math.floor(n1 / CHUNK); k++) {
    const chunk = blockChunk(p, layout, k, scale);
    const top = Math.round(worldToScreen((k + 1) * CHUNK * T, h, s));
    if (!chunk) {
      // 캔버스를 따로 못 만드는 환경: 그냥 그린다
      for (let n = Math.max(n0, k * CHUNK); n <= Math.min(n1, (k + 1) * CHUNK - 1); n++) {
        for (let c = 0; c < layout.cols; c++) {
          const b = blockAt(layout, n, c);
          if (b) drawBlock(ctx, b.mat, b.solid, c * T, Math.round(worldToScreen((n + 1) * T, h, s)), c, n, blink(hash(c, n, 9)));
        }
      }
      continue;
    }
    ctx.drawImage(chunk.image, 0, top, layout.cols * T, CHUNK * T);
    // 용암만 깜빡임을 그 위에 다시
    for (const [c, n, solid] of chunk.lava) {
      const v = hash(c, n, 9);
      if (blink(v)) drawBlock(ctx, "nether", solid, c * T, Math.round(worldToScreen((n + 1) * T, h, s)), c, n, 1);
    }
  }
}

type BlockLayout = { nStone: number; nSurf: number; cols: number };
type BlockChunk = { image: CanvasImageSource; lava: [number, number, boolean][] };

/** 한 덩어리 = 블록 CHUNK줄 */
const CHUNK = 32;
/** 장면·화면 폭·배율별로 최근 덩어리 몇 개만 기억한다 */
const chunkCache = new WeakMap<ScenePalette, Map<string, BlockChunk>>();
const CHUNK_KEEP = 8;

function blockChunk(p: ScenePalette, layout: BlockLayout, k: number, scale: number): BlockChunk | null {
  let cache = chunkCache.get(p);
  if (!cache) chunkCache.set(p, (cache = new Map()));
  const key = `${layout.cols}|${scale}|${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const width = Math.ceil(layout.cols * T * scale);
  const height = Math.ceil(CHUNK * T * scale);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : typeof document !== "undefined"
        ? Object.assign(document.createElement("canvas"), { width, height })
        : null;
  const c2 = canvas?.getContext("2d") as CanvasRenderingContext2D | null | undefined;
  if (!canvas || !c2) return null;
  c2.scale(scale, scale);
  const lava: [number, number, boolean][] = [];
  for (let n = k * CHUNK; n < (k + 1) * CHUNK; n++) {
    const y = ((k + 1) * CHUNK - 1 - n) * T;
    for (let c = 0; c < layout.cols; c++) {
      const b = blockAt(layout, n, c);
      if (!b) continue;
      if (drawBlock(c2, b.mat, b.solid, c * T, y, c, n, 0)) lava.push([c, n, b.solid]);
    }
  }
  const chunk = { image: canvas, lava };
  cache.set(key, chunk);
  if (cache.size > CHUNK_KEEP) cache.delete(cache.keys().next().value!);
  return chunk;
}

/** 세계 블록 줄 n, 칸 c의 블록 (없으면 null = 하늘) */
function blockAt({ nStone, nSurf, cols }: BlockLayout, n: number, c: number): { mat: Material; solid: boolean } | null {
  const surf = nSurf + (hash(c, 4) % 2);
  if (n > surf) {
    // 지표면 위: 양옆 나무만
    for (const tc of [1, cols - 2]) {
      const ts = nSurf + (hash(tc, 4) % 2);
      if (c === tc && n <= ts + 3) return { mat: "trunk", solid: true };
      if (Math.abs(c - tc) <= 1 && n >= ts + 4 && n <= ts + 6 && !(n === ts + 6 && c !== tc)) return { mat: "leaves", solid: true };
    }
    return null;
  }
  const solid = c < 2 + (hash(n, 1) % 2) || c >= cols - 2 - (hash(n, 2) % 2);
  if (n === surf) return { mat: "grass", solid };
  if (n < nStone + (hash(c, 3) % 3) - 1) return { mat: "nether", solid };
  if (n >= surf - 3 - (hash(c, 5) % 2)) return { mat: "dirt", solid };
  return { mat: "stone", solid };
}

/** 블록 하나. 용암 블록이면 true (깜빡임을 따로 다시 그리려고). blink = 용암 깜빡임 단계 0/1 */
function drawBlock(ctx: CanvasRenderingContext2D, mat: Material, solid: boolean, x: number, y: number, c: number, n: number, blink: number): boolean {
  const v = hash(c, n, 9);
  // 가운데 뒷벽은 어둡게 (파낸 굴의 안쪽 벽)
  const shade = (color: string, k = BACKWALL) => (solid ? color : css(mixRgb(hex(color), INK, k)));
  const pick = hex(MAT[mat][v % 3]);
  const base = solid ? pick : mixRgb(pick, INK, BACKWALL);
  ctx.fillStyle = css(base);
  ctx.fillRect(x, y, T, T);
  const dark = css(mixRgb(base, INK, 0.25));
  const light = css(mixRgb(base, WHITE, 0.18));

  // 블록 무늬
  if (mat === "grass") {
    ctx.fillStyle = shade(GRASS_TOP);
    ctx.fillRect(x, y, T, 5);
    ctx.fillRect(x + ((v >>> 3) % 3) * 4 + 2, y + 5, 3, 3);
  } else if (mat === "stone" && v % 11 === 0) {
    ctx.fillStyle = shade(ORES[(v >>> 4) % ORES.length]);
    ctx.fillRect(x + 3, y + 4, 4, 4);
    ctx.fillRect(x + 9, y + 7, 4, 4);
    ctx.fillRect(x + 5, y + 10, 3, 3);
  } else if (mat === "nether" && v % 13 === 0) {
    // 용암: 천천히 깜빡이며 빛난다
    ctx.fillStyle = shade(LAVA[blink], 0.3);
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = shade(LAVA[1 - blink], 0.3);
    ctx.fillRect(x + 4, y + 5, 6, 3);
    return true;
  } else if (mat === "nether" && v % 19 === 0) {
    ctx.fillStyle = shade(GLOW, 0.3);
    ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    ctx.fillStyle = shade("#fff6c9", 0.3);
    ctx.fillRect(x + 5, y + 5, 3, 3);
  } else if (mat === "leaves") {
    ctx.fillStyle = light;
    ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + 3, 3, 3);
    ctx.fillStyle = dark;
    ctx.fillRect(x + ((v >>> 5) % 3) * 4 + 3, y + 10, 3, 3);
  } else {
    ctx.fillStyle = dark;
    ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + ((v >>> 6) % 3) * 4 + 2, 3, 3);
    ctx.fillStyle = light;
    ctx.fillRect(x + ((v >>> 8) % 3) * 4 + 3, y + ((v >>> 10) % 3) * 4 + 3, 2, 2);
  }
  // 블록 경계 (오른쪽·아래 1px)
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + T - 1, T, 1);
  ctx.fillRect(x + T - 1, y, 1, T);
  return false;
}
