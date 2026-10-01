import { CLOUD_SHAPE, drawShape, drawSparkles, PLANET_SHAPE, wrapY } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 과자 나라: 초코 동굴(초코 블록·쿠키) → 케이크 층(스펀지·크림·잼이 번갈아) → 케이크 윗면(분홍 아이싱 + 양옆 체리)
 * → 솜사탕 구름 → 사탕 우주(알록달록 스프링클 별 + 도넛 행성).
 * 지역 시작 줄: rows[1] = 케이크 시작, rows[2] = 케이크 윗면(아이싱).
 */

const TONES: Record<string, readonly string[]> = {
  choco: ["#7b4a35", "#6f412e", "#87543d"],
  sponge: ["#f6d38b", "#f0ca7c", "#fadc9b"],
  cream: ["#fff6e8", "#fff1e0", "#fffaf2"],
  jam: ["#ff8fa8", "#f77f9a", "#ff9db3"],
  frosting: ["#ffb3cf", "#ffaacb", "#ffbfd8"],
};
export const SPRINKLES = ["#ff6f91", "#6fc3ff", "#ffd84a", "#7fe0a8", "#c49bff"];
/** 체리 (2배로 그려 칸보다 크게) */
const CHERRY = ["..##...", ".#####.", "#######", "#######", ".#####."];
/** 과자는 뒷벽을 덜 어둡게 (크림이 회색으로 보이지 않게) */
const BACK = 0.2;

/** 케이크 한 겹 = 6줄: 스펀지 2 · 크림 1 · 잼 1 · 스펀지 2 */
const CAKE = ["sponge", "sponge", "cream", "jam", "sponge", "sponge"];

const cakeTop = (L: TileLayout) => L.rows[2];

export const CANDY_TILES: TileSet = {
  top: (L) => cakeTop(L) + 2,

  at(L, n, c): Tile | null {
    const top = cakeTop(L);
    if (n > top) {
      // 아이싱 위 양옆 체리
      if (n === top + 1 && (c === 1 || c === L.cols - 2)) return { m: "cherry", solid: true };
      return null;
    }
    const solid = wallSolid(L, n, c);
    if (n === top) return { m: "frosting", solid };
    if (n < L.rows[1] + (hash(c, 3) % 3) - 1) return { m: "choco", solid };
    return { m: CAKE[(((n - L.rows[1]) % CAKE.length) + CAKE.length) % CAKE.length], solid };
  },

  draw(ctx, t, x, y, c, n) {
    const v = hash(c, n, 9);
    const { solid } = t;
    if (t.m === "cherry") {
      // 체리 + 꼭지 (아이싱 위에 올라앉게, 칸보다 조금 크게)
      ctx.fillStyle = "#5aa83a";
      ctx.fillRect(x + 8, y - 6, 2, 7);
      ctx.fillRect(x + 10, y - 8, 3, 2);
      drawShape(ctx, CHERRY, x + 1, y + 6, 2, "#e8364f");
      ctx.fillStyle = "#ff9aa8";
      ctx.fillRect(x + 4, y + 9, 3, 3);
      return false;
    }
    if (t.m === "choco" && v % 17 === 0) {
      // 쿠키 조각
      const { dark } = baseTile(ctx, ["#d9a066", "#cf9559", "#e2ab72"], solid, x, y, v, false, BACK);
      ctx.fillStyle = shade("#6f412e", solid, BACK);
      ctx.fillRect(x + 3, y + 4, 3, 3);
      ctx.fillRect(x + 10, y + 6, 3, 3);
      ctx.fillRect(x + 6, y + 11, 3, 2);
      tileEdge(ctx, dark, x, y);
      return false;
    }
    const { dark, light } = baseTile(ctx, TONES[t.m], solid, x, y, v, t.m === "choco" || t.m === "sponge", BACK);
    if (t.m === "choco") {
      // 판 초콜릿처럼 안쪽 볼록선
      ctx.fillStyle = light;
      ctx.fillRect(x + 1, y + 1, T - 3, 1);
      tileEdge(ctx, dark, x, y);
    } else if (t.m === "cream" || t.m === "frosting") {
      if (t.m === "frosting") {
        ctx.fillStyle = shade("#ffd6e7", solid, BACK);
        ctx.fillRect(x, y, T, 3);
        // 흘러내린 아이싱
        ctx.fillStyle = shade(TONES.frosting[0], solid, BACK);
        ctx.fillRect(x + ((v >>> 3) % 3) * 5 + 1, y + T - 1, 3, 1);
      }
      // 스프링클
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = shade(SPRINKLES[(v >>> (k * 4)) % SPRINKLES.length], solid, BACK);
        ctx.fillRect(x + ((v >>> (k * 3 + 2)) % 4) * 3 + 2, y + 4 + k * 5, 3, 1);
      }
    } else if (t.m === "jam") {
      ctx.fillStyle = light;
      ctx.fillRect(x + ((v >>> 2) % 4) * 3 + 2, y + 6, 2, 2);
    }
    return false;
  },
};

/** 솜사탕 구름: 크고 폭신한 분홍·하늘색 구름이 천천히 흐른다 */
const COTTON = ["#ffc9e4", "#c9e6ff", "#ffd9ec", "#d6ecff"];
const cottonClouds: DecorFn = (ctx, p, w, h, s) => {
  for (let k = 0; k < 6; k++) {
    const cell = 7 + (k % 3) * 2;
    const cw = CLOUD_SHAPE[0].length * cell;
    const span = w + cw;
    const x = Math.round(((((((k * 0.41 + 0.1) % 1) * span + (s.reducedMotion ? 0 : s.time * (3 + (k % 3)))) % span) + span) % span) - cw);
    const y = wrapY(((k * 0.27 + 0.08) % 1) * h, s.cameraY * (0.18 + (k % 2) * 0.1), h, 80);
    drawShape(ctx, CLOUD_SHAPE, x, y, cell, COTTON[k % COTTON.length]);
    // 윗면 반짝
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(x + cell * 2, y + cell, cell * 3, Math.max(2, cell / 3));
  }
  drawSparkles(ctx, p, w, h, s, 4, 0.2);
};

/** 사탕 우주: 알록달록 스프링클 별 + 도넛 행성 */
const candySpace: DecorFn = (ctx, p, w, h, s) => {
  for (let k = 0; k < 36; k++) {
    if (!s.reducedMotion && Math.sin(s.time * 3 + k) < -0.6) continue;
    ctx.fillStyle = SPRINKLES[k % SPRINKLES.length];
    const x = Math.round(((k * 0.618) % 1) * w);
    const y = wrapY(((k * 0.382 + (k % 7) * 0.03) % 1) * h, s.cameraY * 0.08, h);
    if (k % 2) ctx.fillRect(x, y, 6, 2);
    else ctx.fillRect(x, y, 2, 6);
  }
  drawSparkles(ctx, p, w, h, s, 8, 0.12);
  // 도넛: 행성 모양 + 가운데 구멍 + 스프링클
  const cell = 5;
  const x = Math.round(w * 0.12);
  const y = wrapY(h * 0.5, s.cameraY * 0.1, h, 80);
  drawShape(ctx, PLANET_SHAPE, x, y, cell, "#ffb3cf");
  ctx.fillStyle = p.regions[p.regions.length - 1].top;
  ctx.fillRect(x + 4 * cell, y + 3 * cell, 4 * cell, 2 * cell);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = SPRINKLES[k % SPRINKLES.length];
    ctx.fillRect(x + [8, 30, 46, 14, 40, 22][k], y + [6, 4, 12, 28, 30, 34][k], 5, 2);
  }
};

export const CANDY_DECOR: Record<string, DecorFn> = {
  cotton: cottonClouds,
  sweetspace: candySpace,
};
