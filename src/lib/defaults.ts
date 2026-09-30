import { CONFIG } from "../game/config";
import { DEFAULT_THEME } from "../game/themes";
import { DEFAULT_PALETTE, HERO_MALLANG, PLATFORM_PRESETS } from "../game/presets";
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
    hero: structuredClone({ frames: [HERO_MALLANG] }),
    platforms: structuredClone(PLATFORM_PRESETS),
    companionSlots: createEmptyCompanionSlots(),
    palette: [...DEFAULT_PALETTE],
    best: { withCompanions: 0, solo: 0 },
    settings: createDefaultSettings(env),
  };
}
