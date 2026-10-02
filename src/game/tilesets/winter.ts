import { drawClouds, drawShape, drawSparkles, drawStars, MOON_SHAPE, wrapY } from "../background";
import type { BackgroundState } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 겨울 왕국: 얼음 동굴(얼음 벽·빛나는 얼음 결정) → 눈 마을(눈 덮인 집·굴뚝, 양옆 눈 쌓인 전나무)
 * → 설산(마을 뒤부터 양옆 바위산이 이어지다 올라갈수록 좁아지고, 왼쪽 꼭대기에 깃발) → 오로라.
 * 바위 턱마다 눈 쌓인 전나무가 서 있다.
 * 지역 시작 줄: rows[1] = 눈 덮인 땅, rows[3] = 꼭대기(오로라). 설산 지역(rows[2])은 하늘 색·이름만 바뀐다.
 */

const TONES: Record<string, readonly string[]> = {
  ice: ["#bfe6f7", "#b3dff2", "#cbecfa"],
  snow: ["#f4f8ff", "#eef4fc", "#fafcff"],
  rock: ["#8e98ad", "#848ea3", "#98a2b6"],
  wall: ["#e6c39a", "#dcb88e", "#eecda6"],
};
const CRYSTAL = ["#9fe8ff", "#e6fbff"];
const LIT = "#ffd36b";
/** 바위산 폭(칸): 마을 뒤에서 시작할 때 (발판 자리를 가리지 않게 얇게) */
const PEAK_WIDTH = 4;
/** 바위산이 시작하는 줄 (땅에서 굴뚝 위) */
const ROCK_FROM = 6;
/** 마을 집: 벽 3줄 + 지붕 1줄 + 굴뚝 */
const HOUSE_W = 3;
/** 전나무가 서는 간격(줄) */
const PINE_EVERY = 28;

/** 바위산 폭: 올라갈수록 줄고(꼭대기에서 1~2칸) 6줄마다 조금 들쭉날쭉. 꼭대기 위로는 0 */
function rockWidth(L: TileLayout, n: number, side: 0 | 1) {
  const from = L.rows[1] + ROCK_FROM;
  const span = L.rows[3] - from;
  const k = n - from;
  if (k < 0 || k >= span) return 0;
  const base = 1 + (PEAK_WIDTH - 1) * (1 - k / span);
  return Math.max(1, Math.round(base + (hash(Math.floor(n / 6), side, 41) % 3) - 1));
}

/** 전나무 한 그루: 바닥 줄 기준 (local 0 = 줄기, 1~5 = 잎, 6 = 꼭대기 별) */
function pine(local: number, dx: number): Tile | null {
  if (local === 0) return dx === 0 ? { m: "trunk", solid: true } : null;
  if (local >= 1 && local <= 5) {
    const half = local <= 2 ? 2 : local <= 4 ? 1 : 0;
    return Math.abs(dx) <= half ? { m: local % 2 ? "pine" : "pineSnow", solid: true } : null;
  }
  return null;
}

export const WINTER_TILES: TileSet = {
  top: (L) => L.rows[3] + 3,

  at(L, n, c): Tile | null {
    const ground = L.rows[1];
    if (n < ground) {
      const solid = wallSolid(L, n, c);
      if (!solid && hash(c, n, 3) % 31 === 0) return { m: "crystal", solid };
      return { m: "ice", solid };
    }
    if (n === ground) return { m: "snowGround", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const edge = side === 0 ? c : L.cols - 1 - c;
    const k = n - ground;

    // 마을: 땅 바로 위 양옆 집
    if (k <= 3 && edge < HOUSE_W) return { m: k === 3 ? "roof" : "house", solid: true };
    if (k === 4 && edge === 1) return { m: "chimney", solid: true };
    // 꼭대기 깃발 (왼쪽 바위 끝 위)
    if (c === 0 && n >= L.rows[3] && n <= L.rows[3] + 2) return { m: n === L.rows[3] + 2 ? "flag" : "pole", solid: true };
    // 바위산 (윗면이 드러난 칸은 눈)
    const rw = rockWidth(L, n, side);
    if (edge < rw) return { m: rockWidth(L, n + 1, side) <= edge ? "rockSnow" : "rock", solid: true };
    // 바위 옆으로 튀어나온 눈 턱 + 그 위 전나무 (좌우 번갈아)
    const j = (k - ROCK_FROM - 10) % PINE_EVERY;
    const b = n - j; // 턱이 있는 줄
    const turn = Math.floor((k - ROCK_FROM - 10) / PINE_EVERY);
    if (k >= ROCK_FROM + 10 && b < L.rows[3] - 20 && turn % 2 === side) {
      const bw = rockWidth(L, b, side);
      if (j === 0 && edge >= bw && edge < bw + 4) return { m: "snowLedge", solid: true };
      const t = pine(j - 1, edge - bw - 2);
      if (t) return t;
    }
    return null;
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "crystal": {
        baseTile(ctx, TONES.ice, false, x, y, v, false, 0.25);
        ctx.fillStyle = CRYSTAL[phase];
        ctx.fillRect(x + 6, y + 2, 4, 12);
        ctx.fillRect(x + 3, y + 6, 10, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 7, y + 4, 2, 2);
        return true;
      }
      case "snowGround": {
        baseTile(ctx, TONES.ice, true, x, y, v, false);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, T, 7);
        ctx.fillRect(x + ((v >>> 3) % 3) * 4 + 2, y + 7, 4, 3);
        return false;
      }
      case "house": {
        const { dark } = baseTile(ctx, TONES.wall, true, x, y, v, false);
        if (v % 2) {
          ctx.fillStyle = dark;
          ctx.fillRect(x + 3, y + 3, 10, 9);
          ctx.fillStyle = LIT;
          ctx.fillRect(x + 4, y + 4, 8, 7);
          ctx.fillStyle = dark;
          ctx.fillRect(x + 7, y + 4, 2, 7);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "roof":
        ctx.fillStyle = "#c25b5b";
        ctx.fillRect(x, y + 6, T, T - 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y + 2, T, 6);
        ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 1, y + 8, 4, 2);
        return false;
      case "chimney":
        ctx.fillStyle = "#9b6a5a";
        ctx.fillRect(x + 4, y + 6, 8, 10);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 3, y + 4, 10, 3);
        return false;
      case "trunk":
        ctx.fillStyle = "#7a5232";
        ctx.fillRect(x + 6, y, 4, T);
        return false;
      case "pine":
      case "pineSnow":
        ctx.fillStyle = "#3f8f6b";
        ctx.fillRect(x, y + 2, T, T - 2);
        ctx.fillStyle = "#357a5b";
        ctx.fillRect(x, y + T - 3, T, 3);
        if (t.m === "pineSnow") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x + 1, y + 1, T - 2, 4);
        }
        return false;
      case "snowLedge":
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y + 4, T, T - 4);
        ctx.fillStyle = "#d8e6f5";
        ctx.fillRect(x, y + T - 3, T, 3);
        return false;
      case "pole":
        ctx.fillStyle = "#6b6f7a";
        ctx.fillRect(x + 7, y, 2, T);
        return false;
      case "flag":
        ctx.fillStyle = "#6b6f7a";
        ctx.fillRect(x + 7, y + 2, 2, T - 2);
        ctx.fillStyle = "#ff6f91";
        ctx.fillRect(x + 9, y + 2, 7, 6);
        return false;
    }
    const { dark, light } = baseTile(ctx, TONES[t.m === "rockSnow" ? "rock" : t.m], solid, x, y, v, t.m === "rock");
    if (t.m === "ice") {
      // 얼음 빛 반사: 비스듬한 흰 줄
      ctx.fillStyle = shade("#ffffff", solid, 0.25);
      if (v % 3 === 0) {
        ctx.fillRect(x + 3, y + 9, 2, 2);
        ctx.fillRect(x + 5, y + 7, 2, 2);
        ctx.fillRect(x + 7, y + 5, 2, 2);
      }
    } else if (t.m === "rockSnow") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, T, 6);
      ctx.fillRect(x + ((v >>> 3) % 3) * 4 + 2, y + 6, 3, 2);
    } else if (t.m === "rock" && v % 7 === 0) {
      ctx.fillStyle = light;
      ctx.fillRect(x + 4, y + 4, 4, 2);
    }
    tileEdge(ctx, dark, x, y);
    return false;
  },
};

/** 내리는 눈: 크기·속도가 다른 흰 점이 살랑이며 떨어진다 */
function snow(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, count: number) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let k = 0; k < count; k++) {
    const fall = s.reducedMotion ? 0 : s.time * (18 + (k % 4) * 9);
    const x = Math.round(((k * 0.618 + 0.03) % 1) * w + (s.reducedMotion ? 0 : Math.sin(s.time * 1.1 + k) * 8));
    const size = k % 3 === 0 ? 4 : 3;
    ctx.fillRect(x, wrapY(((k * 0.37) % 1) * h + fall, s.cameraY * (0.2 + (k % 3) * 0.1), h), size, size);
  }
}

const AURORA = ["rgba(140,255,200,0.35)", "rgba(120,220,255,0.3)", "rgba(255,160,230,0.28)"];

/** 오로라: 물결치는 세 줄 빛 띠 + 별 + 달 */
const aurora: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, p, w, h, s);
  const cell = 6;
  AURORA.forEach((color, band) => {
    ctx.fillStyle = color;
    const base = wrapY(h * (0.18 + band * 0.1), s.cameraY * 0.06, h, 160);
    for (let x = 0; x < w; x += cell) {
      const wave = Math.sin(x * 0.02 + band * 1.3 + (s.reducedMotion ? 0 : s.time * 0.5)) * 18;
      const len = 30 + Math.round((Math.sin(x * 0.05 + band) + 1) * 16);
      ctx.fillRect(x, Math.round(base + wave), cell, len);
    }
  });
  drawShape(ctx, MOON_SHAPE, Math.round(w * 0.78), wrapY(h * 0.08, s.cameraY * 0.05, h), 5, p.moon);
};

export const WINTER_DECOR: Record<string, DecorFn> = {
  icecave: (ctx, p, w, h, s) => drawSparkles(ctx, p, w, h, s, 10, 0.3),
  village: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 3, 0.15);
    snow(ctx, w, h, s, 24);
  },
  mountain: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 5, 0.3);
    snow(ctx, w, h, s, 34);
  },
  aurora,
};
