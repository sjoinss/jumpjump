import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_PRESETS } from "../src/game/presets";
import { buildShareLink, parseShareBody, readShareHash, SHARE_LINK_MAX } from "../src/lib/shareLink";
import type { Character } from "../src/lib/schema";
import { hexToHsv, hsvToHex, normalizeHex } from "../src/editor/color";

const BASE = "https://example.test/jumpjump/";

async function roundTrip(c: Character) {
  const link = await buildShareLink(c, BASE);
  assert.ok(link.ok);
  const body = readShareHash(new URL(link.value).hash);
  assert.ok(body);
  return { link: link.value, parsed: await parseShareBody(body) };
}

test("공유 링크: 도트 캐릭터를 담았다가 그대로 꺼낸다 (세 모습 포함)", async () => {
  const p = CHARACTER_PRESETS[0].sprite;
  const hero: Character = { base: p, fall: { ...p, pixels: [...p.pixels].reverse() } };
  const { link, parsed } = await roundTrip(hero);
  assert.ok(link.startsWith(BASE + "#c=z"), "압축해서 # 뒤에");
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.value, hero);
});

test("공유 링크: 32×36 가득 그린 캐릭터도 메신저에 붙일 만한 길이", async () => {
  const colors = ["#ff8fab", "#9fd8ff", "#3d2c5e", "#ffd36e", "#c8ebc0", "#a77bff"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pixels = Array.from({ length: 32 * 36 }, () => colors[Math.floor(rnd() * colors.length)]);
  const sprite = { kind: "pixel" as const, width: 32, height: 36, pixels };
  const { link, parsed } = await roundTrip({ base: sprite, fall: sprite, land: sprite });
  assert.ok(parsed.ok);
  assert.ok(link.length < 6000, `길이 ${link.length}`);
});

test("공유 링크: 잘리거나 엉뚱한 값은 거절하고 이유를 알려준다", async () => {
  const link = await buildShareLink({ base: CHARACTER_PRESETS[0].sprite }, BASE);
  assert.ok(link.ok);
  const body = readShareHash(new URL(link.value).hash)!;
  for (const broken of [body.slice(0, Math.floor(body.length / 2)), "zAAAA", "xabc", "j" + Buffer.from('{"app":"other","v":1}').toString("base64url")]) {
    const r = await parseShareBody(broken);
    assert.equal(r.ok, false, broken.slice(0, 10));
    assert.ok(!r.ok && r.error.length > 0);
  }
  // 형식은 맞지만 그림이 규칙에 어긋나면 검사에서 걸린다
  const bad = "j" + Buffer.from(JSON.stringify({ app: "jumpjump", v: 1, hero: { base: { kind: "pixel", width: 3, height: 3, pixels: [] } } })).toString("base64url");
  assert.equal((await parseShareBody(bad)).ok, false);
  assert.equal(readShareHash("#settings"), null);
  assert.equal(readShareHash(""), null);
  assert.ok(SHARE_LINK_MAX > 6000);
});

test("색 변환: HSV ↔ #rrggbb가 서로 맞고, 색 코드 입력은 3·6자리 모두 받는다", () => {
  for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ff8fab", "#3d2c5e", "#9fd8ff", "#7f7f7f"]) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex);
  }
  assert.deepEqual(hexToHsv("#ff0000"), { h: 0, s: 1, v: 1 });
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), "#00ff00");
  assert.equal(hsvToHex({ h: 360, s: 1, v: 1 }), "#ff0000");
  assert.equal(normalizeHex("ABC"), "#aabbcc");
  assert.equal(normalizeHex(" #FF8FAB "), "#ff8fab");
  assert.equal(normalizeHex("#ff8fa"), null);
  assert.equal(normalizeHex("빨강"), null);
});
