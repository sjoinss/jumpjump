import { test } from "node:test";
import assert from "node:assert/strict";
import { isSkinSize, skinToDots, skinToPoses, SKIN_OUT } from "../src/editor/skin";
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

test("스킨 → 32×36 꼬마 도트(기본 = 차렷): 머리 3배 24×24, 몸 8×6, 팔 2×6, 다리 4×6. 모자 층이 위에 덮인다", () => {
  const cells = skinToDots(makeSkin(64));
  assert.equal(cells.length, 32 * 36);
  assert.equal(at(cells, 4, 0), "#ff0000", "머리 왼쪽 위");
  assert.equal(at(cells, 27, 23), "#ff0000", "머리 오른쪽 아래 (24×24)");
  assert.equal(at(cells, 7, 3), "#0000ff", "모자 층 (머리 (1,1) → 3배 자리)");
  assert.equal(at(cells, 12, 24), "#00ff00", "몸");
  assert.equal(at(cells, 10, 24), "#ffff00", "화면 왼쪽 = 오른팔, 몸에 붙음");
  assert.equal(at(cells, 21, 29), "#00ffff", "화면 오른쪽 = 왼팔");
  assert.equal(at(cells, 12, 35), "#800080", "오른다리, 발끝은 맨 아래 줄");
  assert.equal(at(cells, 16, 30), "#ff8000", "왼다리");
  assert.equal(at(cells, 0, 0), "", "머리 옆은 투명");
  assert.equal(at(cells, 9, 26), "", "팔 바깥은 투명");
  assert.equal(at(cells, 10, 32), "", "다리 옆은 투명");
});

test("스킨 세 모습: 내려갈 때는 팔을 옆으로 쭉(십자), 착지는 내려앉아 다리를 굽혀 벌린다", () => {
  const p = skinToPoses(makeSkin(64));
  assert.deepEqual(p.base, skinToDots(makeSkin(64)));
  // 십자
  assert.equal(at(p.fall, 6, 24), "#ffff00", "오른팔이 어깨 높이에서 옆으로 6칸 (차렷 팔과 같은 길이)");
  assert.equal(at(p.fall, 5, 24), "", "너무 길게 뻗지 않음");
  assert.equal(at(p.fall, 25, 25), "#00ffff", "왼팔도 6칸");
  assert.equal(at(p.fall, 26, 25), "");
  assert.equal(at(p.fall, 10, 28), "", "몸 옆에는 팔이 없음");
  // 착지
  assert.equal(at(p.land, 4, 1), "", "머리가 두 칸 내려옴");
  assert.equal(at(p.land, 4, 2), "#ff0000");
  assert.equal(at(p.land, 11, 32), "#800080", "다리가 바깥으로 한 칸");
  assert.equal(at(p.land, 20, 35), "#ff8000");
  assert.equal(at(p.land, 12, 31), "#00ff00", "몸이 내려앉음");
  for (const pose of [p.base, p.fall, p.land]) {
    const v = validatePixelSprite({ kind: "pixel", ...SKIN_OUT, pixels: pose }, "character", "스킨");
    assert.ok(v.ok, "게임 그림 규칙 통과");
  }
});

test("예전 64×32 스킨: 왼팔·왼다리는 오른쪽을 뒤집어 쓴다", () => {
  const cells = skinToDots(makeSkin(32));
  assert.equal(at(cells, 20, 24), "#ffff00", "왼팔 자리에 오른팔 색");
  assert.equal(at(cells, 16, 30), "#800080", "왼다리 자리에 오른다리 색");
});

test("얇은 팔(3px) 스킨도 빈칸 없이 2칸 두께 팔", () => {
  const cells = skinToDots(makeSkin(64, { slim: true }));
  assert.equal(at(cells, 10, 24), "#ffff00");
  assert.equal(at(cells, 11, 24), "#ffff00");
  assert.equal(at(cells, 20, 24), "#00ffff");
  assert.equal(at(cells, 21, 24), "#00ffff");
});

test("예전 64×32 스킨의 꽉 찬 모자 층(검은색 등)은 모자가 없는 것으로 본다", () => {
  const skin = makeSkin(32);
  for (let y = 0; y < 16; y++)
    for (let x = 32; x < 64; x++) skin.rgba.set([0, 0, 0, 255], (y * 64 + x) * 4);
  const cells = skinToDots(skin);
  assert.equal(at(cells, 4, 0), "#ff0000", "얼굴이 그대로 보임");
});
