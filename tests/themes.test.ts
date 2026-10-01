import { test } from "node:test";
import assert from "node:assert/strict";
import { regionBlendAt, regionIndexAt, regionName } from "../src/game/regions";
import { SCENE, THEME_IDS, THEMES } from "../src/game/themes";

test("테마마다 지역 목록: 0m에서 시작해 높이가 오르는 순서, 이름이 있다", () => {
  for (const id of THEME_IDS) {
    const list = SCENE[id].regions;
    assert.equal(list[0].startM, 0, id);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].startM > list[i - 1].startM, `${id} ${i}`);
    for (const r of list) assert.ok(r.name.length > 0 && /^#[0-9a-f]{6}$/.test(r.top) && /^#[0-9a-f]{6}$/.test(r.bottom), `${id} ${r.key}`);
    assert.ok(THEMES[id].name.length > 0);
  }
});

test("바닷속: 해저 → 수면 → 하늘 → 우주 (높이는 기본과 같아 난이도 그대로)", () => {
  const list = SCENE.ocean.regions;
  assert.deepEqual(list.map((r) => r.name), ["해저", "수면", "하늘", "우주"]);
  assert.deepEqual(list.map((r) => r.startM), SCENE.dot.regions.map((r) => r.startM));
  assert.equal(regionName(regionIndexAt(320, list), list), "수면");
});

test("블록 월드: 네더 → 동굴 → 지상 → 하늘 → 우주, 다섯 지역도 배경 섞임이 이어진다", () => {
  const list = SCENE.blocks.regions;
  assert.deepEqual(list.map((r) => r.name), ["네더", "동굴", "지상", "하늘", "우주"]);
  assert.equal(regionName(regionIndexAt(0, list), list), "네더");
  assert.equal(regionName(regionIndexAt(200, list), list), "동굴");
  assert.equal(regionName(regionIndexAt(600, list), list), "지상");
  assert.equal(regionBlendAt(9000, list), 4);
  let prev = -1;
  for (let m = 0; m <= 3000; m += 5) {
    const b = regionBlendAt(m, list);
    assert.ok(b >= prev, `${m}m`);
    prev = b;
  }
});
