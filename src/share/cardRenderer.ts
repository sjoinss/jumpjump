import { drawBackground } from "../game/background";
import { pixelSprite } from "../game/presets";
import { drawSprite } from "../game/sprites";
import type { ScenePalette } from "../game/themes";
import { characterSprites, spriteFor } from "../lib/character";
import type { Character, PixelSprite, Sprite } from "../lib/schema";
import { CARD, cardSlots, memberPose, snapSize, type CardFrame } from "./layout";

/**
 * 결과 카드 렌더러 (기획서 13-1~13-3). 미리보기·PNG·GIF가 모두 이 함수 하나로 그린다.
 * ctx는 부르는 쪽이 배율을 걸어 두고, 여기서는 카드 논리 좌표(360×360)로 그린다.
 */

export type CardData = {
  /** 점수 (m) */
  score: number;
  isNew: boolean;
  /** 기록 구분 (판 시작 때 동료 최대 인원 > 0). 카드의 동료 배지는 실제 동료 수(members)로 그린다 */
  withCompanions: boolean;
  regionName: string;
  /** 게임 배경 섞임 위치 (경계라면 섞인 그대로) */
  blend: number;
  /** 주인공 + 이번 판에 합류한 동료 (합류 순서) */
  members: Character[];
  /** 각자 밑에 까는 기본 발판 */
  platform: PixelSprite;
  scene: ScenePalette;
  /** 맨 아래 글씨 (빈 문자열이면 안 씀) */
  caption: string;
};

const INK = "#3d2c5e";
const OUTSIDE = "#fff4f8";
const RADIUS = 22;

/** 직접 그린 도트 스티커 (이모지 대신) */
const STAR = pixelSprite(
  ["...o...", "..oyo..", "ooyyyoo", ".oyyyo.", ".oyoyo.", "oo...oo"],
  { o: INK, y: "#ffd36e" },
);
const HEART = pixelSprite(
  [".oo.oo.", "oppoppo", "oppppwo", "opppppo", ".opppo.", "..opo..", "...o..."],
  { o: INK, p: "#ff8fab", w: "#ffffff" },
);
const SPARK = pixelSprite([".o.", "oyo", ".o."], { o: INK, y: "#ffffff" });

/** 이미지 캐릭터가 있으면 GIF에서 색이 단순해질 수 있다 (디더링 + 안내) */
export function hasImageMembers(d: CardData) {
  return d.members.some((m) => characterSprites(m).some((f) => f.kind === "image"));
}

/** 미리보기 대체 텍스트 */
export function cardAltText(d: CardData) {
  const companions = d.members.length - 1;
  return `결과 이미지: ${d.regionName}, ${formatMeters(d.score)}${d.isNew ? ", 최고 기록" : ""}, ${companions > 0 ? `동료 ${companions}명과 함께` : "동료 없이"}`;
}

/** 점수 표시: 세 자리마다 쉼표 (아주 큰 점수도 읽기 쉽게) */
export function formatMeters(n: number) {
  return `${Math.max(0, Math.floor(n)).toLocaleString("ko-KR")}m`;
}

export function drawCard(ctx: CanvasRenderingContext2D, d: CardData, frame: CardFrame, font: string) {
  const S = CARD.size;
  ctx.save();
  ctx.fillStyle = OUTSIDE;
  ctx.fillRect(0, 0, S, S);

  // 둥근 카드 안쪽: 게임오버 높이의 배경을 그대로 (게임 배경 렌더러 재사용, 계단식 색 띠라 GIF 밴딩 없음)
  ctx.save();
  roundRectPath(ctx, 6, 6, S - 12, S - 12, RADIUS);
  ctx.clip();
  drawBackground(ctx, d.scene, S, S, { blend: d.blend, cameraY: d.score * 72, time: 0, reducedMotion: true });
  // 우주 쪽은 너무 어두워지지 않게 살짝 밝힌다
  if (d.blend > 2.3) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.16, (d.blend - 2.3) * 0.2)})`;
    ctx.fillRect(0, 0, S, S);
  }

  drawStickers(ctx);
  drawMembers(ctx, d, frame);
  drawHeader(ctx, d, font);

  // 맨 아래 글씨 (기본 "점프점프", 사용자가 바꾼 글씨). 길면 글씨를 줄여 카드 안에 넣는다
  const caption = d.caption.trim();
  if (caption) fitText(ctx, caption, S / 2, S - 16, 13, 8, S - 56, font, "#ffffff", 0.95);
  ctx.restore();

  // 카드 테두리
  roundRectPath(ctx, 6, 6, S - 12, S - 12, RADIUS);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

function drawStickers(ctx: CanvasRenderingContext2D) {
  drawSprite(ctx, STAR, 20, 74, 21, 18);
  drawSprite(ctx, HEART, 318, 78, 21, 21);
  drawSprite(ctx, SPARK, 46, 100, 9, 9);
  drawSprite(ctx, SPARK, 300, 112, 9, 9);
  drawSprite(ctx, STAR, 322, 312, 14, 12);
}

function drawMembers(ctx: CanvasRenderingContext2D, d: CardData, frame: CardFrame) {
  const slots = cardSlots(d.members.length);
  for (const slot of slots) {
    const member = d.members[slot.member];
    if (!member) continue;
    const pose = memberPose(slot.member, frame, slot.width / 128 + 0.25);

    // 발판: 플레이어의 기본 발판 그림 (4:1)
    const pw = slot.width;
    const ph = pw / 4;
    drawSprite(ctx, d.platform, Math.round(slot.cx - pw / 2), slot.groundY, pw, ph);

    // 그림자: 높이 뜰수록 작게
    const sw = Math.max(16, Math.round(pw * 0.55 * (1 - pose.lift / 90)));
    ctx.fillStyle = "rgba(61,44,94,0.22)";
    ctx.fillRect(Math.round(slot.cx - sw / 2), slot.groundY - 3, sw, 4);

    // 단계마다 그 모습 (착지 · 내려갈 때, 없으면 기본)
    const sprite: Sprite = spriteFor(member, pose.landing ? "land" : pose.falling ? "fall" : "base");
    const dotsW = sprite.kind === "pixel" ? sprite.width : null;
    const dotsH = sprite.kind === "pixel" ? sprite.height : null;
    const w = snapSize(slot.width, pose.sx, dotsW);
    const h = snapSize(slot.height, pose.sy, dotsH);
    const x = Math.round(slot.cx - w / 2);
    const y = Math.round(slot.groundY - pose.lift - h);
    drawSprite(ctx, sprite, x, y, w, h);

    // 착지 먼지
    if (pose.dust !== null) {
      const k = pose.dust;
      ctx.globalAlpha = Math.max(0, 1 - k);
      const off = Math.round(w / 2 + 4 + k * 14);
      for (const side of [-1, 1]) {
        const px = Math.round(slot.cx + side * off);
        const py = Math.round(slot.groundY - 6 - k * 8);
        ctx.fillStyle = INK;
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px - 3, py - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** 위쪽: 반투명 판 가운데에 지역 이름과 점수, 그 아래 가운데에 배지 (NEW · 함께한 동료) */
function drawHeader(ctx: CanvasRenderingContext2D, d: CardData, font: string) {
  const S = CARD.size;
  // 반투명 판 위에 올려 어느 배경에서도 또렷하게
  roundRectPath(ctx, 16, 14, S - 32, 52, 16);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  fitText(ctx, d.regionName, S / 2, 32, 13, 9, S - 64, font, "#7a6a99");
  // 점수가 아주 커도(예: 100,000m 이상) 판 밖으로 나가지 않게 글씨를 줄인다
  fitText(ctx, formatMeters(d.score), S / 2, 58, 26, 12, S - 64, font, INK);

  const companions = d.members.length - 1;
  const badges = [...(d.isNew ? [{ label: "NEW 최고 기록", fill: "#ffd36e" }] : []), { label: companions > 0 ? `동료 ${companions}명` : "동료 없이", fill: "#e8e0ff" }];
  ctx.font = `11px ${font}`;
  const widths = badges.map((b) => Math.ceil(ctx.measureText(b.label).width) + 16);
  const gap = 6;
  let x = S / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (badges.length - 1)) / 2;
  badges.forEach((b, i) => {
    pill(ctx, b.label, x, 78, widths[i], font, b.fill);
    x += widths[i] + gap;
  });
}

/** 가운데 기준으로, 최대 폭을 넘으면 글씨 크기를 줄여서(최소 크기까지) 그린다. 그래도 넘치면 말줄임 */
function fitText(
  ctx: CanvasRenderingContext2D,
  s: string,
  cx: number,
  y: number,
  size: number,
  minSize: number,
  maxWidth: number,
  font: string,
  fill: string,
  alpha = 1,
) {
  let px = size;
  ctx.font = `${px}px ${font}`;
  while (px > minSize && ctx.measureText(s).width > maxWidth) {
    px -= 1;
    ctx.font = `${px}px ${font}`;
  }
  let out = s;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = out.slice(0, -2) + "…";
  text(ctx, out, cx, y, `${px}px ${font}`, "center", fill, alpha);
}

/** 왼쪽 끝 x에서 폭 w로 그린 알약 배지 */
function pill(ctx: CanvasRenderingContext2D, label: string, x: number, cy: number, w: number, font: string, fill: string) {
  ctx.font = `11px ${font}`;
  roundRectPath(ctx, x, cy - 9, w, 18, 9);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, cy + 1);
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  align: CanvasTextAlign,
  fill: string,
  alpha = 1,
) {
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if (fill === "#ffffff") {
    // 흰 글자는 잉크 외곽선으로 대비 확보
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 앱에 번들한 폰트 이름 (CSS 변수에서). 저장 직전에 로딩을 기다린다 (기획서 13-3) */
export async function loadCardFont(): Promise<string> {
  const family =
    typeof document === "undefined" ? "" : getComputedStyle(document.body).getPropertyValue("--font-display").trim();
  const font = family || "sans-serif";
  try {
    await Promise.all([document.fonts.load(`26px ${font}`, "점프0123456789mNEW동료기록"), document.fonts.ready]);
  } catch {
    // 폰트를 못 불러와도 기본 글꼴로 그린다
  }
  return font;
}

/** 한 프레임을 배율을 걸어 새 캔버스에 그린다 (PNG·GIF 공용) */
export function renderCardCanvas(d: CardData, frame: CardFrame, font: string, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD.size * scale;
  canvas.height = CARD.size * scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("이미지를 그릴 수 없어요 (Canvas 2D 미지원)");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawCard(ctx, d, frame, font);
  return canvas;
}
