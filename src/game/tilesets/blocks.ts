import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";

/**
 * 블록 월드: 네더(네더랙·용암·발광석) → 돌(광석) → 흙 → 잔디 지표면, 그 위 양옆 나무.
 * 지역 시작 줄: rows[1] = 돌이 시작, rows[2] = 지표면.
 */

const TONES: Record<string, readonly string[]> = {
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

const surfRow = (L: TileLayout, c: number) => L.rows[2] + (hash(c, 4) % 2);

export const BLOCK_TILES: TileSet = {
  top: (L) => L.rows[2] + 8, // 나무 꼭대기

  at(L, n, c): Tile | null {
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
    if (t.m === "nether" && v % 13 === 0) {
      // 용암: 천천히 깜빡이며 빛난다
      ctx.fillStyle = shade(LAVA[phase], solid, 0.3);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = shade(LAVA[1 - phase], solid, 0.3);
      ctx.fillRect(x + 4, y + 5, 6, 3);
      return true;
    }
    const plain = t.m === "dirt" || t.m === "trunk" || (t.m === "nether" && v % 19 !== 0) || (t.m === "stone" && v % 11 !== 0);
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
