import type { PixelSprite, PlatformKind, Platforms } from "../lib/schema";
import { PLATFORM_PRESETS, pixelSprite } from "./presets";
import type { ThemeId } from "./themes";

/**
 * 테마별 기본 발판 (사용자 요청 2026-10-02: 발판이 테마와 동떨어져 보이지 않게, 색만 바꾸지 말고 모양부터 다르게).
 * 규칙: 저장된 발판이 "기본 발판"(PLATFORM_PRESETS) 그대로면 → 지금 테마의 발판으로 보여준다.
 *       직접 그린 발판은 어느 테마에서나 그대로.
 * 그래서 테마 발판을 따로 저장하지 않는다. 에디터에서 테마 발판과 똑같이 완료하면 다시 "기본"(= 테마를 따라감)으로 저장한다.
 *
 * 모두 32×8칸. 칸마다 무엇을 칠할지 정하는 함수(Shape)로 그리고, 글자는 범례 색으로 바꾼다 ("." = 투명).
 * 윗줄(0~1)은 되도록 넓게 채운다 — 캐릭터가 발판 윗면에 서기 때문에 양끝이 비면 떠 보인다.
 */

const W = 32;
const H = 8;
type Shape = (x: number, y: number) => string;
type Legend = Record<string, string>;
type Decor = (x: number, y: number) => boolean;

function art(shape: Shape, legend: Legend): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) row += shape(x, y);
    rows.push(row);
  }
  return pixelSprite(rows, legend);
}

const inside = (x: number, from: number, to: number) => x >= from && x <= to;

// ── 속 무늬 (구름·베개에 넣는다) ──

const dots: Decor = (x, y) => y === 4 && x % 4 === 2;
const heart: Decor = (x, y) => {
  const m = x % 8;
  return (y === 4 && (m === 2 || m === 4)) || (y === 5 && m === 3);
};
const stitch: Decor = (x, y) => y === 4 && x % 3 === 0;
const star: Decor = (x, y) => {
  const dx = (x % 8) - 4;
  const dy = y - 4;
  return (dx === 0 && Math.abs(dy) <= 1) || (dy === 0 && Math.abs(dx) <= 1);
};
const crack: Decor = (x, y) => y === 3 + [0, 1, 2, 1][x % 4] && inside(x, 3, 28);
const wave: Decor = (x, y) => y === 3 + [0, 1, 1, 0][x % 4] + 1;

// ── 솜사탕: 뭉게구름 (위·아래가 봉긋) ──

function cloud(decor: Decor): Shape {
  return (x, y) => {
    const m = x % 8;
    if (y === 0) return inside(m, 2, 5) ? "t" : ".";
    if (y === 1) return inside(x, 1, 30) ? "t" : ".";
    if (y === 2) return "t";
    if (y === 3) return "s";
    if (y === 4) return decor(x, y) ? "a" : "b";
    if (y === 5) return inside(x, 1, 30) ? (decor(x, y) ? "a" : "b") : ".";
    if (y === 6) return inside(m, 2, 5) ? "e" : ".";
    return ".";
  };
}

// ── 꿈나라: 모서리에 술이 달린 베개 ──

function pillow(decor: Decor): Shape {
  return (x, y) => {
    const corner = x <= 1 || x >= 30;
    if (y === 0 || y === 7) return corner ? "e" : ".";
    if (x === 0 || x === 31) return ".";
    if (x === 1 || x === 30) return "e";
    if (y <= 2) return "t";
    if (y === 6) return "e";
    return decor(x, y) ? "a" : y === 3 ? "s" : "b";
  };
}

// ── 바닷속 ──

/** 해초가 돋은 바위 */
const rock: Shape = (x, y) => {
  const weed = x % 9 === 2 || x % 9 === 6;
  if (y === 0) return weed ? "g" : ".";
  if (y === 1) return inside(x, 1, 30) ? (weed ? "g" : "t") : ".";
  if (y === 2) return "t";
  if (y === 3) return "s";
  if (y === 4 || y === 5) return (x * 7 + y * 3) % 11 === 0 ? "a" : "b";
  if (y === 6) return inside(x, 2, 29) && x % 5 !== 0 ? "e" : ".";
  return ".";
};
/** 가리비 조개: 세로 골 + 봉긋한 골 윗면 */
const shell: Shape = (x, y) => {
  const m = x % 6;
  if (y === 0) return inside(m, 1, 4) ? "t" : ".";
  if (y >= 1 && y <= 5) return m === 0 ? "e" : y <= 2 ? "t" : m === 2 ? "a" : "b";
  if (y === 6) return inside(x, 2, 29) ? "e" : ".";
  return ".";
};
/** 떠내려온 판자: 나뭇결 + 옹이 */
const plank: Shape = (x, y) => {
  if (x === 0 || x === 31) return inside(y, 2, 5) ? "e" : ".";
  if (y === 0 || y === 7) return ".";
  if (y === 1) return "t";
  if (y === 6) return "e";
  if ((x === 8 || x === 22) && y === 4) return "a";
  if ((x + 3 * y) % 9 === 0) return "a";
  return y === 2 ? "s" : "b";
};
/** 해파리 줄: 동그란 갓 + 다리 */
const jellyfish: Shape = (x, y) => {
  const m = x % 8;
  if (y === 0) return inside(m, 2, 5) ? "t" : ".";
  if (y === 1) return inside(m, 1, 6) ? "t" : ".";
  if (y === 2 || y === 3) return m === 2 && y === 2 ? "w" : "b";
  if (y === 4) return inside(m, 1, 6) ? "s" : ".";
  if (y === 5) return m === 2 || m === 5 ? "a" : ".";
  if (y === 6) return m === 1 || m === 6 ? "a" : ".";
  return ".";
};

// ── 블록 월드: 8×8 블록 네 칸 (오른쪽·아래 경계선) ──

function blocks(face: (lx: number, y: number, bx: number) => string): Shape {
  return (x, y) => {
    const lx = x % 8;
    if (lx === 7 || y === 7) return "e";
    return face(lx, y, Math.floor(x / 8));
  };
}
const speck = (lx: number, y: number, bx: number) => ((lx * 5 + y * 3 + bx * 7) % 11 === 0 ? "a" : "b");
const grassBlock = blocks((lx, y, bx) => (y <= 1 || (y === 2 && (lx + bx) % 3 === 0) ? "t" : speck(lx, y, bx)));
const slimeBlock = blocks((lx, y) =>
  (inside(lx, 2, 4) && (y === 2 || y === 4)) || (inside(y, 2, 4) && (lx === 2 || lx === 4)) ? "a" : y === 0 ? "t" : "b",
);
const sandBlock = blocks((lx, y, bx) => (y === 0 ? "t" : speck(lx, y, bx)));
const plankBlock = blocks((lx, y, bx) => {
  if (y === 3) return "a";
  const seam = y < 3 ? (bx % 2 ? 3 : 5) : bx % 2 ? 1 : 4;
  return lx === seam ? "a" : y === 0 ? "t" : "b";
});

// ── 과자 나라 ──

/** 분홍 아이싱이 흘러내린 판 초콜릿 */
const chocolate: Shape = (x, y) => {
  if (x === 0 || x === 31) return inside(y, 1, 5) ? "e" : ".";
  if (y <= 1) return "t";
  if (y === 2) return x % 5 === 1 || x % 5 === 2 ? "t" : x % 8 === 0 ? "e" : "b";
  if (y === 6) return "e";
  if (y === 7) return ".";
  if (x % 8 === 0 || y === 4) return "e";
  return x % 8 === 1 || y === 3 ? "s" : "b";
};
/** 말랑한 젤리 (반짝이 + 기포) */
const jellyBar: Shape = (x, y) => {
  if (y === 0) return inside(x, 3, 28) ? "t" : ".";
  if (y === 1) return inside(x, 1, 30) ? (inside(x, 4, 7) ? "w" : "t") : ".";
  if (y >= 2 && y <= 5) return (x * 5 + y * 7) % 13 === 0 ? "a" : "b";
  if (y === 6) return inside(x, 2, 29) ? "e" : ".";
  return ".";
};
/** 격자무늬 웨하스 */
const wafer: Shape = (x, y) => {
  if (y === 0) return "t";
  if (y === 6) return "e";
  if (y === 7) return ".";
  return x % 4 === 0 || y % 2 === 1 ? "a" : "b";
};
/** 빨강·흰 사선 줄무늬 지팡이 사탕 (끝은 둥글게) */
const cane: Shape = (x, y) => {
  if (y === 0 || y === 7) return ".";
  if ((x === 0 || x === 31) && (y === 1 || y === 6)) return ".";
  if (y === 1) return "t";
  if (y === 6) return "e";
  return (x + y) % 6 < 3 ? "b" : "a";
};

// ── 도시 빌딩 ──

/** 구멍 뚫린 철골(I빔): 위·아래 날개 + 가운데 판(구멍으로 뒤가 보인다) */
const beam: Shape = (x, y) => {
  if (y === 0) return x % 8 === 0 ? "a" : "t";
  if (y === 1 || y === 5) return "s";
  if (y >= 2 && y <= 4) return inside(x % 8, 3, 4) && y === 3 ? "." : "b";
  if (y === 6) return x % 8 === 0 ? "a" : "e";
  return ".";
};
/** 트램펄린: 줄무늬 매트 + 틀 + 다리 */
const trampoline: Shape = (x, y) => {
  if (y === 0) return inside(x, 1, 30) ? (x % 4 < 2 ? "t" : "a") : ".";
  if (y === 1) return "s";
  if (y === 2) return "e";
  if (y >= 3 && y <= 6) return x <= 1 || x >= 30 ? "e" : y === 3 && x % 4 === 2 ? "a" : ".";
  return ".";
};
/** 나무 상자 두 개 (X자 버팀목) */
const crate: Shape = (x, y) => {
  if (y === 7) return ".";
  const l = x % 16;
  if (y === 0) return "t";
  if (y === 6 || l === 0 || l === 15) return "e";
  // 안쪽(1~14칸 × 1~5줄)을 대각선 두 줄이 가로지른다 (두 칸 두께)
  const diag = Math.round(1 + (y - 1) * 3.25);
  const anti = 15 - diag;
  return l === diag || l === diag + 1 || l === anti || l === anti - 1 ? "a" : "b";
};
/** 유리 엘리베이터: 테두리 + 창 */
const elevator: Shape = (x, y) => {
  if (y === 7) return ".";
  if (y === 0) return "t";
  if (y === 6 || x === 0 || x === 31) return "e";
  return inside(x % 8, 2, 5) && inside(y, 2, 4) ? (y === 2 && x % 8 === 2 ? "w" : "a") : "b";
};

// ── 동화 숲 ──

/** 이끼 낀 통나무 (양끝은 나이테가 보이는 단면) */
const log: Shape = (x, y) => {
  if (y === 0) return inside(x, 3, 28) && inside(x % 4, 1, 2) ? "g" : ".";
  if (y === 1) return inside(x, 2, 29) ? "g" : ".";
  if (y === 7) return ".";
  if (y === 6) return inside(x, 2, 29) ? "e" : ".";
  if (x <= 1 || x >= 30) return inside(y, 3, 4) && (x === 1 || x === 30) ? "a" : "w";
  return (x + y * 3) % 7 === 0 ? "a" : "b";
};
/** 흰 점 박힌 버섯 갓 + 짧은 대 */
const mushroom: Shape = (x, y) => {
  if (y === 0) return inside(x, 4, 27) ? "t" : ".";
  if (y === 1) return inside(x, 1, 30) ? "t" : ".";
  if (y === 2 || y === 3) {
    const m = x % 8;
    return (y === 2 && (m === 2 || m === 3)) || (y === 3 && (m === 6 || m === 7)) ? "a" : "b";
  }
  if (y === 4) return "s";
  if (y === 5) return inside(x, 1, 30) ? (x % 2 ? "e" : "s") : ".";
  if (y === 6) return inside(x, 13, 18) ? "w" : ".";
  return ".";
};
/** 나뭇잎 (가운데 잎맥, 양끝이 뾰족) */
const leaf: Shape = (x, y) => {
  const half = [12, 14, 16, 16, 14, 12, 9, -1][y];
  const d = x < 16 ? 16 - x : x - 15;
  if (d > half) return ".";
  if (y === 3) return "a";
  return y <= 2 ? "t" : y === 6 ? "e" : "b";
};
/** 꽃 뗏목: 꽃 네 송이를 잎으로 이었다 */
const flowers: Shape = (x, y) => {
  const m = x % 8;
  if (y === 0) return inside(m, 2, 5) ? "t" : ".";
  if (y >= 1 && y <= 3) return inside(m, 1, 6) ? (inside(m, 3, 4) && y === 2 ? "a" : "b") : y === 3 ? "g" : ".";
  if (y === 4) return inside(m, 2, 5) ? "s" : "g";
  if (y === 5) return m === 0 || m === 7 ? "g" : ".";
  return ".";
};

// ── 겨울 왕국 ──

/** 눈 쌓인 얼음 + 아래 고드름 */
const snowIce: Shape = (x, y) => {
  if (y === 0) return inside(x, 2, 29) && x % 6 !== 0 ? "t" : ".";
  if (y === 1) return inside(x, 1, 30) ? "t" : ".";
  if (y === 2) return x % 5 <= 2 ? "t" : "b";
  if (y === 6) return inside(x, 1, 30) ? "e" : ".";
  if (y === 7) return x % 7 === 3 ? "e" : ".";
  return (x - y * 2 + 40) % 10 === 0 ? "a" : "b";
};
/** 눈꽃 무늬 블록 */
const snowflake: Shape = (x, y) => {
  if (y === 7) return ".";
  if ((x === 0 || x === 31) && (y === 0 || y === 6)) return ".";
  if (y === 0) return "t";
  if (y === 6) return "e";
  const dx = (x % 10) - 5;
  const dy = y - 3;
  const flake = (dx === 0 && Math.abs(dy) <= 2) || (dy === 0 && Math.abs(dx) <= 2) || (Math.abs(dx) === 1 && Math.abs(dy) === 1);
  return flake ? "a" : "b";
};
/** 금 간 얇은 얼음 */
const thinIce: Shape = (x, y) => {
  if (y === 7) return ".";
  if ((x === 0 || x === 31) && y !== 3) return ".";
  if (y === 0) return "t";
  if (y === 6) return "e";
  if (y === 2 + [0, 1, 2, 3, 2, 1][x % 6] && inside(x, 2, 29)) return "a";
  return x % 9 === 4 && y === 1 ? "w" : "b";
};
/** 썰매: 좌석 + 버팀대 + 앞이 말린 날 */
const sled: Shape = (x, y) => {
  if (y === 0) return inside(x, 0, 27) ? "t" : ".";
  if (y === 1 || y === 2) return inside(x, 0, 27) ? (x % 5 === 0 ? "a" : "b") : ".";
  if (y === 3) return x === 4 || x === 5 || x === 20 || x === 21 || x === 31 ? "e" : ".";
  if (y === 4) return x === 4 || x === 5 || x === 20 || x === 21 || x === 30 ? "e" : ".";
  if (y === 5) return inside(x, 1, 30) ? "e" : ".";
  if (y === 6) return inside(x, 2, 28) ? "s" : ".";
  return ".";
};

// ── 벚꽃 마을 ──

/** 아치 돌다리: 아래가 둥글게 뚫렸다 */
const bridge: Shape = (x, y) => {
  if (y === 0) return x % 8 === 0 ? "a" : "t";
  if (y === 1) return "t";
  if (y === 7) return ".";
  const hole = [0, 0, 0, 0, 5, 7, 8][y] ?? 0;
  if (hole && Math.abs(x - 15.5) < hole) return ".";
  return x % 6 === 0 || y === 6 ? "e" : y === 2 ? "s" : "b";
};
/** 종이우산: 살이 보이는 둥근 갓 + 손잡이 */
const umbrella: Shape = (x, y) => {
  if (y === 0) return inside(x, 6, 25) ? "t" : ".";
  if (y === 1) return inside(x, 2, 29) ? (x % 5 === 0 ? "a" : "t") : ".";
  if (y === 2) return x % 5 === 0 ? "a" : "b";
  if (y === 3) return x % 4 < 2 ? "e" : ".";
  if (y >= 4 && y <= 5) return inside(x, 15, 16) ? "w" : ".";
  if (y === 6) return inside(x, 15, 17) ? "w" : ".";
  return ".";
};
/** 꽃잎 세 장 (위 가운데가 살짝 파였다) */
const petals: Shape = (x, y) => {
  const m = x % 11;
  const span = [[3, 7], [1, 9], [0, 10], [0, 10], [1, 9], [3, 7], [-1, -2], [-1, -2]][y];
  if (!inside(m, span[0], span[1])) return ".";
  if (y === 0 && m === 5) return ".";
  if (y <= 1) return "t";
  return y === 5 ? "e" : m === 5 && y <= 3 ? "a" : "b";
};
/** 가로로 긴 종이 연등: 위·아래 덮개 + 세로 살 + 가운데 불빛 */
const paperLantern: Shape = (x, y) => {
  if (y === 0 || y === 7) return inside(x, 3, 28) ? "e" : ".";
  if (y === 1) return inside(x, 1, 30) ? "t" : ".";
  if (y === 6) return inside(x, 1, 30) ? "s" : ".";
  if (x % 4 === 0) return "a";
  return inside(x, 12, 19) && inside(y, 3, 4) ? "w" : "b";
};

// ── 장난감 방 ──

/** 레고 블록: 윗면에 돌기 넷 */
const lego: Shape = (x, y) => {
  const m = x % 8;
  if (y <= 1) return inside(m, 2, 5) ? (y === 0 ? "s" : "t") : ".";
  if (y === 2) return "t";
  if (y === 6) return "e";
  if (y === 7) return ".";
  return x === 0 || x === 31 ? "e" : "b";
};
/** 용수철: 위·아래 판 사이에 코일 넷 */
const spring: Shape = (x, y) => {
  const m = x % 8;
  if (y === 0) return "t";
  if (y === 1 || y === 6) return "e";
  if (y === 7) return ".";
  if (!inside(m, 2, 5)) return ".";
  return y % 2 === 0 || m === 2 || m === 5 ? "a" : ".";
};
/** 알록달록 ABC 블록 넷 (블록마다 색 r·y·g·u, 글자 대신 도트 무늬) */
const abcBlocks: Shape = (x, y) => {
  const m = x % 8;
  if (m === 7 || y === 7) return "e";
  if (y === 0) return "w";
  const glyph = Math.floor(x / 8) % 2 ? inside(m, 2, 4) && (y === 2 || y === 5) : m === 3 && inside(y, 2, 5);
  return glyph ? "e" : "rygu"[Math.floor(x / 8)];
};
/** 장난감 기차: 칸 두 개 + 창문 + 바퀴 */
const train: Shape = (x, y) => {
  const m = x % 16;
  if (y === 0) return inside(m, 2, 13) ? "t" : ".";
  if (y >= 1 && y <= 4) {
    if (y === 4 && (m === 15 || m === 0)) return "e";
    if (!inside(m, 1, 14)) return ".";
    return y === 2 && (inside(m, 3, 5) || inside(m, 9, 11)) ? "w" : "b";
  }
  if (y === 5) return inside(m, 1, 14) ? "e" : ".";
  if (y === 6 || y === 7) return inside(m, 2, 4) || inside(m, 10, 12) ? (y === 6 ? "a" : "e") : ".";
  return ".";
};

// ── 사막 피라미드 ──

/** 사암 벽돌 (줄마다 엇갈린 줄눈) */
const sandstone: Shape = (x, y) => {
  if (y === 0) return "t";
  if (y === 7) return ".";
  if (y === 3 || y === 6) return "e";
  return (y < 3 ? x % 8 === 0 : x % 8 === 4) ? "e" : "b";
};
/** 황금 블록에 새긴 호루스의 눈 */
const goldEye: Shape = (x, y) => {
  const m = x % 16;
  if (y === 0) return "t";
  if (y === 6) return "e";
  if (y === 7) return ".";
  if (x === 0 || x === 31) return "e";
  if (y === 2 && inside(m, 5, 10)) return "a";
  if (y === 3 && (m === 4 || m === 11)) return "a";
  if (y === 3 && inside(m, 7, 8)) return "e";
  if (y === 4 && inside(m, 5, 10)) return "a";
  if (y === 5 && m === 6) return "a";
  return "b";
};
/** 모래 더미: 가운데가 봉긋 */
const sandPile: Shape = (x, y) => {
  const span = [[6, 25], [3, 28], [1, 30], [0, 31], [0, 31], [0, 31], [1, 30], [-1, -2]][y];
  if (!inside(x, span[0], span[1])) return ".";
  if (y <= 1) return "t";
  if (y === 6) return "e";
  return (x * 3 + y * 5) % 7 === 0 ? "a" : "b";
};
/** 마법 양탄자: 테두리 무늬 + 가운데 마름모 + 양끝·아래 술 */
const carpet: Shape = (x, y) => {
  if (y === 0 || y === 7) return ".";
  if (x === 0 || x === 31) return y <= 5 ? "t" : ".";
  if (y === 6) return x % 2 === 0 ? "t" : ".";
  if (y === 1 || y === 5) return x % 3 === 0 ? "a" : "e";
  const d = Math.abs((x % 8) - 3.5) + Math.abs(y - 3);
  return d <= 1.5 ? "a" : "b";
};

export const THEME_PLATFORMS: Record<ThemeId, Platforms> = {
  dot: PLATFORM_PRESETS,
  // 솜사탕: 뭉게구름 (분홍 점 · 민트 하트 · 금 간 바닐라 · 라벤더 물결)
  cotton: {
    basic: art(cloud(dots), { t: "#ffb3cf", s: "#f08cb4", b: "#fff1dc", a: "#f7a8c8", e: "#d0709a" }),
    highJump: art(cloud(heart), { t: "#c8f2df", s: "#7fd6b0", b: "#f0fff8", a: "#ff7aa8", e: "#4fb08a" }),
    oneTime: art(cloud(crack), { t: "#fff3c4", s: "#ecd68a", b: "#fff8e0", a: "#c09848", e: "#c09848" }),
    moving: art(cloud(wave), { t: "#d9ccff", s: "#a99be6", b: "#f3efff", a: "#8070c8", e: "#8070c8" }),
  },
  // 꿈나라: 술 달린 베개 (분홍 베개 · 별 쿠션 · 금 간 달빛 · 물결 하늘빛)
  dream: {
    basic: art(pillow(stitch), { t: "#f5b8e8", s: "#e6a0d8", b: "#fff0fb", a: "#c98ac0", e: "#a86aa0" }),
    highJump: art(pillow(star), { t: "#ffe58a", s: "#f0cf6a", b: "#fff8d6", a: "#e6a82a", e: "#b58a2a" }),
    oneTime: art(pillow(crack), { t: "#e6e2f0", s: "#d6d0e6", b: "#f4f2f8", a: "#8a82a6", e: "#7f7896" }),
    moving: art(pillow(wave), { t: "#bdf0f0", s: "#9fe0e6", b: "#e8ffff", a: "#5fb8c0", e: "#3f98a6" }),
  },
  // 바닷속: 해초 바위 · 가리비 · 판자 · 해파리
  ocean: {
    basic: art(rock, { g: "#3fb89a", t: "#9fb8c9", s: "#7f98ab", b: "#b8c9d6", a: "#8aa0b0", e: "#5f7a8f" }),
    highJump: art(shell, { t: "#ffb3c1", b: "#ffd6de", a: "#ff8fa8", e: "#c85a78" }),
    oneTime: art(plank, { t: "#e0bf94", s: "#c9a070", b: "#d4ae80", a: "#8a6440", e: "#6e4e30" }),
    moving: art(jellyfish, { t: "#e6d8ff", w: "#ffffff", b: "#c9b8ff", s: "#9a86e6", a: "#b49cff" }),
  },
  // 블록 월드: 잔디 블록 · 슬라임 블록 · 모래 · 나무 판자
  blocks: {
    basic: art(grassBlock, { t: "#74c84f", b: "#9b6a43", a: "#7a5232", e: "#5c3d22" }),
    highJump: art(slimeBlock, { t: "#b8f0a8", b: "#8fe07a", a: "#5fb84e", e: "#3f8f3a" }),
    oneTime: art(sandBlock, { t: "#f0e6b4", b: "#e3d59a", a: "#c9b878", e: "#a8985a" }),
    moving: art(plankBlock, { t: "#d4a86c", b: "#b88a52", a: "#8a6236", e: "#6a4826" }),
  },
  // 과자 나라: 아이싱 초콜릿 · 젤리 · 웨하스 · 지팡이 사탕
  candy: {
    basic: art(chocolate, { t: "#ffb3cf", s: "#8f5a42", b: "#7b4a35", e: "#4a2a1e" }),
    highJump: art(jellyBar, { t: "#9fe0ff", w: "#ffffff", b: "#7fd0f5", a: "#d6f3ff", e: "#3f8fb8" }),
    oneTime: art(wafer, { t: "#fadc9b", b: "#f0ca7c", a: "#c9963c", e: "#8f6428" }),
    moving: art(cane, { t: "#ffffff", b: "#ff5a6e", a: "#ffffff", e: "#c23a4e" }),
  },
  // 도시 빌딩: 노란 I빔 · 빨강·흰 트램펄린 · 나무 상자 · 유리 엘리베이터
  city: {
    basic: art(beam, { t: "#ffd84a", s: "#e0b02a", b: "#f2c23a", a: "#3f4656", e: "#8a6a1a" }),
    highJump: art(trampoline, { t: "#ff6f6f", s: "#d94a4a", a: "#ffffff", e: "#2b3040" }),
    oneTime: art(crate, { t: "#e0bc88", b: "#c99a60", a: "#8a6236", e: "#6a4826" }),
    moving: art(elevator, { t: "#9fb4ff", b: "#6f86e0", a: "#d6e0ff", w: "#ffffff", e: "#3f56a8" }),
  },
  // 동화 숲: 이끼 통나무 · 버섯 갓 · 나뭇잎 · 꽃 뗏목
  forest: {
    basic: art(log, { g: "#7fd36a", w: "#e8c99a", b: "#a87a52", a: "#7d5634", e: "#5e3e24" }),
    highJump: art(mushroom, { t: "#ff7d7d", b: "#ff6b6b", a: "#ffffff", s: "#f3e6cf", e: "#c9b48f", w: "#f3e6cf" }),
    oneTime: art(leaf, { t: "#ffd06b", b: "#f0a848", a: "#a8641c", e: "#9a6024" }),
    moving: art(flowers, { t: "#d6e8ff", b: "#9fc4ff", a: "#ffe08a", s: "#6f9ae0", g: "#5fb84e" }),
  },
  // 겨울 왕국: 고드름 달린 눈 얼음 · 분홍 눈꽃 블록 · 금 간 청록 얼음 · 빨간 썰매
  winter: {
    basic: art(snowIce, { t: "#ffffff", b: "#bfe6f7", a: "#ffffff", e: "#5f8fb8" }),
    highJump: art(snowflake, { t: "#ffd6e6", b: "#ffb3cf", a: "#ffffff", e: "#b8577a" }),
    oneTime: art(thinIce, { t: "#c9f3ef", w: "#ffffff", b: "#9fe8e0", a: "#2f7f78", e: "#2f7f78" }),
    moving: art(sled, { t: "#ff8a8a", b: "#e05c5c", a: "#a83a3a", e: "#7a4a2a", s: "#c9d6e6" }),
  },
  // 벚꽃 마을: 아치 돌다리 · 종이우산 · 꽃잎 · 종이 연등
  sakura: {
    basic: art(bridge, { t: "#c9c4bb", s: "#b4afa6", b: "#a9a49b", a: "#7a5a46", e: "#7f7a72" }),
    highJump: art(umbrella, { t: "#ff9ab8", a: "#c94a74", b: "#ffb7cf", e: "#c94a74", w: "#8a5a3c" }),
    oneTime: art(petals, { t: "#ffd6e4", b: "#ffb7cf", a: "#ff8fb3", e: "#e07a9e" }),
    moving: art(paperLantern, { t: "#ff8a5c", s: "#d9603a", b: "#ff7a4a", a: "#c9482a", w: "#ffe08a", e: "#3d2c2c" }),
  },
  // 장난감 방: 레고 블록 · 용수철 · ABC 블록 · 장난감 기차
  toys: {
    basic: art(lego, { t: "#ff6f6f", s: "#ff9a9a", b: "#e85555", e: "#a83a3a" }),
    highJump: art(spring, { t: "#8fc4ff", a: "#9aa3b2", e: "#3f6aa8" }),
    oneTime: art(abcBlocks, { r: "#ff9a9a", y: "#ffe08a", g: "#a8e8a0", u: "#a8d0ff", w: "#ffffff", e: "#6a5a8a" }),
    moving: art(train, { t: "#5c8fe0", b: "#ffd36b", w: "#bfe8ff", e: "#3d2c5e", a: "#e05c5c" }),
  },
  // 사막 피라미드: 사암 벽돌 · 호루스의 눈 황금 블록 · 모래 더미 · 마법 양탄자
  desert: {
    basic: art(sandstone, { t: "#f4d79a", b: "#e0b878", e: "#a87a40" }),
    highJump: art(goldEye, { t: "#fff1a8", b: "#ffd36b", a: "#3f5aa8", e: "#b8862a" }),
    oneTime: art(sandPile, { t: "#fff0c8", b: "#f0d49a", a: "#d9b878", e: "#c9a46a" }),
    moving: art(carpet, { t: "#ffd36b", a: "#ffd36b", e: "#7a2a4a", b: "#c9405e" }),
  },
};

const KINDS: PlatformKind[] = ["basic", "highJump", "oneTime", "moving"];

export function samePixels(a: PixelSprite, b: PixelSprite) {
  return a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);
}

/** 게임에 쓸 발판: 기본 그대로인 종류만 테마 발판으로 바꾼다 */
export function resolvePlatforms(saved: Platforms, theme: ThemeId): Platforms {
  const out = { ...saved };
  for (const k of KINDS) if (samePixels(saved[k], PLATFORM_PRESETS[k])) out[k] = THEME_PLATFORMS[theme][k];
  return out;
}

/** 저장할 발판: 지금 테마의 발판과 똑같으면 "기본"으로 저장해서 테마를 바꾸면 따라 바뀌게 한다 */
export function platformsForSave(edited: Platforms, theme: ThemeId): Platforms {
  const out = { ...edited };
  for (const k of KINDS) if (samePixels(edited[k], THEME_PLATFORMS[theme][k])) out[k] = structuredClone(PLATFORM_PRESETS[k]);
  return out;
}
