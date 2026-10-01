/**
 * GIF89a 인코더 (기획서 13-5). 외부 라이브러리 없이 직접 구현: 색 양자화(미디언 컷) + 디더링 + LZW.
 * DOM 없이 동작해서 Web Worker와 테스트에서 그대로 쓴다.
 *
 * 메모리를 아끼려고 두 단계로 나눈다.
 * 1) sample(): 프레임(작게 그려도 됨)을 넣어 색 분포를 모은다 → 전 프레임 공용 팔레트
 * 2) addFrame(): 프레임을 하나씩 넣으면 바로 팔레트 번호로 바꿔 압축한다 (원본 RGBA를 쌓아 두지 않음)
 */

export type GifOptions = {
  width: number;
  height: number;
  /** 프레임 간격 (1/100초) */
  delayCs: number;
  /** 이미지 캐릭터처럼 색이 많은 그림이 있으면 켠다 (Floyd–Steinberg) */
  dither: boolean;
};

const MAX_COLORS = 256;

/** 15비트 색 키 (채널당 5비트) */
const key15 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

type Box = { colors: number[]; };

export class GifEncoder {
  private readonly histogram = new Map<number, number>();
  /** 정확한 색 (채널 8비트) — 256색 이하면 양자화 없이 그대로 쓴다 */
  private readonly exact = new Map<number, number>();
  private palette: number[][] | null = null;
  private lookup = new Map<number, number>();
  private readonly out = new ByteWriter();
  private frames = 0;

  constructor(private readonly opts: GifOptions) {}

  /** 색 분포 모으기 (RGBA). 투명은 무시한다 */
  sample(rgba: Uint8ClampedArray | Uint8Array) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) continue;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const k = key15(r, g, b);
      this.histogram.set(k, (this.histogram.get(k) ?? 0) + 1);
      if (this.exact.size <= MAX_COLORS) {
        const e = (r << 16) | (g << 8) | b;
        this.exact.set(e, (this.exact.get(e) ?? 0) + 1);
      }
    }
  }

  /** 지금까지 모은 색으로 팔레트를 정한다 (첫 addFrame 때 자동으로 불린다) */
  buildPalette(): number[][] {
    if (this.palette) return this.palette;
    let colors: number[][];
    if (this.exact.size > 0 && this.exact.size <= MAX_COLORS) {
      colors = [...this.exact.keys()].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
    } else {
      colors = medianCut(this.histogram, MAX_COLORS);
    }
    if (colors.length === 0) colors = [[0, 0, 0]];
    this.palette = colors;
    this.writeHeader();
    return colors;
  }

  /** 프레임 하나 (RGBA, width×height) */
  addFrame(rgba: Uint8ClampedArray | Uint8Array) {
    const { width, height, delayCs } = this.opts;
    if (rgba.length !== width * height * 4) throw new Error("프레임 크기가 맞지 않습니다");
    this.buildPalette();
    const indices = this.opts.dither ? this.mapDithered(rgba) : this.mapPlain(rgba);
    const w = this.out;
    // 그래픽 제어 확장: 지연 시간, 이전 프레임 위에 덮어 그림
    w.bytes(0x21, 0xf9, 0x04, 0x04);
    w.u16(delayCs);
    w.bytes(0x00, 0x00);
    // 이미지 설명자 (전체 화면, 지역 팔레트 없음)
    w.bytes(0x2c);
    w.u16(0);
    w.u16(0);
    w.u16(width);
    w.u16(height);
    w.bytes(0x00);
    const minCodeSize = Math.max(2, Math.ceil(Math.log2(this.paletteSize())));
    w.bytes(minCodeSize);
    const data = lzwEncode(indices, minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.subarray(i, i + 255);
      w.bytes(chunk.length);
      w.append(chunk);
    }
    w.bytes(0x00);
    this.frames += 1;
  }

  /** 끝내고 파일 바이트를 돌려준다 */
  finish(): Uint8Array {
    if (this.frames === 0) throw new Error("프레임이 없습니다");
    this.out.bytes(0x3b);
    return this.out.result();
  }

  /** 팔레트 크기를 2의 거듭제곱으로 (GIF 규칙) */
  private paletteSize() {
    let n = 2;
    while (n < (this.palette?.length ?? 0)) n *= 2;
    return n;
  }

  private writeHeader() {
    const { width, height } = this.opts;
    const w = this.out;
    const size = this.paletteSize();
    const bits = Math.log2(size) - 1;
    w.ascii("GIF89a");
    w.u16(width);
    w.u16(height);
    // 전역 팔레트 있음 + 색 해상도 + 팔레트 크기
    w.bytes(0x80 | (7 << 4) | bits, 0, 0);
    for (let i = 0; i < size; i++) {
      const c = this.palette![i] ?? [0, 0, 0];
      w.bytes(c[0], c[1], c[2]);
    }
    // 무한 반복 (NETSCAPE2.0)
    w.bytes(0x21, 0xff, 0x0b);
    w.ascii("NETSCAPE2.0");
    w.bytes(0x03, 0x01, 0x00, 0x00, 0x00);
  }

  private nearest(r: number, g: number, b: number) {
    const k = (r << 16) | (g << 8) | b;
    const hit = this.lookup.get(k);
    if (hit !== undefined) return hit;
    const pal = this.palette!;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const p = pal[i];
      // 사람 눈에 맞춘 가중치 (초록에 민감)
      const d = 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
        if (d === 0) break;
      }
    }
    if (this.lookup.size < 200_000) this.lookup.set(k, best);
    return best;
  }

  private mapPlain(rgba: Uint8ClampedArray | Uint8Array) {
    const n = rgba.length / 4;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    return out;
  }

  private mapDithered(rgba: Uint8ClampedArray | Uint8Array) {
    const { width, height } = this.opts;
    const err = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      err[i * 3] = rgba[i * 4];
      err[i * 3 + 1] = rgba[i * 4 + 1];
      err[i * 3 + 2] = rgba[i * 4 + 2];
    }
    const out = new Uint8Array(width * height);
    const pal = this.palette!;
    const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
    const spread = (x: number, y: number, e: number[], f: number) => {
      if (x < 0 || x >= width || y >= height) return;
      const j = (y * width + x) * 3;
      err[j] += e[0] * f;
      err[j + 1] += e[1] * f;
      err[j + 2] += e[2] * f;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const j = (y * width + x) * 3;
        const r = clamp(err[j]);
        const g = clamp(err[j + 1]);
        const b = clamp(err[j + 2]);
        const idx = this.nearest(r, g, b);
        out[y * width + x] = idx;
        const p = pal[idx];
        const e = [r - p[0], g - p[1], b - p[2]];
        // 아주 작은 오차는 퍼뜨리지 않는다: 도트 그림의 단색 면에 점무늬가 생기지 않게
        if (Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]) < 12) continue;
        spread(x + 1, y, e, 7 / 16);
        spread(x - 1, y + 1, e, 3 / 16);
        spread(x, y + 1, e, 5 / 16);
        spread(x + 1, y + 1, e, 1 / 16);
      }
    }
    return out;
  }
}

/** 미디언 컷: 색 상자를 가장 넓은 채널 기준으로 반씩 나눠 maxColors개 대표색을 만든다 */
export function medianCut(histogram: Map<number, number>, maxColors: number): number[][] {
  const entries = [...histogram.keys()];
  if (entries.length === 0) return [];
  const ch = (c: number, k: number) => ((c >> (10 - k * 5)) & 31) << 3;
  const boxes: Box[] = [{ colors: entries }];
  const range = (b: Box, k: number) => {
    let lo = 255;
    let hi = 0;
    for (const c of b.colors) {
      const v = ch(c, k);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  };
  while (boxes.length < maxColors) {
    // 나눌 수 있는 상자 중 가장 넓은 것
    let target = -1;
    let targetK = 0;
    let widest = 0;
    boxes.forEach((b, i) => {
      if (b.colors.length < 2) return;
      for (let k = 0; k < 3; k++) {
        const r = range(b, k);
        if (r > widest) {
          widest = r;
          target = i;
          targetK = k;
        }
      }
    });
    if (target < 0) break;
    const box = boxes[target];
    box.colors.sort((a, b) => ch(a, targetK) - ch(b, targetK));
    // 픽셀 수 기준 가운데에서 자른다
    const total = box.colors.reduce((s, c) => s + (histogram.get(c) ?? 0), 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.colors.length - 1; i++) {
      acc += histogram.get(box.colors[i]) ?? 0;
      if (acc >= total / 2) {
        cut = i + 1;
        break;
      }
      cut = i + 1;
    }
    boxes.splice(target, 1, { colors: box.colors.slice(0, cut) }, { colors: box.colors.slice(cut) });
  }
  // 상자마다 픽셀 수로 가중 평균한 색
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (const c of b.colors) {
      const w = histogram.get(c) ?? 1;
      r += (ch(c, 0) + 4) * w;
      g += (ch(c, 1) + 4) * w;
      bl += (ch(c, 2) + 4) * w;
      n += w;
    }
    return [Math.min(255, Math.round(r / n)), Math.min(255, Math.round(g / n)), Math.min(255, Math.round(bl / n))];
  });
}

/** GIF LZW 압축 (가변 길이 코드, 최대 12비트) */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const bits = new BitWriter();
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();
  bits.write(clear, codeSize);
  if (indices.length === 0) {
    bits.write(eoi, codeSize);
    return bits.result();
  }
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    bits.write(prefix, codeSize);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      // 사전이 가득 차면 처음부터
      bits.write(clear, codeSize);
      dict = new Map();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  bits.write(prefix, codeSize);
  bits.write(eoi, codeSize);
  return bits.result();
}

class BitWriter {
  private buf = new Uint8Array(4096);
  private len = 0;
  private cur = 0;
  private curBits = 0;

  write(code: number, size: number) {
    this.cur |= code << this.curBits;
    this.curBits += size;
    while (this.curBits >= 8) {
      this.push(this.cur & 255);
      this.cur >>>= 8;
      this.curBits -= 8;
    }
  }

  result() {
    if (this.curBits > 0) {
      this.push(this.cur & 255);
      this.cur = 0;
      this.curBits = 0;
    }
    return this.buf.slice(0, this.len);
  }

  private push(b: number) {
    if (this.len === this.buf.length) {
      const bigger = new Uint8Array(this.buf.length * 2);
      bigger.set(this.buf);
      this.buf = bigger;
    }
    this.buf[this.len++] = b;
  }
}

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  private len = 0;

  bytes(...values: number[]) {
    this.ensure(values.length);
    for (const v of values) this.buf[this.len++] = v & 255;
  }

  u16(v: number) {
    this.bytes(v & 255, (v >> 8) & 255);
  }

  ascii(s: string) {
    this.bytes(...[...s].map((c) => c.charCodeAt(0)));
  }

  append(data: Uint8Array) {
    this.ensure(data.length);
    this.buf.set(data, this.len);
    this.len += data.length;
  }

  result() {
    return this.buf.slice(0, this.len);
  }

  private ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const bigger = new Uint8Array(size);
    bigger.set(this.buf.subarray(0, this.len));
    this.buf = bigger;
  }
}
