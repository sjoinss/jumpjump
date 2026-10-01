import { CONFIG } from "./config";
import type { Settings } from "../lib/schema";

/**
 * 동료 후보 규칙 (기획서 7-2, 7-6). 화면·저장과 무관한 순수 함수.
 */

/** n번째(0부터) 후보가 나오는 높이(m): 25, 75, 175, 350, 650, 950, 1250, … */
export function candidateHeight(n: number): number {
  const list = CONFIG.companion.candidateHeights;
  if (n < list.length) return list[n];
  return list[list.length - 1] + (n - list.length + 1) * CONFIG.companion.repeatEvery;
}

/** 후보는 지금 동료 수 C가 최대 인원 M보다 적을 때만 (M = 0이면 처음부터 안 나온다) */
export function canOfferCompanion(companions: number, companionMax: number) {
  return companions < companionMax;
}

export type RefusalOutcome = {
  settings: Settings;
  /** 이번 거절로 자동 설정이 켜졌으면 새 최대 인원 */
  autoSetTo: number | null;
};

/**
 * 후보 선택창에서 "아니오"를 눌렀을 때 (같은 후보 블록은 한 번만 센다 — 부르는 쪽 책임).
 * 설정을 직접 건드린 적이 없을 때('default')만 세고, 한도에 닿으면 그 시점의 동료 수로 최대 인원을 맞춘다.
 * 카운트는 판이 끝나도 유지되고 수락해도 줄지 않는다.
 */
export function applyRefusal(settings: Settings, companionsNow: number): RefusalOutcome {
  if (settings.companionMaxSource !== "default") return { settings, autoSetTo: null };
  const refusalCount = settings.refusalCount + 1;
  if (refusalCount >= CONFIG.companion.refusalLimit) {
    return {
      settings: { ...settings, refusalCount, companionMax: companionsNow, companionMaxSource: "auto" },
      autoSetTo: companionsNow,
    };
  }
  return { settings: { ...settings, refusalCount }, autoSetTo: null };
}
