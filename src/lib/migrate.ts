import { withPresetPoses } from "../game/presets";
import { SCHEMA_VERSION, type Character } from "./schema";

/**
 * 스키마 마이그레이션. MIGRATIONS[n]은 버전 n 데이터를 n+1로 바꾼다.
 * 스키마를 바꿀 때는 SCHEMA_VERSION을 올리고 여기에 한 단계짜리 함수를 추가한다. 검증은 migrate 뒤에 validate.ts가 한다.
 *
 * 예) v1 → v2에서 settings.volume을 추가한다면
 *   1: (d) => ({ ...d, settings: { ...(d.settings as object), volume: 1 } }),
 */
type RawData = Record<string, unknown>;
type Migration = (data: RawData) => RawData;

/**
 * v1 캐릭터 { frames: [기본, 착지?] } → v2 { base, land? } (모르는 모양은 그대로 둬서 검증이 걸러낸다).
 * 손대지 않은 기본 캐릭터면 새로 생긴 내려갈 때·착지 모습도 채운다.
 */
function characterV1toV2(c: unknown): unknown {
  if (typeof c !== "object" || c === null || !Array.isArray((c as { frames?: unknown }).frames)) return c;
  const [base, land] = (c as { frames: unknown[] }).frames;
  if (land !== undefined) return { base, land };
  const b = base as { kind?: unknown; pixels?: unknown };
  return b && b.kind === "pixel" && Array.isArray(b.pixels) ? withPresetPoses({ base } as Character) : { base };
}

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: 캐릭터 모습을 순서(frames)에서 이름(base·fall·land)으로. 내보낸 파일처럼 항목이 일부만 있어도 된다
  1: (d) => {
    const out: RawData = { ...d };
    if ("hero" in d) out.hero = characterV1toV2(d.hero);
    if (Array.isArray(d.companionSlots)) {
      out.companionSlots = d.companionSlots.map((s) =>
        typeof s === "object" && s !== null && "character" in s ? { ...s, character: characterV1toV2((s as RawData).character) } : s,
      );
    }
    return out;
  },
};

export type MigrateResult =
  | { ok: true; data: RawData; fromVersion: number }
  | { ok: false; reason: "invalid" | "newer"; fromVersion?: number };

export function migrate(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, target = SCHEMA_VERSION): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "invalid" };
  const version = (raw as RawData).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, reason: "invalid" };
  if (version > target) return { ok: false, reason: "newer", fromVersion: version };

  let data = raw as RawData;
  for (let v = version; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: "invalid", fromVersion: version };
    data = { ...step(data), version: v + 1 };
  }
  return { ok: true, data, fromVersion: version };
}
