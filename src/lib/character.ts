import { POSES, type Character, type Pose, type Sprite } from "./schema";

/**
 * 캐릭터 모습 도우미. 없는 모습(내려갈 때·착지)은 기본 그림으로 대신한다.
 */

/** 이 모습의 그림 (없으면 기본) */
export function spriteFor(c: Character, pose: Pose): Sprite {
  return c[pose] ?? c.base;
}

/** 그린 모습 전부 (기본 → 내려갈 때 → 착지 순) */
export function characterSprites(c: Character): Sprite[] {
  return POSES.flatMap((p) => (c[p] ? [c[p]] : []));
}

/** 게임 화면에 보이는 이름과 언제 보이는지 */
export const POSE_INFO: Record<Pose, { name: string; when: string }> = {
  base: { name: "기본", when: "올라갈 때와 서 있을 때 보여요" },
  fall: { name: "내려갈 때", when: "떨어지는 동안 보여요" },
  land: { name: "착지", when: "발판에 닿는 순간 잠깐(0.2초) 보여요" },
};
