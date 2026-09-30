import type { ImageSprite, PixelSprite, Sprite } from "../lib/schema";

/**
 * 도트 스프라이트를 원본 크기(칸 1개 = 1px) 캔버스로 한 번만 만들어 두고,
 * 그릴 때는 imageSmoothingEnabled=false로 정수 배율 확대해서 도트를 선명하게 유지한다.
 */
const cache = new WeakMap<PixelSprite, HTMLCanvasElement>();

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function pixelSpriteCanvas(sprite: PixelSprite): HTMLCanvasElement {
  const hit = cache.get(sprite);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(sprite.width, sprite.height);
    sprite.pixels.forEach((color, i) => {
      const rgb = color ? hexToRgb(color) : null;
      if (!rgb) return; // 투명 또는 잘못된 값은 비워 둔다
      img.data[i * 4] = rgb[0];
      img.data[i * 4 + 1] = rgb[1];
      img.data[i * 4 + 2] = rgb[2];
      img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
  }
  cache.set(sprite, canvas);
  return canvas;
}

export function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelSpriteCanvas(sprite), Math.round(x), Math.round(y), width, height);
  ctx.imageSmoothingEnabled = prev;
}

/** 이미지 캐릭터(base64)를 한 번만 디코딩해 둔다. 디코딩이 끝나기 전에는 그리지 않는다 */
const imageCache = new WeakMap<ImageSprite, HTMLImageElement>();

function imageFor(sprite: ImageSprite): HTMLImageElement {
  let img = imageCache.get(sprite);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = `data:${sprite.mime};base64,${sprite.data}`;
    imageCache.set(sprite, img);
  }
  return img;
}

/** 도트는 정수 배율로 선명하게, 이미지는 부드럽게 보간해서 그린다 */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, width: number, height: number) {
  if (sprite.kind === "pixel") {
    drawPixelSprite(ctx, sprite, x, y, width, height);
    return;
  }
  const img = imageFor(sprite);
  if (!img.complete || img.naturalWidth === 0) return;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, width, height);
  ctx.imageSmoothingEnabled = prev;
}
