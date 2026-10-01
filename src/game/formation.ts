import { CONFIG } from "./config";

/**
 * 대열 배치 (기획서 7-1). 주인공 왼쪽 아래 기준 2열 × 3행.
 *
 *   [동료4] [동료5]
 *   [동료2] [동료3]
 *   [주인공] [동료1]
 *
 * member 0 = 주인공, 1~5 = 동료 슬롯 순서.
 */
export function memberCell(member: number): { col: number; row: number } {
  return { col: member % CONFIG.formation.columns, row: Math.floor(member / CONFIG.formation.columns) };
}

/** 동료 수(C)에 따른 대열 크기. 동료1이 오면 폭이 두 칸이 되고, 그 뒤로는 위로만 쌓인다 */
export function formationSize(companions: number) {
  const members = companions + 1;
  const cols = Math.min(CONFIG.formation.columns, members);
  const rows = Math.ceil(members / CONFIG.formation.columns);
  return {
    cols,
    rows,
    width: cols * CONFIG.character.width,
    height: rows * CONFIG.character.height,
  };
}

/** 대열 줄 수에 따른 카메라 기준 비율 (화면 위에서부터) */
export function cameraRatioFor(companions: number) {
  const ratios = CONFIG.formation.cameraRatioByRows;
  return ratios[Math.min(ratios.length, formationSize(companions).rows) - 1];
}
