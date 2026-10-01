import { CONFIG } from "../game/config";
import type { ImageMime, ImageSprite } from "../lib/schema";
import { isSkinSize } from "./skin";
import {
  checkDimensions,
  checkFileSize,
  DECODE_FAIL_MESSAGE,
  detectFormat,
  dotGridFor,
  hasTransparency,
  hasVisiblePixel,
  posterize,
  removeBackground,
  UNSUPPORTED_MESSAGE,
  workingSize,
  type Rect,
} from "./imageMath";

/**
 * 이미지 불러오기의 브라우저 쪽 처리. 파일은 이 기기 안에서만 다루고 어디에도 보내지 않는다.
 * 원본 파일은 저장하지 않으며, 최종 결과를 캔버스로 다시 인코딩하므로 EXIF·위치 정보도 남지 않는다.
 */

export type LoadedImage = {
  /** 긴 변을 workMaxSide 이하로 줄인 작업본 (배경 제거·미리보기용) */
  work: HTMLCanvasElement;
  /** 원래 크기 */
  width: number;
  height: number;
  hasAlpha: boolean;
  /** 도트 격자와 같은 크기(16×18, 32×36)면 원본 픽셀 — 도트로 바꿔 고칠 수 있다. 아니면 null */
  dots: { width: number; height: number; rgba: Uint8ClampedArray } | null;
  /** 블록 게임 스킨 크기(64×64, 64×32)면 원본 픽셀 — 작은 도트 캐릭터로 조립할 수 있다 (skin.ts). 아니면 null */
  skin: { width: number; height: number; rgba: Uint8ClampedArray } | null;
};

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

function decodeWithImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export async function loadImageFile(file: File): Promise<Result<LoadedImage>> {
  const size = checkFileSize(file.size);
  if (!size.ok) return size;

  // 확장자·MIME 대신 파일 앞부분으로 형식 확인 (SVG 등 차단)
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = detectFormat(head);
  if (!format) return { ok: false, message: UNSUPPORTED_MESSAGE };

  let img: HTMLImageElement;
  try {
    // <img>는 EXIF 회전을 반영하고, GIF는 첫 프레임을 그린다
    img = await decodeWithImg(file);
  } catch {
    return { ok: false, message: DECODE_FAIL_MESSAGE };
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const dims = checkDimensions(width, height);
  if (!dims.ok) return dims;

  const { w, h } = workingSize(width, height, CONFIG.imageImport.workMaxSide);
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, message: DECODE_FAIL_MESSAGE };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  let hasAlpha = false;
  let dots: LoadedImage["dots"] = null;
  let skin: LoadedImage["skin"] = null;
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    hasAlpha = format !== "jpeg" && hasTransparency(data);
    // 작은 이미지는 작업본이 원본과 같은 크기(1:1)라 픽셀이 그대로다
    const grid = dotGridFor(width, height);
    if (grid && w === width && h === height) dots = { ...grid, rgba: data };
    if (format === "png" && isSkinSize(width, height) && w === width && h === height) skin = { width, height, rgba: data };
  } catch {
    return { ok: false, message: DECODE_FAIL_MESSAGE };
  }
  return { ok: true, value: { work, width, height, hasAlpha, dots, skin } };
}

export type BackgroundOptions = { enabled: boolean; tolerance: number; soften: boolean };

/** 배경 제거를 적용한 새 캔버스. 끄면 작업본을 그대로 돌려준다 */
export function applyBackground(work: HTMLCanvasElement, opt: BackgroundOptions): HTMLCanvasElement {
  if (!opt.enabled) return work;
  const src = work.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, work.width, work.height);
  const out = document.createElement("canvas");
  out.width = work.width;
  out.height = work.height;
  const data = removeBackground(src.data, work.width, work.height, opt.tolerance, opt.soften);
  out.getContext("2d")!.putImageData(new ImageData(data, work.width, work.height), 0, 0);
  return out;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * 조정 결과를 320×360 투명 캔버스에 그려 다시 인코딩한다 (기획서 6-2).
 * PNG가 상한을 넘으면 WebP 품질을 낮춰 보고, WebP 인코딩을 못 하는 브라우저면 색 단계를 줄인 PNG로.
 */
export async function encodeSprite(source: HTMLCanvasElement, rect: Rect): Promise<Result<ImageSprite>> {
  const { width, height } = CONFIG.limits.image;
  const cap = CONFIG.imageImport.outputMaxBytes;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
  const pixels = ctx.getImageData(0, 0, width, height);
  if (!hasVisiblePixel(pixels.data)) {
    return { ok: false, message: "상자 안에 그림이 없어요. 이미지를 상자 안으로 옮겨주세요." };
  }

  const finish = async (blob: Blob, mime: ImageMime): Promise<Result<ImageSprite>> => ({
    ok: true,
    value: { kind: "image", mime, data: await blobToBase64(blob), width, height },
  });

  const png = await toBlob(canvas, "image/png");
  if (png && png.size <= cap) return finish(png, "image/png");

  for (const q of [0.92, 0.85, 0.75, 0.6, 0.45]) {
    const webp = await toBlob(canvas, "image/webp", q);
    if (!webp || webp.type !== "image/webp") break; // 이 브라우저는 WebP로 저장하지 못한다
    if (webp.size <= cap) return finish(webp, "image/webp");
  }

  for (const bits of [5, 4, 3]) {
    ctx.putImageData(new ImageData(posterize(pixels.data, bits), width, height), 0, 0);
    const reduced = await toBlob(canvas, "image/png");
    if (reduced && reduced.size <= cap) return finish(reduced, "image/png");
  }
  return { ok: false, message: "이미지가 너무 복잡해서 작게 줄이지 못했어요. 더 단순한 이미지를 골라주세요." };
}

