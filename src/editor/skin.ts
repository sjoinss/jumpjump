/**
 * 블록 게임 스킨(64×64 또는 예전 64×32 PNG) → 작은 도트 캐릭터 32×36.
 * 스킨 파일은 머리·몸·팔·다리 각 면이 정해진 자리에 펼쳐져 있다. 그중 "앞면"만 떼어 꼬마 비율로 다시 조립한다:
 *   머리 8×8 → 2배(16×16), 그 아래 팔·몸·팔(12줄 그대로), 다리 12줄 → 8줄.
 * 덧입는 층(모자·겉옷·소매·바지)은 불투명한 곳만 위에 덮는다. 예전 64×32 스킨은 왼팔·왼다리가 없어 오른쪽을 좌우로 뒤집어 쓴다.
 * 결과는 도트 칸이라 에디터에서 펜·지우개로 바로 고칠 수 있다.
 */

export const SKIN_WIDTH = 64;
export const SKIN_OUT = { width: 32, height: 36 } as const;

/** 반투명은 이 값 이상이면 칠한 칸 */
const ALPHA_CUT = 128;

export function isSkinSize(w: number, h: number) {
  return w === SKIN_WIDTH && (h === 64 || h === 32);
}

type Src = { rgba: Uint8ClampedArray; width: number; height: number };
type Face = { x: number; y: number; w: number; h: number };

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function pixel(src: Src, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= src.width || y >= src.height) return "";
  const i = (y * src.width + x) * 4;
  if (src.rgba[i + 3] < ALPHA_CUT) return "";
  return `#${hex2(src.rgba[i])}${hex2(src.rgba[i + 1])}${hex2(src.rgba[i + 2])}`;
}

/** 면 전체가 불투명한지 */
function fullyOpaque(src: Src, f: Face) {
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (!pixel(src, x, y)) return false;
  return true;
}

/** 이 면이 전부 투명한지 (얇은 팔 판별용) */
function emptyColumn(src: Src, x: number, y: number, h: number) {
  for (let k = 0; k < h; k++) if (pixel(src, x, y + k)) return false;
  return true;
}

/**
 * @returns 32×36 도트 칸 (왼쪽 위부터, "#rrggbb" 또는 "" 투명)
 */
export function skinToDots(src: Src): string[] {
  const { width: W, height: H } = SKIN_OUT;
  const out: string[] = new Array(W * H).fill("");
  const modern = src.height === 64;

  /**
   * 면 하나를 out에 옮긴다. sx·sy는 배율(머리 2배), rows는 세로로 몇 줄에 담을지(다리 12→8줄).
   * mirror면 좌우를 뒤집어 읽는다 (예전 스킨의 왼팔·왼다리).
   */
  const put = (face: Face, overlay: Face | null, dx: number, dy: number, scale: number, rows = face.h * scale, mirror = false) => {
    const cols = face.w * scale;
    for (let oy = 0; oy < rows; oy++) {
      const fy = Math.min(face.h - 1, Math.floor((oy * face.h) / rows));
      for (let ox = 0; ox < cols; ox++) {
        const fxRaw = Math.floor(ox / scale);
        const fx = mirror ? face.w - 1 - fxRaw : fxRaw;
        const top = overlay ? pixel(src, overlay.x + fx, overlay.y + fy) : "";
        const color = top || pixel(src, face.x + fx, face.y + fy);
        const tx = dx + ox;
        const ty = dy + oy;
        if (color && tx >= 0 && tx < W && ty >= 0 && ty < H) out[ty * W + tx] = color;
      }
    }
  };

  // 얇은 팔(3px) 스킨: 64×64에서 굵은 팔의 넷째 줄이 비어 있다
  const slim = modern && emptyColumn(src, 47, 20, 12);
  const armW = slim ? 3 : 4;

  // 머리 (앞면 8×8, 모자 층) → 16×16.
  // 예전 64×32 스킨은 모자 층을 검은색 등으로 꽉 채워 둔 경우가 많다 — 게임도 모자 층 전체(32×16)가 불투명하면 모자가 없는 것으로 본다
  const hat = { x: 40, y: 8, w: 8, h: 8 };
  const hatUsable = modern || !fullyOpaque(src, { x: 32, y: 0, w: 32, h: 16 });
  put({ x: 8, y: 8, w: 8, h: 8 }, hatUsable ? hat : null, 8, 0, 2);
  // 몸 (앞면 8×12, 겉옷 층)
  put({ x: 20, y: 20, w: 8, h: 12 }, modern ? { x: 20, y: 36, w: 8, h: 12 } : null, 12, 16, 1);
  // 팔: 화면 왼쪽 = 캐릭터의 오른팔
  const rightArm = { x: 44, y: 20, w: armW, h: 12 };
  put(rightArm, modern ? { x: 44, y: 36, w: armW, h: 12 } : null, 12 - armW, 16, 1);
  if (modern) put({ x: 36, y: 52, w: armW, h: 12 }, { x: 52, y: 52, w: armW, h: 12 }, 20, 16, 1);
  else put(rightArm, null, 20, 16, 1, 12, true);
  // 다리: 12줄 → 8줄 (꼬마 비율)
  const rightLeg = { x: 4, y: 20, w: 4, h: 12 };
  put(rightLeg, modern ? { x: 4, y: 36, w: 4, h: 12 } : null, 12, 28, 1, 8);
  if (modern) put({ x: 20, y: 52, w: 4, h: 12 }, { x: 4, y: 52, w: 4, h: 12 }, 16, 28, 1, 8);
  else put(rightLeg, null, 16, 28, 1, 8, true);

  return out;
}
