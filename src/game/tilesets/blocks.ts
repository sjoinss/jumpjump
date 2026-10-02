import { drawShape, drawStars, wrapY } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 블록 월드: 네더(네더랙·용암·발광석) → 돌(광석) → 흙 → 잔디 지표면, 그 위 양옆 나무 → (하늘·우주) → 엔더 월드.
 * 엔더 월드: 양옆 엔드 돌 섬 + 흑요석 기둥(꼭대기 엔드 수정이 깜빡임), 그 위로 작은 섬이 끝없이 떠 있다.
 * 지역 시작 줄: rows[1] = 돌이 시작, rows[2] = 지표면, rows[5] = 엔더 월드.
 */

const TONES: Record<string, readonly string[]> = {
  nether: ["#b5464f", "#a63d47", "#c4545c"],
  stone: ["#9a9ba6", "#8d8e99", "#a7a8b2"],
  dirt: ["#9b6a43", "#8e5f3b", "#a8754c"],
  grass: ["#9b6a43", "#8e5f3b", "#a8754c"],
  trunk: ["#7a5232", "#6d4a2c", "#86593a"],
  leaves: ["#4fa83a", "#479a34", "#5cb846"],
  endstone: ["#e6e2a4", "#dbd796", "#efecb6"],
  obsidian: ["#2d2142", "#261b39", "#35284c"],
};
const GRASS_TOP = "#74c84f";
const ORES = ["#3d3d46", "#e3b07a", "#6fe0e6", "#ffd84a"];
const LAVA = ["#ff8a3d", "#ffb347"];
const GLOW = "#ffe08a";

const surfRow = (L: TileLayout, c: number) => L.rows[2] + (hash(c, 4) % 2);

/** 엔더 월드 첫 섬 위로 이만큼 지나면 작은 섬이 반복된다 */
const END_BASE = 4;
const ISLAND_FROM = 22;
const ISLAND_EVERY = 18;
/** 흑요석 기둥 높이 (왼쪽, 오른쪽) */
const PILLARS = [7, 10] as const;

/** 엔더 월드의 타일 (n = 엔더 월드 시작 줄부터 센 줄) */
function endTile(L: TileLayout, n: number, c: number): Tile | null {
  if (n < END_BASE) return wallSolid(L, n, c, 3) ? { m: "endstone", solid: true } : null;
  // 기둥: 왼쪽 2번째 칸, 오른쪽 끝에서 2번째 칸
  const side = c < L.cols / 2 ? 0 : 1;
  const pc = side === 0 ? 1 : L.cols - 2;
  if (c === pc && n < END_BASE + PILLARS[side]) return { m: "obsidian", solid: true };
  if (c === pc && n === END_BASE + PILLARS[side]) return { m: "crystal", solid: true };
  if (n < ISLAND_FROM) return null;
  // 떠 있는 작은 섬: 몇 줄마다 왼쪽·오른쪽 번갈아 3줄짜리 (아래로 갈수록 좁다), 가끔 위에 코러스 나무
  const k = Math.floor((n - ISLAND_FROM) / ISLAND_EVERY);
  const row = (n - ISLAND_FROM) % ISLAND_EVERY;
  const width = 4 + (hash(k, 22) % 3);
  const gap = hash(k, 23) % 2; // 벽에서 떨어진 칸
  const left = (k + (hash(0, 21) % 2)) % 2 === 0 ? gap : L.cols - gap - width;
  const mid = left + Math.floor(width / 2);
  if (row === 3 && c === mid && hash(k, 24) % 2 === 0) return { m: "chorus", solid: true };
  if (row > 2) return null;
  const shrink = 2 - row; // 아래 줄일수록 양쪽이 한 칸씩 빠진다
  return c >= left + shrink && c < left + width - shrink ? { m: "endstone", solid: true } : null;
}

export const BLOCK_TILES: TileSet = {
  // 엔더 월드는 섬이 끝없이 이어진다
  top: () => Infinity,

  at(L, n, c): Tile | null {
    if (L.rows[5] !== undefined && n >= L.rows[5]) return endTile(L, n - L.rows[5], c);
    const surf = surfRow(L, c);
    if (n > surf) {
      // 지표면 위: 양옆 나무만
      for (const tc of [1, L.cols - 2]) {
        const ts = surfRow(L, tc);
        if (c === tc && n <= ts + 3) return { m: "trunk", solid: true };
        if (Math.abs(c - tc) <= 1 && n >= ts + 4 && n <= ts + 6 && !(n === ts + 6 && c !== tc)) return { m: "leaves", solid: true };
      }
      return null;
    }
    const solid = wallSolid(L, n, c);
    if (n === surf) return { m: "grass", solid };
    if (n < L.rows[1] + (hash(c, 3) % 3) - 1) return { m: "nether", solid };
    if (n >= surf - 3 - (hash(c, 5) % 2)) return { m: "dirt", solid };
    return { m: "stone", solid };
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    if (t.m === "crystal") {
      // 엔드 수정: 분홍·보라로 번갈아 빛난다
      ctx.fillStyle = "#3a2c55";
      ctx.fillRect(x + 1, y + 11, T - 2, 5);
      ctx.fillStyle = phase ? "#ffb3f5" : "#d77de8";
      ctx.fillRect(x + 4, y + 2, 8, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 6, y + 4, 3, 3);
      return true;
    }
    if (t.m === "chorus") {
      // 코러스 나무: 보라 줄기 + 꽃
      ctx.fillStyle = "#8f5fb8";
      ctx.fillRect(x + 7, y + 6, 3, 10);
      ctx.fillRect(x + 3, y + 9, 5, 2);
      ctx.fillRect(x + 3, y + 5, 2, 5);
      ctx.fillStyle = "#e6c9f5";
      ctx.fillRect(x + 6, y + 1, 5, 5);
      ctx.fillRect(x + 2, y + 2, 4, 4);
      return false;
    }
    if (t.m === "nether" && v % 13 === 0) {
      // 용암: 천천히 깜빡이며 빛난다
      ctx.fillStyle = shade(LAVA[phase], solid, 0.3);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = shade(LAVA[1 - phase], solid, 0.3);
      ctx.fillRect(x + 4, y + 5, 6, 3);
      return true;
    }
    const plain = t.m === "dirt" || t.m === "trunk" || t.m === "obsidian" || (t.m === "nether" && v % 19 !== 0) || (t.m === "stone" && v % 11 !== 0);
    const { dark, light } = baseTile(ctx, TONES[t.m], solid, x, y, v, plain);
    if (t.m === "grass") {
      ctx.fillStyle = shade(GRASS_TOP, solid);
      ctx.fillRect(x, y, T, 5);
      ctx.fillRect(x + ((v >>> 3) % 3) * 4 + 2, y + 5, 3, 3);
    } else if (t.m === "stone" && v % 11 === 0) {
      ctx.fillStyle = shade(ORES[(v >>> 4) % ORES.length], solid);
      ctx.fillRect(x + 3, y + 4, 4, 4);
      ctx.fillRect(x + 9, y + 7, 4, 4);
      ctx.fillRect(x + 5, y + 10, 3, 3);
    } else if (t.m === "nether" && v % 19 === 0) {
      ctx.fillStyle = shade(GLOW, solid, 0.3);
      ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
      ctx.fillStyle = shade("#fff6c9", solid, 0.3);
      ctx.fillRect(x + 5, y + 5, 3, 3);
    } else if (t.m === "obsidian" && v % 3 === 0) {
      // 흑요석의 보랏빛 결
      ctx.fillStyle = "#6b4fa0";
      ctx.fillRect(x + 4, y + 6, 3, 2);
    } else if (t.m === "leaves") {
      ctx.fillStyle = light;
      ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + 3, 3, 3);
      ctx.fillStyle = dark;
      ctx.fillRect(x + ((v >>> 5) % 3) * 4 + 3, y + 10, 3, 3);
    }
    tileEdge(ctx, dark, x, y);
    return false;
  },
};

/** 엔더 드래곤 (오른쪽을 본다): 몸·날개는 검정, 눈은 보라 */
const DRAGON = [
  "......##........",
  "....######......",
  "..##########....",
  "################",
  "..###########.##",
  "....##...##.....",
];
const DRAGON_FLAP = [
  "................",
  "................",
  "..##########....",
  "################",
  "..###########.##",
  "...####.####....",
];

/** 엔더 월드: 희미한 별 + 위로 떠오르는 보라 가루 + 천천히 지나가는 엔더 드래곤 */
const endSky: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, { ...p, sparkle: "#cbb8ff", sparkleCore: "#ff9ff0", sparkleDensity: 0.5 }, w, h, s);
  ctx.fillStyle = "rgba(204,120,255,0.75)";
  for (let k = 0; k < 14; k++) {
    const rise = s.reducedMotion ? 0 : s.time * (10 + (k % 5) * 4);
    const x = Math.round(((k * 0.618 + 0.11) % 1) * w);
    ctx.fillRect(x, wrapY(((k * 0.41) % 1) * h - rise, s.cameraY * 0.3, h), k % 3 ? 3 : 4, k % 3 ? 3 : 4);
  }
  const cell = 4;
  const dw = DRAGON[0].length * cell;
  const span = w + dw * 2;
  const x = Math.round((((s.reducedMotion ? 0.6 * span : s.time * 20) % span) + span) % span) - dw;
  const y = wrapY(h * 0.22, s.cameraY * 0.12, h, 80);
  const up = s.reducedMotion || Math.floor(s.time * 3) % 2 === 0;
  drawShape(ctx, up ? DRAGON : DRAGON_FLAP, x, y, cell, "#1a1226");
  ctx.fillStyle = "#e07bff";
  ctx.fillRect(x + dw - cell * 2, y + cell * 3, cell, cell);
};

export const BLOCK_DECOR: Record<string, DecorFn> = { end: endSky };
