import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankSprite,
  flipHorizontal,
  floodFill,
  getPixel,
  isEmptySprite,
  isLossyDownscale,
  lineCells,
  paintCells,
  resizeSprite,
  shift,
  withMirror,
} from "../src/editor/grid";
import { createHistory, pushHistory, redo, replacePresent, undo, HISTORY_LIMIT } from "../src/editor/history";
import { CHARACTER_PRESETS } from "../src/game/presets";
import { validateCharacter } from "../src/lib/validate";

const R = "#ff0000";
const B = "#0000ff";

test("칠하기: 원본은 그대로, 바뀐 게 없으면 같은 객체", () => {
  const s = blankSprite(4, 4);
  const t = paintCells(s, [[1, 1]], R);
  assert.equal(getPixel(s, 1, 1), "");
  assert.equal(getPixel(t, 1, 1), R);
  assert.equal(paintCells(t, [[1, 1]], R), t);
  assert.equal(paintCells(t, [[9, 9]], R), t, "범위 밖은 무시");
});

test("대칭: 가운데 선 기준 거울 칸, 홀수 폭 가운데 칸은 한 번만", () => {
  assert.deepEqual(withMirror(blankSprite(16, 18), [[0, 3]]), [[0, 3], [15, 3]]);
  assert.deepEqual(withMirror(blankSprite(5, 5), [[2, 0]]), [[2, 0]]);
});

test("선: 빠르게 끌어도 칸이 이어진다", () => {
  const cells = lineCells(0, 0, 5, 2);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells[cells.length - 1], [5, 2]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(Math.abs(cells[i][0] - cells[i - 1][0]) <= 1 && Math.abs(cells[i][1] - cells[i - 1][1]) <= 1);
  }
});

test("채우기: 이어진 같은 색만, 벽 너머는 그대로", () => {
  // 가운데 세로 벽(x=2)
  let s = blankSprite(5, 3);
  s = paintCells(s, [[2, 0], [2, 1], [2, 2]], B);
  const f = floodFill(s, 0, 0, R);
  assert.equal(getPixel(f, 1, 2), R);
  assert.equal(getPixel(f, 2, 1), B);
  assert.equal(getPixel(f, 4, 0), "", "벽 너머는 안 칠해짐");
  assert.equal(floodFill(f, 0, 0, R), f, "같은 색이면 변화 없음");
});

test("좌우 반전", () => {
  const s = paintCells(blankSprite(4, 1), [[0, 0]], R);
  assert.equal(getPixel(flipHorizontal(s), 3, 0), R);
  assert.equal(getPixel(flipHorizontal(s), 0, 0), "");
});

test("전체 밀기: 밀려난 칸은 사라지고 빈 칸이 들어온다", () => {
  const s = paintCells(blankSprite(3, 3), [[0, 0], [2, 2]], R);
  const t = shift(s, 1, 0);
  assert.equal(getPixel(t, 1, 0), R);
  assert.equal(getPixel(t, 0, 0), "");
  assert.equal(t.pixels.filter(Boolean).length, 1, "오른쪽 끝 칸은 밀려서 사라짐");
});

test("격자 크기: 키웠다 줄이면 원래대로", () => {
  const s = paintCells(blankSprite(16, 18), [[3, 4], [10, 17]], R);
  const big = resizeSprite(s, 32, 36);
  assert.equal(big.pixels.length, 32 * 36);
  assert.equal(getPixel(big, 6, 8), R);
  assert.equal(getPixel(big, 7, 9), R);
  assert.deepEqual(resizeSprite(big, 16, 18).pixels, s.pixels);
  assert.equal(isLossyDownscale(big, 16, 18), false);
});

test("격자 크기: 32에서 1칸짜리 점은 줄이면 뭉개진다고 알려준다", () => {
  const s = paintCells(blankSprite(32, 36), [[5, 5]], R);
  assert.equal(isLossyDownscale(s, 16, 18), true);
});

test("빈 그림 판별", () => {
  assert.equal(isEmptySprite(blankSprite(2, 2)), true);
  assert.equal(isEmptySprite(paintCells(blankSprite(2, 2), [[0, 0]], R)), false);
});

test("되돌리기/다시 하기", () => {
  let h = createHistory(1);
  h = pushHistory(h, 2);
  h = pushHistory(h, 3);
  h = undo(h);
  assert.equal(h.present, 2);
  h = redo(h);
  assert.equal(h.present, 3);
  h = undo(undo(h));
  assert.equal(h.present, 1);
  assert.equal(undo(h), h, "더 되돌릴 게 없으면 그대로");
  h = pushHistory(h, 9);
  assert.equal(h.future.length, 0, "새로 그리면 다시 하기 기록은 지워진다");
});

test("붓질 도중(replacePresent)은 기록을 늘리지 않는다", () => {
  let h = pushHistory(createHistory("a"), "b");
  h = replacePresent(h, "c");
  h = replacePresent(h, "d");
  assert.equal(h.past.length, 1);
  assert.equal(undo(h).present, "a");
});

test("기록은 최대 개수까지만", () => {
  let h = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = pushHistory(h, i);
  assert.equal(h.past.length, HISTORY_LIMIT);
});

test("기본 캐릭터 세트: 3~5종, 모두 검증 통과", () => {
  assert.ok(CHARACTER_PRESETS.length >= 3 && CHARACTER_PRESETS.length <= 5);
  for (const p of CHARACTER_PRESETS) {
    const r = validateCharacter({ base: p.sprite }, p.name);
    assert.ok(r.ok, p.name);
    // 발이 맨 아래 줄에 닿아 있어야 대열·발판 위에서 떠 보이지 않는다
    const bottom = p.sprite.pixels.slice((p.sprite.height - 1) * p.sprite.width);
    assert.ok(bottom.some(Boolean), `${p.name}: 맨 아래 줄이 비어 있음`);
  }
});

test("기본 캐릭터는 늘 세 모습(기본·내려갈 때·착지)이 있고, 같은 격자에 발이 바닥에 닿아 있다", () => {
  for (const p of CHARACTER_PRESETS) {
    const r = validateCharacter(p.character, p.name);
    assert.ok(r.ok, p.name);
    for (const pose of ["base", "fall", "land"] as const) {
      const s = p.character[pose]!;
      assert.equal(s.kind, "pixel");
      if (s.kind !== "pixel") continue;
      assert.deepEqual([s.width, s.height], [16, 18], `${p.name} ${pose}`);
      const bottom = s.pixels.slice((s.height - 1) * s.width);
      assert.ok(bottom.some((c) => c !== ""), `${p.name} ${pose} 발이 맨 아래 줄에`);
    }
    assert.notDeepEqual(p.character.fall, p.character.base, `${p.name} 내려갈 때는 기본과 다름`);
    assert.notDeepEqual(p.character.land, p.character.base, `${p.name} 착지는 기본과 다름`);
    assert.equal(p.sprite, p.character.base);
  }
});

test("PNG 저장 크기: 칸 격자 그대로(빈 칸 포함), 고른 크기가 가로가 되게 정수 배 — 여백 없음", async () => {
  const { pngLayout } = await import("../src/editor/pngExport");
  assert.deepEqual(pngLayout({ width: 16, height: 18 }, 256), { width: 256, height: 288, scale: 16 });
  assert.deepEqual(pngLayout({ width: 32, height: 36 }, 64), { width: 64, height: 72, scale: 2 });
  assert.deepEqual(pngLayout({ width: 16, height: 18 }, 64), { width: 64, height: 72, scale: 4 });
  assert.deepEqual(pngLayout({ width: 32, height: 8 }, 512), { width: 512, height: 128, scale: 16 });
});
