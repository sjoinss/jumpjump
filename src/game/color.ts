/** 배경·타일 그리기용 색 도우미 */

export type RGB = [number, number, number];

export const INK: RGB = [61, 44, 94];
export const WHITE: RGB = [255, 255, 255];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function css(c: RGB) {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

/** "#rrggbb"를 다른 색 쪽으로 t만큼 섞은 css 색 */
export function mix(c: string, toward: RGB, t: number) {
  return css(mixRgb(hex(c), toward, t));
}
