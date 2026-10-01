/**
 * 저장 데이터 모델 (기획서 15번).
 * 저장소에서 읽은 값, JSON 불러오기로 들어온 값은 모두 validate.ts를 거친 뒤에만 이 타입으로 다룬다.
 */

import type { ThemeId } from "../game/themes";

/** 스키마 버전. 구조를 바꾸면 올리고 migrate.ts에 변환 함수를 추가한다 */
export const SCHEMA_VERSION = 2;

/** 도트 한 칸의 색: "#rrggbb"(소문자) 또는 투명("") */
export type PixelColor = string;

export const TRANSPARENT: PixelColor = "";

export type PixelSprite = {
  kind: "pixel";
  width: number;
  height: number;
  /** 길이 = width × height, 왼쪽 위부터 행 순서 */
  pixels: PixelColor[];
};

export type ImageMime = "image/png" | "image/webp";

export type ImageSprite = {
  kind: "image";
  mime: ImageMime;
  /** data URL 접두사 없는 base64 본문 */
  data: string;
  width: 320;
  height: 360;
};

export type Sprite = PixelSprite | ImageSprite;

/**
 * 캐릭터 모습 (v2, 사용자 결정으로 기획서 4-4의 "기본 / 기본+착지"를 셋으로 늘림).
 * - base: 기본 = 올라갈 때·서 있을 때 (꼭 있음)
 * - fall: 내려갈 때 (선택)
 * - land: 발판에 닿는 순간 (선택)
 * 없는 모습은 기본 그림으로 보여준다. v1의 frames: [기본, 착지?]는 migrate.ts가 바꾼다.
 */
export type Character = { base: Sprite; fall?: Sprite; land?: Sprite };

export type Pose = keyof Character;

/** 에디터·목록에 보여주는 순서 */
export const POSES: Pose[] = ["base", "fall", "land"];

export type CompanionSlot = { character: Character | null; name?: string };

export const COMPANION_SLOT_COUNT = 5;

export type Platforms = {
  basic: PixelSprite;
  highJump: PixelSprite;
  oneTime: PixelSprite;
};

export type PlatformKind = keyof Platforms;

export type CompanionMaxSource = "default" | "auto" | "user";

export type Settings = {
  /** 동료 최대 인원 0~5 */
  companionMax: number;
  companionMaxSource: CompanionMaxSource;
  /** 'default' 상태에서만 증가하는 누적 거절 횟수 */
  refusalCount: number;
  shake: boolean;
  particles: boolean;
  sfx: boolean;
  specialPlatformMarker: boolean;
  /** 화면 테마. v1에서 나중에 추가된 항목이라 없으면 기본 테마로 읽는다 (마이그레이션 불필요) */
  theme: ThemeId;
  /** 결과 이미지 맨 아래 글씨 (빈 문자열이면 안 씀). 나중에 추가된 항목이라 없으면 "점프점프" */
  cardCaption: string;
  onboarding: {
    firstRunDone: boolean;
    controlsGuideShown: boolean;
    /** 마지막으로 백업 안내를 보여준 시각(ms). 아직 없으면 null */
    backupReminderAt: number | null;
    /** 마지막으로 내보내기를 한 시각(ms). v1에 나중에 추가된 항목이라 없으면 null */
    lastExportAt: number | null;
  };
};

export type BestScores = { withCompanions: number; solo: number };

export type SaveData = {
  version: number;
  hero: Character;
  platforms: Platforms;
  /** 항상 길이 5 */
  companionSlots: CompanionSlot[];
  palette: PixelColor[];
  best: BestScores;
  settings: Settings;
};

/** 한 판 동안만 쓰는 상태. 저장하지 않는다 (동료 획득 여부 포함) */
export type RunState = {
  acquired: boolean[];
  /** 판 시작 시점의 동료 최대 인원. 최고 기록 구분(동료 모드/혼자 모드, lib/records.ts)의 기준 */
  companionMaxAtStart: number;
};
