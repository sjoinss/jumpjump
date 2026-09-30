import { CONFIG } from "./config";

/**
 * 캔버스 한 장의 좌표계.
 * 폭 360을 기준으로 스케일을 정하고, 화면이 더 넓거나 길면 논리 크기를 늘려 배경이 여분을 채운다(레터박스 없음).
 * 게임 판정은 가운데 폭 360(playX ~ playX+360), 아래쪽 기준 높이 playH(최대 840) 안에서 한다.
 */
export type Viewport = {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** 논리 px → CSS px 배율 */
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
  /** 게임 판정 영역의 왼쪽 x (논리) */
  playX: number;
  /** 게임 판정 영역 높이 (논리, 640~840). 화면 아래에 붙는다 */
  playHeight: number;
};

export function computeViewport(cssWidth: number, cssHeight: number, dpr: number): Viewport {
  const { width, minHeight, maxHeight } = CONFIG.view;
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const scale = Math.min(w / width, h / minHeight);
  const logicalWidth = w / scale;
  const logicalHeight = h / scale;
  return {
    cssWidth: w,
    cssHeight: h,
    // 너무 큰 DPR은 메모리만 먹고 차이가 없어 3으로 제한
    dpr: Math.min(Math.max(1, dpr), 3),
    scale,
    logicalWidth,
    logicalHeight,
    playX: (logicalWidth - width) / 2,
    playHeight: Math.min(logicalHeight, maxHeight),
  };
}

export type FrameLayout = {
  mode: "mobile" | "desktop";
  /** desktop일 때 프레임 크기 (CSS px). mobile이면 화면 전체 */
  frameWidth: number;
  frameHeight: number;
  showSides: boolean;
};

/**
 * PC 프레임 크기. 도트 선명도를 위해 배율을 0.5 단위로 내림하고, 남는 높이는 논리 높이(640~840)로 흡수한다.
 * 창이 논리 최소 높이보다 작으면 스냅하지 않고 그대로 줄인다.
 */
export function computeFrameLayout(windowWidth: number, windowHeight: number): FrameLayout {
  const { width, minHeight, maxHeight, desktopBreakpoint, desktopGutter, desktopSideWidth } = CONFIG.view;
  if (windowWidth <= desktopBreakpoint) {
    return { mode: "mobile", frameWidth: windowWidth, frameHeight: windowHeight, showSides: false };
  }
  const availH = Math.max(1, windowHeight - desktopGutter * 2);
  const availW = Math.max(1, windowWidth - desktopGutter * 2);
  const raw = Math.min(availH / minHeight, availW / width);
  const scale = raw >= 1 ? Math.floor(raw * 2) / 2 : raw;
  const logicalHeight = Math.min(maxHeight, Math.max(minHeight, availH / scale));
  const frameWidth = Math.round(width * scale);
  const frameHeight = Math.round(Math.min(availH, logicalHeight * scale));
  const showSides = windowWidth - frameWidth >= 2 * (desktopSideWidth + desktopGutter * 2);
  return { mode: "desktop", frameWidth, frameHeight, showSides };
}
