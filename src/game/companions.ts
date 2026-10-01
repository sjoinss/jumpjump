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
 * 한도(3번)에 닿으면 그 시점의 동료 수로 최대 인원을 맞춘다 → 더는 후보가 나오지 않는다.
 * 사용자 요청으로 설정을 직접 바꾼 적이 있어도 센다 (기획서 7-6의 "직접 설정하면 자동 설정 끔"을 바꿈).
 * 카운트는 판이 끝나도 이어지고 수락해도 줄지 않으며, 자동 설정되거나 설정에서 최대 인원을 바꾸면 0부터 다시.
 */
export function applyRefusal(settings: Settings, companionsNow: number): RefusalOutcome {
  const refusalCount = settings.refusalCount + 1;
  if (refusalCount >= CONFIG.companion.refusalLimit) {
    return {
      settings: { ...settings, refusalCount: 0, companionMax: companionsNow, companionMaxSource: "auto" },
      autoSetTo: companionsNow,
    };
  }
  return { settings: { ...settings, refusalCount }, autoSetTo: null };
}
