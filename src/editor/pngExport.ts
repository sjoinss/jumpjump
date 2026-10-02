import type { PixelSprite } from "../lib/schema";

/**
 * 도트 그림 → 배경이 투명한 PNG (사용자 요청 2026-10-02). 크기는 64·128·256·512 중에서.
 * - 캐릭터: 고른 크기의 정사각형 파일. 그린 칸만 잘라서(둘레 빈 칸은 버린다) 꽉 차게 키우고 가운데에 둔다.
 *   도트가 흐려지지 않게 정수 배로만 키우므로 남는 여백은 한 칸 크기보다 작다 (예: 12×15칸을 256으로 → 17배 204×255)
 *   (처음엔 격자 전체를 넣어서 그림이 고른 크기보다 한참 작아 보였다 — 2026-10-02 사용자 지적)
 * - 발판: 고른 크기가 가로 (32×8을 256으로 → 8배 256×64)
 */

export const PNG_SIZES = [64, 128, 256, 512] as const;
export type PngSize = (typeof PNG_SIZES)[number];

/** 그린 칸이 있는 영역 (없으면 전체) */
export type Crop = { x: number; y: number; width: number; height: number };

export type PngLayout = { width: number; height: number; scale: number; x: number; y: number; crop: Crop };

export function drawnBounds(sprite: PixelSprite): Crop {
  let minX = sprite.width;
  let minY = sprite.height;
  let maxX = -1;
  let maxY = -1;
  sprite.pixels.forEach((c, i) => {
    if (!c) return;
    const x = i % sprite.width;
    const y = Math.floor(i / sprite.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  if (maxX < 0) return { x: 0, y: 0, width: sprite.width, height: sprite.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function pngLayout(sprite: PixelSprite, size: PngSize, platform: boolean): PngLayout {
  if (platform) {
    const crop = { x: 0, y: 0, width: sprite.width, height: sprite.height };
    const scale = Math.max(1, Math.floor(size / sprite.width));
    return { width: sprite.width * scale, height: sprite.height * scale, scale, x: 0, y: 0, crop };
  }
  const crop = drawnBounds(sprite);
  const scale = Math.max(1, Math.floor(size / Math.max(crop.width, crop.height)));
  const w = crop.width * scale;
  const h = crop.height * scale;
  return { width: size, height: size, scale, x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2), crop };
}

export function spriteToPng(sprite: PixelSprite, size: PngSize, platform: boolean): Promise<Blob> {
  const l = pngLayout(sprite, size, platform);
  const canvas = document.createElement("canvas");
  canvas.width = l.width;
  canvas.height = l.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("그림을 만들 수 없어요"));
  // 칸마다 사각형을 채운다 (확대 보간이 끼어들 일이 없어 테두리가 선명하다)
  sprite.pixels.forEach((color, i) => {
    if (!color) return;
    const cx = (i % sprite.width) - l.crop.x;
    const cy = Math.floor(i / sprite.width) - l.crop.y;
    ctx.fillStyle = color;
    ctx.fillRect(l.x + cx * l.scale, l.y + cy * l.scale, l.scale, l.scale);
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG로 바꾸지 못했어요"))), "image/png"),
  );
}
