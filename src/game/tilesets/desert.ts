import { drawBirds, drawClouds, drawShape, drawSparkles, drawStars, MOON_SHAPE, wrapY } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 사막 피라미드: 모래 속 무덤(사암 벽, 상형문자·횃불) → 오아시스(모래 언덕 위 야자수·선인장이 좌우 번갈아)
 * → 피라미드(양옆 계단식 피라미드가 올라갈수록 좁아지고 꼭대기에 황금 갓돌) → 별 쏟아지는 밤.
 * 지역 시작 줄: rows[1] = 모래 땅, rows[2] = 피라미드 시작, rows[3] = 꼭대기.
 */

const TONES: Record<string, readonly string[]> = {
  sandstone: ["#e0b878", "#d6ae6e", "#e8c284"],
  brick: ["#c99a5e", "#bf9056", "#d1a466"],
  sand: ["#f0d49a", "#ebcd90", "#f4daa4"],
  pyramid: ["#e8c584", "#dfbb7a", "#efcd8e"],
};
const FLAME = ["#ff8a3d", "#ffd36b"];
const PALM_EVERY = 22;
const PEAK_WIDTH = 5;

/** 피라미드 폭: 올라갈수록 줄고 4줄마다 한 계단 */
function pyramidWidth(L: TileLayout, n: number) {
  const span = L.rows[3] - L.rows[2];
  const k = n - L.rows[2];
  if (k < 0 || k >= span) return 0;
  const step = Math.floor(k / 4) * 4;
  return Math.max(1, Math.round(1 + (PEAK_WIDTH - 1) * (1 - step / span)));
}

/** 오아시스의 나무 한 그루 (local = 언덕 줄부터, dx = 벽에서 몇 번째 칸). 셋에 하나는 선인장 */
function plant(local: number, dx: number, cactus: boolean): Tile | null {
  if (local === 0) return dx <= 3 ? { m: "dune", solid: true } : null;
  if (cactus) {
    if (dx === 1 && local <= 4) return { m: "cactus", solid: true };
    if (dx === 2 && local === 2) return { m: "cactusArm", solid: true };
    return null;
  }
  if (dx === 1 && local <= 6) return { m: "palm", solid: true };
  if (local === 7 && dx <= 4) return { m: "frond", solid: true };
  if (local === 6 && (dx === 0 || dx === 3 || dx === 4)) return { m: "frondTip", solid: true };
  return null;
}

export const DESERT_TILES: TileSet = {
  top: (L) => L.rows[3] + 1,

  at(L, n, c): Tile | null {
    const ground = L.rows[1];
    if (n < ground) {
      const solid = wallSolid(L, n, c);
      if (solid) return { m: "sandstone", solid };
      const v = hash(c, n, 3);
      if (v % 41 === 0) return { m: "torch", solid };
      if (v % 13 === 0) return { m: "glyph", solid };
      return { m: "brick", solid };
    }
    if (n === ground) return { m: "sand", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const dx = side === 0 ? c : L.cols - 1 - c;

    if (n === L.rows[3] && dx === 0) return { m: "cap", solid: true };
    const pw = pyramidWidth(L, n);
    if (dx < pw) return { m: pyramidWidth(L, n + 1) <= dx ? "pyramidTop" : "pyramid", solid: true };

    if (n < L.rows[2] - 2) {
      const k = n - ground - 3;
      if (k >= 0) {
        const turn = Math.floor(k / PALM_EVERY);
        if (turn % 2 === side) return plant(k % PALM_EVERY, dx, turn % 3 === 2);
      }
    }
    return null;
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "torch": {
        baseTile(ctx, TONES.brick, false, x, y, v, false);
        ctx.fillStyle = shade("#6b4a2a", false, 0.2);
        ctx.fillRect(x + 7, y + 8, 2, 7);
        ctx.fillStyle = FLAME[phase];
        ctx.fillRect(x + 5, y + 2, 6, 6);
        ctx.fillStyle = FLAME[1 - phase];
        ctx.fillRect(x + 7, y + 4, 2, 3);
        return true;
      }
      case "glyph": {
        const { dark } = baseTile(ctx, TONES.brick, false, x, y, v, false);
        // 상형문자: 눈 · 새 · 물결 중 하나
        ctx.fillStyle = shade("#6b4a2a", false, 0.1);
        const g = v % 3;
        if (g === 0) {
          ctx.fillRect(x + 3, y + 6, 10, 2);
          ctx.fillRect(x + 6, y + 8, 4, 2);
          ctx.fillRect(x + 7, y + 10, 2, 3);
        } else if (g === 1) {
          ctx.fillRect(x + 4, y + 4, 4, 3);
          ctx.fillRect(x + 6, y + 7, 6, 4);
          ctx.fillRect(x + 8, y + 11, 2, 3);
        } else for (let k = 0; k < 3; k++) ctx.fillRect(x + 2 + k * 4, y + 6 + (k % 2) * 2, 3, 2);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "brick":
      case "sandstone": {
        const { dark } = baseTile(ctx, TONES[t.m], solid, x, y, v, false);
        // 벽돌 줄눈 (줄마다 엇갈림)
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 7, T, 1);
        ctx.fillRect(x + (n % 2 ? 4 : 11), y, 1, 7);
        ctx.fillRect(x + (n % 2 ? 11 : 4), y + 8, 1, 8);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "sand":
      case "dune": {
        if (t.m === "dune") {
          ctx.fillStyle = TONES.sand[v % 3];
          ctx.fillRect(x, y + 5, T, T - 5);
          ctx.fillStyle = "#fff0c8";
          ctx.fillRect(x, y + 5, T, 2);
          return false;
        }
        const { dark } = baseTile(ctx, TONES.sand, true, x, y, v, true);
        ctx.fillStyle = "#fff0c8";
        ctx.fillRect(x, y, T, 3);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "palm":
        ctx.fillStyle = "#a8743a";
        ctx.fillRect(x + 5, y, 6, T);
        ctx.fillStyle = "#8a5a28";
        ctx.fillRect(x + 5, y + (n % 2 ? 3 : 10), 6, 2);
        return false;
      case "frond":
      case "frondTip":
        ctx.fillStyle = "#4fae4f";
        if (t.m === "frond") ctx.fillRect(x, y + 4, T, 6);
        else ctx.fillRect(x + 2, y, 10, 5);
        ctx.fillStyle = "#3f8f3f";
        ctx.fillRect(x, y + (t.m === "frond" ? 9 : 4), T, 1);
        if (t.m === "frond" && c % 3 === 0) {
          ctx.fillStyle = "#8a5a28";
          ctx.fillRect(x + 6, y + 10, 4, 4);
        }
        return false;
      case "cactus":
      case "cactusArm":
        ctx.fillStyle = "#5fb86a";
        if (t.m === "cactus") ctx.fillRect(x + 4, y, 8, T);
        else ctx.fillRect(x, y + 4, 8, 5);
        ctx.fillStyle = "#3f9a4f";
        ctx.fillRect(x + (t.m === "cactus" ? 7 : 0), y + (t.m === "cactus" ? 0 : 6), t.m === "cactus" ? 1 : 8, t.m === "cactus" ? T : 1);
        return false;
      case "pyramid":
      case "pyramidTop": {
        const { dark } = baseTile(ctx, TONES.pyramid, true, x, y, v, false);
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 7, T, 1);
        ctx.fillRect(x + (n % 2 ? 3 : 10), y, 1, 7);
        if (t.m === "pyramidTop") {
          ctx.fillStyle = "#fff0c8";
          ctx.fillRect(x, y, T, 2);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "cap":
        ctx.fillStyle = "#ffd36b";
        ctx.fillRect(x + 2, y + 6, 12, 10);
        ctx.fillRect(x + 5, y + 2, 6, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 6, y + 4, 2, 2);
        return false;
    }
    return false;
  },
};

const SUN = ["..####..", ".######.", "########", "########", "########", "########", ".######.", "..####.."];
const CAMEL = ["....##......", "...###...##.", "..#####.###.", "############", ".##########.", ".#..#..#..#.", ".#..#..#..#."];

/** 별이 쏟아지는 밤: 촘촘한 별 + 달 + 가끔 별똥별 */
const starryNight: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, { ...p, sparkleDensity: 2 }, w, h, s);
  drawShape(ctx, MOON_SHAPE, Math.round(w * 0.74), wrapY(h * 0.1, s.cameraY * 0.05, h), 5, p.moon);
  if (!s.reducedMotion && s.time % 4 < 0.7) {
    const t = (s.time % 4) / 0.7;
    const x = Math.round(w * (0.85 - t * 0.6));
    const y = Math.round(h * (0.06 + t * 0.2));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let k = 1; k <= 4; k++) ctx.fillRect(x + k * 6, y - k * 3, 3, 3);
  }
};

export const DESERT_DECOR: Record<string, DecorFn> = {
  tomb: (ctx, p, w, h, s) => drawSparkles(ctx, p, w, h, s, 6, 0.3),
  oasis: (ctx, p, w, h, s) => {
    drawShape(ctx, SUN, Math.round(w * 0.7), wrapY(h * 0.12, s.cameraY * 0.05, h, 80), 6, "#fff1a8");
    drawClouds(ctx, p, w, h, s, 2, 0.15);
    drawBirds(ctx, w, h, s, "rgba(120,80,40,0.55)");
  },
  pyramid: (ctx, p, w, h, s) => {
    drawShape(ctx, SUN, Math.round(w * 0.2), wrapY(h * 0.2, s.cameraY * 0.05, h, 80), 6, "#ffb36b");
    // 멀리 지나가는 낙타
    const span = w + 60;
    const x = Math.round((((s.reducedMotion ? 0.4 * span : s.time * 8) % span) + span) % span) - 40;
    drawShape(ctx, CAMEL, x, wrapY(h * 0.62, s.cameraY * 0.08, h, 80), 3, "rgba(140,90,50,0.45)");
    drawClouds(ctx, p, w, h, s, 3, 0.25);
  },
  night: starryNight,
};
