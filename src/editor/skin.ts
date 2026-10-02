/**
 * 블록 게임 스킨(64×64 또는 예전 64×32 PNG) → 작은 도트 캐릭터 32×36, 세 모습.
 * 스킨 파일은 머리·몸·팔·다리 각 면이 정해진 자리에 펼쳐져 있다. 그중 "앞면"만 떼어 꼬마 비율로 다시 조립한다
 * (사용자 결정: 머리는 크게, 몸은 작게):
 *   머리 8×8 → 3배(24×24, 모자 층 26×25), 몸 8×12 → 8×6, 팔 4×12 → 2×6, 다리 4×12 → 4×5.
 * 모습 (2026-10-01 사용자 결정)
 *   - 기본(올라갈 때): 차렷 — 팔을 몸에 붙인다
 *   - 내려갈 때: 팔을 양옆으로 쭉 벌린 십자
 *   - 착지: 몸이 한 칸 내려앉고 다리를 짧게 굽혀 살짝 벌린다
 * 덧입는 층(모자·겉옷·소매·바지)은 불투명한 곳만 위에 덮는다.
 * 모자 층은 머리보다 위·양옆으로 한 칸씩 크게 그린다 (실제 게임처럼 바깥 층이 부풀어 보여 너무 네모나지 않게). 예전 64×32 스킨은 왼팔·왼다리가 없어 오른쪽을 좌우로 뒤집어 쓴다.
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

export type SkinPoses = { base: string[]; fall: string[]; land: string[] };

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

/** 이 세로줄이 전부 투명한지 (얇은 팔 판별용) */
function emptyColumn(src: Src, x: number, y: number, h: number) {
  for (let k = 0; k < h; k++) if (pixel(src, x, y + k)) return false;
  return true;
}

type Part = { face: Face; overlay: Face | null; mirror: boolean };
/** 바탕 층(base) 또는 덧입는 층(over)만 그린다 */
type Layer = "base" | "over";

/** 그 층의 색 (면 안 좌표 fx, fy). 덧입는 층이 없으면 "" */
function partColor(src: Src, part: Part, layer: Layer, fx: number, fy: number) {
  const x = part.mirror ? part.face.w - 1 - fx : fx;
  if (layer === "over") return part.overlay ? pixel(src, part.overlay.x + x, part.overlay.y + fy) : "";
  return pixel(src, part.face.x + x, part.face.y + fy);
}

/** 스킨에서 앞면 부위들을 찾는다 */
function parts(src: Src) {
  const modern = src.height === 64;
  // 얇은 팔(3px) 스킨: 64×64에서 굵은 팔의 넷째 줄이 비어 있다
  const armW = modern && emptyColumn(src, 47, 20, 12) ? 3 : 4;
  // 예전 64×32 스킨은 모자 층을 검은색 등으로 꽉 채워 둔 경우가 많다 — 게임도 모자 층 전체(32×16)가 불투명하면 모자가 없는 것으로 본다
  const hatUsable = modern || !fullyOpaque(src, { x: 32, y: 0, w: 32, h: 16 });
  const rightArm: Face = { x: 44, y: 20, w: armW, h: 12 };
  const rightLeg: Face = { x: 4, y: 20, w: 4, h: 12 };
  return {
    head: { face: { x: 8, y: 8, w: 8, h: 8 }, overlay: hatUsable ? { x: 40, y: 8, w: 8, h: 8 } : null, mirror: false },
    body: { face: { x: 20, y: 20, w: 8, h: 12 }, overlay: modern ? { x: 20, y: 36, w: 8, h: 12 } : null, mirror: false },
    // 화면 왼쪽 = 캐릭터의 오른팔·오른다리
    armL: { face: rightArm, overlay: modern ? { x: 44, y: 36, w: armW, h: 12 } : null, mirror: false },
    armR: modern
      ? { face: { x: 36, y: 52, w: armW, h: 12 }, overlay: { x: 52, y: 52, w: armW, h: 12 }, mirror: false }
      : { face: rightArm, overlay: null, mirror: true },
    legL: { face: rightLeg, overlay: modern ? { x: 4, y: 36, w: 4, h: 12 } : null, mirror: false },
    legR: modern
      ? { face: { x: 20, y: 52, w: 4, h: 12 }, overlay: { x: 4, y: 52, w: 4, h: 12 }, mirror: false }
      : { face: rightLeg, overlay: null, mirror: true },
  } satisfies Record<string, Part>;
}

const W = SKIN_OUT.width;
const H = SKIN_OUT.height;

/** 그리는 판: 칸 색 */
type Board = { out: string[] };

function put(b: Board, tx: number, ty: number, color: string) {
  if (!color || tx < 0 || tx >= W || ty < 0 || ty >= H) return;
  b.out[ty * W + tx] = color;
}

/** 부위의 한 층을 (dx, dy)부터 dw×dh 크기로 (가장 가까운 픽셀로) 옮긴다 */
function blit(b: Board, src: Src, part: Part, layer: Layer, dx: number, dy: number, dw: number, dh: number) {
  const { w, h } = part.face;
  for (let oy = 0; oy < dh; oy++) {
    const fy = Math.min(h - 1, Math.floor(((oy + 0.5) * h) / dh));
    for (let ox = 0; ox < dw; ox++) {
      const fx = Math.min(w - 1, Math.floor(((ox + 0.5) * w) / dw));
      put(b, dx + ox, dy + oy, partColor(src, part, layer, fx, fy));
    }
  }
}

/** 바탕 층 → 덧입는 층 순서로 같은 자리에 */
function blitBoth(b: Board, src: Src, part: Part, dx: number, dy: number, dw: number, dh: number) {
  blit(b, src, part, "base", dx, dy, dw, dh);
  blit(b, src, part, "over", dx, dy, dw, dh);
}

/**
 * 팔을 옆으로 눕혀 그린다 (십자). 어깨(팔 면의 위쪽)가 몸 쪽, 손이 바깥쪽.
 * dir = -1이면 왼쪽으로 뻗는다. 길이 len, 두께 thick.
 */
function blitArmOut(b: Board, src: Src, part: Part, shoulderX: number, y: number, len: number, thick: number, dir: 1 | -1) {
  const { w, h } = part.face;
  for (const layer of ["base", "over"] as const) {
    for (let i = 0; i < len; i++) {
      const fy = Math.min(h - 1, Math.floor(((i + 0.5) * h) / len));
      for (let t = 0; t < thick; t++) {
        // 팔의 바깥 면이 위로 오게: 왼쪽 팔은 면의 왼쪽 줄이 위
        const fxRaw = Math.min(w - 1, Math.floor(((t + 0.5) * w) / thick));
        const fx = dir === -1 ? fxRaw : w - 1 - fxRaw;
        put(b, shoulderX + dir * i, y + t, partColor(src, part, layer, fx, fy));
      }
    }
  }
}

/** 꼬마 비율 크기 (32×36 안) */
const HEAD = 24;
const BODY_W = 8;
const BODY_H = 6;
const ARM_W = 2;
const LEG_W = 4;
/** 모자 층이 머리보다 한 칸 위로 나오는 자리만큼 다리를 한 칸 줄였다 */
const LEG_H = 5;
/** 모자 층은 머리보다 위·양옆으로 한 칸씩 크게 (입체감) */
const HAT_GROW = 1;
const LEFT = (W - BODY_W) / 2; // 몸 왼쪽 x = 12

function pose(src: Src, kind: "base" | "fall" | "land"): string[] {
  const b: Board = { out: new Array(W * H).fill("") };
  const p = parts(src);
  // 착지는 두 칸 내려앉고 다리가 짧아진다 (발끝은 늘 맨 아래 줄)
  const sink = kind === "land" ? 2 : 0;
  const legH = LEG_H - sink;
  const headY = H - HEAD - BODY_H - LEG_H + sink;
  const bodyY = headY + HEAD;
  const legY = bodyY + BODY_H;

  // 다리 먼저 (몸 아래), 착지는 살짝 벌린다
  const spread = kind === "land" ? 1 : 0;
  blitBoth(b, src, p.legL, LEFT - spread, legY, LEG_W, legH);
  blitBoth(b, src, p.legR, LEFT + LEG_W + spread, legY, LEG_W, legH);
  blitBoth(b, src, p.body, LEFT, bodyY, BODY_W, BODY_H);
  if (kind === "fall") {
    // 십자: 어깨(몸 맨 위)에 붙여 차렷 팔과 같은 길이(6칸)로 양옆에 (화면 끝까지 길게 뻗으면 징그럽다는 의견 — 2026-10-01)
    blitArmOut(b, src, p.armL, LEFT - 1, bodyY, BODY_H, ARM_W, -1);
    blitArmOut(b, src, p.armR, LEFT + BODY_W, bodyY, BODY_H, ARM_W, 1);
  } else {
    // 차렷: 몸에 붙인다
    blitBoth(b, src, p.armL, LEFT - ARM_W, bodyY, ARM_W, BODY_H);
    blitBoth(b, src, p.armR, LEFT + BODY_W, bodyY, ARM_W, BODY_H);
  }
  // 머리는 마지막 (몸 위에 살짝 겹쳐도 얼굴이 보이게). 모자 층은 머리보다 크게 덮어 입체감을 준다
  const headX = (W - HEAD) / 2;
  blit(b, src, p.head, "base", headX, headY, HEAD, HEAD);
  blit(b, src, p.head, "over", headX - HAT_GROW, headY - HAT_GROW, HEAD + HAT_GROW * 2, HEAD + HAT_GROW);
  return b.out;
}

/** 스킨 → 세 모습 (각 32×36 도트 칸, 왼쪽 위부터, "#rrggbb" 또는 "" 투명) */
export function skinToPoses(src: Src): SkinPoses {
  return { base: pose(src, "base"), fall: pose(src, "fall"), land: pose(src, "land") };
}

/** 기본 모습만 (미리보기 등) */
export function skinToDots(src: Src): string[] {
  return pose(src, "base");
}
