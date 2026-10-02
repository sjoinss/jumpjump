import type { PixelSprite } from "../lib/schema";

/**
 * 도트 그림 → 배경이 투명한 PNG (사용자 요청 2026-10-02). 크기는 64·128·256·512 중에서.
 * - 캐릭터: 고른 크기의 정사각형. 도트가 흐려지지 않게 칸을 정수 배로 키우고 가운데에 둔다 (예: 16×18을 64로 → 3배 48×54)
 * - 발판: 고른 크기가 가로 (32×8을 256으로 → 8배 256×64)
 */

export const PNG_SIZES = [64, 128, 256, 512] as const;
export type PngSize = (typeof PNG_SIZES)[number];

export type PngLayout = { width: number; height: number; scale: number; x: number; y: number };

export function pngLayout(sprite: Pick<PixelSprite, "width" | "height">, size: PngSize, platform: boolean): PngLayout {
  if (platform) {
    const scale = Math.max(1, Math.floor(size / sprite.width));
    return { width: sprite.width * scale, height: sprite.height * scale, scale, x: 0, y: 0 };
  }
  const scale = Math.max(1, Math.floor(size / Math.max(sprite.width, sprite.height)));
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  return { width: size, height: size, scale, x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2) };
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
    ctx.fillStyle = color;
    ctx.fillRect(l.x + (i % sprite.width) * l.scale, l.y + Math.floor(i / sprite.width) * l.scale, l.scale, l.scale);
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG로 바꾸지 못했어요"))), "image/png"),
  );
}
