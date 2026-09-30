import { test } from "node:test";
import assert from "node:assert/strict";
import { getPixel } from "../src/editor/grid";
import {
  applyToSave,
  checkCommit,
  createEditorState,
  currentSprite,
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
  assert.equal(s.tabs.hero.history.future.length, 0);
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
  const before = s.tabs.hero.history.past.length;
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
  assert.equal(s.tabs.hero.history.past.length, before + 1);
});

test("착지 프레임: 복사해서 추가, 삭제는 되돌리기 가능", () => {
  let s = run(createEditorState(save()), { type: "addLanding", copyBase: true });
  assert.equal(s.frame, 1);
  assert.deepEqual(currentSprite(s), s.tabs.hero.history.present.frames[0]);
  s = run(s, { type: "removeLanding" });
  assert.equal(s.tabs.hero.history.present.frames.length, 1);
  assert.equal(s.frame, 0);
  s = run(s, { type: "undo" });
  assert.equal(s.tabs.hero.history.present.frames.length, 2);
  s = run(s, { type: "setFrame", frame: 1 }, { type: "undo" });
  assert.equal(s.frame, 0, "착지 프레임이 사라지면 기본 프레임으로");
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
    { type: "addLanding", copyBase: true },
    { type: "resizeGrid", width: 32, height: 36 },
  );
  for (const f of s.tabs.hero.history.present.frames) assert.equal((f as PixelSprite).width, 32);
});

test("완료 검사: 빈 그림이 있으면 어느 탭인지 알려준다", () => {
  let s = run(createEditorState(save()), { type: "setTab", tab: "oneTime" }, { type: "clear" });
  const r = checkCommit(s);
  assert.ok(!r.ok && r.tab === "oneTime" && r.message.includes("일회용 발판"));
  s = run(s, { type: "undo" }, { type: "setTab", tab: "hero" }, { type: "addLanding", copyBase: false });
  const r2 = checkCommit(s);
  assert.ok(!r2.ok && r2.frame === 1 && r2.message.includes("착지"));
});

test("완료: 저장 데이터에 반영, 다른 값은 유지", () => {
  const base = save();
  base.best.solo = 77;
  const s = run(createEditorState(base), { type: "setTab", tab: "basic" }, { type: "flip" });
  const next = applyToSave(s, base);
  assert.equal(next.best.solo, 77);
  assert.notDeepEqual(next.platforms.basic.pixels, base.platforms.basic.pixels);
  assert.equal(next.hero.frames[0], base.hero.frames[0]);
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
    run(restored, { type: "undo" }).tabs.hero.history.present,
    restored.tabs.hero.baseline,
    "복구도 되돌릴 수 있음",
  );
  const broken = { ...draft, docs: { hero: { frames: [{ kind: "pixel", width: 3, height: 3, pixels: [] }] } } };
  assert.equal(parseDraft(broken), null);
});

test("이미지 넣기: 지금 프레임에, 되돌리기 가능 / 빈 칸 착지는 이미지가 아니라 빈 도트", () => {
  const img = { kind: "image" as const, mime: "image/png" as const, data: "AAAA", width: 320 as const, height: 360 as const };
  let s = run(createEditorState(save()), { type: "setFrameSprite", sprite: img });
  assert.equal(currentSprite(s).kind, "image");
  s = run(s, { type: "addLanding", copyBase: false });
  const landing = currentSprite(s) as PixelSprite;
  assert.equal(landing.kind, "pixel");
  assert.equal(landing.width, 16);
  s = run(s, { type: "undo" }, { type: "undo" });
  assert.equal(currentSprite(s).kind, "pixel");
  const onPlatform = run(createEditorState(save()), { type: "setTab", tab: "basic" }, { type: "setFrameSprite", sprite: img });
  assert.equal(currentSprite(onPlatform).kind, "pixel", "발판에는 이미지를 넣지 않음");
});
