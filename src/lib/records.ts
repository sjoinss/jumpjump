import type { BestScores } from "./schema";

/**
 * 최고 기록 구분 (기획서 7-8). 기준은 "판을 시작할 때의 동료 최대 인원"이다.
 * 동료를 실제로 몇 명 만났는지와는 다르다 — 동료 모드로 시작해 한 명도 못 만나도 동료 모드 기록.
 * 그래서 기록 구분은 "모드"로, 이번 판의 실제 동료 수는 따로 보여준다 (예전엔 둘 다 "동료 있음"이라 헷갈렸다).
 */
export const RECORD_LABEL: Record<keyof BestScores, string> = {
  withCompanions: "동료 모드",
  solo: "혼자 모드",
};

/** 기록 화면에 붙이는 한 줄 설명 */
export const RECORD_HELP = "혼자 모드는 동료 최대 인원을 0명으로 두고 시작한 판이에요.";

/** 이번 판에 실제로 함께한 동료 */
export function companionsLabel(count: number) {
  return count > 0 ? `동료 ${count}명과 함께` : "동료 없이";
}
