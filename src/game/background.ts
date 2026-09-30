import type { ScenePalette } from "./themes";

/**
 * 배경 렌더러. 지금은 시작 지역 한 가지이고, 8단계에서 높이별 지역 섞기를 추가한다.
 * 색은 테마(themes.ts의 SCENE)에서 받는다.
 * 그라데이션 대신 계단식 색 띠를 써서 밴딩이 생기지 않고 도트 느낌이 나게 한다.
 */

type RGB = [number, number, number];

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const BAND_COUNT = 9;

/** 팔레트별 색 띠를 한 번만 계산해 둔다 */
const bandCache = new WeakMap<ScenePalette, string[]>();
function bandsFor(p: ScenePalette) {
  let bands = bandCache.get(p);
  if (!bands) {
    const top = hex(p.skyTop);
    const bottom = hex(p.skyBottom);
    bands = Array.from({ length: BAND_COUNT }, (_, i) => mix(top, bottom, i / (BAND_COUNT - 1)));
    bandCache.set(p, bands);
  }
  return bands;
}

/** 반짝이 위치(0~1 비율)와 박자. 매번 같은 배치가 나오게 고정값을 쓴다 */
const SPARKLES = [
  [0.12, 0.1, 0],
  [0.8, 0.07, 1.3],
  [0.55, 0.2, 0.6],
  [0.25, 0.33, 2.1],
  [0.9, 0.3, 0.2],
  [0.4, 0.47, 1.7],
  [0.72, 0.52, 0.9],
  [0.08, 0.6, 1.1],
  // 꿈나라처럼 별이 많은 테마에서만 쓰는 추가분
  [0.32, 0.06, 0.4],
  [0.63, 0.12, 2.4],
  [0.18, 0.22, 1.9],
  [0.86, 0.18, 0.7],
  [0.5, 0.36, 1.2],
  [0.95, 0.45, 2.7],
  [0.28, 0.5, 0.3],
  [0.6, 0.62, 1.5],
] as const;

const CLOUDS = [
  // x 비율, y 비율, 크기(칸 배수), 흐르는 속도(px/초)
  [0.1, 0.16, 4, 5],
  [0.62, 0.3, 3, 7],
  [0.3, 0.55, 3, 4],
] as const;

const CLOUD_SHAPE = ["..####..", ".######.", "########", "########"];
const MOON_SHAPE = ["..####..", ".####...", "####....", "####....", "####....", ".####...", "..####.."];

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  p: ScenePalette,
  w: number,
  h: number,
  time: number,
  reducedMotion: boolean,
) {
  const bands = bandsFor(p);
  const band = h / BAND_COUNT;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(i * band), w, Math.ceil(band) + 1);
  });

  if (p.moon) drawShape(ctx, MOON_SHAPE, Math.round(w * 0.74), Math.round(h * 0.09), 5, p.moon);

  // 구름: 화면 폭을 넘어가면 반대편에서 다시 나온다
  for (const [fx, fy, cell, speed] of CLOUDS) {
    const cloudW = CLOUD_SHAPE[0].length * cell;
    const span = w + cloudW;
    const x = ((((fx * span + (reducedMotion ? 0 : time * speed)) % span) + span) % span) - cloudW;
    drawShape(ctx, CLOUD_SHAPE, Math.round(x), Math.round(fy * h), cell, p.cloud);
  }

  // 반짝이: 십자 모양, 박자에 맞춰 가운데가 켜졌다 꺼진다
  const count = Math.min(SPARKLES.length, Math.round(8 * p.sparkleDensity));
  for (let i = 0; i < count; i++) {
    const [fx, fy, phase] = SPARKLES[i];
    const on = reducedMotion || Math.sin(time * 2.2 + phase * 3) > -0.2;
    const x = Math.round(fx * w);
    const y = Math.round(fy * h);
    ctx.fillStyle = p.sparkle;
    ctx.fillRect(x, y - 3, 3, 9);
    ctx.fillRect(x - 3, y, 9, 3);
    if (on) {
      ctx.fillStyle = p.sparkleCore;
      ctx.fillRect(x, y, 3, 3);
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, cell: number, color: string) {
  ctx.fillStyle = color;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === "#") ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
    }
  });
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
