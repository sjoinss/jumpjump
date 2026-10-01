import { test } from "node:test";
import assert from "node:assert/strict";
import { isSkinSize, skinToDots, SKIN_OUT } from "../src/editor/skin";
import { validatePixelSprite } from "../src/lib/validate";

/** 부위마다 다른 색으로 칠한 가짜 스킨 */
function makeSkin(height: 64 | 32, opts: { slim?: boolean } = {}) {
  const rgba = new Uint8ClampedArray(64 * height * 4);
  const fill = (x: number, y: number, w: number, h: number, [r, g, b]: number[]) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const i = (yy * 64 + xx) * 4;
        rgba.set([r, g, b, 255], i);
      }
  };
  const arm = opts.slim ? 3 : 4;
  fill(8, 8, 8, 8, [255, 0, 0]); // 머리 앞
  fill(41, 9, 1, 1, [0, 0, 255]); // 모자 층 한 점 (머리 (1,1) 위)
  fill(20, 20, 8, 12, [0, 255, 0]); // 몸 앞
  fill(44, 20, arm, 12, [255, 255, 0]); // 오른팔 앞
  fill(4, 20, 4, 12, [128, 0, 128]); // 오른다리 앞
  if (height === 64) {
    fill(36, 52, arm, 12, [0, 255, 255]); // 왼팔 앞
    fill(20, 52, 4, 12, [255, 128, 0]); // 왼다리 앞
  }
  return { rgba, width: 64, height };
}

const at = (cells: string[], x: number, y: number) => cells[y * SKIN_OUT.width + x];

test("스킨 크기: 64×64와 예전 64×32만", () => {
  assert.ok(isSkinSize(64, 64));
  assert.ok(isSkinSize(64, 32));
  assert.ok(!isSkinSize(32, 36));
  assert.ok(!isSkinSize(128, 128));
});

test("스킨 → 32×36 꼬마 도트: 머리 2배, 몸·팔, 다리는 짧게. 모자 층이 위에 덮인다", () => {
  const cells = skinToDots(makeSkin(64));
  assert.equal(cells.length, 32 * 36);
  assert.equal(at(cells, 8, 0), "#ff0000", "머리 왼쪽 위");
  assert.equal(at(cells, 23, 15), "#ff0000", "머리 오른쪽 아래 (16×16)");
  assert.equal(at(cells, 2 + 8, 2), "#0000ff", "모자 층 (머리 (1,1) → 2배 자리)");
  assert.equal(at(cells, 12, 16), "#00ff00", "몸");
  assert.equal(at(cells, 8, 16), "#ffff00", "화면 왼쪽 = 오른팔");
  assert.equal(at(cells, 20, 27), "#00ffff", "화면 오른쪽 = 왼팔");
  assert.equal(at(cells, 12, 35), "#800080", "오른다리 (8줄)");
  assert.equal(at(cells, 16, 28), "#ff8000", "왼다리");
  assert.equal(at(cells, 0, 0), "", "머리 옆은 투명");
  assert.equal(at(cells, 8, 30), "", "다리 옆은 투명");
  // 게임 그림 규칙(크기·색 형식)을 통과한다
  const v = validatePixelSprite({ kind: "pixel", ...SKIN_OUT, pixels: cells }, "character", "스킨");
  assert.ok(v.ok);
});

test("예전 64×32 스킨: 왼팔·왼다리는 오른쪽을 뒤집어 쓴다", () => {
  const cells = skinToDots(makeSkin(32));
  assert.equal(at(cells, 20, 16), "#ffff00", "왼팔 자리에 오른팔 색");
  assert.equal(at(cells, 16, 30), "#800080", "왼다리 자리에 오른다리 색");
});

test("얇은 팔(3px) 스킨: 팔이 몸에 붙고 바깥 한 줄은 비운다", () => {
  const cells = skinToDots(makeSkin(64, { slim: true }));
  assert.equal(at(cells, 9, 16), "#ffff00");
  assert.equal(at(cells, 8, 16), "", "굵은 팔이면 칠해질 자리");
  assert.equal(at(cells, 22, 16), "#00ffff");
  assert.equal(at(cells, 23, 16), "");
});

test("예전 64×32 스킨의 꽉 찬 모자 층(검은색 등)은 모자가 없는 것으로 본다", () => {
  const skin = makeSkin(32);
  for (let y = 0; y < 16; y++)
    for (let x = 32; x < 64; x++) skin.rgba.set([0, 0, 0, 255], (y * 64 + x) * 4);
  const cells = skinToDots(skin);
  assert.equal(at(cells, 8, 0), "#ff0000", "얼굴이 그대로 보임");
});
