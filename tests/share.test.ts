import { test } from "node:test";
import assert from "node:assert/strict";
import { GifEncoder, lzwEncode, medianCut } from "../src/share/gif";
import { bestFrame, CARD, cardSlots, jumpPose, memberPose, snapSize } from "../src/share/layout";

// ── 배치 ──

test("카드 배치: 1~2명은 큰 크기 한 줄, 3명은 작게 한 줄, 4~6명은 앞뒤 줄", () => {
  assert.deepEqual(cardSlots(1).map((s) => [s.member, s.width]), [[0, 128]]);
  assert.deepEqual(cardSlots(2).map((s) => s.width), [128, 128]);
  assert.deepEqual(cardSlots(3).map((s) => s.width), [96, 96, 96]);
  for (const n of [4, 5, 6]) {
    const slots = cardSlots(n);
    assert.equal(slots.length, n);
    assert.deepEqual(slots.map((s) => s.member).sort(), Array.from({ length: n }, (_, i) => i));
    // 뒷줄을 먼저 그리고, 뒷줄은 약 60px 위
    const firstFront = slots.findIndex((s) => s.row === 0);
    assert.ok(slots.slice(firstFront).every((s) => s.row === 0));
    const back = slots.filter((s) => s.row === 1);
    assert.equal(back.length, n - 3);
    for (const b of back) assert.equal(slots.find((s) => s.row === 0)!.groundY - b.groundY, 60);
  }
});

test("주인공은 앞줄 가운데 (2명일 땐 앞줄 왼쪽), 모두 카드 안", () => {
  for (const n of [1, 3, 4, 5, 6]) assert.equal(cardSlots(n).find((s) => s.member === 0)!.cx, 180);
  for (let n = 1; n <= 6; n++) {
    for (const s of cardSlots(n)) {
      assert.ok(s.cx - s.width / 2 >= 0 && s.cx + s.width / 2 <= CARD.size, `${n}명 ${s.member}`);
      // 가장 높이 뛰어도 위쪽 점수 영역을 가리지 않는다
      assert.ok(s.groundY - s.height - 44 >= CARD.headerHeight - 4, `${n}명 ${s.member} 높이`);
    }
  }
});

// ── 폴짝 모션 ──

test("폴짝: 준비 때 눌리고, 도약 때 늘어나고, 정점에서 원래 비율, 착지 때 강하게 눌린다", () => {
  const ready = jumpPose(0.09, 40);
  assert.ok(ready.sx > 1 && ready.sy < 1 && ready.lift === 0);
  const launch = jumpPose(0.15, 40);
  assert.ok(launch.sy > 1.1 && launch.sx < 1);
  const top = jumpPose(0.45, 40);
  assert.deepEqual([top.lift, top.sx, top.sy], [40, 1, 1]);
  const land = jumpPose(0.73, 40);
  assert.ok(land.landing && land.sy < 0.85 && land.lift === 0);
  assert.equal(jumpPose(0.45, 40).landing, false);
});

test("폴짝: 상승은 ease-out(처음이 빠름), 하강은 ease-in(나중이 빠름)", () => {
  const up1 = jumpPose(0.2, 40).lift - jumpPose(0.16, 40).lift;
  const up2 = jumpPose(0.4 - 0.001, 40).lift - jumpPose(0.36, 40).lift;
  assert.ok(up1 > up2);
  const down1 = jumpPose(0.54, 40).lift - jumpPose(0.5, 40).lift;
  const down2 = jumpPose(0.7 - 0.001, 40).lift - jumpPose(0.66, 40).lift;
  assert.ok(Math.abs(down1) < Math.abs(down2));
});

test("루프가 자연스럽게 이어진다: 마지막 프레임 다음은 첫 프레임과 같은 자세", () => {
  for (let m = 0; m < 6; m++) assert.deepEqual(memberPose(m, CARD.loopFrames), memberPose(m, 0));
});

test("착지 단계는 약 0.2초(4프레임 안팎)", () => {
  const frames = Array.from({ length: CARD.loopFrames }, (_, f) => memberPose(0, f).landing).filter(Boolean).length;
  assert.ok(frames >= 3 && frames <= 5, `${frames}프레임`);
});

test("캐릭터마다 위상이 달라서 동시에 뛰지 않는다", () => {
  const lifts = (f: number) => [0, 1, 2].map((m) => memberPose(m, f).lift);
  const same = Array.from({ length: CARD.loopFrames }, (_, f) => lifts(f)).filter((l) => l[0] === l[1] && l[1] === l[2]).length;
  assert.ok(same < 4);
});

test("크기 스냅: 도트 그림은 칸 수의 배수(한 칸이 정수 px), 이미지는 정수 px", () => {
  assert.equal(snapSize(96, 1.18, 16) % 16, 0);
  assert.equal(snapSize(96, 1.18, 32) % 32, 0);
  assert.equal(snapSize(96, 1, 16), 96);
  assert.equal(snapSize(96, 1.18, null), 113);
});

test("PNG 대표 프레임: 여러 명이 서로 다른 높이로 떠 있다", () => {
  for (const n of [3, 6]) {
    const f = bestFrame(n);
    const lifts = cardSlots(n).map((s) => memberPose(s.member, f).lift);
    assert.ok(lifts.filter((l) => l > 6).length >= Math.ceil(n / 2), `${n}명: ${lifts}`);
    assert.ok(new Set(lifts.map(Math.round)).size >= Math.min(n, 3));
  }
});

// ── GIF ──

/** 검증용 최소 GIF 디코더: 전역 팔레트 + 프레임별 인덱스 */
function decodeGif(bytes: Uint8Array) {
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => u8() | (u8() << 8);
  const sig = String.fromCharCode(...bytes.slice(0, 6));
  p = 6;
  const width = u16();
  const height = u16();
  const packed = u8();
  p += 2;
  const size = 2 << (packed & 7);
  const palette: number[][] = [];
  for (let i = 0; i < size; i++) palette.push([u8(), u8(), u8()]);
  const frames: { indices: number[]; delay: number }[] = [];
  let delay = 0;
  let loop = false;
  for (;;) {
    const b = u8();
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        p += 2;
        delay = u16();
        p += 2;
      } else {
        if (label === 0xff) loop = String.fromCharCode(...bytes.slice(p + 1, p + 12)) === "NETSCAPE2.0";
        for (let n = u8(); n > 0; n = u8()) p += n;
      }
      continue;
    }
    assert.equal(b, 0x2c);
    p += 8;
    u8();
    const min = u8();
    const data: number[] = [];
    for (let n = u8(); n > 0; n = u8()) for (let i = 0; i < n; i++) data.push(u8());
    frames.push({ indices: lzwDecode(data, min, width * height), delay });
  }
  return { sig, width, height, palette, frames, loop };
}

function lzwDecode(data: number[], min: number, count: number) {
  const clear = 1 << min;
  const eoi = clear + 1;
  let size = min + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: clear + 2 }, (_, i) => [i]);
    size = min + 1;
  };
  reset();
  let bitPos = 0;
  const read = () => {
    let v = 0;
    for (let i = 0; i < size; i++, bitPos++) v |= ((data[bitPos >> 3] >> (bitPos & 7)) & 1) << i;
    return v;
  };
  const out: number[] = [];
  let prev: number[] | null = null;
  while (out.length < count + 1) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else throw new Error("bad code");
    out.push(...entry);
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length === 1 << size && size < 12) size += 1;
  }
  return out;
}

function solid(w: number, h: number, pick: (x: number, y: number) => [number, number, number]) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pick(x, y);
      a.set([r, g, b, 255], (y * w + x) * 4);
    }
  return a;
}

test("GIF: 머리말·무한 반복·프레임 지연, 256색 이하는 색이 정확히 그대로", () => {
  const w = 20;
  const h = 10;
  const colors: [number, number, number][] = [
    [255, 143, 171],
    [61, 44, 94],
    [255, 255, 255],
    [124, 201, 143],
  ];
  const f1 = solid(w, h, (x, y) => colors[(x + y) % 4]);
  const f2 = solid(w, h, (x) => colors[x % 2]);
  const enc = new GifEncoder({ width: w, height: h, delayCs: 5, dither: false });
  enc.sample(f1);
  enc.sample(f2);
  enc.addFrame(f1);
  enc.addFrame(f2);
  const gif = decodeGif(enc.finish());
  assert.equal(gif.sig, "GIF89a");
  assert.deepEqual([gif.width, gif.height], [w, h]);
  assert.equal(gif.loop, true);
  assert.equal(gif.frames.length, 2);
  assert.equal(gif.frames[0].delay, 5);
  for (const [fi, src] of [f1, f2].entries()) {
    const idx = gif.frames[fi].indices;
    for (let i = 0; i < w * h; i++) assert.deepEqual(gif.palette[idx[i]], [...src.slice(i * 4, i * 4 + 3)]);
  }
});

test("GIF: 색이 많으면 256색으로 줄이고, 비슷한 색으로 그린다 (디더링 포함)", () => {
  const w = 64;
  const h = 64;
  const grad = solid(w, h, (x, y) => [x * 4, y * 4, (x + y) * 2]);
  for (const dither of [false, true]) {
    const enc = new GifEncoder({ width: w, height: h, delayCs: 5, dither });
    enc.sample(grad);
    enc.addFrame(grad);
    const gif = decodeGif(enc.finish());
    assert.ok(gif.palette.length <= 256);
    const idx = gif.frames[0].indices;
    let err = 0;
    for (let i = 0; i < w * h; i++) {
      const p = gif.palette[idx[i]];
      err += Math.abs(p[0] - grad[i * 4]) + Math.abs(p[1] - grad[i * 4 + 1]) + Math.abs(p[2] - grad[i * 4 + 2]);
    }
    assert.ok(err / (w * h) < 30, `평균 오차 ${err / (w * h)} (dither ${dither})`);
  }
});

test("LZW: 긴 데이터(사전이 꽉 차서 처음부터 다시)도 그대로 복원", () => {
  const n = 120_000;
  const data = new Uint8Array(n);
  let s = 7;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s >> 16) % 64;
  }
  const enc = lzwEncode(data, 6);
  assert.deepEqual(lzwDecode([...enc], 6, n), [...data]);
});

test("미디언 컷: 요청한 개수 이하로 대표색을 만든다", () => {
  const hist = new Map<number, number>();
  for (let i = 0; i < 5000; i++) hist.set(i * 6, 1 + (i % 7));
  const pal = medianCut(hist, 16);
  assert.ok(pal.length <= 16 && pal.length > 8);
  for (const c of pal) for (const v of c) assert.ok(v >= 0 && v <= 255);
});
