import { CONFIG } from "../config";
import { ACTOR, ARENA, addProgress, overlaps, shrink, takeHit, type Box, type MiniEvent, type MiniInput, type MinigameLogic, type Rng } from "./types";

const C = CONFIG.minigame.flappy;

export type Pipe = { x: number; gapY: number; passed: boolean };

/** 바닥 윗면 y */
export const FLAPPY_GROUND = ARENA.height - 40;

/**
 * 파닥파닥(플래피 버드형): 동료가 탭할 때마다 날아오르고 기둥 사이 통로를 지난다.
 * 첫 탭 전에는 제자리에 떠서 기다린다. 기둥·바닥에 부딪히면 목숨 -1 (잠깐 무적, 바닥이면 가운데로 다시 띄움).
 */
export class FlappyGame implements MinigameLogic {
  readonly id = "flappy" as const;
  readonly goal = C.goal;
  status: MinigameLogic["status"] = "playing";
  lives = C.lives;
  current = 0;
  invincible = 0;
  started = false;
  time = 0;
  readonly playerX = 90;
  /** 동료 가운데 y */
  y = ARENA.height / 2 - 40;
  vy = 0;
  pipes: Pipe[] = [];
  /** 다음 기둥까지 남은 가로 거리 */
  private untilNext = 0;

  constructor(private readonly rng: Rng) {}

  get playerBox(): Box {
    return { x: this.playerX - ACTOR.width / 2, y: this.y - ACTOR.height / 2, w: ACTOR.width, h: ACTOR.height };
  }

  step(dt: number, input: MiniInput): MiniEvent[] {
    const events: MiniEvent[] = [];
    if (this.status !== "playing") return events;
    this.time += dt;
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);

    if (input.taps > 0) {
      this.started = true;
      this.vy = -C.flapVelocity;
    }
    if (!this.started) return events;

    this.vy += C.gravity * dt;
    this.y += this.vy * dt;
    const half = ACTOR.height / 2;
    if (this.y < half) {
      this.y = half;
      this.vy = 0;
    }
    if (this.y + half >= FLAPPY_GROUND) {
      takeHit(this, C.invincible, events);
      // 바닥에 닿으면 가운데로 살짝 띄워서 다시 시작
      this.y = ARENA.height / 2 - 40;
      this.vy = -C.flapVelocity * 0.5;
    }

    // 기둥
    const move = C.pipeSpeed * dt;
    for (const p of this.pipes) p.x -= move;
    this.untilNext -= move;
    if (this.untilNext <= 0) {
      this.untilNext += C.pipeSpacing;
      const margin = 50;
      const min = C.pipeGap / 2 + margin;
      const max = FLAPPY_GROUND - C.pipeGap / 2 - margin;
      this.pipes.push({ x: ARENA.width + 20, gapY: min + (max - min) * this.rng(), passed: false });
    }

    const me = shrink(this.playerBox, 7);
    for (const p of this.pipes) {
      const top: Box = { x: p.x, y: -100, w: C.pipeWidth, h: p.gapY - C.pipeGap / 2 + 100 };
      const bottom: Box = { x: p.x, y: p.gapY + C.pipeGap / 2, w: C.pipeWidth, h: ARENA.height };
      if (overlaps(me, top) || overlaps(me, bottom)) takeHit(this, C.invincible, events);
      if (!p.passed && p.x + C.pipeWidth < me.x) {
        p.passed = true;
        addProgress(this, events);
      }
    }
    this.pipes = this.pipes.filter((p) => p.x + C.pipeWidth > -10);
    return events;
  }
}
