import type { RegionId } from "./regions";

/**
 * 테마 목록. UI 색은 styles/tokens.css의 [data-theme]에, 게임 장면 색은 여기 SCENE에 둔다.
 * 테마를 추가할 때는 두 곳 + THEME_IDS에 같은 id로 넣는다.
 */
export const THEME_IDS = ["dot", "cotton", "dream"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "dot";

export type ThemeInfo = {
  id: ThemeId;
  name: string;
  description: string;
  /** 설정 화면 미리보기용 색 (배경, 채우기 2개, 외곽선) */
  swatches: [string, string, string, string];
};

export const THEMES: Record<ThemeId, ThemeInfo> = {
  dot: {
    id: "dot",
    name: "도트 놀이터",
    description: "진한 외곽선과 톡톡 눌리는 버튼. 기본 테마예요.",
    swatches: ["#dcd0fb", "#ff9cc6", "#ffe39a", "#3d2c5e"],
  },
  cotton: {
    id: "cotton",
    name: "솜사탕",
    description: "연한 분홍 외곽선에 폭신하고 둥근 파스텔.",
    swatches: ["#ffe9f3", "#ffc2da", "#c8f2df", "#e7a3c2"],
  },
  dream: {
    id: "dream",
    name: "꿈나라",
    description: "라벤더와 하늘빛, 별이 반짝이는 몽환적인 밤하늘.",
    swatches: ["#c9c0f7", "#f5b8e8", "#bdf0f0", "#9d8ee6"],
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

/** 지역 하나의 하늘 (위 → 아래 계단식 띠) */
export type RegionSky = { top: string; bottom: string };

/** 게임 캔버스 장면 색. 지역(동굴·지상·하늘·우주)마다 하늘이 다르고 장식 색은 테마 공통 */
export type ScenePalette = {
  regions: Record<RegionId, RegionSky>;
  cloud: string;
  sparkle: string;
  sparkleCore: string;
  /** 반짝이 개수 배율 (꿈나라는 별이 많다) */
  sparkleDensity: number;
  /** 동굴 수정·우주 행성 같은 포인트 장식 색 */
  accent: string;
  moon: string;
  ground: {
    top: string;
    topEdge: string;
    highlight: string;
    soil: string;
    pebble: string;
    flower: string;
    flowerCore: string;
  };
  /** 캐릭터 그림자 */
  shadow: string;
  /** 캔버스 뒤 CSS 배경 (캔버스가 그려지기 전 잠깐 보인다) = 동굴 하늘 윗색 */
  cssBackground: string;
};

/**
 * 우주도 너무 어두워지지 않게 한다: 캐릭터 외곽선(잉크)은 묻혀도 채우기 색과 HUD가 또렷하도록 (기획서 3-5, 13-3).
 */
export const SCENE: Record<ThemeId, ScenePalette> = {
  dot: {
    regions: {
      cave: { top: "#cbbdf3", bottom: "#efe4fb" },
      ground: { top: "#bfe3ff", bottom: "#fff1d6" },
      sky: { top: "#9fd3ff", bottom: "#dff1ff" },
      space: { top: "#5d5bb0", bottom: "#8f86d8" },
    },
    cloud: "rgba(255,255,255,0.85)",
    sparkle: "#ffffff",
    sparkleCore: "#fff3b0",
    sparkleDensity: 1,
    accent: "#ffb3d9",
    moon: "#fff4c7",
    ground: {
      top: "#a8e6c8",
      topEdge: "#6cc59a",
      highlight: "#d6f5e4",
      soil: "#f6dcc0",
      pebble: "#e8c29c",
      flower: "#ff9cc6",
      flowerCore: "#fff3b0",
    },
    shadow: "rgba(61,44,94,0.18)",
    cssBackground: "#cbbdf3",
  },
  cotton: {
    regions: {
      cave: { top: "#f1cfe6", bottom: "#ffeef6" },
      ground: { top: "#d2ecff", bottom: "#fff4e6" },
      sky: { top: "#bfe2ff", bottom: "#eef8ff" },
      space: { top: "#7a6fc2", bottom: "#b1a5e6" },
    },
    cloud: "rgba(255,255,255,0.95)",
    sparkle: "#ffffff",
    sparkleCore: "#ffc2da",
    sparkleDensity: 0.8,
    accent: "#ffc2da",
    moon: "#fff6d8",
    ground: {
      top: "#ffd1e3",
      topEdge: "#f3a0c2",
      highlight: "#fff0f6",
      soil: "#fff1dc",
      pebble: "#f7dcc0",
      flower: "#c8f2df",
      flowerCore: "#ffffff",
    },
    shadow: "rgba(231,163,194,0.35)",
    cssBackground: "#f1cfe6",
  },
  dream: {
    regions: {
      cave: { top: "#a79ee9", bottom: "#d6ccf8" },
      ground: { top: "#b9d5ff", bottom: "#ffe2f3" },
      sky: { top: "#aac9ff", bottom: "#e3eeff" },
      space: { top: "#4a4598", bottom: "#7b6fcc" },
    },
    cloud: "rgba(245,240,255,0.75)",
    sparkle: "#fff8d6",
    sparkleCore: "#ffffff",
    sparkleDensity: 2,
    accent: "#f5b8e8",
    moon: "#fff4c7",
    ground: {
      top: "#cfc1ff",
      topEdge: "#9d8ee6",
      highlight: "#ece6ff",
      soil: "#eee6ff",
      pebble: "#dccff9",
      flower: "#f5b8e8",
      flowerCore: "#fff8d6",
    },
    shadow: "rgba(51,41,92,0.22)",
    cssBackground: "#a79ee9",
  },
};
