import { drawClouds, drawShape, drawSparkles, drawStars, MOON_SHAPE, wrapY } from "../background";
import type { BackgroundState } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 벚꽃 마을: 정원 연못(돌담 사이 물, 연잎·비단잉어) → 벚꽃길(돌 턱 위 벚나무가 좌우 번갈아) → 기와지붕(양옆 기와집이 층층이)
 * → 연등 밤하늘(떠오르는 연등).
 * 지역 시작 줄: rows[1] = 연못 둑(땅), rows[2] = 기와집 시작, rows[3] = 지붕 꼭대기.
 */

const TONES: Record<string, readonly string[]> = {
  stone: ["#a9a6a0", "#9d9a94", "#b4b1ab"],
  water: ["#4f9aa0", "#4a939a", "#55a2a8"],
  path: ["#d8c9a8", "#cfc09e", "#e0d2b2"],
  wall: ["#fbf6ec", "#f6f0e4", "#fffaf2"],
  roof: ["#4f5a78", "#48526f", "#56627f"],
  trunk: ["#6b4a3a", "#614234", "#755242"],
  blossom: ["#ffb7cf", "#ffc6d9", "#ffa8c4"],
};
const KOI = ["#ff8a3d", "#ffffff"];

/** 벚나무 한 그루가 차지하는 줄 수 (좌우 번갈아) */
const TREE_EVERY = 20;
/** 기와집 한 층 높이(줄) — 맨 위 줄이 처마 */
const STOREY = 9;

/** 벚꽃길: 돌 턱 + 줄기 + 꽃구름 (local = 턱 줄부터 센 줄, dx = 벽에서 몇 번째 칸) */
function tree(local: number, dx: number): Tile | null {
  if (local === 0) return dx <= 3 ? { m: "ledge", solid: true } : null;
  if (local >= 1 && local <= 8 && dx === 1) return { m: "trunk", solid: true };
  // 꽃구름: 7~12줄, 가운데가 넓다
  const half = [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 4, 2][local] ?? 0;
  if (half > 0 && dx <= half) return { m: "blossom", solid: true };
  return null;
}

export const SAKURA_TILES: TileSet = {
  top: (L) => L.rows[3] + 3,

  at(L, n, c): Tile | null {
    const ground = L.rows[1];
    if (n < ground) {
      const solid = wallSolid(L, n, c);
      if (solid) return { m: "stone", solid };
      const v = hash(c, n, 3);
      if (v % 37 === 0) return { m: "koi", solid };
      if (v % 23 === 0) return { m: "lily", solid };
      return { m: "water", solid };
    }
    if (n === ground) return { m: "path", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const dx = side === 0 ? c : L.cols - 1 - c;

    // 기와집: 벽 3칸 + 층마다 처마가 한 칸 더 나온다. 꼭대기엔 용마루 장식
    if (n >= L.rows[2] && n < L.rows[3]) {
      const k = (n - L.rows[2]) % STOREY;
      if (k === STOREY - 1) return dx <= 4 ? { m: dx === 4 ? "eave" : "roof", solid: true } : null;
      if (dx <= 2) return { m: k === 3 && dx === 1 ? "window" : "wall", solid: true };
      return null;
    }
    if (n === L.rows[3] && dx <= 2) return { m: "roof", solid: true };
    if (n === L.rows[3] + 1 && dx === 1) return { m: "finial", solid: true };

    // 벚꽃길: 땅 위 ~ 기와집 아래, 좌우 번갈아 벚나무
    if (n < L.rows[2] - 2) {
      const k = n - ground - 4;
      if (k >= 0) {
        const turn = Math.floor(k / TREE_EVERY);
        if (turn % 2 === side) return tree(k % TREE_EVERY, dx);
      }
    }
    return null;
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "koi": {
        baseTile(ctx, TONES.water, false, x, y, v, false, 0.2);
        // 비단잉어: 천천히 좌우로 헤엄 (두 단계)
        const ox = phase ? 4 : 1;
        ctx.fillStyle = KOI[0];
        ctx.fillRect(x + ox, y + 6, 8, 4);
        ctx.fillStyle = KOI[1];
        ctx.fillRect(x + ox + 2, y + 6, 3, 2);
        ctx.fillStyle = KOI[0];
        ctx.fillRect(x + ox + 8, y + 5, 2, 6);
        return true;
      }
      case "lily":
        baseTile(ctx, TONES.water, false, x, y, v, false, 0.2);
        ctx.fillStyle = shade("#6fbf73", false, 0.15);
        ctx.fillRect(x + 2, y + 5, 12, 6);
        ctx.fillStyle = shade("#ffd0e0", false, 0.1);
        ctx.fillRect(x + 6, y + 6, 3, 3);
        return false;
      case "water": {
        baseTile(ctx, TONES.water, false, x, y, v, false, 0.2);
        if (v % 3 === 0) {
          ctx.fillStyle = shade("#bfe8e8", false, 0.2);
          ctx.fillRect(x + 3, y + 7, 6, 1);
        }
        return false;
      }
      case "path": {
        const { dark } = baseTile(ctx, TONES.path, true, x, y, v, true);
        ctx.fillStyle = "#8fcf8a";
        ctx.fillRect(x, y, T, 4);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "ledge":
        ctx.fillStyle = "#b4b1ab";
        ctx.fillRect(x, y + 4, T, T - 4);
        ctx.fillStyle = "#8f8c86";
        ctx.fillRect(x, y + T - 3, T, 3);
        ctx.fillStyle = "#8fcf8a";
        ctx.fillRect(x, y + 3, T, 2);
        return false;
      case "trunk":
        ctx.fillStyle = TONES.trunk[v % 3];
        ctx.fillRect(x + 5, y, 6, T);
        ctx.fillStyle = "#4f3428";
        ctx.fillRect(x + 6, y + (v % 8), 2, 4);
        return false;
      case "blossom": {
        const { light } = baseTile(ctx, TONES.blossom, true, x, y, v, false);
        ctx.fillStyle = light;
        ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + 3, 3, 3);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + ((v >>> 5) % 3) * 4 + 3, y + 9, 2, 2);
        return false;
      }
      case "wall":
      case "window": {
        const { dark } = baseTile(ctx, TONES.wall, true, x, y, v, false);
        // 나무 기둥·인방
        ctx.fillStyle = "#8a5a3c";
        ctx.fillRect(x, y, 2, T);
        ctx.fillRect(x, y + T - 3, T, 3);
        if (t.m === "window") {
          ctx.fillStyle = "#ffe8b0";
          ctx.fillRect(x + 4, y + 3, 9, 8);
          ctx.fillStyle = "#8a5a3c";
          ctx.fillRect(x + 8, y + 3, 1, 8);
          ctx.fillRect(x + 4, y + 7, 9, 1);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "roof":
      case "eave": {
        // 기와: 가로 줄무늬, 처마 끝은 위로 살짝 들린다
        ctx.fillStyle = TONES.roof[v % 3];
        ctx.fillRect(x, y + 4, T, T - 4);
        ctx.fillStyle = "#3a4360";
        for (let k = 0; k < 3; k++) ctx.fillRect(x, y + 6 + k * 3, T, 1);
        if (t.m === "eave") {
          ctx.fillStyle = TONES.roof[0];
          ctx.fillRect(x + 10, y, 6, 5);
        }
        return false;
      }
      case "finial":
        ctx.fillStyle = "#ffd36b";
        ctx.fillRect(x + 6, y + 6, 4, 10);
        ctx.fillRect(x + 4, y + 4, 8, 3);
        return false;
      case "stone": {
        const { dark } = baseTile(ctx, TONES.stone, solid, x, y, v, true);
        if (v % 5 === 0) {
          ctx.fillStyle = "#7fa86a";
          ctx.fillRect(x + 2, y, 8, 3);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
    }
    return false;
  },
};

const PETAL = ["#.", "##"];

/** 흩날리는 벚꽃잎 */
function petals(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, count: number) {
  for (let k = 0; k < count; k++) {
    const fall = s.reducedMotion ? 0 : s.time * (14 + (k % 4) * 6);
    const sway = s.reducedMotion ? 0 : Math.sin(s.time * 1.4 + k * 1.7) * 18;
    const x = Math.round(((k * 0.618 + 0.05) % 1) * w + sway + (s.reducedMotion ? 0 : s.time * 6));
    drawShape(ctx, PETAL, ((x % w) + w) % w, wrapY(((k * 0.37) % 1) * h + fall, s.cameraY * 0.25, h), 3, k % 3 ? "#ffb7cf" : "#ffd6e4");
  }
}

const LANTERN = [".##.", "####", "####", "####", ".##."];

/** 연등 밤하늘: 별 + 달 + 천천히 떠오르는 연등(불빛이 깜빡) */
const lanternNight: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, p, w, h, s);
  drawShape(ctx, MOON_SHAPE, Math.round(w * 0.76), wrapY(h * 0.1, s.cameraY * 0.05, h), 5, p.moon);
  for (let k = 0; k < 7; k++) {
    const rise = s.reducedMotion ? 0 : s.time * (10 + (k % 3) * 5);
    const x = Math.round(((k * 0.41 + 0.08) % 1) * w + (s.reducedMotion ? 0 : Math.sin(s.time * 0.6 + k) * 6));
    const y = wrapY(((k * 0.29 + 0.15) % 1) * h - rise, s.cameraY * (0.1 + (k % 3) * 0.05), h);
    const cell = 3 + (k % 2);
    ctx.fillStyle = "rgba(255,200,120,0.25)";
    ctx.fillRect(x - cell, y - cell, cell * 6, cell * 7);
    drawShape(ctx, LANTERN, x, y, cell, k % 2 ? "#ff8a5c" : "#ffb35c");
    ctx.fillStyle = s.reducedMotion || Math.sin(s.time * 3 + k) > -0.3 ? "#fff1b8" : "#ffd88a";
    ctx.fillRect(x + cell, y + cell * 2, cell * 2, cell);
  }
};

export const SAKURA_DECOR: Record<string, DecorFn> = {
  pond: (ctx, p, w, h, s) => drawSparkles(ctx, p, w, h, s, 8, 0.3),
  blossom: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 3, 0.15);
    petals(ctx, w, h, s, 16);
  },
  roofs: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 4, 0.25);
    petals(ctx, w, h, s, 10);
  },
  lanterns: lanternNight,
};
