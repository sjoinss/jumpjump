import { CONFIG } from "../game/config";

/**
 * 이미지 불러오기의 순수 계산 (DOM 없이 테스트 가능).
 * 좌표 단위는 저장 상자(320×360) 기준 px. 게임 표시 상자 64×72의 정확히 5배다.
 */

export type ImageFormat = "png" | "jpeg" | "gif" | "webp";

/** 파일 앞부분(매직 넘버)으로 형식을 판별한다. 확장자나 MIME은 믿지 않는다. SVG 등은 null */
export function detectFormat(b: Uint8Array): ImageFormat | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * 상자 맞춤 (기획서 6-2): 세로를 상자 높이에 맞추고 가로는 비율대로.
 * 가로가 상자보다 넓으면 가로에 맞춰 줄인다. 가로 가운데, 세로 바닥 정렬.
 */
export function fitToBox(srcW: number, srcH: number, boxW: number, boxH: number): Rect {
  let h = boxH;
  let w = (srcW * boxH) / srcH;
  if (w > boxW) {
    w = boxW;
    h = (srcH * boxW) / srcW;
  }
  return { x: (boxW - w) / 2, y: boxH - h, w, h };
}

/** 사용자가 조정한 값: 확대 배율(맞춤 크기 기준)과 이동량(상자 px) */
export type Adjust = { zoom: number; dx: number; dy: number };

export const NO_ADJUST: Adjust = { zoom: 1, dx: 0, dy: 0 };

/** 맞춤 위치에 조정을 적용한 최종 그리기 영역. 확대는 발밑(바닥 가운데)을 기준으로 한다 */
export function placedRect(fit: Rect, a: Adjust): Rect {
  const w = fit.w * a.zoom;
  const h = fit.h * a.zoom;
  const cx = fit.x + fit.w / 2;
  const bottom = fit.y + fit.h;
  return { x: cx - w / 2 + a.dx, y: bottom - h + a.dy, w, h };
}

export function clampZoom(z: number) {
  const { zoomMin, zoomMax } = CONFIG.imageImport;
  return Math.max(zoomMin, Math.min(zoomMax, Math.round(z * 100) / 100));
}

/** 작업본 크기: 긴 변을 maxSide 이하로 (비율 유지, 키우지는 않는다) */
export function workingSize(w: number, h: number, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** 알파가 조금이라도 있는 이미지인지 (이미 배경이 투명하면 배경 제거를 기본으로 끈다) */
export function hasTransparency(rgba: Uint8ClampedArray) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) return true;
  return false;
}

/** 칸이 하나라도 보이는지 (상자 밖으로 다 밀어낸 경우를 막는다) */
export function hasVisiblePixel(rgba: Uint8ClampedArray) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 8) return true;
  return false;
}

/** 허용 오차 0~100 → RGB 거리 */
function toleranceToDistance(t: number) {
  return (Math.max(0, Math.min(100, t)) / 100) * 160;
}

/**
 * 간단한 배경 제거 (기획서 6-3).
 * 네 모서리 색을 기준으로, 테두리에서 시작해 허용 오차 안의 "이어진" 영역만 투명하게 한다.
 * 그래서 캐릭터 안쪽에 배경과 같은 색이 있어도 둘러싸여 있으면 지워지지 않는다.
 * soften이면 남은 가장자리 1px을 반투명하게 해서 계단 현상을 줄인다.
 */
export function removeBackground(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  tolerance: number,
  soften: boolean,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(src);
  const maxDist2 = toleranceToDistance(tolerance) ** 2;
  const cornerIdx = [0, w - 1, (h - 1) * w, h * w - 1];
  const refs = cornerIdx.map((p) => [src[p * 4], src[p * 4 + 1], src[p * 4 + 2]]);

  const isBackground = (p: number) => {
    const i = p * 4;
    if (src[i + 3] === 0) return true;
    for (const [r, g, b] of refs) {
      const dr = src[i] - r;
      const dg = src[i + 1] - g;
      const db = src[i + 2] - b;
      if (dr * dr + dg * dg + db * db <= maxDist2) return true;
    }
    return false;
  };

  const removed = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (p: number) => {
    if (!removed[p] && isBackground(p)) {
      removed[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < (h - 1) * w) seed(p + w);
  }

  for (let p = 0; p < w * h; p++) if (removed[p]) out[p * 4 + 3] = 0;

  if (soften) {
    for (let p = 0; p < w * h; p++) {
      if (removed[p]) continue;
      const x = p % w;
      const edge =
        (x > 0 && removed[p - 1]) ||
        (x < w - 1 && removed[p + 1]) ||
        (p >= w && removed[p - w]) ||
        (p < (h - 1) * w && removed[p + w]);
      if (edge) out[p * 4 + 3] = Math.round(out[p * 4 + 3] * 0.5);
    }
  }
  return out;
}

/** 색 단계를 줄인다 (PNG 용량을 줄이는 마지막 수단). bits = 채널당 남길 비트 수 */
export function posterize(rgba: Uint8ClampedArray, bits: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(rgba);
  const shift = 8 - bits;
  for (let i = 0; i < out.length; i++) {
    if (i % 4 === 3) continue;
    out[i] = (out[i] >> shift) << shift;
  }
  return out;
}

export type ImportCheck = { ok: true } | { ok: false; message: string };

/** 파일 크기 확인 (디코딩 전) */
export function checkFileSize(bytes: number): ImportCheck {
  const max = CONFIG.imageImport.maxFileBytes;
  if (bytes <= max) return { ok: true };
  const mb = (bytes / 1024 / 1024).toFixed(1);
  return {
    ok: false,
    message: `파일이 너무 커요(${mb}MB). ${max / 1024 / 1024}MB 이하로 줄이거나 다른 파일을 골라주세요.`,
  };
}

/** 해상도 확인 (디코딩 후) */
export function checkDimensions(w: number, h: number): ImportCheck {
  const { maxSide, maxPixels } = CONFIG.imageImport;
  if (w < 1 || h < 1) return { ok: false, message: "이미지를 열 수 없습니다. 다른 파일을 선택해주세요." };
  if (w > maxSide || h > maxSide || w * h > maxPixels) {
    return {
      ok: false,
      message: `이미지가 너무 커요(${w}×${h}). 가로·세로 ${maxSide}px 이하로 줄여서 다시 골라주세요.`,
    };
  }
  return { ok: true };
}

export const UNSUPPORTED_MESSAGE = "PNG, JPEG, WebP, GIF 이미지만 쓸 수 있어요. SVG나 다른 파일은 안 돼요.";
export const DECODE_FAIL_MESSAGE = "이미지를 열 수 없습니다. 다른 파일을 선택해주세요.";

// ── 도트 크기 이미지 → 도트 칸 (사용자 결정: 도트 격자와 같은 px인 이미지만 불러온 뒤 직접 고칠 수 있게) ──

/** 반투명은 이 값 이상이면 불투명 칸, 아니면 빈 칸 */
const ALPHA_CUT = 128;

/**
 * 이미지 크기가 도트 격자(16×18 또는 32×36)와 정확히 같으면 그 격자, 아니면 null.
 * 다른 크기는 줄이거나 늘리지 않고 이미지로만 쓴다.
 */
export function dotGridFor(w: number, h: number): { width: number; height: number } | null {
  return CONFIG.character.gridSizes.find((g) => g.width === w && g.height === h) ?? null;
}

const toHex = (r: number, g: number, b: number) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

/** 네 모서리가 같은 불투명 색이면 그 색 (배경으로 보이는 색), 아니면 null */
export function cornerBackground(rgba: Uint8ClampedArray, w: number, h: number): string | null {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  if (corners.some((i) => rgba[i + 3] < ALPHA_CUT)) return null;
  const same = (i: number) => rgba[i] === rgba[corners[0]] && rgba[i + 1] === rgba[corners[0] + 1] && rgba[i + 2] === rgba[corners[0] + 2];
  if (!corners.every(same)) return null;
  return toHex(rgba[corners[0]], rgba[corners[0] + 1], rgba[corners[0] + 2]);
}

/**
 * 도트 크기 이미지를 도트 칸으로 (픽셀 하나 = 칸 하나). 반투명은 ALPHA_CUT 기준으로 칸을 채우거나 비운다.
 * removeBackground면 테두리에서 이어진 모서리 색 칸만 비운다 (그림 안쪽의 같은 색은 남긴다).
 */
export function imageToDotPixels(rgba: Uint8ClampedArray, w: number, h: number, removeBackground: boolean): string[] {
  const cells: string[] = [];
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    cells.push(rgba[j + 3] < ALPHA_CUT ? "" : toHex(rgba[j], rgba[j + 1], rgba[j + 2]));
  }
  const bg = removeBackground ? cornerBackground(rgba, w, h) : null;
  if (bg) {
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (cells[i] !== bg) continue;
      cells[i] = "";
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < (h - 1) * w) stack.push(i + w);
    }
  }
  return cells;
}
