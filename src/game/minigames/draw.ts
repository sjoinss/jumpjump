import { CONFIG } from "../config";
import { pixelSprite } from "../presets";
import { drawSprite } from "../sprites";
import type { Sprite } from "../../lib/schema";
import { DodgeGame, DODGE_GROUND } from "./dodge";
import { FlappyGame, FLAPPY_GROUND } from "./flappy";
import { RopeGame } from "./rope";
import { ShooterGame } from "./shooter";
import { ACTOR, ARENA, type MinigameLogic } from "./types";

/**
 * 미니게임 그리기 (판 좌표, y 아래로). 부르는 쪽이 판을 화면에 맞춰 변환해 둔다.
 * 귀여운 파스텔 + 잉크 외곽선. 상태는 색만이 아니라 모양·깜빡임으로도 보인다.
 */

export type MinigameLooks = { hero: Sprite; companion: Sprite };

export type DrawOptions = { time: number; reducedMotion: boolean };

const INK = "#3d2c5e";

/** 판 바깥(레터박스)까지 칠할 배경색 */
export const MINIGAME_BG: Record<MinigameLogic["id"], string> = {
  rope: "#fff1d6",
  shooter: "#e3dcff",
  flappy: "#d6f1ff",
  dodge: "#ffe3ea",
};

const GROUND = { fill: "#c8ebc0", edge: "#7cc98f", dirt: "#f3d9b1" };

const INVADER = pixelSprite(
  [
    "..o......o..",
    "...o....o...",
    "..oooooooo..",
    ".oowooooowo.",
    "oooooooooooo",
    "o.oooooooo.o",
    "o.o......o.o",
    "...oo..oo...",
  ],
  { o: "#a77bff", w: "#ffffff" },
);

export function drawMinigame(ctx: CanvasRenderingContext2D, g: MinigameLogic, looks: MinigameLooks, opts: DrawOptions) {
  ctx.fillStyle = MINIGAME_BG[g.id];
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  if (g instanceof RopeGame) drawRope(ctx, g, looks, opts);
  else if (g instanceof ShooterGame) drawShooter(ctx, g, looks, opts);
  else if (g instanceof FlappyGame) drawFlappy(ctx, g, looks, opts);
  else if (g instanceof DodgeGame) drawDodge(ctx, g, looks, opts);
}

/** 피격 직후 무적 시간: 깜빡임(동작 줄이기면 반투명 고정) */
function blinkAlpha(g: MinigameLogic, opts: DrawOptions) {
  if (g.invincible <= 0) return 1;
  if (opts.reducedMotion) return 0.45;
  return Math.floor(opts.time * 10) % 2 === 0 ? 0.25 : 1;
}

function actor(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  drawSprite(ctx, sprite, Math.round(x), Math.round(y), ACTOR.width, ACTOR.height);
  ctx.globalAlpha = 1;
}

function ground(ctx: CanvasRenderingContext2D, top: number) {
  ctx.fillStyle = GROUND.dirt;
  ctx.fillRect(0, top, ARENA.width, ARENA.height - top);
  ctx.fillStyle = GROUND.fill;
  ctx.fillRect(0, top, ARENA.width, 10);
  ctx.fillStyle = GROUND.edge;
  ctx.fillRect(0, top, ARENA.width, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(0, top - 2, ARENA.width, 2);
}

function outlinedCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// ── 줄넘기: 양쪽 동료가 줄을 돌리고 가운데 주인공이 넘는다 ──

function drawRope(ctx: CanvasRenderingContext2D, g: RopeGame, looks: MinigameLooks, opts: DrawOptions) {
  const groundY = ARENA.height - 90;
  ground(ctx, groundY);
  const leftX = 22;
  const rightX = ARENA.width - 22 - ACTOR.width;
  const handY = groundY - 34;
  const handL = leftX + ACTOR.width - 6;
  const handR = rightX + 6;
  // 줄 가운데 높이: phase 0 = 맨 위, 0.5 = 땅
  const amp = groundY - handY;
  const midY = handY - Math.cos(g.phase * Math.PI * 2) * amp - 4;
  const ctrlY = 2 * midY - handY;
  const front = Math.cos(g.phase * Math.PI * 2) < 0; // 아래쪽 반 바퀴는 앞으로 지나간다

  const rope = () => {
    ctx.beginPath();
    ctx.moveTo(handL, handY);
    ctx.quadraticCurveTo(ARENA.width / 2, ctrlY, handR, handY);
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ff8fab";
    ctx.stroke();
  };

  actor(ctx, looks.companion, leftX, groundY - ACTOR.height);
  actor(ctx, looks.companion, rightX, groundY - ACTOR.height);
  if (!front) rope();
  // 그림자 (높이 뛸수록 작게)
  const shadow = Math.max(14, 40 - g.jump * 0.25);
  ctx.fillStyle = "rgba(61,44,94,0.18)";
  ctx.fillRect(Math.round(ARENA.width / 2 - shadow / 2), groundY - 3, Math.round(shadow), 5);
  actor(ctx, looks.hero, ARENA.width / 2 - ACTOR.width / 2, groundY - ACTOR.height - g.jump, blinkAlpha(g, opts));
  if (front) rope();
}

// ── 슈팅 ──

function drawShooter(ctx: CanvasRenderingContext2D, g: ShooterGame, looks: MinigameLooks, opts: DrawOptions) {
  // 반짝이는 별
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97) % ARENA.width;
    const y = ((i * 53) % (ARENA.height - 120)) + (opts.reducedMotion ? 0 : (g.time * 20 + i * 13) % 40);
    ctx.fillRect(x, y, 3, 3);
  }
  ground(ctx, ARENA.height - 40);

  const s = CONFIG.minigame.shooter.enemySize;
  const wobble = opts.reducedMotion ? 0 : Math.round(Math.sin(g.time * 6) * 2);
  for (const e of g.enemies) {
    if (!e.alive) continue;
    drawSprite(ctx, INVADER, Math.round(g.enemyX(e) - s / 2), Math.round(e.y - s / 2 + wobble), s, s * (8 / 12));
  }
  for (const b of g.bullets) {
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(b.x - 3), Math.round(b.y - 8), 6, 14);
    ctx.fillStyle = "#ffd36e";
    ctx.fillRect(Math.round(b.x - 1.5), Math.round(b.y - 6.5), 3, 11);
  }
  for (const b of g.enemyBullets) outlinedCircle(ctx, b.x, b.y, 6, "#ff8fab");
  actor(ctx, looks.companion, g.player.x, g.playerY, blinkAlpha(g, opts));
}

// ── 파닥파닥 ──

function drawFlappy(ctx: CanvasRenderingContext2D, g: FlappyGame, looks: MinigameLooks, opts: DrawOptions) {
  const { pipeWidth, pipeGap } = CONFIG.minigame.flappy;
  // 구름
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 4; i++) {
    const span = ARENA.width + 120;
    const x = ((((i * 131 - (opts.reducedMotion ? 0 : g.time * 18)) % span) + span) % span) - 60;
    ctx.fillRect(Math.round(x), 60 + i * 90, 64, 18);
    ctx.fillRect(Math.round(x) + 14, 50 + i * 90, 36, 12);
  }
  for (const p of g.pipes) {
    const topH = p.gapY - pipeGap / 2;
    const bottomY = p.gapY + pipeGap / 2;
    pipe(ctx, p.x, -4, pipeWidth, topH + 4, true);
    pipe(ctx, p.x, bottomY, pipeWidth, FLAPPY_GROUND - bottomY, false);
  }
  ground(ctx, FLAPPY_GROUND);
  // 첫 탭 전에는 살짝 둥실
  const bob = !g.started && !opts.reducedMotion ? Math.sin(g.time * 4) * 4 : 0;
  actor(ctx, looks.companion, g.playerX - ACTOR.width / 2, g.y - ACTOR.height / 2 + bob, blinkAlpha(g, opts));
}

function pipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: boolean) {
  if (h <= 0) return;
  ctx.fillStyle = INK;
  ctx.fillRect(Math.round(x - 3), Math.round(y), w + 6, Math.round(h));
  ctx.fillStyle = "#9fe3c0";
  ctx.fillRect(Math.round(x), Math.round(y), w, Math.round(h));
  ctx.fillStyle = "#c9f4dd";
  ctx.fillRect(Math.round(x + 6), Math.round(y), 8, Math.round(h));
  // 입구 테
  const lipY = top ? y + h - 16 : y;
  ctx.fillStyle = INK;
  ctx.fillRect(Math.round(x - 7), Math.round(lipY - 2), w + 14, 20);
  ctx.fillStyle = "#7cd3a6";
  ctx.fillRect(Math.round(x - 4), Math.round(lipY + 1), w + 8, 14);
}

// ── 피하기 ──

function drawDodge(ctx: CanvasRenderingContext2D, g: DodgeGame, looks: MinigameLooks, opts: DrawOptions) {
  ground(ctx, DODGE_GROUND);
  const r = CONFIG.minigame.dodge.radius;
  for (const f of g.fallers) {
    outlinedCircle(ctx, f.x, f.y, r, "#ffd36e");
    // 별 모양 반짝이로 "떨어지는 것"을 색 말고도 알아보게
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(f.x - 1), Math.round(f.y - 6), 2, 12);
    ctx.fillRect(Math.round(f.x - 6), Math.round(f.y - 1), 12, 2);
  }
  actor(ctx, looks.companion, g.player.x, DODGE_GROUND - ACTOR.height, blinkAlpha(g, opts));
}
