import { CLOUD_SHAPE, drawClouds, drawShape, drawSparkles, wrapY } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 동화 숲: 토끼 굴(흙·나무뿌리·빛나는 버섯) → 버섯 숲(풀밭, 양옆 큰 나무 줄기와 커다란 버섯)
 * → 나무 위 마을(양옆 잎 덤불 속 나무 집, 창문 불빛) → 콩나무를 타고 구름 위 성까지.
 * 지역 시작 줄: rows[1] = 땅(풀밭), rows[2] = 나무 위 마을(잎 덤불), rows[3] = 구름 위 성(콩나무 끝).
 */

const TONES: Record<string, readonly string[]> = {
  soil: ["#8a6146", "#7f583f", "#946a4e"],
  root: ["#b98a5e", "#ad7f55", "#c49466"],
  grass: ["#8a6146", "#7f583f", "#946a4e"],
  bark: ["#8c6a4f", "#806048", "#977356"],
  leaves: ["#6fbf73", "#64b268", "#7bcb7f"],
  house: ["#e8c8a0", "#e0bf96", "#efd2ac"],
};
const GLOW = ["#ffe08a", "#fff3c4"];
const CAP = "#ff7d7d";
const STALK = "#7fd36a";

/** 양옆 나무 줄기 두께(칸) */
const TRUNK = 2;
/** 잎 덤불 높이(줄) */
const CANOPY = 12;

/** 큰 버섯이 줄기에 붙어 있는 줄: 40줄마다 한 번, 좌우 번갈아 */
function mushroomAt(L: TileLayout, n: number): 0 | 1 | null {
  const k = n - L.rows[1] - 6;
  if (k < 0 || n >= L.rows[2] - 4 || k % 40 !== 0) return null;
  return ((k / 40) % 2) as 0 | 1;
}

export const FOREST_TILES: TileSet = {
  top: (L) => L.rows[3] + 4,

  at(L, n, c): Tile | null {
    const ground = L.rows[1];
    if (n < ground) {
      const solid = wallSolid(L, n, c);
      // 뿌리는 땅 가까이 많고, 빛나는 버섯은 굴 벽 여기저기
      if (!solid && hash(c, n, 3) % 23 === 0) return { m: "glow", solid };
      if (n > ground - 30 && hash(c, n, 4) % 5 === 0) return { m: "root", solid };
      return { m: "soil", solid };
    }
    if (n === ground) return { m: "grass", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const edge = side === 0 ? c : L.cols - 1 - c; // 벽에서 몇 번째 칸
    const canopy = L.rows[2];

    // 잎 덤불 (나무 위 마을): 5칸 폭, 아래·위는 둥글게
    if (n >= canopy && n < canopy + CANOPY) {
      const k = n - canopy;
      const width = k === 0 || k === CANOPY - 1 ? 4 : 5 + (hash(n, side, 6) % 2);
      // 나무 집: 덤불 가운데 3×3 (벽 쪽 2~4번째 칸), 지붕 한 줄
      if (k >= 4 && k <= 6 && edge >= 1 && edge <= 3) return { m: k === 6 ? "roof" : "house", solid: true };
      if (edge < width) return { m: "leaves", solid: true };
      return beanstalk(L, n, c);
    }
    // 줄기 (땅 ~ 덤불)
    if (n < canopy && edge < TRUNK) return { m: "bark", solid: true };
    // 줄기에 붙은 커다란 버섯 (갓 3칸 + 대 1칸)
    const mush = mushroomAt(L, n - 1);
    if (n < canopy && mushroomAt(L, n) === side && edge === TRUNK) return { m: "stem", solid: true };
    if (n < canopy && mush === side && edge >= TRUNK && edge <= TRUNK + 2) return { m: "cap", solid: true };
    // 버섯 사이사이 잎 달린 가지 (2줄, 벽 반대쪽으로 2~3칸)
    const b = n - L.rows[1] - 26;
    if (n < canopy - 4 && b >= 0 && b % 40 <= 1 && Math.floor(b / 40) % 2 === side && edge >= TRUNK && edge < TRUNK + 2 + (b % 40)) {
      return { m: "leaves", solid: true };
    }
    // 풀밭 위 작은 꽃
    if (n === ground + 1 && edge >= TRUNK && edge <= 4 && hash(c, 31) % 2 === 0) return { m: "flower", solid: true };
    return beanstalk(L, n, c);
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "glow": {
        // 굴 벽의 빛나는 버섯 (천천히 깜빡)
        baseTile(ctx, TONES.soil, false, x, y, v, false);
        ctx.fillStyle = shade("#e8dcc0", false, 0.15);
        ctx.fillRect(x + 7, y + 8, 2, 6);
        ctx.fillStyle = GLOW[phase];
        ctx.fillRect(x + 4, y + 4, 8, 4);
        ctx.fillRect(x + 5, y + 3, 6, 1);
        return true;
      }
      case "flower":
        ctx.fillStyle = "#5aa83a";
        ctx.fillRect(x + 7, y + 8, 2, 8);
        ctx.fillStyle = ["#ff9cc6", "#ffe08a", "#b5d8ff"][v % 3];
        ctx.fillRect(x + 5, y + 4, 6, 5);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 7, y + 6, 2, 2);
        return false;
      case "stem":
        ctx.fillStyle = "#f3e6cf";
        ctx.fillRect(x, y + 5, T, 6);
        ctx.fillStyle = "#dccaa8";
        ctx.fillRect(x, y + 10, T, 1);
        return false;
      case "cap": {
        // 빨간 갓 + 흰 점
        ctx.fillStyle = CAP;
        ctx.fillRect(x, y + 4, T, T - 4);
        ctx.fillStyle = "#e05a5a";
        ctx.fillRect(x, y + T - 2, T, 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + 7, 3, 3);
        return false;
      }
      case "roof":
        ctx.fillStyle = "#c25b4a";
        ctx.fillRect(x, y + 6, T, T - 6);
        ctx.fillStyle = "#e07a66";
        ctx.fillRect(x, y + 6, T, 2);
        return false;
      case "house": {
        const { dark } = baseTile(ctx, TONES.house, true, x, y, v, false);
        // 둥근 창문: 불이 켜져 있다
        ctx.fillStyle = dark;
        ctx.fillRect(x + 4, y + 4, 8, 8);
        ctx.fillStyle = v % 2 ? GLOW[0] : "#ffd36b";
        ctx.fillRect(x + 5, y + 5, 6, 6);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "stalk": {
        // 콩나무: 굵은 줄기 + 몇 줄마다 잎
        ctx.fillStyle = STALK;
        ctx.fillRect(x + 5, y, 6, T);
        ctx.fillStyle = "#5fb84e";
        ctx.fillRect(x + 9, y, 2, T);
        if (n % 4 === 0) {
          ctx.fillStyle = "#8fe07a";
          if ((n >> 2) % 2) ctx.fillRect(x + 11, y + 4, 5, 4);
          else ctx.fillRect(x, y + 4, 5, 4);
        }
        return false;
      }
    }
    const { dark, light } = baseTile(ctx, TONES[t.m], solid, x, y, v, t.m === "soil");
    if (t.m === "grass") {
      ctx.fillStyle = shade("#7fd36a", solid);
      ctx.fillRect(x, y, T, 5);
      ctx.fillRect(x + ((v >>> 3) % 3) * 4 + 2, y + 5, 3, 3);
    } else if (t.m === "root") {
      // 구불구불한 뿌리
      ctx.fillStyle = shade("#d6a878", solid);
      ctx.fillRect(x, y + 6 + (v % 3), 8, 2);
      ctx.fillRect(x + 7, y + 8 + (v % 3), 9, 2);
    } else if (t.m === "bark") {
      // 세로 나무결
      ctx.fillStyle = dark;
      ctx.fillRect(x + 3 + (v % 3) * 3, y, 2, T);
      ctx.fillStyle = light;
      ctx.fillRect(x + 11, y + ((v >>> 4) % 2) * 6, 1, 6);
    } else if (t.m === "leaves") {
      ctx.fillStyle = light;
      ctx.fillRect(x + ((v >>> 2) % 3) * 4 + 2, y + 3, 3, 3);
      ctx.fillStyle = dark;
      ctx.fillRect(x + ((v >>> 5) % 3) * 4 + 3, y + 10, 3, 3);
      if (v % 11 === 0) {
        // 사과
        ctx.fillStyle = "#ff6b6b";
        ctx.fillRect(x + 5, y + 6, 5, 5);
      }
    }
    if (t.m !== "grass") tileEdge(ctx, dark, x, y);
    return false;
  },
};

/** 콩나무: 덤불 위부터 구름 위 성까지 왼쪽 두 번째 칸을 타고 올라간다 */
function beanstalk(L: TileLayout, n: number, c: number): Tile | null {
  if (c === 1 && n >= L.rows[2] + CANOPY && n <= L.rows[3] + 3) return { m: "stalk", solid: true };
  return null;
}

/** 반딧불: 노란 점이 둥실둥실 떠다니며 깜빡인다 */
function fireflies(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cameraY: number, still: boolean, count: number) {
  for (let k = 0; k < count; k++) {
    if (!still && Math.sin(t * 2 + k * 1.9) < -0.3) continue;
    const x = Math.round(((k * 0.618 + 0.07) % 1) * w + (still ? 0 : Math.sin(t * 0.8 + k) * 10));
    const y = wrapY(((k * 0.37 + 0.1) % 1) * h + (still ? 0 : Math.cos(t * 0.7 + k) * 8), cameraY * 0.3, h);
    ctx.fillStyle = "rgba(255,240,150,0.45)";
    ctx.fillRect(x - 2, y - 2, 7, 7);
    ctx.fillStyle = "#fff3a0";
    ctx.fillRect(x, y, 3, 3);
  }
}

const BUTTERFLY_UP = ["#.#", "###", ".#."];
const BUTTERFLY_DOWN = ["...", "###", "#.#"];
const LEAF = [".##", "##.", "#.."];
/** 구름 위 성: 뾰족 지붕 탑 셋 */
const CASTLE = [
  "..#.......#.......#..",
  ".###.....###.....###.",
  ".###.....###.....###.",
  "#####...#####...#####",
  ".###.....###.....###.",
  ".###.#.#.###.#.#.###.",
  ".###########.#######.",
  ".###################.",
  ".########...########.",
  ".########...########.",
];

export const FOREST_DECOR: Record<string, DecorFn> = {
  burrow: (ctx, p, w, h, s) => {
    fireflies(ctx, w, h, s.time, s.cameraY, s.reducedMotion, 8);
  },
  mushroom: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 3, 0.15);
    fireflies(ctx, w, h, s.time, s.cameraY, s.reducedMotion, 4);
    // 나비 둘
    const flap = s.reducedMotion || Math.floor(s.time * 5) % 2 === 0;
    ([[0.3, 0.35, "#ff9cc6"], [0.7, 0.6, "#b5d8ff"]] as const).forEach(([fx, fy, color], k) => {
      const x = Math.round(fx * w + (s.reducedMotion ? 0 : Math.sin(s.time * 0.6 + k * 2) * w * 0.2));
      const y = wrapY(fy * h + (s.reducedMotion ? 0 : Math.sin(s.time * 1.7 + k) * 12), s.cameraY * 0.25, h);
      drawShape(ctx, flap ? BUTTERFLY_UP : BUTTERFLY_DOWN, x, y, 3, color);
    });
  },
  treetop: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 4, 0.25);
    // 팔랑팔랑 떨어지는 나뭇잎
    for (let k = 0; k < 6; k++) {
      const fall = s.reducedMotion ? 0 : s.time * (16 + (k % 3) * 6);
      const x = Math.round(((k * 0.43 + 0.12) % 1) * w + (s.reducedMotion ? 0 : Math.sin(s.time * 1.3 + k) * 14));
      drawShape(ctx, LEAF, x, wrapY(((k * 0.29) % 1) * h + fall, s.cameraY * 0.3, h), 3, k % 2 ? "#8fd18a" : "#ffc06b");
    }
  },
  castle: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 5, 0.3);
    // 구름 위에 앉은 성 (천천히 흘러간다)
    const cell = 5;
    const cw = CASTLE[0].length * cell;
    const x = Math.round(w / 2 - cw / 2);
    const y = wrapY(h * 0.2, s.cameraY * 0.1, h, 120);
    drawShape(ctx, CASTLE, x, y, cell, "#fff4d6");
    ctx.fillStyle = "#ffb3c7";
    for (const tx of [0, 8, 16]) ctx.fillRect(x + (tx + 2) * cell, y, cell, cell);
    ctx.fillStyle = "#ffd36b";
    for (const tx of [2, 10, 18]) ctx.fillRect(x + tx * cell, y + 5 * cell, cell, cell);
    for (let k = 0; k < 3; k++) drawShape(ctx, CLOUD_SHAPE, x - 10 + k * Math.round(cw / 3), y + CASTLE.length * cell - 6, 6, "#ffffff");
    drawSparkles(ctx, p, w, h, s, 6, 0.12);
  },
};
