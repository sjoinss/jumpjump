import { drawShape, drawSparkles, drawStars, MOON_SHAPE, wrapY } from "../background";
import type { BackgroundState } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 장난감 방: 장난감 상자 속(나무 상자 벽, 뒤엔 알파벳 블록·공이 쌓여 있다) → 놀이방 바닥(카펫, 양옆 쌓기 블록 탑)
 * → 책장(양옆 책장: 칸마다 책·곰 인형) → 천장 모빌(밤 조명, 흔들리는 별·달 모빌과 종이비행기).
 * 지역 시작 줄: rows[1] = 카펫(땅), rows[2] = 책장 시작, rows[3] = 책장 꼭대기.
 */

const BLOCK_COLORS = ["#ff8a8a", "#ffd36b", "#8fd18a", "#8fc4ff", "#c9a8ff"];
const BOOK_COLORS = ["#e05c5c", "#5c8fe0", "#5fb84e", "#e0a83a", "#a86ad0", "#3fa8a0"];
const WOOD = ["#d9a86c", "#cf9f62", "#e2b276"];

/** 블록 탑 한 개가 차지하는 줄 (좌우 번갈아): 아래 3칸 폭 4줄, 2칸 폭 4줄, 1칸 폭 3줄 */
const TOWER_EVERY = 20;
/** 책장 한 칸 높이(줄): 맨 아래 줄이 선반 */
const SHELF = 5;

export const TOY_TILES: TileSet = {
  top: (L) => L.rows[3] + 1,

  at(L, n, c): Tile | null {
    const ground = L.rows[1];
    if (n < ground) {
      const solid = wallSolid(L, n, c);
      if (solid) return { m: "box", solid };
      // 뒤쪽은 대부분 상자 안벽, 장난감은 드문드문 (너무 알록달록하면 발판이 묻힌다)
      const v = hash(c, n, 3);
      return { m: v % 23 === 0 ? "ball" : v % 5 === 0 ? "toy" : "inner", solid };
    }
    if (n === ground) return { m: "rug", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const dx = side === 0 ? c : L.cols - 1 - c;

    // 책장 (꼭대기 줄은 장식 몰딩)
    if (n >= L.rows[2] && n <= L.rows[3]) {
      if (dx > 2) return null;
      if (n === L.rows[3]) return { m: "crown", solid: true };
      if (dx === 2) return { m: "frame", solid: true };
      const k = (n - L.rows[2]) % SHELF;
      if (k === 0) return { m: "shelf", solid: true };
      const slot = Math.floor((n - L.rows[2]) / SHELF);
      if (hash(slot, side, 5) % 6 === 0 && dx === 1 && k <= 3) return { m: k === 1 ? "bear" : k === 2 ? "bearHead" : "back", solid: true };
      return { m: "book", solid: true };
    }

    // 놀이방 바닥: 좌우 번갈아 블록 탑
    const k = n - ground - 1;
    if (k >= 0 && n < L.rows[2] - 2) {
      const turn = Math.floor(k / TOWER_EVERY);
      const local = k % TOWER_EVERY;
      if (turn % 2 === side) {
        const width = local < 4 ? 3 : local < 8 ? 2 : local < 11 ? 1 : 0;
        if (dx < width) return { m: "block", solid: true };
      }
    }
    return null;
  },

  draw(ctx, t, x, y, c, n) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "inner": {
        const { dark } = baseTile(ctx, WOOD, false, x, y, v, false, 0.3);
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 7, T, 1);
        return false;
      }
      case "box": {
        const { dark } = baseTile(ctx, WOOD, solid, x, y, v, false);
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 7, T, 1);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "toy":
      case "block": {
        // 알파벳 블록: 색 칸 + 흰 테두리 + 글자 대신 도트 무늬
        const color = BLOCK_COLORS[(v >>> 3) % BLOCK_COLORS.length];
        const k = t.m === "toy" ? 0.4 : 0;
        ctx.fillStyle = shade(color, solid, k);
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = shade("#ffffff", solid, k);
        ctx.fillRect(x + 2, y + 2, T - 4, 1);
        ctx.fillRect(x + 2, y + T - 3, T - 4, 1);
        ctx.fillRect(x + 2, y + 2, 1, T - 4);
        ctx.fillRect(x + T - 3, y + 2, 1, T - 4);
        ctx.fillStyle = shade("#3d2c5e", solid, k);
        const glyph = v % 3;
        if (glyph === 0) ctx.fillRect(x + 6, y + 5, 4, 6);
        else if (glyph === 1) {
          ctx.fillRect(x + 5, y + 5, 6, 2);
          ctx.fillRect(x + 5, y + 9, 6, 2);
        } else ctx.fillRect(x + 7, y + 4, 2, 8);
        return false;
      }
      case "ball": {
        ctx.fillStyle = shade("#ffd36b", false, 0.35);
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = shade(v % 2 ? "#ff6f6f" : "#5c8fe0", false, 0.3);
        ctx.fillRect(x + 3, y + 2, 10, 12);
        ctx.fillRect(x + 2, y + 3, 12, 10);
        ctx.fillStyle = shade("#ffffff", false, 0.3);
        ctx.fillRect(x + 2, y + 7, 12, 2);
        return false;
      }
      case "rug": {
        ctx.fillStyle = "#e05c7a";
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#ffd36b";
        for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 4, y + 3 + (k % 2) * 2, 3, 2);
        ctx.fillStyle = "#b8405e";
        ctx.fillRect(x, y + T - 4, T, 4);
        return false;
      }
      case "frame":
      case "crown":
      case "shelf":
      case "back": {
        const { dark } = baseTile(ctx, ["#a8744a", "#9e6c44", "#b07c50"], true, x, y, v, false);
        if (t.m === "crown") {
          ctx.fillStyle = "#c9925e";
          ctx.fillRect(x, y + 8, T, 4);
        }
        if (t.m === "shelf") {
          ctx.fillStyle = "#c9925e";
          ctx.fillRect(x, y, T, 4);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "book": {
        // 책 두세 권: 높이·색이 조금씩 다르다
        ctx.fillStyle = "#7d5434";
        ctx.fillRect(x, y, T, T);
        let bx = x;
        for (let k = 0; k < 3; k++) {
          const w = 4 + ((v >>> (k * 3)) % 2);
          const top = (v >>> (k * 2 + 7)) % 4;
          ctx.fillStyle = BOOK_COLORS[(v >>> (k * 4)) % BOOK_COLORS.length];
          ctx.fillRect(bx, y + top, w, T - top);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(bx + 1, y + top + 3, w - 2, 1);
          bx += w + 1;
        }
        return false;
      }
      case "bear":
      case "bearHead": {
        ctx.fillStyle = "#7d5434";
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#c98f5a";
        if (t.m === "bear") ctx.fillRect(x + 3, y + 2, 10, 14);
        else {
          ctx.fillRect(x + 3, y + 4, 10, 12);
          ctx.fillRect(x + 2, y + 2, 4, 4);
          ctx.fillRect(x + 10, y + 2, 4, 4);
          ctx.fillStyle = "#3d2c5e";
          ctx.fillRect(x + 5, y + 8, 2, 2);
          ctx.fillRect(x + 9, y + 8, 2, 2);
          ctx.fillRect(x + 7, y + 11, 2, 2);
        }
        return false;
      }
    }
    return false;
  },
};

const PLANE = ["#.....", "####..", ".#####", "..##..", ];

function airplanes(ctx: CanvasRenderingContext2D, w: number, h: number, s: BackgroundState, count: number) {
  for (let k = 0; k < count; k++) {
    const span = w + 40;
    const x = Math.round((((k * 0.53 * span + (s.reducedMotion ? 0 : s.time * (30 + k * 8))) % span) + span) % span) - 20;
    const y = wrapY(((k * 0.37 + 0.2) % 1) * h + (s.reducedMotion ? 0 : Math.sin(s.time + k) * 8), s.cameraY * 0.2, h);
    drawShape(ctx, PLANE, x, y, 3, "#ffffff");
  }
}

/** 놀이방 벽지: 옅은 물방울 무늬 + 종이비행기 */
const wallpaper: DecorFn = (ctx, p, w, h, s) => {
  ctx.fillStyle = "rgba(255,170,190,0.25)";
  const off = Math.round(s.cameraY * 0.3) % 40;
  for (let y = -40; y < h + 40; y += 40) {
    for (let x = 10; x < w; x += 40) ctx.fillRect(x + ((y / 40) % 2 ? 20 : 0), y + off, 6, 6);
  }
  airplanes(ctx, w, h, s, 2);
};

const STAR = [".#.", "###", ".#."];

/** 천장 모빌: 위에서 줄로 매달린 별·달이 흔들린다 */
const mobile: DecorFn = (ctx, p, w, h, s) => {
  drawStars(ctx, { ...p, sparkleDensity: 0.5 }, w, h, s);
  const top = wrapY(h * 0.05, s.cameraY * 0.08, h, 160);
  const swing = s.reducedMotion ? 0 : Math.sin(s.time * 0.8) * 10;
  ctx.fillStyle = "#c9a8ff";
  ctx.fillRect(Math.round(w * 0.2), top, Math.round(w * 0.6), 3);
  [0.25, 0.4, 0.55, 0.7].forEach((fx, k) => {
    const len = 30 + (k % 2) * 24;
    const x = Math.round(w * fx + swing * (k % 2 ? 1 : -1));
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(Math.round(w * fx), top, 1, len);
    if (k === 1) drawShape(ctx, MOON_SHAPE, x - 6, top + len, 3, p.moon);
    else drawShape(ctx, STAR, x - 6, top + len, 5, k % 2 ? "#ffd36b" : "#ffb3cf");
  });
  airplanes(ctx, w, h, s, 1);
};

export const TOY_DECOR: Record<string, DecorFn> = {
  toybox: (ctx, p, w, h, s) => drawSparkles(ctx, p, w, h, s, 8, 0.3),
  playroom: wallpaper,
  bookshelf: (ctx, p, w, h, s) => {
    drawSparkles(ctx, p, w, h, s, 5, 0.2);
    airplanes(ctx, w, h, s, 2);
  },
  mobile,
};
