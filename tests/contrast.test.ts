import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 색 대비 검수 (기획서 18, 22 · WCAG 2.2 AA). tokens.css를 직접 읽어 세 테마 모두 확인한다.
 * 글자는 4.5:1, 포커스 링처럼 꼭 보여야 하는 UI 표시는 3:1.
 */

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function block(selector: string) {
  const i = css.indexOf(selector + " {");
  if (i < 0) throw new Error(`${selector} 없음`);
  return css.slice(i, css.indexOf("\n}", i));
}

function vars(text: string) {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const ROOT = vars(block(":root"));
const THEMES: Record<string, Record<string, string>> = {
  "도트 놀이터": ROOT,
  솜사탕: { ...ROOT, ...vars(block(':root[data-theme="cotton"]')) },
  꿈나라: { ...ROOT, ...vars(block(':root[data-theme="dream"]')) },
};

function resolve(t: Record<string, string>, name: string): string {
  let v = t[name];
  for (let i = 0; i < 5 && v?.startsWith("var("); i++) v = t[v.slice(4, -1).trim()];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} = ${v} (#rrggbb가 아님)`);
  return v;
}

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [글자색, 그 글자가 실제로 올라가는 배경들] */
const TEXT_PAIRS: [string, string[]][] = [
  [
    "--color-ink",
    [
      "--color-background",
      "--color-surface",
      "--color-surface-alt",
      "--color-primary",
      "--color-primary-soft",
      "--color-secondary",
      "--color-secondary-soft",
      "--color-mint",
      "--color-butter",
      "--color-sky",
      "--color-cream",
      "--color-danger-fill",
      "--color-desk-bg",
      "--color-desk-bg-2",
    ],
  ],
  ["--color-muted", ["--color-background", "--color-surface", "--color-surface-alt", "--color-primary-soft", "--color-secondary-soft"]],
  ["--color-primary-strong", ["--color-background", "--color-surface", "--color-secondary-soft", "--color-primary-soft"]],
  ["--color-success", ["--color-success-soft", "--color-surface"]],
  ["--color-warning", ["--color-warning-soft", "--color-surface"]],
  ["--color-error", ["--color-error-soft", "--color-surface"]],
];

/** 꼭 보여야 하는 UI 표시 (3:1) */
const UI_PAIRS: [string, string[]][] = [
  ["--color-focus", ["--color-background", "--color-surface", "--color-surface-alt", "--color-primary-soft"]],
];

for (const [theme, t] of Object.entries(THEMES)) {
  test(`대비 · ${theme}: 글자 4.5:1 이상`, () => {
    const bad: string[] = [];
    for (const [fg, bgs] of TEXT_PAIRS)
      for (const bg of bgs) {
        const r = contrast(resolve(t, fg), resolve(t, bg));
        if (r < 4.5) bad.push(`${fg} / ${bg} = ${r.toFixed(2)}`);
      }
    assert.deepEqual(bad, []);
  });

  test(`대비 · ${theme}: 포커스 표시 3:1 이상`, () => {
    const bad: string[] = [];
    for (const [fg, bgs] of UI_PAIRS)
      for (const bg of bgs) {
        const r = contrast(resolve(t, fg), resolve(t, bg));
        if (r < 3) bad.push(`${fg} / ${bg} = ${r.toFixed(2)}`);
      }
    assert.deepEqual(bad, []);
  });
}
