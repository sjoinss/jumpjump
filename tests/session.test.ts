import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_PRESETS } from "../src/game/presets";
import { getPixel } from "../src/editor/grid";
import {
  applyCompanionToSave,
  applyToSave,
  checkCommit,
  companionDraftKey,
  createCompanionEditorState,
  createEditorState,
  currentSprite,
  editorTabItems,
  editorReducer,
  isDirty,
  parseDraft,
  toDraft,
  type EditorAction,
  type EditorState,
} from "../src/editor/session";
import { createDefaultSaveData } from "../src/lib/defaults";
import type { PixelSprite } from "../src/lib/schema";

const R = "#ff0000";
const save = () => createDefaultSaveData({ reducedMotion: false });
/** 주인공이 기본 모습만 있는 저장 데이터 (모습 추가·삭제 시험용) */
const baseOnly = () => {
  const d = save();
  return { ...d, hero: { base: d.hero.base } };
};
const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const px = (s: EditorState, x: number, y: number) => getPixel(currentSprite(s) as PixelSprite, x, y);

test("펜 붓질 한 번 = 되돌리기 한 번", () => {
  let s = run(createEditorState(save()), { type: "setColor", color: R }, { type: "clear" });
  s = run(
    s,
    { type: "pointer", phase: "start", x: 0, y: 0 },
    { type: "pointer", phase: "move", x: 5, y: 0 },
    { type: "pointer", phase: "end", x: 5, y: 0 },
  );
  assert.equal(px(s, 3, 0), R, "사이 칸도 이어서 칠해짐");
  s = run(s, { type: "undo" });
  assert.equal(px(s, 3, 0), "");
  assert.equal(px(s, 0, 0), "", "붓질 전체가 한 번에 되돌려짐");
});

test("대칭 켜고 칠하면 반대편도", () => {
  const s = run(
    createEditorState(save()),
    { type: "clear" },
    { type: "setColor", color: R },
    { type: "toggle", key: "symmetry" },
    { type: "pointer", phase: "start", x: 1, y: 2 },
    { type: "pointer", phase: "end", x: 1, y: 2 },
  );
  assert.equal(px(s, 14, 2), R);
});

test("붓질 취소(핀치)는 붓질 전으로, 다시 하기 기록도 남기지 않음", () => {
  let s = run(createEditorState(save()), { type: "clear" }, { type: "setColor", color: R });
  s = run(s, { type: "pointer", phase: "start", x: 2, y: 2 }, { type: "pointer", phase: "cancel", x: 2, y: 2 });
  assert.equal(px(s, 2, 2), "");
  assert.equal(s.tabs.hero!.history.future.length, 0);
});

test("스포이드: 색을 집고 펜으로, 빈 칸이면 지우개로", () => {
  let s = run(createEditorState(save()), { type: "setTool", tool: "eyedropper" });
  const sprite = currentSprite(s) as PixelSprite;
  const i = sprite.pixels.findIndex(Boolean);
  s = run(s, { type: "pointer", phase: "start", x: i % sprite.width, y: Math.floor(i / sprite.width) });
  assert.equal(s.tool, "pen");
  assert.equal(s.color, sprite.pixels[i]);
  s = run(s, { type: "setTool", tool: "eyedropper" }, { type: "pointer", phase: "start", x: 0, y: 0 });
  assert.equal(s.tool, "eraser");
});

test("이동 도구: 끄는 동안 원래 그림 기준으로 밀고, 기록은 한 칸", () => {
  let s = run(createEditorState(save()), { type: "clear" }, { type: "setColor", color: R });
  s = run(s, { type: "pointer", phase: "start", x: 0, y: 0 }, { type: "pointer", phase: "end", x: 0, y: 0 });
  const before = s.tabs.hero!.history.past.length;
  s = run(
    s,
    { type: "setTool", tool: "move" },
    { type: "pointer", phase: "start", x: 5, y: 5 },
    { type: "pointer", phase: "move", x: 6, y: 5 },
    { type: "pointer", phase: "move", x: 7, y: 6 },
    { type: "pointer", phase: "end", x: 7, y: 6 },
  );
  assert.equal(px(s, 2, 1), R);
  assert.equal(px(s, 0, 0), "");
  assert.equal(s.tabs.hero!.history.past.length, before + 1);
});

const drawn = (s: EditorState) => s.tabs.hero!.history.present.frames.map((f) => f !== null);

test("모습: 내려갈 때·착지를 따로 추가(복사), 삭제는 되돌리기 가능", () => {
  let s = run(createEditorState(baseOnly()), { type: "addPose", pose: "land", copyBase: true });
  assert.equal(s.frame, 2, "착지는 셋째 칸");
  assert.deepEqual(drawn(s), [true, false, true], "내려갈 때는 안 그려도 됨");
  assert.deepEqual(currentSprite(s), s.tabs.hero!.history.present.frames[0]);
  s = run(s, { type: "addPose", pose: "fall", copyBase: false });
  assert.equal(s.frame, 1);
  assert.deepEqual(drawn(s), [true, true, true]);
  s = run(s, { type: "removePose" });
  assert.deepEqual(drawn(s), [true, false, true]);
  assert.equal(s.frame, 0);
  s = run(s, { type: "undo" });
  assert.deepEqual(drawn(s), [true, true, true]);
  s = run(s, { type: "setFrame", frame: 1 }, { type: "undo" });
  assert.deepEqual(drawn(s), [true, false, true]);
  assert.equal(s.frame, 0, "보던 모습이 사라지면 기본으로");
  assert.equal(run(s, { type: "setFrame", frame: 1 }).frame, 0, "안 그린 모습으로는 못 감");
  const atBase = run(s, { type: "setFrame", frame: 0 });
  assert.equal(run(atBase, { type: "removePose" }), atBase, "기본은 못 지움");
});

test("모습: 저장하면 그린 것만 들어간다 (기본 · 내려갈 때 · 착지)", () => {
  const base = baseOnly();
  const onlyFall = run(createEditorState(base), { type: "addPose", pose: "fall", copyBase: true });
  const hero = applyToSave(onlyFall, base).hero;
  assert.deepEqual(Object.keys(hero).sort(), ["base", "fall"]);
  const back = createEditorState({ ...base, hero });
  assert.deepEqual(drawn(back), [true, true, false], "다시 열어도 그대로");
});

test("탭마다 따로 기록되고, 바뀐 탭만 dirty", () => {
  let s = run(createEditorState(save()), { type: "setTab", tab: "highJump" }, { type: "flip" });
  assert.equal(isDirty(s, "highJump"), true);
  assert.equal(isDirty(s, "hero"), false);
  s = run(s, { type: "setTab", tab: "hero" }, { type: "undo" });
  assert.equal(isDirty(s, "highJump"), true, "캐릭터 탭 되돌리기는 발판에 영향 없음");
  s = run(s, { type: "setTab", tab: "highJump" }, { type: "undo" });
  assert.equal(isDirty(s), false, "원래대로 되돌리면 dirty 아님");
});

test("격자 크기 바꾸기는 모든 도트 프레임에 적용", () => {
  const s = run(
    createEditorState(save()),
    { type: "addPose", pose: "land", copyBase: true },
    { type: "resizeGrid", width: 32, height: 36 },
  );
  for (const f of s.tabs.hero!.history.present.frames) if (f) assert.equal((f as PixelSprite).width, 32);
});

test("완료 검사: 빈 그림이 있으면 어느 탭인지 알려준다", () => {
  let s = run(createEditorState(save()), { type: "setTab", tab: "oneTime" }, { type: "clear" });
  const r = checkCommit(s);
  assert.ok(!r.ok && r.tab === "oneTime" && r.message.includes("일회용 발판"));
  s = run(s, { type: "undo" }, { type: "setTab", tab: "hero" }, { type: "removePose" }, { type: "setFrame", frame: 0 });
  s = run(s, { type: "setFrame", frame: 1 }, { type: "removePose" }, { type: "addPose", pose: "fall", copyBase: false });
  const r2 = checkCommit(s);
  assert.ok(!r2.ok && r2.frame === 1 && r2.message.includes("내려갈 때"));
});

test("완료: 저장 데이터에 반영, 다른 값은 유지", () => {
  const base = save();
  base.best.solo = 77;
  const s = run(createEditorState(base), { type: "setTab", tab: "basic" }, { type: "flip" });
  const next = applyToSave(s, base);
  assert.equal(next.best.solo, 77);
  assert.notDeepEqual(next.platforms.basic.pixels, base.platforms.basic.pixels);
  assert.equal(next.hero.base, base.hero.base);
});

test("임시 저장: 바뀐 탭만 담고, 검증 후 복구", () => {
  const clean = createEditorState(save());
  assert.equal(toDraft(clean), null);
  const s = run(clean, { type: "setColor", color: R }, { type: "pointer", phase: "start", x: 0, y: 0 });
  const draft = toDraft(s)!;
  assert.deepEqual(Object.keys(draft.docs), ["hero"]);
  const parsed = parseDraft(JSON.parse(JSON.stringify(draft)))!;
  const restored = run(createEditorState(save()), { type: "restoreDraft", draft: parsed });
  assert.equal(px(restored, 0, 0), R);
  assert.equal(isDirty(restored), true);
  assert.equal(
    run(restored, { type: "undo" }).tabs.hero!.history.present,
    restored.tabs.hero!.baseline,
    "복구도 되돌릴 수 있음",
  );
  const broken = { ...draft, docs: { hero: { frames: [{ kind: "pixel", width: 3, height: 3, pixels: [] }] } } };
  assert.equal(parseDraft(broken), null);
});

test("이미지 넣기: 지금 모습에, 되돌리기 가능 / 빈 칸 착지는 이미지가 아니라 빈 도트", () => {
  const img = { kind: "image" as const, mime: "image/png" as const, data: "AAAA", width: 320 as const, height: 360 as const };
  let s = run(createEditorState(save()), { type: "setFrameSprite", sprite: img });
  assert.equal(currentSprite(s).kind, "image");
  s = run(s, { type: "addPose", pose: "land", copyBase: false });
  const landing = currentSprite(s) as PixelSprite;
  assert.equal(landing.kind, "pixel");
  assert.equal(landing.width, 16);
  s = run(s, { type: "undo" }, { type: "undo" });
  assert.equal(currentSprite(s).kind, "pixel");
  const onPlatform = run(createEditorState(save()), { type: "setTab", tab: "basic" }, { type: "setFrameSprite", sprite: img });
  assert.equal(currentSprite(onPlatform).kind, "pixel", "발판에는 이미지를 넣지 않음");
});

// ── 10단계: 동료 그리기 (같은 reducer의 companion 모드) ──

const emptySlot = { character: null };

test("동료: 빈 슬롯은 빈 16×18 한 장에서 시작하고, 탭은 동료 하나뿐", () => {
  const s = createCompanionEditorState(emptySlot, save().palette);
  assert.deepEqual(s.keys, ["companion"]);
  const sprite = currentSprite(s) as PixelSprite;
  assert.equal(sprite.width, 16);
  assert.ok(sprite.pixels.every((p) => p === ""));
  assert.equal(run(s, { type: "setTab", tab: "basic" }).active, "companion", "없는 탭으로는 못 감");
  const r = checkCommit(s);
  assert.ok(!r.ok && r.tab === "companion" && r.message.includes("동료 기본 그림"));
});

test("동료: 모습 추가·격자 크기·이미지 넣기는 주인공과 같이 된다", () => {
  let s = run(
    createCompanionEditorState(emptySlot, save().palette),
    { type: "setColor", color: R },
    { type: "pointer", phase: "start", x: 1, y: 1 },
    { type: "pointer", phase: "end", x: 1, y: 1 },
    { type: "addPose", pose: "land", copyBase: true },
    { type: "resizeGrid", width: 32, height: 36 },
  );
  assert.deepEqual(currentDoc2(s).map((f) => f !== null), [true, false, true]);
  for (const f of currentDoc2(s)) if (f) assert.equal((f as PixelSprite).width, 32);
  const r = checkCommit(s);
  assert.ok(r.ok);
  const img = { kind: "image" as const, mime: "image/png" as const, data: "AAAA", width: 320 as const, height: 360 as const };
  s = run(s, { type: "setFrame", frame: 0 }, { type: "setFrameSprite", sprite: img });
  assert.equal(currentSprite(s).kind, "image");
});

const currentDoc2 = (s: EditorState) => s.tabs.companion!.history.present.frames;

test("동료 완료: 그 슬롯에만 저장, 이름은 앞뒤 공백을 빼고 비면 이름 없음", () => {
  const base = save();
  let s = run(
    createCompanionEditorState(emptySlot, base.palette),
    { type: "setColor", color: R },
    { type: "pointer", phase: "start", x: 0, y: 0 },
    { type: "pointer", phase: "end", x: 0, y: 0 },
    { type: "setName", name: "  콩이  " },
  );
  let next = applyCompanionToSave(s, base, 3);
  assert.equal(next.companionSlots[2].name, "콩이");
  assert.equal((next.companionSlots[2].character!.base as PixelSprite).pixels[0], R);
  assert.equal(next.companionSlots[0].character, null, "다른 슬롯은 그대로");
  assert.equal(next.hero, base.hero, "주인공은 그대로");
  s = run(s, { type: "setName", name: "   " });
  next = applyCompanionToSave(s, base, 3);
  assert.equal("name" in next.companionSlots[2], false);
});

test("동료 이름: 12자까지, 이름만 바꿔도 dirty, 저장하면 깨끗", () => {
  const base = save();
  const slot = { character: base.hero, name: "콩이" };
  let s = createCompanionEditorState(slot, base.palette);
  assert.equal(isDirty(s), false);
  s = run(s, { type: "setName", name: "가나다라마바사아자차카타파하" });
  assert.equal(s.name.length, 12);
  assert.equal(isDirty(s), true);
  assert.equal(isDirty(run(s, { type: "markSaved" })), false);
  assert.equal(isDirty(run(s, { type: "setName", name: " 콩이 " })), false, "공백만 다르면 같은 이름");
});

test("동료 임시 저장(초안): 그림·이름을 담고 검증 후 복구, 슬롯마다 다른 키", () => {
  const base = save();
  const s = run(
    createCompanionEditorState(emptySlot, base.palette),
    { type: "setColor", color: R },
    { type: "pointer", phase: "start", x: 2, y: 3 },
    { type: "pointer", phase: "end", x: 2, y: 3 },
    { type: "setName", name: "별이" },
  );
  const draft = parseDraft(JSON.parse(JSON.stringify(toDraft(s))))!;
  assert.deepEqual(Object.keys(draft.docs), ["companion"]);
  assert.equal(draft.name, "별이");
  const restored = run(createCompanionEditorState(emptySlot, base.palette), { type: "restoreDraft", draft });
  assert.equal(px(restored, 2, 3), R);
  assert.equal(restored.name, "별이");
  assert.notEqual(companionDraftKey(1), companionDraftKey(2));
  assert.equal(parseDraft({ ...draft, name: 3 }), null, "이름 형식이 이상하면 버림");
  // 주인공·발판 에디터에 동료 초안이 들어와도 아무 탭도 바뀌지 않음
  const main = run(createEditorState(base), { type: "restoreDraft", draft });
  assert.equal(isDirty(main), false);
});

test("탭 줄 항목은 그 에디터에 있는 탭만 (동료 에디터가 주인공 탭을 찾다가 멈추던 문제)", () => {
  const companion = createCompanionEditorState({ character: null }, save().palette);
  assert.deepEqual(
    editorTabItems(companion).map((t) => t.id),
    ["companion"],
  );
  assert.deepEqual(
    editorTabItems(createEditorState(save())).map((t) => t.id),
    ["hero", "basic", "highJump", "oneTime", "moving"],
  );
});

test("임시 저장: 예전 형식([기본, 착지])도 읽어서 [기본, 없음, 착지]로", () => {
  const a = { kind: "pixel", width: 16, height: 18, pixels: new Array(288).fill("") };
  const b = { ...a, pixels: new Array(288).fill("#ff0000") };
  const old = { savedAt: 1, active: "hero", frame: 1, docs: { hero: { frames: [a, b] } } };
  const d = parseDraft(old)!;
  assert.deepEqual(d.docs.hero!.frames.map((f) => f !== null), [true, false, true]);
  assert.equal(d.frame, 2, "예전 1번(착지)은 2번");
  const restored = run(createEditorState(save()), { type: "restoreDraft", draft: d });
  assert.equal(restored.frame, 2);
  assert.equal((currentSprite(restored) as PixelSprite).pixels[0], "#ff0000");
});

test("기본 캐릭터를 불러오면 세 모습이 그대로 (주인공·동료 둘 다)", () => {
  const nabi = CHARACTER_PRESETS[2].character;
  const hero = run(createEditorState(save()), { type: "loadCharacter", character: nabi });
  assert.deepEqual(applyToSave(hero, save()).hero, nabi);
  const comp = run(createCompanionEditorState({ character: null }, save().palette), { type: "loadCharacter", character: nabi });
  assert.deepEqual(applyCompanionToSave(comp, save(), 1).companionSlots[0].character, nabi);
  const plat = run(createEditorState(save()), { type: "setTab", tab: "basic" }, { type: "loadCharacter", character: nabi });
  assert.equal(plat.tabs.basic!.history.past.length, 0, "발판 탭에는 안 들어감");
});

test("기본 모습에 이미지를 넣으면 예전 내려갈 때·착지 모습은 빠진다 (되돌리기 가능), 다른 모습에 넣으면 그대로", () => {
  const img = { kind: "image" as const, mime: "image/png" as const, data: "AAAA", width: 320 as const, height: 360 as const };
  let s = run(createEditorState(save()), { type: "addPose", pose: "fall", copyBase: true }, { type: "addPose", pose: "land", copyBase: true });
  assert.deepEqual(s.tabs.hero!.history.present.frames.map((f) => f !== null), [true, true, true]);
  const onLand = run(s, { type: "setFrame", frame: 2 }, { type: "setFrameSprite", sprite: img });
  assert.deepEqual(onLand.tabs.hero!.history.present.frames.map((f) => f?.kind ?? null), ["pixel", "pixel", "image"]);
  s = run(s, { type: "setFrame", frame: 0 }, { type: "setFrameSprite", sprite: img });
  assert.deepEqual(s.tabs.hero!.history.present.frames.map((f) => f?.kind ?? null), ["image", null, null]);
  s = run(s, { type: "undo" });
  assert.deepEqual(s.tabs.hero!.history.present.frames.map((f) => f !== null), [true, true, true]);
});
