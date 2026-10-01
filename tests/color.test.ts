import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsv, hsvToHex, normalizeHex } from "../src/editor/color";

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
