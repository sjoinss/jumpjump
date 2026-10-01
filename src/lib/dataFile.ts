import { CONFIG } from "../game/config";
import { CHARACTER_PRESETS, PLATFORM_PRESETS } from "../game/presets";
import { migrate } from "./migrate";
import { characterSprites, POSE_INFO } from "./character";
import {
  POSES,
  SCHEMA_VERSION,
  type BestScores,
  type Character,
  type CompanionSlot,
  type ImageSprite,
  type PixelColor,
  type Platforms,
  type SaveData,
  type Settings,
  type Sprite,
} from "./schema";
import {
  normalizeSettings,
  validateBest,
  validateCharacter,
  validateCompanionSlots,
  validatePalette,
  validatePlatforms,
  type Result,
} from "./validate";

/**
 * JSON 내보내기·불러오기 (기획서 14번). 파일 형식:
 * { app: "dot-jump-climb", type: "save", version, exportedAt, data: { hero?, platforms?, companionSlots?, palette?, settings?, best? } }
 */

export const DATA_KEYS = ["hero", "platforms", "companionSlots", "palette", "settings", "best"] as const;
export type DataKey = (typeof DATA_KEYS)[number];

export const DATA_LABEL: Record<DataKey, string> = {
  hero: "캐릭터",
  platforms: "발판 3종",
  companionSlots: "동료 그림",
  palette: "팔레트",
  settings: "설정",
  best: "최고 기록",
};

/** 기본 체크: 그림 데이터만. 설정·최고 기록은 "전체 백업"에서만 */
export const DEFAULT_EXPORT_KEYS: DataKey[] = ["hero", "platforms", "companionSlots", "palette"];
export const FULL_BACKUP_KEYS: DataKey[] = [...DATA_KEYS];

export type ExportData = {
  hero?: Character;
  platforms?: Platforms;
  companionSlots?: CompanionSlot[];
  palette?: PixelColor[];
  settings?: Settings;
  best?: BestScores;
};

export type ExportFile = {
  app: string;
  type: "save";
  version: number;
  exportedAt: string;
  data: ExportData;
};

// ── 내보내기 ──

export function buildExport(save: SaveData, keys: readonly DataKey[], now: Date): ExportFile {
  const data: ExportData = {};
  for (const k of keys) (data as Record<string, unknown>)[k] = save[k];
  return { app: CONFIG.dataFile.app, type: "save", version: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function exportFileName(now: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${CONFIG.dataFile.fileNamePrefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** 고른 항목에 불러온 이미지(사진일 수 있음)가 들어 있는지 — 공유 전 경고용 (기획서 6-4) */
export function exportHasImages(save: SaveData, keys: readonly DataKey[]) {
  const hasImage = (c: Character | null) => !!c && characterSprites(c).some((f) => f.kind === "image");
  return (keys.includes("hero") && hasImage(save.hero)) || (keys.includes("companionSlots") && save.companionSlots.some((s) => hasImage(s.character)));
}

// ── 불러오기 ──

export type ParsedImport = {
  version: number;
  exportedAt: Date | null;
  data: ExportData;
  /** 들어 있는 항목 (DATA_KEYS 순서) */
  keys: DataKey[];
};

/** 알 수 없는 입력에서 문자열 값만 안전하게 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * 파일 내용을 읽어 화이트리스트 검증한다. 하나라도 잘못되면 전체를 거부한다 (부분 적용 없음).
 * 이미지의 실제 디코딩 확인·재인코딩은 브라우저에서 따로 한다 (imageVerify.ts).
 */
export function parseImport(text: string): Result<ParsedImport> {
  const fail = (error: string): Result<ParsedImport> => ({ ok: false, error });

  if (new Blob([text]).size > CONFIG.dataFile.maxBytes) {
    return fail(`파일이 너무 커요. ${CONFIG.dataFile.maxBytes / 1024 / 1024}MB 이하 파일만 불러올 수 있어요.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("파일을 읽을 수 없어요. 이 게임에서 내보낸 JSON 파일인지 확인해주세요.");
  }
  if (!isRecord(raw) || raw.app !== CONFIG.dataFile.app || raw.type !== "save") {
    return fail("이 게임에서 내보낸 파일이 아니에요.");
  }
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return fail("파일의 버전 정보가 올바르지 않아요.");
  }
  if (version > SCHEMA_VERSION) {
    return fail("더 새로운 버전의 앱에서 만든 파일이에요. 앱을 업데이트한 뒤 다시 불러와 주세요.");
  }
  if (!isRecord(raw.data)) return fail("파일에 가져올 데이터가 없어요.");

  // 이전 버전 파일은 저장 데이터와 같은 마이그레이션을 거친다
  const migrated = migrate({ ...raw.data, version });
  if (!migrated.ok) return fail("이전 버전 파일을 변환하지 못했어요.");
  const src = migrated.data;

  const data: ExportData = {};
  const keys: DataKey[] = [];
  const take = <T>(key: DataKey, r: Result<T>): string | null => {
    if (!r.ok) return r.error;
    (data as Record<string, unknown>)[key] = r.value;
    keys.push(key);
    return null;
  };

  for (const key of DATA_KEYS) {
    const v = src[key];
    if (v === undefined) continue;
    let error: string | null = null;
    switch (key) {
      case "hero":
        error = take(key, validateCharacter(v, "캐릭터"));
        break;
      case "platforms":
        error = take(key, validatePlatforms(v));
        break;
      case "companionSlots":
        error = take(key, validateCompanionSlots(v));
        break;
      case "palette":
        error = take(key, validatePalette(v));
        break;
      case "best":
        error = take(key, validateBest(v));
        break;
      case "settings": {
        const s = normalizeSettings(v, { reducedMotion: false });
        error = s.issues.length > 0 || !isRecord(v) ? "설정 값이 올바르지 않습니다" : take(key, { ok: true, value: s.value });
        break;
      }
    }
    if (error) return fail(error);
  }
  if (keys.length === 0) return fail("파일에 가져올 데이터가 없어요.");

  const at = typeof raw.exportedAt === "string" && raw.exportedAt.length <= 40 ? new Date(raw.exportedAt) : null;
  return { ok: true, value: { version, exportedAt: at && !Number.isNaN(at.getTime()) ? at : null, data, keys } };
}

/** 이미지 스프라이트 목록 (재인코딩 대상) — 오류 문구용 이름과 함께 */
export function collectImages(data: ExportData): { label: string; sprite: ImageSprite }[] {
  const out: { label: string; sprite: ImageSprite }[] = [];
  const add = (c: Character | null | undefined, label: string) => {
    if (!c) return;
    for (const pose of POSES) {
      const f = c[pose];
      if (f?.kind === "image") out.push({ label: pose === "base" ? label : `${label} ${POSE_INFO[pose].name} 모습`, sprite: f });
    }
  };
  add(data.hero, "캐릭터");
  data.companionSlots?.forEach((s, i) => add(s.character, `동료 슬롯 ${i + 1}`));
  return out;
}

/** 이미지를 바꾼 결과로 교체 (같은 객체 기준) */
export function replaceImages(data: ExportData, map: Map<ImageSprite, ImageSprite>): ExportData {
  const one = (f: Sprite) => (f.kind === "image" ? (map.get(f) ?? f) : f);
  const swap = (c: Character | null): Character | null => {
    if (!c) return null;
    const out: Character = { base: one(c.base) };
    if (c.fall) out.fall = one(c.fall);
    if (c.land) out.land = one(c.land);
    return out;
  };
  return {
    ...data,
    hero: data.hero && (swap(data.hero) as Character),
    companionSlots: data.companionSlots?.map((s) => ({ ...s, character: swap(s.character) })),
  };
}

/**
 * 고른 항목만 덮어쓴다. 설정을 가져오면 동료 최대 인원은 "직접 설정"으로 본다 (기획서 7-6).
 * 온보딩 기록(안내를 봤는지 등)은 이 기기 것을 유지한다.
 */
export function applyImport(save: SaveData, imp: ExportData, keys: readonly DataKey[]): SaveData {
  const next: SaveData = { ...save };
  for (const k of keys) {
    const v = imp[k];
    if (v === undefined) continue;
    if (k === "settings") {
      const s = v as Settings;
      next.settings = { ...s, companionMaxSource: "user", onboarding: save.settings.onboarding };
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  return next;
}

// ── 백업 안내 ──

const pixelsKey = (s: Sprite) => (s.kind === "pixel" ? `${s.width}:${s.pixels.join(",")}` : `img:${s.data.length}`);

/** 기본 제공 그림에서 바뀐 게 있는지 (내보낼 가치가 있는 그림이 있는지) */
export function hasCustomArt(save: SaveData) {
  // 기본 캐릭터 그대로 (안 그린 모습은 없거나 그 캐릭터의 모습 그대로)
  const same = (a: Sprite | undefined, b: Sprite | undefined) => !a || (!!b && pixelsKey(a) === pixelsKey(b));
  const presetHero = CHARACTER_PRESETS.some(
    (p) =>
      pixelsKey(p.sprite) === pixelsKey(save.hero.base) &&
      same(save.hero.fall, p.character.fall) &&
      same(save.hero.land, p.character.land),
  );
  const presetPlatforms = (Object.keys(PLATFORM_PRESETS) as (keyof Platforms)[]).every(
    (k) => pixelsKey(save.platforms[k]) === pixelsKey(PLATFORM_PRESETS[k]),
  );
  return !presetHero || !presetPlatforms || save.companionSlots.some((s) => s.character !== null);
}

/**
 * 시작 화면에 백업 안내를 띄울지 (기획서 10-4 "이후 주기적으로").
 * 직접 그린 그림이 있고, 마지막 내보내기(또는 마지막 안내)에서 일정 기간이 지났을 때.
 */
export function needsBackupReminder(save: SaveData, now: number) {
  if (!hasCustomArt(save)) return false;
  const { lastExportAt, backupReminderAt } = save.settings.onboarding;
  const last = Math.max(lastExportAt ?? 0, backupReminderAt ?? 0);
  if (last === 0) return false; // 첫 안내는 에디터에서 처음 완료할 때 이미 보여준다
  return now - last > CONFIG.dataFile.reminderIntervalDays * 24 * 60 * 60 * 1000;
}

