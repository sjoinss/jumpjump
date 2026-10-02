import type { PixelSprite } from "../lib/schema";

/**
 * 도트 그림 → 배경이 투명한 PNG (사용자 요청 2026-10-02). 크기는 64·128·256·512 중에서.
 * 칸 격자 전체(빈 칸 포함)를 그대로, 고른 크기가 가로가 되게 정수 배로 키운다. 여백을 덧붙이지 않는다.
 * 예: 16×18 격자를 256으로 → 16배 256×288, 32×36을 64로 → 2배 64×72, 발판 32×8을 512로 → 512×128.
 * (처음엔 정사각형 안에 넣고 여백을 붙여 그림이 고른 크기보다 작아 보였고, 그다음 빈 칸을 잘랐더니 격자 그대로가 맞다는 의견 — 2026-10-02)
 */

export const PNG_SIZES = [64, 128, 256, 512] as const;
export type PngSize = (typeof PNG_SIZES)[number];

export type PngLayout = { width: number; height: number; scale: number };

export function pngLayout(sprite: Pick<PixelSprite, "width" | "height">, size: PngSize): PngLayout {
  const scale = Math.max(1, Math.round(size / sprite.width));
  return { width: sprite.width * scale, height: sprite.height * scale, scale };
}

export function spriteToPng(sprite: PixelSprite, size: PngSize): Promise<Blob> {
  const l = pngLayout(sprite, size);
  const canvas = document.createElement("canvas");
  canvas.width = l.width;
  canvas.height = l.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("그림을 만들 수 없어요"));
  // 칸마다 사각형을 채운다 (확대 보간이 끼어들 일이 없어 테두리가 선명하다)
  sprite.pixels.forEach((color, i) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect((i % sprite.width) * l.scale, Math.floor(i / sprite.width) * l.scale, l.scale, l.scale);
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG로 바꾸지 못했어요"))), "image/png"),
  );
}
