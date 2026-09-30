"use client";

import type { Sprite } from "@/lib/schema";
import { PixelPreview } from "./PixelPreview";

type Props = {
  sprite: Sprite;
  width: number;
  height: number;
  label?: string;
  className?: string;
};

/** 도트는 선명하게(PixelPreview), 이미지는 부드럽게(img) 보여준다 */
export function SpritePreview({ sprite, width, height, label, className }: Props) {
  if (sprite.kind === "pixel") {
    return <PixelPreview sprite={sprite} width={width} height={height} label={label} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 사용자가 넣은 base64 이미지를 그대로 보여준다
    <img
      src={`data:${sprite.mime};base64,${sprite.data}`}
      width={width}
      height={height}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
