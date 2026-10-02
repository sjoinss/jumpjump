import { drawBirds, drawClouds, drawShape, drawStars, MOON_SHAPE, wrapY } from "../background";
import { baseTile, hash, shade, T, tileEdge, wallSolid, type Tile, type TileLayout, type TileSet } from "../tiles";
import type { DecorFn } from "../themes";

/**
 * 도시 빌딩: 지하철(역 벽 타일·형광등·역 표지판) → 거리(차도·인도·가로등, 1층 가게와 차양) → 빌딩 숲(양옆 높은 건물, 창문 불빛)
 * → 옥상(지붕·안테나 깜빡이·물탱크, 노을 하늘에 헬리콥터) → 밤하늘(별·달).
 * 지역 시작 줄: rows[1] = 거리(땅), rows[2] = 빌딩 숲(건물이 넓어짐), rows[3] = 옥상.
 */

const FACADES = ["#c9b8a8", "#a9b8c9", "#d6c2d9", "#b8c9b0", "#e0c9a6"];
const LIT = "#ffe08a";
const DARK_WINDOW = "#4a5a7a";

/** 건물 폭(칸): 가게 거리는 3칸, 빌딩 숲부터 4~5칸 (40줄마다 조금씩 다르게) */
function buildingWidth(L: TileLayout, n: number, side: 0 | 1) {
  if (n < L.rows[2]) return 3;
  return 4 + (hash(Math.floor(n / 40), side, 3) % 2);
}

/** 옥상 줄 (왼쪽·오른쪽 건물 높이가 조금 다르다) */
const roofRow = (L: TileLayout, side: 0 | 1) => L.rows[3] + (hash(side, 7) % 3);

export const CITY_TILES: TileSet = {
  top: (L) => L.rows[3] + 8,

  at(L, n, c): Tile | null {
    const street = L.rows[1];
    if (n < street) {
      // 지하철 역: 양옆 콘크리트, 가운데 역 벽 타일 (형광등 줄, 가끔 역 표지판)
      if (wallSolid(L, n, c)) return { m: "concrete", solid: true };
      if (((n % 9) + 9) % 9 === 6 && c % 4 === 1) return { m: "lamp", solid: false };
      if (hash(c, n, 5) % 29 === 0) return { m: "sign", solid: false };
      return { m: "station", solid: false };
    }
    if (n === street) return { m: c < 3 || c >= L.cols - 3 ? "sidewalk" : "road", solid: true };

    const side: 0 | 1 = c < L.cols / 2 ? 0 : 1;
    const bw = buildingWidth(L, n, side);
    const inBuilding = side === 0 ? c < bw : c >= L.cols - bw;
    const roof = roofRow(L, side);
    if (inBuilding && n < roof) {
      // 1층은 가게: 유리창 + 그 위 줄무늬 차양
      if (n <= street + 2) return { m: "shop", solid: true };
      if (n === street + 3) return { m: "awning", solid: true };
      return { m: "facade", solid: true };
    }
    if (inBuilding && n === roof) return { m: "rooftop", solid: true };
    // 옥상 위: 왼쪽 안테나, 오른쪽 물탱크
    if (side === 0 && c === 1 && n > roof && n <= roof + 4) return { m: n === roof + 4 ? "beacon" : "antenna", solid: true };
    if (side === 1 && (c === L.cols - 2 || c === L.cols - 3) && n > roof && n <= roof + 2) return { m: "tank", solid: true };
    // 거리 가로등
    if (n < L.rows[2] && (c === 4 || c === L.cols - 5)) {
      if (n > street && n <= street + 4) return { m: "pole", solid: true };
      if (n === street + 5) return { m: "streetlamp", solid: true };
    }
    return null;
  },

  draw(ctx, t, x, y, c, n, phase) {
    const v = hash(c, n, 9);
    const { solid } = t;
    switch (t.m) {
      case "concrete": {
        const { dark } = baseTile(ctx, ["#9aa0ad", "#8f95a3", "#a5abb8"], true, x, y, v);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "station":
      case "lamp":
      case "sign": {
        // 역 벽: 크림색 작은 타일 (뒷벽이라 어둡게)
        const { dark } = baseTile(ctx, ["#d8d2c4", "#d2ccbd", "#ddd8cb"], false, x, y, v, false, 0.3);
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 7, T, 1);
        ctx.fillRect(x + 7, y, 1, T);
        if (t.m === "lamp") {
          ctx.fillStyle = "#fff7c9";
          ctx.fillRect(x + 1, y + 2, T - 2, 3);
        } else if (t.m === "sign") {
          ctx.fillStyle = shade("#3b6fd6", false, 0.2);
          ctx.fillRect(x, y + 4, T, 7);
          ctx.fillStyle = "#e6ecff";
          ctx.fillRect(x + 3, y + 7, T - 6, 1);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "road": {
        ctx.fillStyle = "#5a5f6b";
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#6c7280";
        ctx.fillRect(x, y, T, 2);
        if (c % 2 === 0) {
          ctx.fillStyle = "#ffd84a";
          ctx.fillRect(x + 3, y + 8, 10, 2);
        }
        return false;
      }
      case "sidewalk": {
        const { dark } = baseTile(ctx, ["#c9c4bb", "#c1bcb2", "#d0cbc3"], true, x, y, v, false);
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "facade":
      case "shop": {
        const color = FACADES[hash(Math.floor(n / 30), c < 8 ? 0 : 1, 11) % FACADES.length];
        const { dark } = baseTile(ctx, [color], true, x, y, v, false);
        if (t.m === "shop") {
          ctx.fillStyle = "#9fd8ff";
          ctx.fillRect(x + 1, y + 2, T - 2, T - 3);
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.fillRect(x + 3, y + 4, 2, 6);
        } else {
          // 창문: 셋 중 하나는 불이 켜져 있다
          ctx.fillStyle = dark;
          ctx.fillRect(x + 4, y + 3, 8, 9);
          ctx.fillStyle = v % 3 === 0 ? LIT : DARK_WINDOW;
          ctx.fillRect(x + 5, y + 4, 6, 7);
        }
        tileEdge(ctx, dark, x, y);
        return false;
      }
      case "awning": {
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = k % 2 ? "#ffffff" : "#ff6f6f";
          ctx.fillRect(x + k * 4, y + 4, 4, 8);
        }
        ctx.fillStyle = "#c94a4a";
        ctx.fillRect(x, y + 12, T, 2);
        return false;
      }
      case "rooftop": {
        ctx.fillStyle = "#6b6f7a";
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = "#8a8f9a";
        ctx.fillRect(x, y, T, 3);
        return false;
      }
      case "antenna":
        ctx.fillStyle = "#6b6f7a";
        ctx.fillRect(x + 7, y, 2, T);
        if (n % 2 === 0) ctx.fillRect(x + 3, y + 6, 10, 2);
        return false;
      case "beacon":
        ctx.fillStyle = "#6b6f7a";
        ctx.fillRect(x + 7, y + 8, 2, 8);
        ctx.fillStyle = phase ? "#ff5a5a" : "#a83232";
        ctx.fillRect(x + 5, y + 4, 6, 5);
        return true;
      case "tank":
        ctx.fillStyle = "#9b6a43";
        ctx.fillRect(x, y + 1, T, T - 1);
        ctx.fillStyle = "#7d5434";
        ctx.fillRect(x, y + 5, T, 1);
        ctx.fillRect(x, y + 10, T, 1);
        return false;
      case "pole":
        ctx.fillStyle = "#5d6270";
        ctx.fillRect(x + 7, y, 3, T);
        return false;
      case "streetlamp":
        ctx.fillStyle = "#5d6270";
        ctx.fillRect(x + 7, y + 8, 3, 8);
        ctx.fillRect(x + 3, y + 5, 11, 3);
        ctx.fillStyle = LIT;
        ctx.fillRect(x + 4, y + 8, 9, 3);
        return false;
    }
    void solid;
    return false;
  },
};

/** 헬리콥터 (오른쪽을 본다). 프로펠러는 따로 깜빡이며 그린다 */
const HELI = [
  ".......#.......",
  "...#######.....",
  "..#############",
  "..#########..##",
  "...#######.....",
  "....#...#......",
  "...#######.....",
];

const helicopter: DecorFn = (ctx, p, w, h, s) => {
  drawClouds(ctx, { ...p, cloud: "rgba(255,236,224,0.9)" }, w, h, s, 4, 0.2);
  const cell = 3;
  const hw = HELI[0].length * cell;
  const span = w + hw * 2;
  const x = Math.round((((s.reducedMotion ? 0.3 * span : s.time * 26) % span) + span) % span) - hw;
  const y = wrapY(h * 0.3, s.cameraY * 0.15, h, 80);
  const rows = HELI.map((r) => [...r].reverse().join("")); // 왼쪽→오른쪽으로 날아가니 앞이 오른쪽
  drawShape(ctx, rows, x, y, cell, "#ff8a5c");
  ctx.fillStyle = "#9fd8ff";
  ctx.fillRect(x + hw - 9 * cell, y + 2 * cell, cell * 2, cell);
  // 프로펠러: 길게 ↔ 짧게
  const blade = s.reducedMotion || Math.floor(s.time * 12) % 2 ? 13 : 7;
  ctx.fillStyle = "#3d2c5e";
  ctx.fillRect(x + hw - 8 * cell - (blade * cell) / 2, y - cell, blade * cell, 2);
};

export const CITY_DECOR: Record<string, DecorFn> = {
  street: (ctx, p, w, h, s) => {
    drawClouds(ctx, p, w, h, s, 3, 0.15);
    drawBirds(ctx, w, h, s, "rgba(61,44,94,0.55)");
  },
  towers: (ctx, p, w, h, s) => drawClouds(ctx, p, w, h, s, 5, 0.3),
  roof: helicopter,
  night: (ctx, p, w, h, s) => {
    drawStars(ctx, p, w, h, s);
    drawShape(ctx, MOON_SHAPE, Math.round(w * 0.74), wrapY(h * 0.1, s.cameraY * 0.05, h), 5, p.moon);
  },
};
