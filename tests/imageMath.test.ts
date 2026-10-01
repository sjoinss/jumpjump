import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkDimensions,
  checkFileSize,
  detectFormat,
  fitToBox,
  hasTransparency,
  placedRect,
  posterize,
  removeBackground,
  workingSize, cornerBackground, dotGridFor, imageToDotPixels } from "../src/editor/imageMath";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

test("형식 판별: 매직 넘버로, SVG·텍스트는 거부", () => {
  assert.equal(detectFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "png");
  assert.equal(detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  assert.equal(detectFormat(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), "gif");
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectFormat(webp), "webp");
  assert.equal(detectFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(detectFormat(new Uint8Array([1, 2])), null);
});

test("상자 맞춤: 세로 기준, 가로 가운데·바닥 정렬", () => {
  // 세로로 긴 그림 100×200 → 세로 360, 가로 180
  assert.deepEqual(fitToBox(100, 200, 320, 360), { x: 70, y: 0, w: 180, h: 360 });
});

test("상자 맞춤: 가로가 넘치면 가로에 맞추고 바닥에 붙인다", () => {
  // 가로로 긴 그림 400×200 → 가로 320, 세로 160
  const r = fitToBox(400, 200, 320, 360);
  assert.deepEqual(r, { x: 0, y: 200, w: 320, h: 160 });
  assert.equal(r.y + r.h, 360, "바닥 정렬");
});

test("조정: 확대는 발밑 가운데 기준, 이동은 그대로 더한다", () => {
  const fit = fitToBox(100, 200, 320, 360);
  const r = placedRect(fit, { zoom: 0.5, dx: 10, dy: -20 });
  assert.equal(r.w, 90);
  assert.equal(r.x + r.w / 2, 160 + 10, "가로 가운데 유지 + 이동");
  assert.equal(r.y + r.h, 360 - 20, "바닥 유지 + 이동");
});

test("작업본 크기: 긴 변만 줄이고 작은 그림은 키우지 않음", () => {
  assert.deepEqual(workingSize(4000, 2000, 1080), { w: 1080, h: 540 });
  assert.deepEqual(workingSize(50, 80, 1080), { w: 50, h: 80 });
});

test("파일·해상도 상한: 원인과 해결 방법을 글로", () => {
  assert.equal(checkFileSize(1024).ok, true);
  const big = checkFileSize(12 * 1024 * 1024);
  assert.ok(!big.ok && big.message.includes("12.0MB") && big.message.includes("10MB"));
  assert.equal(checkDimensions(4000, 3000).ok, true);
  const huge = checkDimensions(9000, 100);
  assert.ok(!huge.ok && huge.message.includes("9000×100"));
});

/** w×h 이미지를 만들고 (x,y) → [r,g,b] 로 칠한다 */
function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
  return d;
}
const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

test("배경 제거: 테두리와 이어진 배경만, 둘러싸인 같은 색은 남긴다", () => {
  // 9×9 흰 배경, 가운데 5×5 빨간 사각형, 그 정중앙에 흰 점(눈)
  const w = 9;
  const src = image(w, w, (x, y) => {
    if (x === 4 && y === 4) return [255, 255, 255];
    if (x >= 2 && x <= 6 && y >= 2 && y <= 6) return [220, 30, 40];
    return [255, 255, 255];
  });
  const out = removeBackground(src, w, w, 20, false);
  assert.equal(alphaAt(out, w, 0, 0), 0, "배경은 투명");
  assert.equal(alphaAt(out, w, 3, 3), 255, "캐릭터는 남음");
  assert.equal(alphaAt(out, w, 4, 4), 255, "안쪽의 흰 점은 이어져 있지 않아서 남음");
  assert.equal(src[3], 255, "원본은 그대로");
});

test("배경 제거: 허용 오차 안의 비슷한 색까지, 가장자리 부드럽게", () => {
  const w = 6;
  // 배경이 살짝 얼룩진 흰색(245~255)
  const src = image(w, w, (x, y) => (x >= 2 && x <= 3 && y >= 2 && y <= 3 ? [0, 0, 200] : [250 + ((x + y) % 5), 250, 250]));
  const strict = removeBackground(src, w, w, 0, false);
  assert.ok(alphaAt(strict, w, 1, 0) === 255 || alphaAt(strict, w, 2, 0) === 255, "오차 0이면 얼룩은 남음");
  const loose = removeBackground(src, w, w, 20, true);
  assert.equal(alphaAt(loose, w, 1, 0), 0);
  assert.equal(alphaAt(loose, w, 2, 2), 128, "배경과 맞닿은 가장자리는 반투명");
});

test("투명도 판별, 색 줄이기", () => {
  const opaque = image(2, 2, () => [10, 20, 30]);
  assert.equal(hasTransparency(opaque), false);
  const t = new Uint8ClampedArray(opaque);
  t[3] = 0;
  assert.equal(hasTransparency(t), true);
  const p = posterize(new Uint8ClampedArray([255, 129, 7, 200]), 4);
  assert.deepEqual([...p], [240, 128, 0, 200], "알파는 건드리지 않음");
});

// ── 도트 크기 이미지 → 도트 칸 ──

function rgbaOf(w: number, h: number, cell: (x: number, y: number) => [number, number, number, number]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(cell(x, y), (y * w + x) * 4);
  return out;
}
const INKC: [number, number, number, number] = [61, 44, 94, 255];
const PINK: [number, number, number, number] = [255, 143, 171, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

test("도트로 고칠 수 있는 건 도트 격자와 같은 크기(16×18, 32×36)뿐, 나머지는 이미지로만", () => {
  assert.deepEqual(dotGridFor(16, 18), { width: 16, height: 18 });
  assert.deepEqual(dotGridFor(32, 36), { width: 32, height: 36 });
  for (const [w, h] of [[16, 16], [32, 32], [64, 72], [18, 16], [320, 360]]) assert.equal(dotGridFor(w, h), null, `${w}×${h}`);
});

test("도트 칸으로: 픽셀 하나 = 칸 하나, 반투명은 128 기준", () => {
  const src = rgbaOf(16, 18, (x, y) => (x === 0 && y === 0 ? [10, 20, 30, 200] : x === 1 && y === 0 ? [10, 20, 30, 100] : PINK));
  const px = imageToDotPixels(src, 16, 18, false);
  assert.equal(px.length, 16 * 18);
  assert.equal(px[0], "#0a141e");
  assert.equal(px[1], "");
  assert.equal(px[2], "#ff8fab");
});

test("배경 지우기: 테두리와 이어진 모서리 색만 비우고, 그림 안쪽의 같은 색은 남긴다", () => {
  const src = rgbaOf(16, 18, (x, y) => {
    if (x >= 4 && x <= 11 && y >= 4 && y <= 11) return x === 4 || x === 11 || y === 4 || y === 11 ? INKC : x === 7 && y === 7 ? WHITE : PINK;
    return WHITE;
  });
  assert.equal(cornerBackground(src, 16, 18), "#ffffff");
  const px = imageToDotPixels(src, 16, 18, true);
  const at = (x: number, y: number) => px[y * 16 + x];
  assert.equal(at(0, 0), "", "바깥 흰색은 지움");
  assert.equal(at(4, 4), "#3d2c5e");
  assert.equal(at(7, 7), "#ffffff", "안쪽 흰 눈은 남김");
  assert.equal(cornerBackground(rgbaOf(16, 18, (x, y) => ((x + y) % 2 ? INKC : PINK)), 16, 18), null, "모서리 색이 다르면 배경 없음");
});
