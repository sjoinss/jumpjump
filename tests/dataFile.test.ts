import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyImport,
  buildExport,
  collectImages,
  DEFAULT_EXPORT_KEYS,
  exportFileName,
  exportHasImages,
  FULL_BACKUP_KEYS,
  hasCustomArt,
  needsBackupReminder,
  parseImport,
  replaceImages,
} from "../src/lib/dataFile";
import { createDefaultSaveData } from "../src/lib/defaults";
import { SCHEMA_VERSION, type ImageSprite } from "../src/lib/schema";

const env = { reducedMotion: false };
const save = () => createDefaultSaveData(env);
const NOW = new Date(2026, 8, 30, 15, 0, 0);
const img = (data = "AAAA"): ImageSprite => ({ kind: "image", mime: "image/png", data, width: 320, height: 360 });
const roundTrip = (s = save(), keys = DEFAULT_EXPORT_KEYS) => JSON.stringify(buildExport(s, keys, NOW));

test("내보내기: 기본은 그림 데이터만, 전체 백업은 설정·기록까지", () => {
  const basic = buildExport(save(), DEFAULT_EXPORT_KEYS, NOW);
  assert.equal(basic.app, "dot-jump-climb");
  assert.equal(basic.version, SCHEMA_VERSION);
  assert.deepEqual(Object.keys(basic.data), ["hero", "platforms", "companionSlots", "palette"]);
  assert.deepEqual(Object.keys(buildExport(save(), FULL_BACKUP_KEYS, NOW).data).sort(), [...FULL_BACKUP_KEYS].sort());
});

test("내보내기: 파일 이름은 날짜", () => {
  assert.equal(exportFileName(NOW), "jumpjump-2026-09-30.json");
});

test("내보내기: 이미지 포함 여부 (고른 항목 기준)", () => {
  const s = save();
  assert.equal(exportHasImages(s, DEFAULT_EXPORT_KEYS), false);
  s.companionSlots[2] = { character: { base: img() } };
  assert.equal(exportHasImages(s, DEFAULT_EXPORT_KEYS), true);
  assert.equal(exportHasImages(s, ["hero", "palette"]), false, "동료를 빼면 경고 없음");
});

test("불러오기: 내보낸 파일은 그대로 다시 읽힌다", () => {
  const s = save();
  s.palette = ["#123456"];
  const r = parseImport(roundTrip(s));
  assert.ok(r.ok);
  assert.deepEqual(r.value.keys, ["hero", "platforms", "companionSlots", "palette"]);
  assert.deepEqual(r.value.data.palette, ["#123456"]);
  assert.equal(r.value.exportedAt?.getTime(), NOW.getTime());
});

test("불러오기: 깨진 JSON, 다른 앱 파일, 새 버전은 원인과 함께 거부", () => {
  const bad = (text: string) => {
    const r = parseImport(text);
    assert.ok(!r.ok);
    return r.error;
  };
  assert.match(bad("{nope"), /읽을 수 없어요/);
  assert.match(bad(JSON.stringify({ app: "other", type: "save", version: 1, data: {} })), /이 게임에서 내보낸 파일이 아니에요/);
  const newer = JSON.parse(roundTrip());
  newer.version = SCHEMA_VERSION + 1;
  assert.match(bad(JSON.stringify(newer)), /업데이트/);
  const empty = JSON.parse(roundTrip());
  empty.data = { unknown: 1 };
  assert.match(bad(JSON.stringify(empty)), /가져올 데이터가 없어요/);
});

test("불러오기: 하나라도 잘못되면 전체 거부, 오류에 위치가 나온다", () => {
  const f = JSON.parse(roundTrip());
  f.data.companionSlots[2] = { character: { base: { kind: "pixel", width: 8, height: 8, pixels: new Array(64).fill("") } } };
  const r = parseImport(JSON.stringify(f));
  assert.deepEqual(r, { ok: false, error: "동료 슬롯 3의 그림 크기가 올바르지 않습니다" });
});

test("불러오기: 이미지 형식 제한 (svg 거부)", () => {
  const f = JSON.parse(roundTrip());
  f.data.hero = { base: { ...img(), mime: "image/svg+xml" } };
  const r = parseImport(JSON.stringify(f));
  assert.ok(!r.ok && r.error.includes("PNG 또는 WebP"));
});

test("불러오기: 모르는 필드는 버리고, 설정 값이 이상하면 거부", () => {
  const f = JSON.parse(roundTrip(save(), FULL_BACKUP_KEYS));
  f.data.hero.evil = "<script>";
  const ok = parseImport(JSON.stringify(f));
  assert.ok(ok.ok && !("evil" in (ok.value.data.hero as object)));
  f.data.settings.companionMax = 99;
  assert.ok(!parseImport(JSON.stringify(f)).ok);
});

test("적용: 고른 항목만 덮어쓰고, 설정은 직접 설정(user)으로, 온보딩은 이 기기 것", () => {
  const mine = save();
  mine.best.solo = 50;
  mine.settings.onboarding.controlsGuideShown = true;
  const theirs = save();
  theirs.palette = ["#abcdef"];
  theirs.best.solo = 999;
  theirs.settings.theme = "dream";
  const parsed = parseImport(JSON.stringify(buildExport(theirs, FULL_BACKUP_KEYS, NOW)));
  assert.ok(parsed.ok);
  const next = applyImport(mine, parsed.value.data, ["palette", "settings"]);
  assert.deepEqual(next.palette, ["#abcdef"]);
  assert.equal(next.best.solo, 50, "고르지 않은 기록은 그대로");
  assert.equal(next.settings.theme, "dream");
  assert.equal(next.settings.companionMaxSource, "user");
  assert.equal(next.settings.onboarding.controlsGuideShown, true);
  assert.equal(mine.palette.length, 8, "원본은 그대로 (실패해도 기존 데이터 유지)");
});

test("이미지 모으기·바꾸기", () => {
  const a = img("AAAA");
  const b = img("BBBB");
  const data = { hero: { base: a as ImageSprite }, companionSlots: [{ character: { base: save().hero.base, land: b } }] };
  const found = collectImages(data);
  assert.deepEqual(found.map((x) => x.label), ["캐릭터", "동료 슬롯 1 착지 모습"]);
  const re = img("CCCC");
  const next = replaceImages(data, new Map([[a, re]]));
  assert.equal(next.hero!.base, re);
  assert.equal(next.companionSlots![0].character!.land, b);
});

test("백업 안내: 직접 그린 게 있고 오래 내보내지 않았을 때만", () => {
  const day = 24 * 60 * 60 * 1000;
  const s = save();
  assert.equal(hasCustomArt(s), false);
  s.settings.onboarding.backupReminderAt = 0 + 1;
  assert.equal(needsBackupReminder(s, 100 * day), false, "기본 그림뿐이면 안내 안 함");
  s.platforms = { ...s.platforms, basic: { ...s.platforms.basic, pixels: s.platforms.basic.pixels.map(() => "#000000") } };
  assert.equal(hasCustomArt(s), true);
  s.settings.onboarding.backupReminderAt = 10 * day;
  assert.equal(needsBackupReminder(s, 20 * day), false, "14일 안");
  assert.equal(needsBackupReminder(s, 25 * day), true, "14일 지남");
  s.settings.onboarding.lastExportAt = 24 * day;
  assert.equal(needsBackupReminder(s, 25 * day), false, "최근에 내보냄");
});
