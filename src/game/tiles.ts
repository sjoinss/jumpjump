import { CONFIG } from "./config";
import { css, hex, INK, mixRgb, WHITE } from "./color";
import type { BackgroundState } from "./background";
import type { ScenePalette } from "./themes";

/**
 * 세상의 단면 배경 (블록 월드·과자 나라·도시·동화 숲·겨울 왕국이 같이 쓴다).
 * 세계 높이를 T px 줄로 나누고, 줄마다 어떤 타일이 오는지는 테마의 TileSet이 정한다 (예: 0~150m 네더랙, 150m~ 돌…).
 * 타일은 세계에 붙어 있어(패럴랙스 없음) 경계가 실제로 지나간다. 양옆은 밝은 벽(solid), 가운데는 어두운 뒷벽이라
 * 발판과 헷갈리지 않는다. 타일은 CHUNK줄씩 이미지로 미리 그려 두고, 깜빡이는 타일(용암·불빛)만 매 프레임 다시 그린다.
 */

export const T = 16;
/** 가운데 뒷벽을 어둡게 하는 정도 (발판보다 뒤에 있어 보이게) */
export const BACKWALL = 0.36;

/** 테마의 지역 시작 줄들 + 화면 칸 수 */
export type TileLayout = { cols: number; rows: number[] };
/** m = 재질 이름(TileSet이 정함), solid = 밝은 앞 벽(아니면 어두운 뒷벽) */
export type Tile = { m: string; solid: boolean };

export type TileSet = {
  /** 이 줄보다 위에는 타일이 하나도 없다 (그 위는 하늘만 — 일찍 끝내려고) */
  top(L: TileLayout): number;
  /** 줄 n(세계 높이 n·T부터), 칸 c의 타일. null = 비어 있음(하늘이 보임) */
  at(L: TileLayout, n: number, c: number): Tile | null;
  /** 타일 하나 그리기. phase = 깜빡이는 타일의 단계(0/1, 미리 그릴 땐 0). 깜빡이는 타일이면 true */
  draw(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, c: number, n: number, phase: number): boolean;
};

/** 타일 좌표마다 고정된 무작위 값 (매 프레임 같게) */
export function hash(a: number, b: number, c = 0) {
  let x = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1442695041);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

/** 양옆 벽 두께(칸): 줄마다 2~3칸으로 울퉁불퉁 */
export function wallSolid(L: TileLayout, n: number, c: number, min = 2) {
  return c < min + (hash(n, 1) % 2) || c >= L.cols - min - (hash(n, 2) % 2);
}

/** 뒷벽이면 어둡게 한 색 */
export function shade(color: string, solid: boolean, k = BACKWALL) {
  return solid ? color : css(mixRgb(hex(color), INK, k));
}

/**
 * 기본 타일: 세 명암 중 하나로 칠하고 얼룩 두 점 + 오른쪽·아래 1px 경계.
 * @returns 경계·얼룩에 쓴 어두운/밝은 색 (무늬를 더 그릴 때)
 */
export function baseTile(ctx: CanvasRenderingContext2D, tones: readonly string[], solid: boolean, x: number, y: number, v: number, specks = true, back = BACKWALL) {
  const pick = hex(tones[v % tones.length]);
  const base = solid ? pick : mixRgb(pick, INK, back);
  ctx.fillStyle = css(base);
  ctx.fillRect(x, y, T, T);
  const dark = css(mixRgb(base, INK, 0.25));
  const light = css(mixRgb(base, WHITE, 0.18));
  if (specks) {
    ctx.fillStyle = dark;
    ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + ((v >>> 6) % 3) * 4 + 2, 3, 3);
    ctx.fillStyle = light;
    ctx.fillRect(x + ((v >>> 8) % 3) * 4 + 3, y + ((v >>> 10) % 3) * 4 + 3, 2, 2);
  }
  return { dark, light };
}

/** 타일 경계선 (오른쪽·아래 1px) */
export function tileEdge(ctx: CanvasRenderingContext2D, color: string, x: number, y: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + T - 1, T, 1);
  ctx.fillRect(x + T - 1, y, 1, T);
}

// ── 그리기 엔진 ──

const worldToScreen = (y: number, h: number, s: BackgroundState) => h - (y - s.cameraY);

export function drawTiles(ctx: CanvasRenderingContext2D, p: ScenePalette, set: TileSet, w: number, h: number, s: BackgroundState) {
  const ppm = CONFIG.score.pxPerMeter;
  const layout: TileLayout = { cols: Math.ceil(w / T), rows: p.regions.map((r) => Math.floor((r.startM * ppm) / T)) };
  const n0 = Math.max(-4, Math.floor(s.cameraY / T) - 1);
  const n1 = Math.floor((s.cameraY + h) / T) + 1;
  if (n0 > set.top(layout)) return;

  const scale = ctx.getTransform().a || 1;
  const phase = (v: number) => (s.reducedMotion ? 0 : Math.floor(s.time * 2 + (v % 7)) % 2);
  for (let k = Math.floor(n0 / CHUNK); k <= Math.floor(n1 / CHUNK); k++) {
    const chunk = tileChunk(p, set, layout, k, scale);
    if (!chunk) {
      // 캔버스를 따로 못 만드는 환경: 그냥 그린다
      for (let n = Math.max(n0, k * CHUNK); n <= Math.min(n1, (k + 1) * CHUNK - 1); n++) {
        for (let c = 0; c < layout.cols; c++) {
          const t = set.at(layout, n, c);
          if (t) set.draw(ctx, t, c * T, Math.round(worldToScreen((n + 1) * T, h, s)), c, n, phase(hash(c, n, 9)));
        }
      }
      continue;
    }
    ctx.drawImage(chunk.image, 0, Math.round(worldToScreen((k + 1) * CHUNK * T, h, s)), layout.cols * T, CHUNK * T);
    // 깜빡이는 타일만 그 위에 다시
    for (const [c, n] of chunk.animated) {
      if (!phase(hash(c, n, 9))) continue;
      const t = set.at(layout, n, c);
      if (t) set.draw(ctx, t, c * T, Math.round(worldToScreen((n + 1) * T, h, s)), c, n, 1);
    }
  }
}

type Chunk = { image: CanvasImageSource; animated: [number, number][] };

/** 한 덩어리 = 타일 CHUNK줄 */
const CHUNK = 32;
/** 장면·화면 폭·배율별로 최근 덩어리 몇 개만 기억한다 */
const chunkCache = new WeakMap<ScenePalette, Map<string, Chunk>>();
const CHUNK_KEEP = 8;

function tileChunk(p: ScenePalette, set: TileSet, layout: TileLayout, k: number, scale: number): Chunk | null {
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
  const animated: [number, number][] = [];
  for (let n = k * CHUNK; n < (k + 1) * CHUNK; n++) {
    const y = ((k + 1) * CHUNK - 1 - n) * T;
    for (let c = 0; c < layout.cols; c++) {
      const t = set.at(layout, n, c);
      if (t && set.draw(c2, t, c * T, y, c, n, 0)) animated.push([c, n]);
    }
  }
  const chunk = { image: canvas, animated };
  cache.set(key, chunk);
  if (cache.size > CHUNK_KEEP) cache.delete(cache.keys().next().value!);
  return chunk;
}
