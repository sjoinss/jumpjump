import type { PixelSprite, Platforms } from "../lib/schema";

/**
 * 기본 제공 세트. 행 문자열 + 색 범례로 적고 pixelSprite()로 변환한다.
 * "." 은 투명. 3단계(에디터)에서 캐릭터 3~5종과 발판 3종을 채운다.
 */
type Legend = Record<string, string>;

export function pixelSprite(rows: readonly string[], legend: Legend): PixelSprite {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const pixels: string[] = [];
  for (const row of rows) {
    if (row.length !== width) throw new Error(`preset row width mismatch: "${row}"`);
    for (const ch of row) pixels.push(ch === "." ? "" : (legend[ch] ?? ""));
  }
  return { kind: "pixel", width, height, pixels };
}

/** 앱 아이콘에도 쓰는 대표 캐릭터 "말랑이" (16×18) */
export const HERO_MALLANG = pixelSprite(
  [
    "................",
    "................",
    "................",
    "......gg........",
    ".......g........",
    "....oooooooo....",
    "...obbbbbbbbo...",
    "..obbbbbbbbbbo..",
    ".obbbbbbbbbbbbo.",
    ".obbobbbbbbobbo.",
    ".obbobbbbbbobbo.",
    ".obbbbbbbbbbbbo.",
    ".obpbbbmmbbbpbo.",
    ".obbbbbbbbbbbbo.",
    "..obbbbbbbbbbo..",
    "...oooooooooo...",
    "...obbo..obbo...",
    "...oooo..oooo...",
  ],
  { o: "#28213a", b: "#ffd36e", p: "#ff8fab", m: "#c02a37", g: "#3fa66b" },
);

const INK = "#3d2c5e";

/** 토끼 "토리" */
const HERO_TORI = pixelSprite(
  [
    "................",
    "................",
    "................",
    "....oo....oo....",
    "...owwo..owwo...",
    "...owpo..owpo...",
    "...owpo..owpo...",
    "...owwoooowwo...",
    "..owwwwwwwwwwo..",
    ".owwwwwwwwwwwwo.",
    ".owwowwwwwwowwo.",
    ".owwowwwwwwowwo.",
    ".owcwwwppwwwcwo.",
    ".owwwwwwwwwwwwo.",
    "..owwwwwwwwwwo..",
    "...oooooooooo...",
    "...owwo..owwo...",
    "...oooo..oooo...",
  ],
  { o: INK, w: "#ffffff", p: "#ffb3cf", c: "#ff9cc6" },
);

/** 고양이 "나비" */
const HERO_NABI = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "..oo........oo..",
    "..obo......obo..",
    "..obboooooobbo..",
    ".obbbssbbssbbbo.",
    ".obbbbbbbbbbbbo.",
    ".obbobbbbbbobbo.",
    ".obbobbbbbbobbo.",
    ".obpbwwwwwwbpbo.",
    ".obbbwwoowwbbbo.",
    ".obbbbbbbbbbbbo.",
    "..obbbbbbbbbbo..",
    "...oooooooooo...",
    "...obbo..obbo...",
    "...oooo..oooo...",
  ],
  { o: INK, b: "#ffc48a", s: "#f09a55", w: "#fffaf0", p: "#ff9cc6" },
);

/** 개구리 "개굴" */
const HERO_GAEGUL = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "...ooo....ooo...",
    "..owwwo..owwwo..",
    "..owowo..owowo..",
    "..owwwoooowwwo..",
    ".oggggggggggggo.",
    ".ogpggggggggpgo.",
    ".ogggoooooogggo.",
    ".oggggggggggggo.",
    ".oggllllllllggo.",
    "..oggllllllggo..",
    "...oooooooooo...",
    "..oggo....oggo..",
    "..oooo....oooo..",
  ],
  { o: INK, w: "#ffffff", g: "#9ee6a0", p: "#ff9cc6", l: "#dcf7d2" },
);

export type CharacterPreset = { id: string; name: string; sprite: PixelSprite };

/** 기본 캐릭터 세트 (첫 번째가 처음 주인공) */
export const CHARACTER_PRESETS: readonly CharacterPreset[] = [
  { id: "mallang", name: "말랑이", sprite: HERO_MALLANG },
  { id: "tori", name: "토리", sprite: HERO_TORI },
  { id: "nabi", name: "나비", sprite: HERO_NABI },
  { id: "gaegul", name: "개굴", sprite: HERO_GAEGUL },
];

/**
 * 발판 32×8. 윗면(t) · 윗면 그림자(s) · 몸통(b) · 무늬(a) · 테두리(e) 다섯 색으로 같은 틀을 쓴다.
 * 종류 구분은 색 + 무늬로 하고, 색약 대응 표식은 8단계에서 게임 화면 위에 따로 겹친다.
 */
function platformSprite(pattern: string, legend: Record<string, string>): PixelSprite {
  return pixelSprite(
    [
      ".." + "t".repeat(28) + "..",
      "." + "t".repeat(30) + ".",
      "s".repeat(32),
      "e" + "b".repeat(30) + "e",
      "e" + pattern + "e",
      "." + "b".repeat(30) + ".",
      ".." + "e".repeat(28) + "..",
      "................................",
    ],
    legend,
  );
}

export const PLATFORM_PRESETS: Platforms = {
  // 풀밭 흙 발판: 몸통에 돌 무늬
  basic: platformSprite("bbab".repeat(7) + "bb", {
    t: "#7cc98f",
    s: "#3fa66b",
    b: "#a47b52",
    a: "#7d5a3a",
    e: "#5c4128",
  }),
  // 고점프: 분홍 윗면 + 촘촘한 점 무늬
  highJump: platformSprite("bab".repeat(10), {
    t: "#ff8fab",
    s: "#e05f84",
    b: "#fff0f4",
    a: "#e05f84",
    e: "#a8405f",
  }),
  // 일회용: 모래색 + 금 간 무늬
  oneTime: platformSprite("bbaab".repeat(6), {
    t: "#f3dca6",
    s: "#d8b874",
    b: "#e9cf94",
    a: "#9c7a3c",
    e: "#8a6a30",
  }),
};

/** 처음 팔레트: 프리셋에 쓰인 색 위주로 8개 */
export const DEFAULT_PALETTE = ["#28213a", "#ffffff", "#ffd36e", "#ff8fab", "#c02a37", "#3fa66b", "#7cc98f", "#a47b52"];
