/**
 * 색 고르기용 변환 (HSV ↔ #rrggbb).
 * 색상 피커는 "채도·밝기 네모 + 색조 막대"(포토샵·PC 피커식)라서 HSV로 다룬다.
 * h: 0~360, s·v: 0~1
 */

export type Hsv = { h: number; s: number; v: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");

/** "#abc", "abc", "#aabbcc", "AABBCC" → "#aabbcc". 아니면 null */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  const d = m[1].toLowerCase();
  return d.length === 3 ? `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}` : `#${d}`;
}

export function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex) ?? "#000000";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hh = (((h % 360) + 360) % 360) / 60;
  const ss = clamp01(s);
  const vv = clamp01(v);
  const c = vv * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = vv - c;
  return `#${hex2(r + m)}${hex2(g + m)}${hex2(b + m)}`;
}
