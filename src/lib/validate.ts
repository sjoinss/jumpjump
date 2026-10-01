import { CONFIG } from "../game/config";
import { PLATFORM_PRESETS } from "../game/presets";
import { isThemeId } from "../game/themes";
import { createDefaultSaveData, createDefaultSettings, type DefaultEnv } from "./defaults";
import {
  COMPANION_SLOT_COUNT,
  SCHEMA_VERSION,
  type BestScores,
  type Character,
  type CompanionMaxSource,
  type CompanionSlot,
  type ImageSprite,
  type PixelColor,
  type PixelSprite,
  type Platforms,
  type SaveData,
  type Settings,
  type Sprite,
} from "./schema";

/**
 * 화이트리스트 검증. 저장소에서 읽은 값과 JSON 불러오기(6단계) 모두 이 함수들을 거친다.
 * 알려진 필드만 골라 새 객체로 만들기 때문에 모르는 필드는 자연스럽게 버려진다.
 * 오류 문구는 사용자에게 그대로 보여줄 수 있게 한국어 문장으로 만든다.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** "#RRGGBB" → "#rrggbb", 투명은 "". 그 밖의 값은 null */
export function normalizeColor(v: unknown): PixelColor | null {
  if (v === "") return "";
  if (typeof v === "string" && HEX_COLOR.test(v)) return v.toLowerCase();
  return null;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export type SpriteUsage = "character" | "platform";

function allowedPixelSize(usage: SpriteUsage, width: unknown, height: unknown) {
  if (usage === "platform") {
    const g = CONFIG.platform.grid;
    return width === g.width && height === g.height;
  }
  return CONFIG.character.gridSizes.some((g) => g.width === width && g.height === height);
}

export function validatePixelSprite(raw: unknown, usage: SpriteUsage, label: string): Result<PixelSprite> {
  if (!isRecord(raw) || raw.kind !== "pixel") return fail(`${label}의 그림 형식이 올바르지 않습니다`);
  const { width, height, pixels } = raw;
  if (!allowedPixelSize(usage, width, height)) return fail(`${label}의 그림 크기가 올바르지 않습니다`);
  const w = width as number;
  const h = height as number;
  if (!Array.isArray(pixels) || pixels.length !== w * h) return fail(`${label}의 그림 크기가 올바르지 않습니다`);
  const out: PixelColor[] = new Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    const c = normalizeColor(pixels[i]);
    if (c === null) return fail(`${label}의 색 값이 올바르지 않습니다`);
    out[i] = c;
  }
  return ok({ kind: "pixel", width: w, height: h, pixels: out });
}

/** 형식·크기·길이만 본다. 실제 디코딩 확인과 재인코딩은 이미지를 다루는 쪽(5·6단계)에서 한다 */
export function validateImageSprite(raw: unknown, label: string): Result<ImageSprite> {
  if (!isRecord(raw) || raw.kind !== "image") return fail(`${label}의 그림 형식이 올바르지 않습니다`);
  if (raw.mime !== "image/png" && raw.mime !== "image/webp") {
    return fail(`${label}의 이미지 형식이 올바르지 않습니다. PNG 또는 WebP만 사용할 수 있습니다`);
  }
  const { width, height } = CONFIG.limits.image;
  if (raw.width !== width || raw.height !== height) return fail(`${label}의 그림 크기가 올바르지 않습니다`);
  const data = raw.data;
  if (typeof data !== "string" || data.length === 0 || data.length % 4 !== 0 || !BASE64.test(data)) {
    return fail(`${label}의 이미지 데이터가 손상되었습니다`);
  }
  if (data.length > CONFIG.limits.imageBase64MaxLength) return fail(`${label}의 이미지 파일이 너무 큽니다`);
  return ok({ kind: "image", mime: raw.mime, data, width, height });
}

export function validateSprite(raw: unknown, usage: SpriteUsage, label: string): Result<Sprite> {
  if (isRecord(raw) && raw.kind === "image") {
    if (usage === "platform") return fail(`${label}에는 이미지를 쓸 수 없습니다`);
    return validateImageSprite(raw, label);
  }
  return validatePixelSprite(raw, usage, label);
}

const POSE_LABEL = { fall: "내려갈 때 모습", land: "착지 모습" } as const;

/** 기본은 꼭, 내려갈 때·착지는 있으면 검사. 모르는 항목은 버린다 */
export function validateCharacter(raw: unknown, label: string): Result<Character> {
  if (!isRecord(raw) || raw.base === undefined) return fail(`${label}의 그림 형식이 올바르지 않습니다`);
  const base = validateSprite(raw.base, "character", label);
  if (!base.ok) return base;
  const out: Character = { base: base.value };
  for (const pose of ["fall", "land"] as const) {
    if (raw[pose] === undefined || raw[pose] === null) continue;
    const s = validateSprite(raw[pose], "character", `${label} ${POSE_LABEL[pose]}`);
    if (!s.ok) return s;
    out[pose] = s.value;
  }
  return ok(out);
}

export function validateCompanionSlots(raw: unknown): Result<CompanionSlot[]> {
  if (!Array.isArray(raw) || raw.length !== COMPANION_SLOT_COUNT) {
    return fail(`동료 슬롯은 ${COMPANION_SLOT_COUNT}칸이어야 합니다`);
  }
  const out: CompanionSlot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const label = `동료 슬롯 ${i + 1}`;
    const slot = raw[i];
    if (!isRecord(slot)) return fail(`${label}의 형식이 올바르지 않습니다`);
    let character: Character | null = null;
    if (slot.character !== null && slot.character !== undefined) {
      const c = validateCharacter(slot.character, label);
      if (!c.ok) return c;
      character = c.value;
    }
    const next: CompanionSlot = { character };
    if (slot.name !== undefined) {
      if (typeof slot.name !== "string") return fail(`${label}의 이름이 올바르지 않습니다`);
      const name = slot.name.trim();
      if (name.length > CONFIG.limits.companionNameMax) {
        return fail(`${label}의 이름은 ${CONFIG.limits.companionNameMax}자까지 쓸 수 있습니다`);
      }
      if (name) next.name = name;
    }
    out.push(next);
  }
  return ok(out);
}

const PLATFORM_LABEL: Record<keyof Platforms, string> = {
  basic: "기본 발판",
  highJump: "고점프 발판",
  oneTime: "일회용 발판",
  moving: "움직이는 발판",
};

export function validatePlatforms(raw: unknown): Result<Platforms> {
  if (!isRecord(raw)) return fail("발판 데이터 형식이 올바르지 않습니다");
  const out: Partial<Platforms> = {};
  for (const key of Object.keys(PLATFORM_LABEL) as (keyof Platforms)[]) {
    // 움직이는 발판은 나중에 생겨서 예전 데이터·파일에는 없다 → 기본 그림 (손상으로 치지 않음)
    if (key === "moving" && raw[key] === undefined) {
      out.moving = structuredClone(PLATFORM_PRESETS.moving);
      continue;
    }
    const r = validatePixelSprite(raw[key], "platform", PLATFORM_LABEL[key]);
    if (!r.ok) return r;
    out[key] = r.value;
  }
  return ok(out as Platforms);
}

export function validatePalette(raw: unknown): Result<PixelColor[]> {
  if (!Array.isArray(raw)) return fail("팔레트 형식이 올바르지 않습니다");
  if (raw.length > CONFIG.limits.paletteMax) {
    return fail(`팔레트 색은 ${CONFIG.limits.paletteMax}개까지 저장할 수 있습니다`);
  }
  const out: PixelColor[] = [];
  for (const v of raw) {
    const c = normalizeColor(v);
    if (!c) return fail("팔레트에 올바르지 않은 색이 있습니다");
    if (!out.includes(c)) out.push(c);
  }
  return ok(out);
}

export function validateBest(raw: unknown): Result<BestScores> {
  if (!isRecord(raw) || !isNonNegativeInt(raw.withCompanions) || !isNonNegativeInt(raw.solo)) {
    return fail("최고 기록 형식이 올바르지 않습니다");
  }
  return ok({ withCompanions: raw.withCompanions, solo: raw.solo });
}

const SOURCES: CompanionMaxSource[] = ["default", "auto", "user"];

/**
 * 설정은 항목별로 관대하게 읽는다: 잘못된 항목만 기본값으로 바꾸고 나머지는 살린다.
 * 바뀐 항목 이름을 issues에 담아 돌려준다.
 */
export function normalizeSettings(raw: unknown, env: DefaultEnv): { value: Settings; issues: string[] } {
  const def = createDefaultSettings(env);
  if (!isRecord(raw)) return { value: def, issues: raw === undefined ? [] : ["settings"] };
  const issues: string[] = [];
  const pick = <T>(key: string, valid: (v: unknown) => v is T, fallback: T): T => {
    const v = raw[key];
    if (valid(v)) return v;
    if (v !== undefined) issues.push(`settings.${key}`);
    return fallback;
  };
  const isBool = (v: unknown): v is boolean => typeof v === "boolean";
  const isMax = (v: unknown): v is number => isNonNegativeInt(v) && v <= CONFIG.companion.maxCount;
  const isSource = (v: unknown): v is CompanionMaxSource => SOURCES.includes(v as CompanionMaxSource);
  const isCaption = (v: unknown): v is string => typeof v === "string" && v.length <= CONFIG.card.captionMax;

  const ob = isRecord(raw.onboarding) ? raw.onboarding : {};
  const reminder = ob.backupReminderAt;
  const lastExport = ob.lastExportAt;
  const isTime = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0;
  return {
    value: {
      companionMax: pick("companionMax", isMax, def.companionMax),
      companionMaxSource: pick("companionMaxSource", isSource, def.companionMaxSource),
      refusalCount: pick("refusalCount", isNonNegativeInt, def.refusalCount),
      shake: pick("shake", isBool, def.shake),
      particles: pick("particles", isBool, def.particles),
      sfx: pick("sfx", isBool, def.sfx),
      specialPlatformMarker: pick("specialPlatformMarker", isBool, def.specialPlatformMarker),
      theme: pick("theme", isThemeId, def.theme),
      cardCaption: pick("cardCaption", isCaption, def.cardCaption),
      onboarding: {
        firstRunDone: isBool(ob.firstRunDone) ? ob.firstRunDone : def.onboarding.firstRunDone,
        controlsGuideShown: isBool(ob.controlsGuideShown) ? ob.controlsGuideShown : def.onboarding.controlsGuideShown,
        backupReminderAt: isTime(reminder) ? reminder : null,
        lastExportAt: isTime(lastExport) ? lastExport : null,
      },
    },
    issues,
  };
}

/**
 * 저장소에서 읽은 (마이그레이션까지 끝난) 값을 SaveData로 만든다.
 * 한 부분이 망가져도 그 부분만 기본값으로 되돌리고 나머지 그림은 살린다.
 */
export function normalizeSaveData(raw: unknown, env: DefaultEnv): { data: SaveData; issues: string[] } {
  const def = createDefaultSaveData(env);
  if (!isRecord(raw)) return { data: def, issues: ["전체 데이터"] };
  const issues: string[] = [];
  const section = <T>(r: Result<T>, fallback: T): T => {
    if (r.ok) return r.value;
    issues.push(r.error);
    return fallback;
  };
  const settings = normalizeSettings(raw.settings, env);
  issues.push(...settings.issues);
  return {
    data: {
      version: SCHEMA_VERSION,
      hero: section(validateCharacter(raw.hero, "주인공"), def.hero),
      platforms: section(validatePlatforms(raw.platforms), def.platforms),
      companionSlots: section(validateCompanionSlots(raw.companionSlots), def.companionSlots),
      palette: section(validatePalette(raw.palette), def.palette),
      best: section(validateBest(raw.best), def.best),
      settings: settings.value,
    },
    issues,
  };
}
