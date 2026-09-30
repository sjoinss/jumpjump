import type { PixelColor, PixelSprite } from "../lib/schema";

/**
 * 도트 격자 연산. 모두 원본을 고치지 않고 새 스프라이트를 돌려준다 (되돌리기 기록을 위해).
 * 좌표는 칸 단위, (0,0)이 왼쪽 위.
 */

export function blankSprite(width: number, height: number): PixelSprite {
  return { kind: "pixel", width, height, pixels: new Array<PixelColor>(width * height).fill("") };
}

export function inBounds(s: PixelSprite, x: number, y: number) {
  return x >= 0 && y >= 0 && x < s.width && y < s.height;
}

export function getPixel(s: PixelSprite, x: number, y: number): PixelColor {
  return inBounds(s, x, y) ? s.pixels[y * s.width + x] : "";
}

/** 여러 칸을 한 번에 칠한다. 바뀐 칸이 없으면 원본을 그대로 돌려준다 */
export function paintCells(s: PixelSprite, cells: readonly [number, number][], color: PixelColor): PixelSprite {
  let pixels: PixelColor[] | null = null;
  for (const [x, y] of cells) {
    if (!inBounds(s, x, y)) continue;
    const i = y * s.width + x;
    if ((pixels ?? s.pixels)[i] === color) continue;
    pixels ??= s.pixels.slice();
    pixels[i] = color;
  }
  return pixels ? { ...s, pixels } : s;
}

/** 대칭 그리기: 세로 가운데 선 기준으로 거울 칸을 더한다 */
export function withMirror(s: PixelSprite, cells: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of cells) {
    out.push([x, y]);
    const mx = s.width - 1 - x;
    if (mx !== x) out.push([mx, y]);
  }
  return out;
}

/** 두 칸 사이를 빈틈없이 잇는 칸들 (빠르게 끌어도 선이 끊기지 않게) */
export function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const cells: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

/** 같은 색으로 이어진 영역(상하좌우)을 채운다 */
export function floodFill(s: PixelSprite, x: number, y: number, color: PixelColor): PixelSprite {
  if (!inBounds(s, x, y)) return s;
  const target = getPixel(s, x, y);
  if (target === color) return s;
  const pixels = s.pixels.slice();
  const stack = [y * s.width + x];
  while (stack.length) {
    const i = stack.pop()!;
    if (pixels[i] !== target) continue;
    pixels[i] = color;
    const cx = i % s.width;
    const cy = (i - cx) / s.width;
    if (cx > 0) stack.push(i - 1);
    if (cx < s.width - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - s.width);
    if (cy < s.height - 1) stack.push(i + s.width);
  }
  return { ...s, pixels };
}

export function flipHorizontal(s: PixelSprite): PixelSprite {
  const pixels = new Array<PixelColor>(s.pixels.length);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) pixels[y * s.width + x] = s.pixels[y * s.width + (s.width - 1 - x)];
  }
  return { ...s, pixels };
}

/** 전체 밀기. 밖으로 밀려난 칸은 사라지고 빈 칸이 들어온다 (되돌리기로 복구) */
export function shift(s: PixelSprite, dx: number, dy: number): PixelSprite {
  if (dx === 0 && dy === 0) return s;
  const pixels = new Array<PixelColor>(s.pixels.length).fill("");
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < s.width && ny < s.height) pixels[ny * s.width + nx] = s.pixels[y * s.width + x];
    }
  }
  return { ...s, pixels };
}

/**
 * 격자 크기 바꾸기 (16×18 ↔ 32×36).
 * 키우면 한 칸이 2×2가 되어 모양이 그대로이고, 줄이면 2×2 중 가장 많은 색(동점이면 왼쪽 위)을 쓴다.
 */
export function resizeSprite(s: PixelSprite, width: number, height: number): PixelSprite {
  if (s.width === width && s.height === height) return s;
  const out = blankSprite(width, height);
  const rx = s.width / width;
  const ry = s.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rx <= 1 && ry <= 1) {
        out.pixels[y * width + x] = getPixel(s, Math.floor(x * rx), Math.floor(y * ry));
        continue;
      }
      const counts = new Map<PixelColor, number>();
      let best: PixelColor = getPixel(s, Math.floor(x * rx), Math.floor(y * ry));
      let bestCount = 0;
      for (let sy = Math.floor(y * ry); sy < Math.floor((y + 1) * ry); sy++) {
        for (let sx = Math.floor(x * rx); sx < Math.floor((x + 1) * rx); sx++) {
          const c = getPixel(s, sx, sy);
          const n = (counts.get(c) ?? 0) + 1;
          counts.set(c, n);
          if (n > bestCount) {
            best = c;
            bestCount = n;
          }
        }
      }
      out.pixels[y * width + x] = best;
    }
  }
  return out;
}

export function isEmptySprite(s: PixelSprite) {
  return s.pixels.every((p) => p === "");
}

/** 줄이면 모양이 뭉개지는지 (2×2 안에 서로 다른 색이 있는지) */
export function isLossyDownscale(s: PixelSprite, width: number, height: number) {
  if (width >= s.width) return false;
  return resizeSprite(resizeSprite(s, width, height), s.width, s.height).pixels.some((p, i) => p !== s.pixels[i]);
}
