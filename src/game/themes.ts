import { CONFIG } from "./config";
import type { BackgroundState } from "./background";
import type { RegionStop } from "./regions";
import type { TileSet } from "./tiles";
import { BLOCK_TILES } from "./tilesets/blocks";
import { CANDY_DECOR, CANDY_TILES } from "./tilesets/candy";

/**
 * 테마 목록. UI 색은 styles/tokens.css의 [data-theme]에, 게임 장면 색은 여기 SCENE에 둔다.
 * 테마를 추가할 때는 두 곳 + THEME_IDS에 같은 id로 넣는다.
 */
export const THEME_IDS = ["dot", "cotton", "dream", "ocean", "blocks", "candy"] as const;
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
  ocean: {
    id: "ocean",
    name: "바닷속",
    description: "푸른 바다 밑에서 출발해 수면 위로, 하늘과 우주까지.",
    swatches: ["#d6eeff", "#7fd3f0", "#a6eadb", "#2b5c8f"],
  },
  blocks: {
    id: "blocks",
    name: "블록 월드",
    description: "네모난 블록 세상의 단면. 네더에서 동굴, 지상, 하늘, 우주로.",
    swatches: ["#e4efd9", "#8fd16a", "#c9a27a", "#3b3b3b"],
  },
  candy: {
    id: "candy",
    name: "과자 나라",
    description: "초코 동굴에서 케이크를 뚫고 솜사탕 구름, 사탕 우주까지.",
    swatches: ["#fff0f6", "#ff8fbf", "#9fe0ff", "#6b4430"],
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

/** 지역마다 그리는 장식 종류 (background.ts) */
export type RegionKey = string;

/** 테마 전용 장식 (지역 키마다). 기본 장식(동굴 벽·구름·새·별) 대신 그린다 */
export type DecorFn = (ctx: CanvasRenderingContext2D, p: ScenePalette, w: number, h: number, s: BackgroundState) => void;

/** 테마의 지역 한 칸: 이름·시작 높이 + 하늘(위 → 아래 계단식 띠) 색 + 장식 종류 */
export type SceneRegion = RegionStop & { key: RegionKey; top: string; bottom: string };

/**
 * 배경 방식
 * - classic: 지역 색이 섞이며 바뀌고 장식(동굴 벽·구름·새·별)이 패럴랙스로 흐른다
 * - ocean: 둘째 지역 시작 높이에 실제 수면이 있다. 그 아래는 물(해초·거품·물고기), 위는 하늘
 * - tiles: 세상의 단면 (tiles.ts). 높이마다 타일 재질이 정해져 있고 경계가 실제로 지나간다 — 블록 월드·과자 나라 등
 */
export type SceneStyle = "classic" | "ocean" | "tiles";

/** 게임 캔버스 장면 색. 지역마다 하늘이 다르고 장식 색은 테마 공통 */
export type ScenePalette = {
  style: SceneStyle;
  /** 아래(0m)부터 위로. 첫 칸 startM = 0 */
  regions: SceneRegion[];
  /** style = "tiles"일 때 높이별 타일 */
  tiles?: TileSet;
  /** 지역 키별 전용 장식 */
  decor?: Partial<Record<RegionKey, DecorFn>>;
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

/** 기본 네 지역(동굴·지상·하늘·우주)에 하늘 색만 입힌다 */
function classicRegions(sky: Record<"cave" | "ground" | "sky" | "space", [string, string]>): SceneRegion[] {
  return CONFIG.regions.list.map((r) => ({ key: r.id, name: r.name, startM: r.startM, top: sky[r.id][0], bottom: sky[r.id][1] }));
}

/** 해저 테마: 높이는 기본과 같고(수면 = 지상 시작 높이) 이름만 바다식 */
const OCEAN_STOPS = CONFIG.regions.list.map((r) => r.startM);

/**
 * 우주도 너무 어두워지지 않게 한다: 캐릭터 외곽선(잉크)은 묻혀도 채우기 색과 HUD가 또렷하도록 (기획서 3-5, 13-3).
 */
export const SCENE: Record<ThemeId, ScenePalette> = {
  dot: {
    style: "classic",
    regions: classicRegions({
      cave: ["#cbbdf3", "#efe4fb"],
      ground: ["#bfe3ff", "#fff1d6"],
      sky: ["#9fd3ff", "#dff1ff"],
      space: ["#5d5bb0", "#8f86d8"],
    }),
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
    style: "classic",
    regions: classicRegions({
      cave: ["#f1cfe6", "#ffeef6"],
      ground: ["#d2ecff", "#fff4e6"],
      sky: ["#bfe2ff", "#eef8ff"],
      space: ["#7a6fc2", "#b1a5e6"],
    }),
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
    style: "classic",
    regions: classicRegions({
      cave: ["#a79ee9", "#d6ccf8"],
      ground: ["#b9d5ff", "#ffe2f3"],
      sky: ["#aac9ff", "#e3eeff"],
      space: ["#4a4598", "#7b6fcc"],
    }),
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
  ocean: {
    style: "ocean",
    regions: [
      { key: "seabed", name: "해저", startM: OCEAN_STOPS[0], top: "#86c8ee", bottom: "#4f93d8" },
      { key: "surface", name: "수면", startM: OCEAN_STOPS[1], top: "#bfe6ff", bottom: "#eaf8ff" },
      { key: "sky", name: "하늘", startM: OCEAN_STOPS[2], top: "#8fd0ff", bottom: "#dcf2ff" },
      { key: "space", name: "우주", startM: OCEAN_STOPS[3], top: "#4459b0", bottom: "#7a8fdc" },
    ],
    cloud: "rgba(255,255,255,0.9)",
    sparkle: "#ffffff",
    sparkleCore: "#c9f3ff",
    sparkleDensity: 1,
    accent: "#ff9fb3",
    moon: "#fff4c7",
    ground: {
      top: "#f6e3b4",
      topEdge: "#dcc184",
      highlight: "#fff6dc",
      soil: "#f0d9a6",
      pebble: "#e0c08a",
      flower: "#ff8fa3",
      flowerCore: "#ffffff",
    },
    shadow: "rgba(31,58,95,0.22)",
    cssBackground: "#4f93d8",
  },
  blocks: {
    style: "tiles",
    tiles: BLOCK_TILES,
    regions: [
      { key: "nether", name: "네더", startM: 0, top: "#7d3540", bottom: "#a8505a" },
      { key: "stone", name: "동굴", startM: 150, top: "#6f7180", bottom: "#9496a3" },
      { key: "overworld", name: "지상", startM: 500, top: "#9fd6ff", bottom: "#e4f4ff" },
      { key: "sky", name: "하늘", startM: 1200, top: "#8ccaff", bottom: "#d8efff" },
      { key: "space", name: "우주", startM: 2500, top: "#3f3f7a", bottom: "#6a6aa8" },
    ],
    cloud: "rgba(255,255,255,0.95)",
    sparkle: "#ffffff",
    sparkleCore: "#fff3b0",
    sparkleDensity: 1,
    accent: "#9be37a",
    moon: "#fff4c7",
    ground: {
      top: "#b5464f",
      topEdge: "#7e2c35",
      highlight: "#d46a72",
      soil: "#8f3a43",
      pebble: "#6e2a32",
      flower: "#ffb347",
      flowerCore: "#ffe08a",
    },
    shadow: "rgba(30,20,20,0.25)",
    cssBackground: "#7d3540",
  },
  candy: {
    style: "tiles",
    tiles: CANDY_TILES,
    decor: CANDY_DECOR,
    regions: [
      { key: "choco", name: "초코 동굴", startM: 0, top: "#8a5a45", bottom: "#a8705a" },
      { key: "cake", name: "케이크 층", startM: 300, top: "#ffe3ef", bottom: "#fff4f8" },
      { key: "cotton", name: "솜사탕 구름", startM: 1000, top: "#ffd6ec", bottom: "#e3f1ff" },
      { key: "sweetspace", name: "사탕 우주", startM: 2500, top: "#6b52a8", bottom: "#9a7fd0" },
    ],
    cloud: "rgba(255,255,255,0.95)",
    sparkle: "#ffffff",
    sparkleCore: "#ffd84a",
    sparkleDensity: 1,
    accent: "#ffb3cf",
    moon: "#fff4c7",
    ground: {
      top: "#8b5a3c",
      topEdge: "#6b4430",
      highlight: "#a8735a",
      soil: "#7b4a35",
      pebble: "#5e3626",
      flower: "#ff8fb8",
      flowerCore: "#fff6e8",
    },
    shadow: "rgba(74,44,34,0.25)",
    cssBackground: "#8a5a45",
  },
};
