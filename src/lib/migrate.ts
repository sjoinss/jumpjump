import { SCHEMA_VERSION } from "./schema";

/**
 * 스키마 마이그레이션. MIGRATIONS[n]은 버전 n 데이터를 n+1로 바꾼다.
 * 스키마를 바꿀 때는 SCHEMA_VERSION을 올리고 여기에 한 단계짜리 함수를 추가한다. 검증은 migrate 뒤에 validate.ts가 한다.
 *
 * 예) v1 → v2에서 settings.volume을 추가한다면
 *   1: (d) => ({ ...d, settings: { ...(d.settings as object), volume: 1 } }),
 */
type RawData = Record<string, unknown>;
type Migration = (data: RawData) => RawData;

const MIGRATIONS: Record<number, Migration> = {};

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
