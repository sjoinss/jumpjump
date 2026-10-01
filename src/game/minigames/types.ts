import { CONFIG } from "../config";
import type { MoveIntent } from "../../input/controller";

/**
 * 미니게임 공통 인터페이스 (기획서 8번 "독립 모듈 + 통일된 성공/실패 인터페이스").
 * 로직은 DOM 없이 step()만으로 돌아가서 테스트할 수 있고, 그리기는 draw.ts가 맡는다.
 * 좌표는 판(arena) 기준 논리 px, y는 아래로 갈수록 커진다.
 */

export type MinigameId = "rope" | "shooter" | "flappy" | "dodge";

export type MiniInput = {
  /** 좌우 이동 (슈팅·피하기) */
  move: MoveIntent;
  /** 지난 스텝 이후 탭·클릭·Space를 누른 횟수 (줄넘기·파닥파닥) */
  taps: number;
};

export type MiniStatus = "playing" | "success" | "fail";

export type MiniEvent =
  /** 목표에 한 걸음 (넘은 줄, 물리친 적, 통과한 기둥, 버틴 초) */
  | { type: "progress"; current: number }
  /** 목숨을 잃음 */
  | { type: "hit"; lives: number }
  | { type: "end"; success: boolean };

export interface MinigameLogic {
  readonly id: MinigameId;
  readonly goal: number;
  status: MiniStatus;
  lives: number;
  /** 목표까지 지금 몇 (피하기는 버틴 초) */
  current: number;
  /** 피격 직후 잠깐 무적인 남은 시간 (깜빡임 연출용) */
  invincible: number;
  step(dt: number, input: MiniInput): MiniEvent[];
}

export type Rng = () => number;

export const ARENA = CONFIG.minigame.arena;
export const ACTOR = CONFIG.minigame.actor;

export type Box = { x: number; y: number; w: number; h: number };

export function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 보기보다 조금 작은 판정 상자 (아슬아슬하게 스친 건 봐준다) */
export function shrink(b: Box, by: number): Box {
  return { x: b.x + by, y: b.y + by, w: Math.max(1, b.w - by * 2), h: Math.max(1, b.h - by * 2) };
}

/** 목숨을 잃는 공통 처리. 무적 시간 중이면 무시 */
export function takeHit(g: MinigameLogic, invincible: number, events: MiniEvent[]) {
  if (g.invincible > 0 || g.status !== "playing") return;
  g.lives -= 1;
  g.invincible = invincible;
  events.push({ type: "hit", lives: g.lives });
  if (g.lives <= 0) finish(g, false, events);
}

export function addProgress(g: MinigameLogic, events: MiniEvent[]) {
  if (g.status !== "playing") return;
  g.current += 1;
  events.push({ type: "progress", current: g.current });
  if (g.current >= g.goal) finish(g, true, events);
}

export function finish(g: MinigameLogic, success: boolean, events: MiniEvent[]) {
  if (g.status !== "playing") return;
  g.status = success ? "success" : "fail";
  events.push({ type: "end", success });
}
