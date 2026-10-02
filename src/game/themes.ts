import { CONFIG } from "./config";
import { DREAM_DECOR } from "./dream";
import type { BackgroundState } from "./background";
import type { RegionStop } from "./regions";
import type { TileSet } from "./tiles";
import { BLOCK_DECOR, BLOCK_TILES } from "./tilesets/blocks";
import { CANDY_DECOR, CANDY_TILES } from "./tilesets/candy";
import { CITY_DECOR, CITY_TILES } from "./tilesets/city";
import { FOREST_DECOR, FOREST_TILES } from "./tilesets/forest";
import { WINTER_DECOR, WINTER_TILES } from "./tilesets/winter";

/**
 * 테마 목록. UI 색은 styles/tokens.css의 [data-theme]에, 게임 장면 색은 여기 SCENE에 둔다.
 * 테마를 추가할 때는 두 곳 + THEME_IDS에 같은 id로 넣는다.
 */
export const THEME_IDS = ["dot", "cotton", "dream", "ocean", "blocks", "candy", "city", "forest", "winter"] as const;
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
    description: "잠든 방에서 양을 세며 무지개 구름을 지나 은하수까지.",
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
    description: "네모난 블록 세상의 단면. 네더에서 동굴, 지상, 하늘, 우주, 엔더 월드까지.",
    swatches: ["#e4efd9", "#8fd16a", "#c9a27a", "#3b3b3b"],
  },
  candy: {
    id: "candy",
    name: "과자 나라",
    description: "초코 동굴에서 케이크를 뚫고 솜사탕 구름, 사탕 우주까지.",
    swatches: ["#fff0f6", "#ff8fbf", "#9fe0ff", "#6b4430"],
  },
  city: {
    id: "city",
    name: "도시 빌딩",
    description: "지하철역에서 거리로, 빌딩 숲을 지나 옥상과 밤하늘까지.",
    swatches: ["#eef1f8", "#ffb26b", "#9fb4ff", "#2f3d5c"],
  },
  forest: {
    id: "forest",
    name: "동화 숲",
    description: "토끼 굴에서 버섯 숲으로, 나무 위 마을을 지나 콩나무 타고 구름 위 성까지.",
    swatches: ["#f1f8e8", "#8fd18a", "#ff9a8a", "#3d4a2f"],
  },
  winter: {
    id: "winter",
    name: "겨울 왕국",
    description: "얼음 동굴에서 눈 마을로, 설산 꼭대기를 넘어 오로라까지.",
    swatches: ["#eef6ff", "#9fd8ff", "#ffb3c7", "#2f4a6b"],
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

/** 기본 지역 높이 (바닷속·꿈나라는 높이는 그대로 두고 이름·장식만 바꾼다. 바다의 수면 = 지상 시작 높이) */
const DEFAULT_STOPS = CONFIG.regions.list.map((r) => r.startM);

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
    decor: DREAM_DECOR,
    regions: [
      { key: "bedroom", name: "잠든 방", startM: DEFAULT_STOPS[0], top: "#6a62bd", bottom: "#a79ee9" },
      { key: "sheep", name: "양 세는 언덕", startM: DEFAULT_STOPS[1], top: "#b9d5ff", bottom: "#ffe2f3" },
      { key: "rainbow", name: "무지개 구름", startM: DEFAULT_STOPS[2], top: "#c6d8ff", bottom: "#fff0f8" },
      { key: "galaxy", name: "은하수", startM: DEFAULT_STOPS[3], top: "#3f3a8c", bottom: "#6d61c0" },
    ],
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
    cssBackground: "#6a62bd",
  },
  ocean: {
    style: "ocean",
    regions: [
      { key: "seabed", name: "해저", startM: DEFAULT_STOPS[0], top: "#86c8ee", bottom: "#4f93d8" },
      { key: "surface", name: "수면", startM: DEFAULT_STOPS[1], top: "#bfe6ff", bottom: "#eaf8ff" },
      { key: "sky", name: "하늘", startM: DEFAULT_STOPS[2], top: "#8fd0ff", bottom: "#dcf2ff" },
      { key: "space", name: "우주", startM: DEFAULT_STOPS[3], top: "#4459b0", bottom: "#7a8fdc" },
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
    decor: BLOCK_DECOR,
    regions: [
      { key: "nether", name: "네더", startM: 0, top: "#7d3540", bottom: "#a8505a" },
      { key: "stone", name: "동굴", startM: 150, top: "#6f7180", bottom: "#9496a3" },
      { key: "overworld", name: "지상", startM: 500, top: "#9fd6ff", bottom: "#e4f4ff" },
      { key: "sky", name: "하늘", startM: 1200, top: "#8ccaff", bottom: "#d8efff" },
      { key: "space", name: "우주", startM: 2500, top: "#3f3f7a", bottom: "#6a6aa8" },
      { key: "end", name: "엔더 월드", startM: 4000, top: "#2e2250", bottom: "#4e3a7a" },
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
  city: {
    style: "tiles",
    tiles: CITY_TILES,
    decor: CITY_DECOR,
    regions: [
      { key: "subway", name: "지하철", startM: 0, top: "#5d6270", bottom: "#7a8090" },
      { key: "street", name: "거리", startM: 300, top: "#bfe3ff", bottom: "#fff1d6" },
      { key: "towers", name: "빌딩 숲", startM: 800, top: "#a8d4ff", bottom: "#e8f4ff" },
      { key: "roof", name: "옥상", startM: 1600, top: "#ffc8a8", bottom: "#ffe9d6" },
      { key: "night", name: "밤하늘", startM: 2500, top: "#2f3a6a", bottom: "#55609a" },
    ],
    cloud: "rgba(255,255,255,0.9)",
    sparkle: "#ffffff",
    sparkleCore: "#ffe08a",
    sparkleDensity: 1.2,
    accent: "#ffb26b",
    moon: "#fff4c7",
    ground: {
      top: "#b8bcc6",
      topEdge: "#ffd84a",
      highlight: "#d6d9e0",
      soil: "#8f95a3",
      pebble: "#7a808c",
      flower: "#ffd84a",
      flowerCore: "#ffffff",
    },
    shadow: "rgba(36,48,74,0.25)",
    cssBackground: "#5d6270",
  },
  forest: {
    style: "tiles",
    tiles: FOREST_TILES,
    decor: FOREST_DECOR,
    regions: [
      { key: "burrow", name: "토끼 굴", startM: DEFAULT_STOPS[0], top: "#5e4634", bottom: "#7d6049" },
      { key: "mushroom", name: "버섯 숲", startM: DEFAULT_STOPS[1], top: "#c4ecd2", bottom: "#fff6dc" },
      { key: "treetop", name: "나무 위 마을", startM: DEFAULT_STOPS[2], top: "#a8dcff", bottom: "#e6f7ee" },
      { key: "castle", name: "구름 위 성", startM: DEFAULT_STOPS[3], top: "#b9a8f0", bottom: "#ffe1ee" },
    ],
    cloud: "rgba(255,255,255,0.92)",
    sparkle: "#ffffff",
    sparkleCore: "#fff3a0",
    sparkleDensity: 1,
    accent: "#ff9a8a",
    moon: "#fff4c7",
    ground: {
      top: "#8a6146",
      topEdge: "#5e4634",
      highlight: "#a87a5a",
      soil: "#7f583f",
      pebble: "#6a4935",
      flower: "#ffe08a",
      flowerCore: "#ffffff",
    },
    shadow: "rgba(45,35,25,0.25)",
    cssBackground: "#5e4634",
  },
  winter: {
    style: "tiles",
    tiles: WINTER_TILES,
    decor: WINTER_DECOR,
    regions: [
      { key: "icecave", name: "얼음 동굴", startM: DEFAULT_STOPS[0], top: "#5f86a8", bottom: "#8ab4d4" },
      { key: "village", name: "눈 마을", startM: DEFAULT_STOPS[1], top: "#b8d4ee", bottom: "#eef4fb" },
      { key: "mountain", name: "설산", startM: DEFAULT_STOPS[2], top: "#a9c6e8", bottom: "#e4eefa" },
      { key: "aurora", name: "오로라", startM: DEFAULT_STOPS[3], top: "#2c3f6e", bottom: "#4f6aa0" },
    ],
    cloud: "rgba(255,255,255,0.92)",
    sparkle: "#ffffff",
    sparkleCore: "#c9f3ff",
    sparkleDensity: 1.2,
    accent: "#9fe8ff",
    moon: "#fff4c7",
    ground: {
      top: "#ffffff",
      topEdge: "#cfe2f3",
      highlight: "#ffffff",
      soil: "#bfe6f7",
      pebble: "#9fd0ea",
      flower: "#ff9cc6",
      flowerCore: "#ffffff",
    },
    shadow: "rgba(30,50,80,0.22)",
    cssBackground: "#5f86a8",
  },
};
