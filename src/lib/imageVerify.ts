import { CONFIG } from "../game/config";
import { encodeSprite } from "../editor/imageDom";
import { fitToBox } from "../editor/imageMath";
import { collectImages, replaceImages, type ExportData } from "./dataFile";
import type { ImageSprite } from "./schema";
import type { Result } from "./validate";

function decode(sprite: ImageSprite): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = `data:${sprite.mime};base64,${sprite.data}`;
  });
}

/**
 * 불러온 파일 속 이미지를 실제로 디코딩해 보고(실패하면 전체 거부),
 * 통과하면 320×360 캔버스에 다시 그려 새로 인코딩한 것으로 바꾼다 (기획서 14-2).
 * 파일 안의 바이트를 그대로 저장하지 않으므로 숨은 데이터·메타데이터가 남지 않는다.
 */
export async function verifyImages(data: ExportData): Promise<Result<ExportData>> {
  const { width, height } = CONFIG.limits.image;
  const replaced = new Map<ImageSprite, ImageSprite>();
  for (const { label, sprite } of collectImages(data)) {
    let img: HTMLImageElement;
    try {
      img = await decode(sprite);
    } catch {
      return { ok: false, error: `${label}의 이미지를 열 수 없습니다` };
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 1 || h < 1 || w > width || h > height) return { ok: false, error: `${label}의 이미지 크기가 올바르지 않습니다` };

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const r = await encodeSprite(canvas, w === width && h === height ? { x: 0, y: 0, w, h } : fitToBox(w, h, width, height));
    if (!r.ok) return { ok: false, error: `${label}: ${r.message}` };
    replaced.set(sprite, r.value);
  }
  return { ok: true, value: replaceImages(data, replaced) };
}
