import { CONFIG } from "./config";

/**
 * 지역 (기획서 3-5). 높이(m)마다 이름과 배경이 바뀐다.
 * - 게임 규칙(지역마다 조금씩 빨라지는 속도)은 늘 CONFIG.regions.list(동굴·지상·하늘·우주) 높이를 따른다 — 테마를 바꿔도 난이도는 같다.
 * - 보이는 지역(이름 배너·배경·결과 이미지)은 테마마다 다를 수 있다 (예: 해저 → 수면 → 하늘 → 우주, 블록 월드는 5개).
 *   테마의 지역 목록은 themes.ts의 SCENE[테마].regions에 있다.
 */

export type RegionId = (typeof CONFIG.regions.list)[number]["id"];

/** 지역 목록의 한 칸: 이름과 시작 높이(m). 첫 칸은 0m */
export type RegionStop = { name: string; startM: number };

const DEFAULT: readonly RegionStop[] = CONFIG.regions.list;

/** 이 높이(m, 곧 점수)에서 "들어와 있는" 지역 (경계 높이에 닿으면 그 지역) */
export function regionIndexAt(meters: number, list: readonly RegionStop[] = DEFAULT): number {
  let idx = 0;
  for (let i = 0; i < list.length; i++) if (meters >= list[i].startM) idx = i;
  return idx;
}

/**
 * 배경 섞임 위치: 정수면 한 지역, 소수면 두 지역 사이 (예: 0.5 = 첫째와 둘째 반반).
 * 경계 높이 ±blend(m) 구간에서 0→1로 넘어간다.
 */
export function regionBlendAt(meters: number, list: readonly RegionStop[] = DEFAULT): number {
  const { blend } = CONFIG.regions;
  for (let i = 1; i < list.length; i++) {
    const b = list[i].startM;
    if (meters < b - blend) return i - 1;
    if (meters <= b + blend) return i - 1 + (meters - (b - blend)) / (2 * blend);
  }
  return list.length - 1;
}

export function regionName(index: number, list: readonly RegionStop[] = DEFAULT) {
  return list[Math.max(0, Math.min(list.length - 1, index))].name;
}
