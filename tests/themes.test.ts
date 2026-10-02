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

test("블록 월드: 네더 → 동굴 → 지상 → 하늘 → 우주 → 엔더 월드, 지역이 많아도 배경 섞임이 이어진다", () => {
  const list = SCENE.blocks.regions;
  assert.deepEqual(list.map((r) => r.name), ["네더", "동굴", "지상", "하늘", "우주", "엔더 월드"]);
  assert.equal(regionName(regionIndexAt(0, list), list), "네더");
  assert.equal(regionName(regionIndexAt(200, list), list), "동굴");
  assert.equal(regionName(regionIndexAt(600, list), list), "지상");
  assert.equal(regionName(regionIndexAt(4200, list), list), "엔더 월드");
  assert.equal(regionBlendAt(9000, list), 5);
  let prev = -1;
  for (let m = 0; m <= 4500; m += 5) {
    const b = regionBlendAt(m, list);
    assert.ok(b >= prev, `${m}m`);
    prev = b;
  }
});

test("테마 발판: 테마마다 네 종류 모두 올바른 32×8 발판이고, 한 테마 안에서 종류끼리 다르다", async () => {
  const { THEME_PLATFORMS } = await import("../src/game/themePlatforms");
  const { validatePixelSprite } = await import("../src/lib/validate");
  for (const id of THEME_IDS) {
    const p = THEME_PLATFORMS[id];
    const keys = ["basic", "highJump", "oneTime", "moving"] as const;
    for (const k of keys) assert.ok(validatePixelSprite(p[k], "platform", k).ok, `${id} ${k}`);
    const looks = new Set(keys.map((k) => p[k].pixels.join(",")));
    assert.equal(looks.size, 4, id);
  }
});

test("테마 발판: 기본 그대로인 종류만 테마를 따라가고, 직접 그린 발판은 그대로. 저장할 땐 테마 발판 = 기본", async () => {
  const { THEME_PLATFORMS, resolvePlatforms, platformsForSave, samePixels } = await import("../src/game/themePlatforms");
  const { PLATFORM_PRESETS } = await import("../src/game/presets");
  const mine = { ...structuredClone(PLATFORM_PRESETS.basic), pixels: PLATFORM_PRESETS.basic.pixels.map((c, i) => (i === 40 ? "#123456" : c)) };
  const saved = { ...structuredClone(PLATFORM_PRESETS), basic: mine };
  const shown = resolvePlatforms(saved, "candy");
  assert.equal(shown.basic, mine, "직접 그린 기본 발판은 그대로");
  assert.equal(shown.highJump, THEME_PLATFORMS.candy.highJump, "안 그린 종류는 과자 나라 발판");
  const back = platformsForSave(shown, "candy");
  assert.ok(samePixels(back.highJump, PLATFORM_PRESETS.highJump), "테마 발판 그대로면 기본으로 저장");
  assert.equal(back.basic, mine);
  assert.equal(resolvePlatforms(back, "winter").highJump, THEME_PLATFORMS.winter.highJump, "테마를 바꾸면 따라 바뀜");
});
