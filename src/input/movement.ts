import { CONFIG } from "../game/config";
import type { MoveIntent } from "./controller";

/** 좌우로만 움직이는 물체 (대열 전체). x는 대열 왼쪽 끝 기준 논리 좌표 */
export type Mover = { x: number; vx: number };

/**
 * MoveIntent를 한 스텝 적용한다. 좌우 벽에서 멈추며 반대편으로 넘어가지 않는다.
 * @param minX 이동 가능한 가장 왼쪽 x
 * @param maxX 이동 가능한 가장 오른쪽 x (= 판정 영역 오른쪽 끝 - 대열 폭)
 * @param anchorOffset target(마우스)을 대열의 어디에 맞출지. 보통 대열 폭의 절반
 */
export function stepMover(m: Mover, intent: MoveIntent, dt: number, minX: number, maxX: number, anchorOffset: number) {
  const cfg = CONFIG.input;
  switch (intent.kind) {
    case "drag":
      m.x += intent.dx;
      m.vx = dt > 0 ? intent.dx / dt : 0;
      break;
    case "target": {
      const diff = intent.x - anchorOffset - m.x;
      const maxStep = cfg.mouseMaxSpeed * dt;
      // 지수 감쇠로 부드럽게 붙되 최대 속도를 넘지 않는다
      const step = Math.max(-maxStep, Math.min(maxStep, diff * (1 - Math.exp(-cfg.mouseFollow * dt))));
      m.x += step;
      m.vx = dt > 0 ? step / dt : 0;
      break;
    }
    case "axis": {
      if (intent.dir !== 0) {
        const turning = Math.sign(m.vx) !== 0 && Math.sign(m.vx) !== intent.dir;
        const accel = cfg.keyAccel * (turning ? cfg.keyTurnBoost : 1);
        m.vx = Math.max(-cfg.keyMaxSpeed, Math.min(cfg.keyMaxSpeed, m.vx + intent.dir * accel * dt));
      } else {
        const dec = cfg.keyDecel * dt;
        m.vx = Math.abs(m.vx) <= dec ? 0 : m.vx - Math.sign(m.vx) * dec;
      }
      m.x += m.vx * dt;
      break;
    }
    case "none": {
      // 입력이 끊겨도 미끄러지던 속도는 자연스럽게 줄인다
      const dec = cfg.keyDecel * dt;
      m.vx = Math.abs(m.vx) <= dec ? 0 : m.vx - Math.sign(m.vx) * dec;
      m.x += m.vx * dt;
      break;
    }
  }
  if (m.x < minX) {
    m.x = minX;
    m.vx = 0;
  } else if (m.x > maxX) {
    m.x = maxX;
    m.vx = 0;
  }
}
