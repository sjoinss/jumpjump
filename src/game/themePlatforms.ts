import type { PixelSprite, PlatformKind, Platforms } from "../lib/schema";
import { PLATFORM_PRESETS, platformSprite } from "./presets";
import type { ThemeId } from "./themes";

/**
 * 테마별 기본 발판 (사용자 요청 2026-10-02: 발판이 테마와 동떨어져 보이지 않게).
 * 규칙: 저장된 발판이 "기본 발판"(PLATFORM_PRESETS) 그대로면 → 지금 테마의 발판으로 보여준다.
 *       직접 그린 발판은 어느 테마에서나 그대로.
 * 그래서 테마 발판을 따로 저장하지 않는다. 에디터에서 테마 발판과 똑같이 완료하면 다시 "기본"(= 테마를 따라감)으로 저장한다.
 * 틀은 모두 같은 32×8 (윗면 t · 윗면 그림자 s · 몸통 b · 무늬 a · 테두리 e), 종류 구분은 색 + 무늬.
 */

const DOTS = "bbab".repeat(7) + "bb";
const FINE = "bab".repeat(10);
const CRACK = "bbaab".repeat(6);
const DASH = "bbaabb".repeat(5);
const STRIPE = "bbaa".repeat(7) + "bb";

type Legend = { t: string; s: string; b: string; a: string; e: string };
const set = (basic: Legend, highJump: Legend, oneTime: Legend, moving: Legend, movingPattern = DASH): Platforms => ({
  basic: platformSprite(DOTS, basic),
  highJump: platformSprite(FINE, highJump),
  oneTime: platformSprite(CRACK, oneTime),
  moving: platformSprite(movingPattern, moving),
});

export const THEME_PLATFORMS: Record<ThemeId, Platforms> = {
  dot: PLATFORM_PRESETS,
  // 솜사탕: 분홍 크림 · 민트 · 바닐라 · 라벤더
  cotton: set(
    { t: "#ffd1e3", s: "#f3a0c2", b: "#fff1dc", a: "#f7c9a8", e: "#e090b4" },
    { t: "#c8f2df", s: "#7fd6b0", b: "#f0fff8", a: "#7fd6b0", e: "#4fb08a" },
    { t: "#fff3c4", s: "#ecd68a", b: "#fff8e0", a: "#d9b86a", e: "#c09848" },
    { t: "#d9ccff", s: "#a99be6", b: "#f3efff", a: "#a99be6", e: "#8070c8" },
  ),
  // 꿈나라: 라벤더 베개 · 노란 별 · 희미한 달빛(사라짐) · 하늘빛
  dream: set(
    { t: "#cfc1ff", s: "#9d8ee6", b: "#eee6ff", a: "#c9bdf5", e: "#7d6fcc" },
    { t: "#ffe58a", s: "#e6b84a", b: "#fff8d6", a: "#e6b84a", e: "#b58a2a" },
    { t: "#e6e2f0", s: "#bdb6d0", b: "#f4f2f8", a: "#9a92b0", e: "#7f7896" },
    { t: "#bdf0f0", s: "#7fd0d6", b: "#e8ffff", a: "#5fb8c0", e: "#3f98a6" },
  ),
  // 바닷속: 해초 덮인 모래 · 산호 · 떠내려온 나무 · 해파리
  ocean: set(
    { t: "#6fd0b0", s: "#3fa88c", b: "#f6e3b4", a: "#e0c08a", e: "#b8935a" },
    { t: "#ff9fb3", s: "#e5708c", b: "#ffe6ec", a: "#ff7a98", e: "#b84a64" },
    { t: "#d8b48a", s: "#b08a5e", b: "#c9a070", a: "#8a6440", e: "#6e4e30" },
    { t: "#c9b8ff", s: "#9a86e6", b: "#efe8ff", a: "#b49cff", e: "#6f5bc0" },
  ),
  // 블록 월드: 잔디 블록 · 슬라임 블록 · 모래 · 나무 판자
  blocks: set(
    { t: "#74c84f", s: "#4fa83a", b: "#9b6a43", a: "#7a5232", e: "#5c3d22" },
    { t: "#8fe07a", s: "#5fb84e", b: "#b8f0a8", a: "#6fcf5f", e: "#3f8f3a" },
    { t: "#e8dca0", s: "#cdbd78", b: "#e3d59a", a: "#b8a868", e: "#8f8048" },
    { t: "#c99a5e", s: "#a87a44", b: "#b88a52", a: "#8a6236", e: "#6a4826" },
  ),
  // 과자 나라: 분홍 아이싱 초콜릿 · 젤리 · 웨하스 · 지팡이 사탕(빨강·흰 줄무늬)
  candy: set(
    { t: "#ffb3cf", s: "#f78fb5", b: "#7b4a35", a: "#5e3626", e: "#4a2a1e" },
    { t: "#9fe0ff", s: "#5fb8e0", b: "#d6f3ff", a: "#ffffff", e: "#3f8fb8" },
    { t: "#f6d38b", s: "#d9a95a", b: "#f0ca7c", a: "#b8853c", e: "#8f6428" },
    { t: "#ffffff", s: "#ffd0d6", b: "#ff5a6e", a: "#ffffff", e: "#c23a4e" },
    STRIPE,
  ),
  // 도시 빌딩: 철골(노란 볼트) · 주황 트램펄린 · 나무 비계 · 파란 유리 엘리베이터
  city: set(
    { t: "#c3cad6", s: "#8c96a8", b: "#9aa3b2", a: "#ffd84a", e: "#5d6270" },
    { t: "#ffb26b", s: "#e0883a", b: "#3f4656", a: "#ffd84a", e: "#2b3040" },
    { t: "#d9b07a", s: "#b88a50", b: "#c99a60", a: "#8a6236", e: "#6a4826" },
    { t: "#9fb4ff", s: "#6f86e0", b: "#d6e0ff", a: "#6f86e0", e: "#3f56a8" },
  ),
  // 동화 숲: 풀 덮인 통나무 · 빨간 버섯 갓(흰 점) · 마른 잎 · 연잎
  forest: set(
    { t: "#8fd18a", s: "#5fae5a", b: "#a87a52", a: "#7d5634", e: "#5e3e24" },
    { t: "#ff7d7d", s: "#e05a5a", b: "#ff9a9a", a: "#ffffff", e: "#a83a3a" },
    { t: "#ffc06b", s: "#e09a3a", b: "#f5d6a0", a: "#c9853a", e: "#9a6024" },
    { t: "#7fd36a", s: "#4fa83a", b: "#bff0a8", a: "#5fb84e", e: "#2f7a2a" },
  ),
  // 겨울 왕국: 눈 쌓인 얼음 · 분홍 눈꽃 · 금 간 얇은 얼음 · 빨간 썰매
  winter: set(
    { t: "#ffffff", s: "#d8e6f5", b: "#bfe6f7", a: "#8cc8e8", e: "#5f8fb8" },
    { t: "#ffc6dc", s: "#f39ab9", b: "#ffeef5", a: "#f39ab9", e: "#b8577a" },
    { t: "#e6f7ff", s: "#b8dcef", b: "#d4eefb", a: "#7fb4d6", e: "#5f8fb0" },
    { t: "#ff8a8a", s: "#d95c5c", b: "#c9945e", a: "#a06a3a", e: "#7a4a2a" },
  ),
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
