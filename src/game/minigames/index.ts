import { DodgeGame } from "./dodge";
import { FlappyGame } from "./flappy";
import { RopeGame } from "./rope";
import { ShooterGame } from "./shooter";
import type { MinigameId, MinigameLogic, Rng } from "./types";

export type { MinigameId, MinigameLogic, MiniEvent, MiniInput } from "./types";

export const MINIGAME_IDS: MinigameId[] = ["rope", "shooter", "flappy", "dodge"];

/** 조작 방식: 탭(줄넘기·파닥파닥) / 좌우 이동(슈팅·피하기) */
export type MinigameControl = "tap" | "move";

export type MinigameInfo = {
  name: string;
  /** 목표 한 줄 (시작 전 안내) */
  goal: string;
  control: MinigameControl;
  /** 조작법: 터치 / PC */
  touch: string;
  pc: string;
  /** HUD 진행 표시 ("3/5번") */
  progress: (current: number, goal: number) => string;
};

export const MINIGAMES: Record<MinigameId, MinigameInfo> = {
  rope: {
    name: "줄넘기",
    goal: "줄을 5번 넘어요",
    control: "tap",
    touch: "줄이 발밑에 오면 화면을 탭",
    pc: "Space 또는 클릭",
    progress: (c, g) => `${c}/${g}번`,
  },
  shooter: {
    name: "슈팅",
    goal: "적 10마리를 물리쳐요",
    control: "move",
    touch: "좌우로 끌어서 이동 (자동 발사)",
    pc: "← → 또는 마우스 이동 (자동 발사)",
    progress: (c, g) => `${c}/${g}마리`,
  },
  flappy: {
    name: "파닥파닥",
    goal: "기둥 5개를 지나가요",
    control: "tap",
    touch: "탭할 때마다 날아올라요",
    pc: "Space 또는 클릭",
    progress: (c, g) => `${c}/${g}개`,
  },
  dodge: {
    name: "피하기",
    goal: "15초 동안 버텨요",
    control: "move",
    touch: "좌우로 끌어서 피하기",
    pc: "← → 또는 마우스 이동",
    progress: (c, g) => `${g - c}초 남음`,
  },
};

export function createMinigame(id: MinigameId, rng: Rng): MinigameLogic {
  switch (id) {
    case "rope":
      return new RopeGame();
    case "shooter":
      return new ShooterGame(rng);
    case "flappy":
      return new FlappyGame(rng);
    case "dodge":
      return new DodgeGame(rng);
  }
}

/** 랜덤 1종 (기획서 8번). 바로 앞 판과 같은 게임은 되도록 피한다 */
export function pickMinigame(rng: Rng, previous?: MinigameId | null): MinigameId {
  const pool = previous ? MINIGAME_IDS.filter((id) => id !== previous) : MINIGAME_IDS;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
