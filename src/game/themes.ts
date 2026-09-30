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

/** 게임 캔버스 장면 색 */
export type ScenePalette = {
  skyTop: string;
  skyBottom: string;
  cloud: string;
  sparkle: string;
  sparkleCore: string;
  /** 반짝이 개수 배율 (꿈나라는 별이 많다) */
  sparkleDensity: number;
  moon: string | null;
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
  /** 캔버스 뒤 CSS 배경 (캔버스가 그려지기 전 잠깐 보인다) */
  cssBackground: string;
};

export const SCENE: Record<ThemeId, ScenePalette> = {
  dot: {
    skyTop: "#dcd0fb",
    skyBottom: "#ffe6f1",
    cloud: "rgba(255,255,255,0.85)",
    sparkle: "#ffffff",
    sparkleCore: "#fff3b0",
    sparkleDensity: 1,
    moon: null,
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
    cssBackground: "#dcd0fb",
  },
  cotton: {
    skyTop: "#ffe0ee",
    skyBottom: "#fff6e6",
    cloud: "rgba(255,255,255,0.95)",
    sparkle: "#ffffff",
    sparkleCore: "#ffc2da",
    sparkleDensity: 0.8,
    moon: null,
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
    cssBackground: "#ffe0ee",
  },
  dream: {
    skyTop: "#a9a2ec",
    skyBottom: "#ffd9ef",
    cloud: "rgba(245,240,255,0.7)",
    sparkle: "#fff8d6",
    sparkleCore: "#ffffff",
    sparkleDensity: 2,
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
    cssBackground: "#a9a2ec",
  },
};
