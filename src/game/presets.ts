import type { Character, PixelSprite, Platforms } from "../lib/schema";

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

const MALLANG = { o: "#28213a", b: "#ffd36e", p: "#ff8fab", m: "#c02a37", g: "#3fa66b", w: "#ffffff" };

/** 말랑이 내려갈 때: 몸이 한 칸 늘어나고 잎이 날리고 눈이 동그래진다, 다리는 벌린다 */
const HERO_MALLANG_FALL = pixelSprite(
  [
    "................",
    "......g.........",
    "......gg........",
    ".......g........",
    "....oooooooo....",
    "...obbbbbbbbo...",
    "..obbbbbbbbbbo..",
    ".obbbbbbbbbbbbo.",
    ".obooobbbbooobo.",
    ".obowobbbbowobo.",
    ".obooobbbbooobo.",
    ".obpbbbbbbbbpbo.",
    ".obbbbbmmbbbbbo.",
    ".obbbbbmmbbbbbo.",
    "..obbbbbbbbbbo..",
    "...oooooooooo...",
    "..obbo....obbo..",
    "..oooo....oooo..",
  ],
  MALLANG,
);

/** 말랑이 착지: 납작하게 눌리고 눈은 ^ ^, 입은 활짝 */
const HERO_MALLANG_LAND = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......gg........",
    "...oooooooooo...",
    "..obbbbbbbbbbo..",
    ".obbbbbbbbbbbbo.",
    ".obbobbbbbbobbo.",
    ".obobobbbbobobo.",
    ".obpbbmmmmbbpbo.",
    ".obbbbbbbbbbbbo.",
    ".obbbbbbbbbbbbo.",
    "..oooooooooooo..",
    ".obbbo....obbbo.",
    ".ooooo....ooooo.",
  ],
  MALLANG,
);

const INK = "#3d2c5e";

/** 토끼 "토리" */
const TORI = { o: INK, w: "#ffffff", p: "#ffb3cf", c: "#ff9cc6" };
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
  TORI,
);

const HERO_TORI_FALL = pixelSprite(
  [
    "................",
    "....oo....oo....",
    "...owwo..owwo...",
    "...owpo..owpo...",
    "...owpo..owpo...",
    "...owpo..owpo...",
    "...owwoooowwo...",
    "..owwwwwwwwwwo..",
    ".owwwwwwwwwwwwo.",
    ".owooowwwwooowo.",
    ".owowowwwwowowo.",
    ".owooowwwwooowo.",
    ".owcwwwwwwwwcwo.",
    ".owwwwwppwwwwwo.",
    "..owwwwwwwwwwo..",
    "...oooooooooo...",
    "..owwo....owwo..",
    "..oooo....oooo..",
  ],
  TORI,
);

const HERO_TORI_LAND = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "...oo......oo...",
    "..owwo....owwo..",
    "..owwoooooowwo..",
    ".owwwwwwwwwwwwo.",
    ".owwwwwwwwwwwwo.",
    ".owwowwwwwwowwo.",
    ".owowowwwwowowo.",
    ".owcwwppppwwcwo.",
    ".owwwwwwwwwwwwo.",
    ".owwwwwwwwwwwwo.",
    "..oooooooooooo..",
    ".owwwo....owwwo.",
    ".ooooo....ooooo.",
  ],
  TORI,
);

/** 고양이 "나비" */
const NABI = { o: INK, b: "#ffc48a", s: "#f09a55", w: "#fffaf0", p: "#ff9cc6" };
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
  NABI,
);

const HERO_NABI_FALL = pixelSprite(
  [
    "................",
    "................",
    "..oo........oo..",
    "..obo......obo..",
    "..obo......obo..",
    "..obboooooobbo..",
    ".obbbssbbssbbbo.",
    ".obbbbbbbbbbbbo.",
    ".obooobbbbooobo.",
    ".obowobbbbowobo.",
    ".obooobbbbooobo.",
    ".obpbwwwwwwbpbo.",
    ".obbbwwoowwbbbo.",
    ".obbbbwoowbbbbo.",
    "..obbbbbbbbbbo..",
    "...oooooooooo...",
    "..obbo....obbo..",
    "..oooo....oooo..",
  ],
  NABI,
);

const HERO_NABI_LAND = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..oo........oo..",
    "..obboooooobbo..",
    ".obbbssbbssbbbo.",
    ".obbbbbbbbbbbbo.",
    ".obbobbbbbbobbo.",
    ".obobobbbbobobo.",
    ".obpbwwwwwwbpbo.",
    ".obbbwoooowbbbo.",
    ".obbbbbbbbbbbbo.",
    "..oooooooooooo..",
    ".obbbo....obbbo.",
    ".ooooo....ooooo.",
  ],
  NABI,
);

/** 개구리 "개굴" */
const GAEGUL = { o: INK, w: "#ffffff", g: "#9ee6a0", p: "#ff9cc6", l: "#dcf7d2" };
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
  GAEGUL,
);

const HERO_GAEGUL_FALL = pixelSprite(
  [
    "................",
    "................",
    "................",
    "...ooo....ooo...",
    "..owwwo..owwwo..",
    "..owowo..owowo..",
    "..owwwo..owwwo..",
    "..owwwoooowwwo..",
    ".oggggggggggggo.",
    ".ogpggggggggpgo.",
    ".ogggggoogggggo.",
    ".ogggggoogggggo.",
    ".oggggggggggggo.",
    ".oggllllllllggo.",
    "..oggllllllggo..",
    "...oooooooooo...",
    ".oggo......oggo.",
    ".oooo......oooo.",
  ],
  GAEGUL,
);

const HERO_GAEGUL_LAND = pixelSprite(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "...ooo....ooo...",
    "..owwwo..owwwo..",
    "..oooooooooooo..",
    ".oggggggggggggo.",
    ".ogpggggggggpgo.",
    ".oggoggggggoggo.",
    ".ogggoooooogggo.",
    ".oggllllllllggo.",
    ".oggllllllllggo.",
    "..oooooooooooo..",
    ".oggo......oggo.",
    ".oooo......oooo.",
  ],
  GAEGUL,
);

/** 기본 캐릭터: 늘 세 모습(기본·내려갈 때·착지)이 다 있다. sprite는 기본 모습(목록 미리보기용) */
export type CharacterPreset = { id: string; name: string; sprite: PixelSprite; character: Character };

const preset = (id: string, name: string, base: PixelSprite, fall: PixelSprite, land: PixelSprite): CharacterPreset => ({
  id,
  name,
  sprite: base,
  character: { base, fall, land },
});

/** 기본 캐릭터 세트 (첫 번째가 처음 주인공). 주인공·동료 모두 여기서 고를 수 있다 */
export const CHARACTER_PRESETS: readonly CharacterPreset[] = [
  preset("mallang", "말랑이", HERO_MALLANG, HERO_MALLANG_FALL, HERO_MALLANG_LAND),
  preset("tori", "토리", HERO_TORI, HERO_TORI_FALL, HERO_TORI_LAND),
  preset("nabi", "나비", HERO_NABI, HERO_NABI_FALL, HERO_NABI_LAND),
  preset("gaegul", "개굴", HERO_GAEGUL, HERO_GAEGUL_FALL, HERO_GAEGUL_LAND),
];

/**
 * 손대지 않은 기본 캐릭터(기본 모습만 있음)면 그 캐릭터의 내려갈 때·착지 모습을 채운다.
 * 세 모습이 생기기 전에 저장된 데이터·파일을 바꿀 때 쓴다 (migrate.ts v1→v2).
 */
export function withPresetPoses(c: Character): Character {
  if (c.fall || c.land || c.base.kind !== "pixel") return c;
  const key = c.base.pixels.join(",");
  const hit = CHARACTER_PRESETS.find((p) => p.sprite.width === c.base.width && p.sprite.pixels.join(",") === key);
  return hit ? { ...c, fall: hit.character.fall, land: hit.character.land } : c;
}

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
  // 움직이는: 하늘색 + 두 칸씩 끊긴 줄무늬 (바퀴 자국 느낌)
  moving: platformSprite("bbaabb".repeat(5), {
    t: "#9fd8ff",
    s: "#5aa9e6",
    b: "#e3f3ff",
    a: "#4f8fd0",
    e: "#3f6fa8",
  }),
};

/** 처음 팔레트: 프리셋에 쓰인 색 위주로 8개 */
export const DEFAULT_PALETTE = ["#28213a", "#ffffff", "#ffd36e", "#ff8fab", "#c02a37", "#3fa66b", "#7cc98f", "#a47b52"];

/** 그림이 없는 동료 슬롯·후보의 모습: 물음표 방울 (기획서 4-3 "슬롯이 비어 있으면 ?") */
export const COMPANION_QUESTION = pixelSprite(
  [
    "................",
    "................",
    "................",
    ".....oooooo.....",
    "...oowwwwwwoo...",
    "..owwwwqqwwwwo..",
    ".owwwwqwwqwwwwo.",
    ".owwwwwwwqwwwwo.",
    ".owwwwwwqwwwwwo.",
    ".owwwwwqwwwwwwo.",
    ".owwwwwqwwwwwwo.",
    ".owwwwwwwwwwwwo.",
    ".owwwwwqwwwwwwo.",
    "..owwwwwwwwwwo..",
    "...oowwwwwwoo...",
    ".....oooooo.....",
    "................",
    "................",
  ],
  { o: INK, w: "#efe8ff", q: "#b0306a" },
);
