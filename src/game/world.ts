import { CONFIG } from "./config";
import { stepMover, type Mover } from "../input/movement";
import type { MoveIntent } from "../input/controller";

/**
 * 게임 세계 (DOM 없는 순수 로직 — 테스트 가능).
 * 좌표: x는 판정 영역(폭 360) 기준 왼쪽 끝, y는 위로 갈수록 커지는 높이(바닥 윗면 = 0).
 * 카메라 cameraY는 "화면 맨 아래"의 세계 높이다.
 */

export type PlatformKind = "ground" | "basic";

export type Platform = {
  id: number;
  kind: PlatformKind;
  x: number;
  /** 윗면 높이 */
  y: number;
  width: number;
  /** 한 번이라도 밟았는지 (점수는 처음 밟을 때만) */
  touched: boolean;
};

export type WorldEvent =
  | { type: "land"; platform: Platform; first: boolean }
  | { type: "score"; score: number }
  | { type: "gameover"; score: number };

export type Rng = () => number;

/** 시드가 있는 난수 (테스트에서 같은 발판 배치를 재현하려고) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 최대 점프 높이 = v² / 2g */
export function maxJumpHeight() {
  const { gravity, jumpVelocity } = CONFIG.physics;
  return (jumpVelocity * jumpVelocity) / (2 * gravity);
}

/** 높이에 따른 발판 간격 상한 (최대 점프 높이의 maxGapRatio를 넘지 않는다) */
export function gapAt(height: number) {
  const w = CONFIG.world;
  const cap = maxJumpHeight() * w.maxGapRatio;
  const t = Math.max(0, Math.min(1, height / w.gapGrowthHeight));
  return w.minGap + (cap - w.minGap) * t;
}

export type WorldOptions = {
  rng: Rng;
  /** 판정 영역 높이(640~840)와 실제로 보이는 논리 높이 (길쭉한 폰은 더 크다) */
  playHeight: number;
  viewHeight: number;
};

export class World {
  readonly rng: Rng;
  playHeight: number;
  viewHeight: number;

  hero: Mover & { y: number; vy: number } = { x: 0, vx: 0, y: 0, vy: 0 };
  /** 보간용 이전 스텝 값 */
  prev = { x: 0, y: 0, cameraY: 0 };
  platforms: Platform[] = [];
  cameraY = 0;
  score = 0;
  over = false;
  private nextId = 1;
  private topY = 0;

  constructor(opts: WorldOptions) {
    this.rng = opts.rng;
    this.playHeight = opts.playHeight;
    this.viewHeight = opts.viewHeight;
    this.reset();
  }

  get heroWidth() {
    return CONFIG.character.width;
  }

  get platformWidth() {
    // 대열 시스템(9단계) 전까지는 동료 0명 기준
    return CONFIG.platform.width + CONFIG.world.platformWidthBonusSolo;
  }

  setView(playHeight: number, viewHeight: number) {
    this.playHeight = playHeight;
    this.viewHeight = viewHeight;
    this.spawn();
  }

  /** 바닥 위 가운데에 서 있는 처음 상태 */
  reset() {
    const w = CONFIG.view.width;
    this.hero = { x: (w - this.heroWidth) / 2, vx: 0, y: 0, vy: 0 };
    // 바닥 윗면이 시작 장면과 같은 위치에 오도록 (화면 아래에서 groundHeight만큼 위)
    this.cameraY = -CONFIG.view.groundHeight;
    this.prev = { x: this.hero.x, y: 0, cameraY: this.cameraY };
    this.score = 0;
    this.over = false;
    this.nextId = 1;
    this.platforms = [{ id: 0, kind: "ground", x: -w, y: 0, width: w * 3, touched: true }];
    this.topY = CONFIG.world.firstPlatformY - gapAt(0);
    this.spawn();
  }

  /** 바닥에서 첫 점프 */
  launch() {
    this.hero.vy = CONFIG.physics.jumpVelocity;
  }

  step(dt: number, intent: MoveIntent): WorldEvent[] {
    if (this.over) return [];
    const events: WorldEvent[] = [];
    const h = this.hero;
    this.prev = { x: h.x, y: h.y, cameraY: this.cameraY };

    // 좌우 이동: 벽에서 멈춤 (반대편 등장 없음)
    stepMover(h, intent, dt, 0, CONFIG.view.width - this.heroWidth, this.heroWidth / 2);

    // 중력
    const prevFeet = h.y;
    h.vy -= CONFIG.physics.gravity * dt;
    h.y += h.vy * dt;

    // 단방향 발판: 내려올 때, 이전 스텝엔 윗면 위였고 지금은 아래일 때만
    if (h.vy <= 0) {
      let hit: Platform | null = null;
      for (const p of this.platforms) {
        if (prevFeet < p.y || h.y > p.y) continue;
        if (h.x + this.heroWidth <= p.x || h.x >= p.x + p.width) continue;
        if (!hit || p.y > hit.y) hit = p;
      }
      if (hit) {
        h.y = hit.y;
        h.vy = CONFIG.physics.jumpVelocity;
        const first = !hit.touched;
        hit.touched = true;
        events.push({ type: "land", platform: hit, first });
        if (first && hit.kind !== "ground") {
          this.score += 1;
          events.push({ type: "score", score: this.score });
        }
      }
    }

    // 카메라: 위로만. 발밑이 화면 위에서 cameraRatio 위치에 오도록
    const target = h.y - this.playHeight * (1 - CONFIG.world.cameraRatio);
    if (target > this.cameraY) this.cameraY = target;

    this.spawn();
    this.platforms = this.platforms.filter((p) => p.y >= this.cameraY - CONFIG.world.removeBelow);

    // 화면 아래로 완전히 벗어나면 끝
    if (h.y + CONFIG.character.height < this.cameraY) {
      this.over = true;
      events.push({ type: "gameover", score: this.score });
    }
    return events;
  }

  /** 화면 위쪽까지 발판을 채운다 */
  private spawn() {
    const limit = this.cameraY + this.viewHeight + CONFIG.world.spawnAhead;
    const width = this.platformWidth;
    while (this.topY < limit) {
      const gap = gapAt(this.topY) * (1 - CONFIG.world.gapJitter * this.rng());
      this.topY += gap;
      const x = this.rng() * (CONFIG.view.width - width);
      this.platforms.push({ id: this.nextId++, kind: "basic", x, y: this.topY, width, touched: false });
    }
  }
}
