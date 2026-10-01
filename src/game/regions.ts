import { CONFIG } from "./config";

export type RegionId = (typeof CONFIG.regions.list)[number]["id"];

export const REGION_IDS: RegionId[] = CONFIG.regions.list.map((r) => r.id);

/** 이 높이(m, 곧 점수)에서 "들어와 있는" 지역 (경계 높이에 닿으면 그 지역) */
export function regionIndexAt(meters: number): number {
  const list = CONFIG.regions.list;
  let idx = 0;
  for (let i = 0; i < list.length; i++) if (meters >= list[i].startM) idx = i;
  return idx;
}

/**
 * 배경 섞임 위치: 정수면 한 지역, 소수면 두 지역 사이 (예: 0.5 = 동굴과 지상 반반).
 * 경계 높이 ±blend(m) 구간에서 0→1로 넘어간다.
 */
export function regionBlendAt(meters: number): number {
  const { list, blend } = CONFIG.regions;
  for (let i = 1; i < list.length; i++) {
    const b = list[i].startM;
    if (meters < b - blend) return i - 1;
    if (meters <= b + blend) return i - 1 + (meters - (b - blend)) / (2 * blend);
  }
  return list.length - 1;
}

export function regionName(index: number) {
  return CONFIG.regions.list[Math.max(0, Math.min(CONFIG.regions.list.length - 1, index))].name;
}
