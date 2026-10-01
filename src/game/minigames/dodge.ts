import { CONFIG } from "../config";
import { stepMover } from "../../input/movement";
import { ACTOR, ARENA, addProgress, finish, overlaps, shrink, takeHit, type Box, type MiniEvent, type MiniInput, type MinigameLogic, type Rng } from "./types";

const C = CONFIG.minigame.dodge;

export type Faller = { x: number; y: number; vy: number };

/** 바닥 윗면 y */
export const DODGE_GROUND = ARENA.height - 40;

/** 낙하물 피하기: 동료가 바닥에서 좌우로 움직여 떨어지는 것을 피하며 정해진 시간을 버틴다 */
export class DodgeGame implements MinigameLogic {
  readonly id = "dodge" as const;
  readonly goal = C.seconds;
  status: MinigameLogic["status"] = "playing";
  lives = C.lives;
  /** 버틴 초 (정수) */
  current = 0;
  invincible = 0;
  time = 0;
  player = { x: (ARENA.width - ACTOR.width) / 2, vx: 0 };
  fallers: Faller[] = [];
  private spawnTimer = 0.4;

  constructor(private readonly rng: Rng) {}

  get playerBox(): Box {
    return { x: this.player.x, y: DODGE_GROUND - ACTOR.height, w: ACTOR.width, h: ACTOR.height };
  }

  step(dt: number, input: MiniInput): MiniEvent[] {
    const events: MiniEvent[] = [];
    if (this.status !== "playing") return events;
    this.time += dt;
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);

    stepMover(this.player, input.move, dt, 0, ARENA.width - ACTOR.width, ACTOR.width / 2);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += C.spawnInterval;
      const r = C.radius;
      this.fallers.push({
        x: r + (ARENA.width - r * 2) * this.rng(),
        y: -r,
        vy: C.fallSpeedMin + (C.fallSpeedMax - C.fallSpeedMin) * this.rng(),
      });
    }
    const me = shrink(this.playerBox, 8);
    for (const f of this.fallers) {
      f.y += f.vy * dt;
      const r = C.radius * 0.8;
      if (overlaps({ x: f.x - r, y: f.y - r, w: r * 2, h: r * 2 }, me)) {
        f.y = ARENA.height + 100;
        takeHit(this, C.invincible, events);
      }
    }
    this.fallers = this.fallers.filter((f) => f.y - C.radius < DODGE_GROUND);

    // 1초 버틸 때마다 한 걸음, 끝까지 버티면 성공
    while (this.status === "playing" && this.current < Math.floor(this.time) && this.current < this.goal) addProgress(this, events);
    if (this.time >= this.goal) finish(this, true, events);
    return events;
  }
}
