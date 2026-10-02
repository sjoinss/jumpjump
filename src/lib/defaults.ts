import { CONFIG } from "../game/config";
import { DEFAULT_THEME } from "../game/themes";
import { CHARACTER_PRESETS, DEFAULT_PALETTE, PLATFORM_PRESETS } from "../game/presets";
import { COMPANION_SLOT_COUNT, SCHEMA_VERSION, type CompanionSlot, type SaveData, type Settings } from "./schema";

export type DefaultEnv = {
  /** OS의 동작 줄이기 설정. 켜져 있으면 흔들림·파티클을 끈 채로 시작한다 (기획서 12번) */
  reducedMotion: boolean;
};

export function createDefaultSettings(env: DefaultEnv): Settings {
  return {
    companionMax: CONFIG.companion.defaultMax,
    companionMaxSource: "default",
    refusalCount: 0,
    shake: !env.reducedMotion,
    particles: !env.reducedMotion,
    sfx: true,
    specialPlatformMarker: true,
    theme: DEFAULT_THEME,
    cardCaption: CONFIG.card.defaultCaption,
    onboarding: { firstRunDone: false, controlsGuideShown: false, backupReminderAt: null, lastExportAt: null },
  };
}

export function createEmptyCompanionSlots(): CompanionSlot[] {
  return Array.from({ length: COMPANION_SLOT_COUNT }, () => ({ character: null }));
}

/** 기본값은 매번 새 객체로 만든다. 프리셋 객체를 그대로 공유하면 에디터 수정이 프리셋까지 바꿔버린다 */
export function createDefaultSaveData(env: DefaultEnv): SaveData {
  return {
    version: SCHEMA_VERSION,
    // 처음 주인공: 말랑이 세 모습(기본·내려갈 때·착지)
    hero: structuredClone(CHARACTER_PRESETS[0].character),
    platforms: structuredClone(PLATFORM_PRESETS),
    companionSlots: createEmptyCompanionSlots(),
    savedCharacters: [],
    savedPlatforms: [],
    palette: [...DEFAULT_PALETTE],
    best: { withCompanions: 0, solo: 0 },
    settings: createDefaultSettings(env),
  };
}
