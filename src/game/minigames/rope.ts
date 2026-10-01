import { CONFIG } from "../config";
import { addProgress, takeHit, type MiniEvent, type MiniInput, type MinigameLogic } from "./types";

const C = CONFIG.minigame.rope;

/**
 * 줄넘기: 동료 둘(같은 그림)이 양쪽에서 줄을 돌리고 주인공이 가운데서 넘는다.
 * 탭하면 점프(땅에 있을 때만). 줄이 발밑을 지나는 순간 발이 clearance 이상 떠 있으면 성공, 아니면 목숨 -1.
 */
export class RopeGame implements MinigameLogic {
  readonly id = "rope" as const;
  readonly goal = C.goal;
  status: MinigameLogic["status"] = "playing";
  lives = C.lives;
  current = 0;
  invincible = 0;
  /** 줄 위치 0~1 (0 = 맨 위, 0.5 = 발밑). 계속 커진다 */
  phase = 0;
  /** 주인공 발이 땅에서 떠 있는 높이 */
  jump = 0;
  vy = 0;

  step(dt: number, input: MiniInput): MiniEvent[] {
    const events: MiniEvent[] = [];
    if (this.status !== "playing") return events;
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);

    if (input.taps > 0 && this.jump === 0 && this.vy === 0) this.vy = C.jumpVelocity;
    if (this.jump > 0 || this.vy > 0) {
      this.vy -= C.gravity * dt;
      this.jump += this.vy * dt;
      if (this.jump <= 0) {
        this.jump = 0;
        this.vy = 0;
      }
    }

    // 줄이 발밑(phase = k + 0.5)을 지나는 순간 판정
    const prev = this.phase;
    this.phase += dt / C.period;
    if (Math.floor(prev - 0.5) < Math.floor(this.phase - 0.5)) {
      if (this.jump >= C.clearance) addProgress(this, events);
      // 걸린 순간은 깜빡임만 짧게 (줄은 계속 돈다)
      else takeHit(this, 0.4, events);
    }
    return events;
  }
}
