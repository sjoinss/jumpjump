import { CONFIG } from "../config";
import { stepMover } from "../../input/movement";
import { ACTOR, ARENA, addProgress, overlaps, shrink, takeHit, type Box, type MiniEvent, type MiniInput, type MinigameLogic, type Rng } from "./types";

const C = CONFIG.minigame.shooter;

export type Enemy = { baseX: number; y: number; alive: boolean };
export type Bullet = { x: number; y: number };

/** 동료가 아래에서 좌우로 움직이며 자동으로 쏜다. 위의 적 무리는 좌우로 흔들리며 가끔 느린 탄을 떨어뜨린다 */
export class ShooterGame implements MinigameLogic {
  readonly id = "shooter" as const;
  readonly goal = C.goal;
  status: MinigameLogic["status"] = "playing";
  lives = C.lives;
  current = 0;
  invincible = 0;
  time = 0;
  player = { x: (ARENA.width - ACTOR.width) / 2, vx: 0 };
  readonly playerY = ARENA.height - 40 - ACTOR.height;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  enemyBullets: Bullet[] = [];
  private fireTimer = 0;
  private enemyFireTimer = C.enemyFireInterval;

  constructor(private readonly rng: Rng) {
    const gap = C.enemySize + 20;
    for (let r = 0; r < C.rows; r++) {
      for (let c = 0; c < C.cols; c++) {
        this.enemies.push({ baseX: ARENA.width / 2 + (c - (C.cols - 1) / 2) * gap, y: 80 + r * (C.enemySize + 16), alive: true });
      }
    }
  }

  /** 흔들림을 더한 지금 x (가운데) */
  enemyX(e: Enemy) {
    return e.baseX + Math.sin(this.time * C.swaySpeed * Math.PI * 2) * C.swayAmplitude;
  }

  enemyBox(e: Enemy): Box {
    const s = C.enemySize;
    return { x: this.enemyX(e) - s / 2, y: e.y - s / 2, w: s, h: s };
  }

  get playerBox(): Box {
    return { x: this.player.x, y: this.playerY, w: ACTOR.width, h: ACTOR.height };
  }

  step(dt: number, input: MiniInput): MiniEvent[] {
    const events: MiniEvent[] = [];
    if (this.status !== "playing") return events;
    this.time += dt;
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);

    stepMover(this.player, input.move, dt, 0, ARENA.width - ACTOR.width, ACTOR.width / 2);

    // 자동 발사
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer += C.fireInterval;
      this.bullets.push({ x: this.player.x + ACTOR.width / 2, y: this.playerY });
    }
    for (const b of this.bullets) b.y -= C.bulletSpeed * dt;

    // 맞힌 적
    for (const b of this.bullets) {
      const box = { x: b.x - 2, y: b.y - 6, w: 4, h: 12 };
      const hit = this.enemies.find((e) => e.alive && overlaps(box, this.enemyBox(e)));
      if (hit) {
        hit.alive = false;
        b.y = -100;
        addProgress(this, events);
      }
    }
    this.bullets = this.bullets.filter((b) => b.y > -20);

    // 적 탄환: 살아 있는 적 하나가 가끔 쏜다
    this.enemyFireTimer -= dt;
    const alive = this.enemies.filter((e) => e.alive);
    if (this.enemyFireTimer <= 0 && alive.length > 0) {
      this.enemyFireTimer += C.enemyFireInterval;
      const e = alive[Math.floor(this.rng() * alive.length)];
      this.enemyBullets.push({ x: this.enemyX(e), y: e.y + C.enemySize / 2 });
    }
    for (const b of this.enemyBullets) b.y += C.enemyBulletSpeed * dt;
    const me = shrink(this.playerBox, 8);
    for (const b of this.enemyBullets) {
      if (overlaps({ x: b.x - 5, y: b.y - 5, w: 10, h: 10 }, me)) {
        b.y = ARENA.height + 100;
        takeHit(this, C.invincible, events);
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.y < ARENA.height + 20);
    return events;
  }
}
