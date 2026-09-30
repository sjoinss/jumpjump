"use client";

import { useEffect, useRef } from "react";
import type { PixelSprite } from "@/lib/schema";
import { pixelSpriteCanvas } from "@/game/sprites";

type Props = {
  sprite: PixelSprite;
  /** 표시 크기(CSS px). 도트가 선명하도록 격자의 정수배를 권장 */
  width: number;
  height: number;
  /** 스크린리더용 설명. 장식이면 비워 둔다 */
  label?: string;
  className?: string;
};

/** 도트 스프라이트 미리보기. DPR까지 고려해 정수 배율로 그린다 */
export function PixelPreview({ sprite, width, height, label, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(pixelSpriteCanvas(sprite), 0, 0, canvas.width, canvas.height);
  }, [sprite, width, height]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height, imageRendering: "pixelated" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
