import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultSaveData } from "../src/lib/defaults";
import { migrate } from "../src/lib/migrate";
import { CORRUPT_BACKUP_KEY, SAVE_KEY, SaveStore, loadSaveData } from "../src/lib/saveStore";
import { SCHEMA_VERSION } from "../src/lib/schema";
import { MemoryStore, StorageError, type KeyValueStore } from "../src/lib/storage";
import { normalizeSaveData, validateCharacter, validateCompanionSlots, validatePalette } from "../src/lib/validate";

const env = { reducedMotion: false };
const pixel = (w: number, h: number, color = "#ffffff") => ({
  kind: "pixel",
  width: w,
  height: h,
  pixels: new Array(w * h).fill(color),
});

// ── 기본값 ──

test("기본값: 동료 슬롯 5칸, 동료 최대 5, 설정 출처 default", () => {
  const d = createDefaultSaveData(env);
  assert.equal(d.version, SCHEMA_VERSION);
  assert.equal(d.companionSlots.length, 5);
  assert.ok(d.companionSlots.every((s) => s.character === null));
  assert.equal(d.settings.companionMax, 5);
  assert.equal(d.settings.companionMaxSource, "default");
  assert.equal(d.hero.frames.length, 1);
});

test("기본값: 동작 줄이기가 켜져 있으면 흔들림·파티클 꺼진 채 시작", () => {
  const d = createDefaultSaveData({ reducedMotion: true });
  assert.equal(d.settings.shake, false);
  assert.equal(d.settings.particles, false);
  assert.equal(d.settings.sfx, true);
});

test("기본값: 매번 새 객체 (프리셋을 공유하지 않음)", () => {
  const a = createDefaultSaveData(env);
  const b = createDefaultSaveData(env);
  assert.notEqual(a.hero.frames[0], b.hero.frames[0]);
  assert.notEqual(a.platforms.basic.pixels, b.platforms.basic.pixels);
});

test("기본값은 자기 자신의 검증을 통과한다", () => {
  const { issues } = normalizeSaveData(createDefaultSaveData(env), env);
  assert.deepEqual(issues, []);
});

// ── 검증 ──

test("캐릭터: 16×18, 32×36 허용 / 다른 크기 거부", () => {
  assert.ok(validateCharacter({ frames: [pixel(16, 18)] }, "주인공").ok);
  assert.ok(validateCharacter({ frames: [pixel(32, 36), pixel(16, 18)] }, "주인공").ok);
  const bad = validateCharacter({ frames: [pixel(20, 20)] }, "주인공");
  assert.deepEqual(bad, { ok: false, error: "주인공의 그림 크기가 올바르지 않습니다" });
});

test("캐릭터: pixels 길이가 width×height와 다르면 거부", () => {
  const sprite = { ...pixel(16, 18), pixels: new Array(10).fill("") };
  assert.equal(validateCharacter({ frames: [sprite] }, "주인공").ok, false);
});

test("캐릭터: 프레임 0장·3장 거부", () => {
  assert.equal(validateCharacter({ frames: [] }, "주인공").ok, false);
  assert.equal(validateCharacter({ frames: [pixel(16, 18), pixel(16, 18), pixel(16, 18)] }, "주인공").ok, false);
});

test("색: #rrggbb 또는 투명만, 대문자는 소문자로", () => {
  const r = validateCharacter({ frames: [pixel(16, 18, "#ABCDEF")] }, "주인공");
  assert.ok(r.ok && r.value.frames[0].kind === "pixel" && r.value.frames[0].pixels[0] === "#abcdef");
  for (const c of ["red", "#fff", "rgb(0,0,0)", "#12345g", null, 5]) {
    assert.equal(validateCharacter({ frames: [pixel(16, 18, c as string)] }, "주인공").ok, false, String(c));
  }
});

test("이미지: png/webp만, 320×360, base64", () => {
  const img = { kind: "image", mime: "image/png", data: "iVBORw0KGgo=", width: 320, height: 360 };
  assert.ok(validateCharacter({ frames: [img] }, "주인공").ok);
  assert.equal(validateCharacter({ frames: [{ ...img, mime: "image/svg+xml" }] }, "주인공").ok, false);
  assert.equal(validateCharacter({ frames: [{ ...img, width: 640 }] }, "주인공").ok, false);
  assert.equal(validateCharacter({ frames: [{ ...img, data: "<script>" }] }, "주인공").ok, false);
});

test("동료 슬롯: 오류 문구에 슬롯 번호가 들어간다", () => {
  const slots = [null, null, { character: { frames: [pixel(8, 8)] } }, null, null].map((s) => s ?? { character: null });
  assert.deepEqual(validateCompanionSlots(slots), { ok: false, error: "동료 슬롯 3의 그림 크기가 올바르지 않습니다" });
});

test("동료 슬롯: 5칸이 아니면 거부, 이름 길이 제한", () => {
  assert.equal(validateCompanionSlots([{ character: null }]).ok, false);
  const long = Array.from({ length: 5 }, () => ({ character: null, name: "가".repeat(13) }));
  assert.equal(validateCompanionSlots(long).ok, false);
});

test("팔레트: 중복 제거, 상한 초과 거부", () => {
  const r = validatePalette(["#FFFFFF", "#ffffff", "#000000"]);
  assert.deepEqual(r, { ok: true, value: ["#ffffff", "#000000"] });
  assert.equal(validatePalette(new Array(25).fill("#000000")).ok, false);
});

test("모르는 필드는 버린다", () => {
  const raw = { ...createDefaultSaveData(env), evil: "<img onerror>" } as Record<string, unknown>;
  const { data } = normalizeSaveData(raw, env);
  assert.equal("evil" in data, false);
});

test("일부만 망가지면 그 부분만 기본값, 나머지는 유지", () => {
  const raw = createDefaultSaveData(env) as unknown as Record<string, unknown>;
  raw.best = { withCompanions: 42, solo: 7 };
  raw.palette = "not an array";
  (raw.settings as Record<string, unknown>).companionMax = 9;
  const { data, issues } = normalizeSaveData(raw, env);
  assert.deepEqual(data.best, { withCompanions: 42, solo: 7 });
  assert.equal(data.palette.length, 8);
  assert.equal(data.settings.companionMax, 5);
  assert.ok(issues.includes("팔레트 형식이 올바르지 않습니다"));
  assert.ok(issues.includes("settings.companionMax"));
});

// ── 마이그레이션 ──

test("마이그레이션: 단계별로 적용하고 버전을 올린다", () => {
  const steps = {
    1: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
    2: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
  };
  const r = migrate({ version: 1 }, steps, 3);
  assert.deepEqual(r, { ok: true, data: { version: 3, a: 1, b: 2 }, fromVersion: 1 });
});

test("마이그레이션: 더 새 버전은 newer, 버전 없음은 invalid", () => {
  assert.deepEqual(migrate({ version: SCHEMA_VERSION + 1 }), { ok: false, reason: "newer", fromVersion: SCHEMA_VERSION + 1 });
  assert.equal(migrate({}).ok, false);
  assert.equal(migrate("garbage").ok, false);
});

// ── 불러오기 ──

test("불러오기: 비어 있으면 fresh", async () => {
  const r = await loadSaveData(new MemoryStore(), env);
  assert.equal(r.notice, "fresh");
  assert.equal(r.readOnly, false);
});

test("불러오기: 정상 데이터는 그대로", async () => {
  const store = new MemoryStore();
  const saved = createDefaultSaveData(env);
  saved.best.solo = 33;
  await store.set(SAVE_KEY, saved);
  const r = await loadSaveData(store, env);
  assert.equal(r.notice, "loaded");
  assert.equal(r.data.best.solo, 33);
});

test("불러오기: 통째로 깨진 데이터는 원본을 보관하고 기본값으로", async () => {
  const store = new MemoryStore();
  await store.set(SAVE_KEY, "{broken json");
  const r = await loadSaveData(store, env);
  assert.equal(r.notice, "reset");
  assert.deepEqual((await store.get<{ raw: unknown }>(CORRUPT_BACKUP_KEY))?.raw, "{broken json");
  assert.equal((await store.get<{ version: number }>(SAVE_KEY))?.version, SCHEMA_VERSION);
});

test("불러오기: 일부 손상은 repaired, 고친 값을 다시 저장", async () => {
  const store = new MemoryStore();
  const saved = createDefaultSaveData(env) as unknown as Record<string, unknown>;
  saved.hero = { frames: [pixel(3, 3)] };
  await store.set(SAVE_KEY, saved);
  const r = await loadSaveData(store, env);
  assert.equal(r.notice, "repaired");
  assert.ok(r.issues.includes("주인공의 그림 크기가 올바르지 않습니다"));
  assert.ok(await store.get(CORRUPT_BACKUP_KEY));
});

test("불러오기: 새 버전 데이터는 읽기 전용이고 원본을 덮어쓰지 않는다", async () => {
  const store = new MemoryStore();
  const saved = { ...createDefaultSaveData(env), version: SCHEMA_VERSION + 1, future: true };
  await store.set(SAVE_KEY, saved);
  const r = await loadSaveData(store, env);
  assert.equal(r.notice, "newer");
  assert.equal(r.readOnly, true);

  const s = new SaveStore(store, r.data, r.readOnly, 0);
  s.update((d) => ({ ...d, best: { ...d.best, solo: 999 } }));
  await s.flush();
  assert.equal((await store.get<{ future: boolean }>(SAVE_KEY))?.future, true);
});

// ── 쓰기 ──

test("쓰기: 연속 update는 한 번에 모아서 쓴다", async () => {
  const store = new MemoryStore();
  let writes = 0;
  const counting: KeyValueStore = {
    kind: "memory",
    get: (k) => store.get(k),
    delete: (k) => store.delete(k),
    set: async (k, v) => {
      writes++;
      await store.set(k, v);
    },
  };
  const s = new SaveStore(counting, createDefaultSaveData(env), false, 20);
  for (let i = 1; i <= 5; i++) s.update((d) => ({ ...d, best: { ...d.best, solo: i } }));
  assert.equal(s.getData().best.solo, 5);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(writes, 1);
  assert.equal((await store.get<{ best: { solo: number } }>(SAVE_KEY))?.best.solo, 5);
});

test("쓰기: 실패하면 오류 상태, 다음 flush에서 다시 시도", async () => {
  const store = new MemoryStore();
  let fail = true;
  const flaky: KeyValueStore = {
    kind: "persistent",
    get: (k) => store.get(k),
    delete: (k) => store.delete(k),
    set: async (k, v) => {
      if (fail) throw new StorageError("quota", "저장 공간이 부족합니다");
      await store.set(k, v);
    },
  };
  const s = new SaveStore(flaky, createDefaultSaveData(env), false, 0);
  s.update((d) => ({ ...d, best: { ...d.best, solo: 10 } }));
  await s.flush();
  assert.equal(s.getStatus().error?.kind, "quota");
  assert.equal(s.getData().best.solo, 10, "메모리 데이터는 유지");

  fail = false;
  await s.flush();
  assert.equal(s.getStatus().error, null);
  assert.equal((await store.get<{ best: { solo: number } }>(SAVE_KEY))?.best.solo, 10);
});

test("테마: 없으면 기본 테마로 읽고 손상으로 치지 않음, 모르는 값은 기본으로", () => {
  const raw = createDefaultSaveData(env) as unknown as { settings: Record<string, unknown> };
  delete raw.settings.theme;
  const a = normalizeSaveData(raw, env);
  assert.equal(a.data.settings.theme, "dot");
  assert.deepEqual(a.issues, []);
  raw.settings.theme = "neon";
  const b = normalizeSaveData(raw, env);
  assert.equal(b.data.settings.theme, "dot");
  assert.ok(b.issues.includes("settings.theme"));
  raw.settings.theme = "dream";
  assert.equal(normalizeSaveData(raw, env).data.settings.theme, "dream");
});
