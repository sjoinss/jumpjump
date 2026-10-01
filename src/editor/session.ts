import { CONFIG } from "../game/config";
import type { Character, CompanionSlot, PixelSprite, Platforms, SaveData, Sprite } from "../lib/schema";
import { validateCharacter, validatePixelSprite } from "../lib/validate";
import {
  blankSprite,
  flipHorizontal,
  floodFill,
  getPixel,
  isEmptySprite,
  lineCells,
  paintCells,
  resizeSprite,
  shift,
  withMirror,
} from "./grid";
import { createHistory, pushHistory, redo, replacePresent, undo, type History } from "./history";

/**
 * 에디터 상태 (React와 무관한 순수 reducer).
 * 탭마다 작업본과 되돌리기 기록을 따로 가진다. "완료"를 누르기 전까지 저장 데이터는 바뀌지 않고,
 * 작업본은 임시 저장(draft)으로만 남는다.
 *
 * 두 가지 모드가 같은 reducer를 쓴다 (기획서 7-7 "같은 에디터 컴포넌트 재사용"):
 * - main: 캐릭터(주인공) + 발판 3종 탭
 * - companion: 동료 한 명(companion 탭 하나)과 이름
 */

export type TabKey = "hero" | "companion" | "basic" | "highJump" | "oneTime";
/** 주인공·발판 편집 화면의 탭 순서 */
export const TAB_KEYS: TabKey[] = ["hero", "basic", "highJump", "oneTime"];
const ALL_KEYS: TabKey[] = ["hero", "companion", "basic", "highJump", "oneTime"];
export const TAB_LABEL: Record<TabKey, string> = {
  hero: "캐릭터",
  companion: "동료",
  basic: "기본 발판",
  highJump: "고점프 발판",
  oneTime: "일회용 발판",
};

/** 캐릭터(1~2장, 도트·이미지)를 그리는 탭인지. 발판 탭은 도트 1장 */
export function isCharacterTab(k: TabKey) {
  return k === "hero" || k === "companion";
}

/** 탭 하나의 그림. 캐릭터는 1~2장(두 번째가 착지), 발판은 도트 1장 */
export type Doc = { frames: Sprite[] };

export type TabState = { history: History<Doc>; baseline: Doc };

export type Tool = "pen" | "eraser" | "fill" | "eyedropper" | "move";

type Stroke = { base: Doc; origin: [number, number]; last: [number, number]; pushed: boolean };

export type EditorState = {
  /** 이 에디터에 있는 탭 (main: 주인공·발판 4개, companion: 동료 1개) */
  keys: TabKey[];
  tabs: Partial<Record<TabKey, TabState>>;
  active: TabKey;
  /** 동료 이름 (companion 모드만). 저장된 이름과 다르면 바뀐 것으로 본다 */
  name: string;
  savedName: string;
  /** 0 = 기본, 1 = 착지 */
  frame: number;
  tool: Tool;
  color: string;
  symmetry: boolean;
  grid: boolean;
  onion: boolean;
  onionOpacity: number;
  /** 동료 그리기의 주인공 가이드 (주인공 모습을 반투명하게 깔기) */
  guide: boolean;
  stroke: Stroke | null;
};

export type PointerPhase = "start" | "move" | "end" | "cancel";

export type EditorAction =
  | { type: "setTab"; tab: TabKey }
  | { type: "setFrame"; frame: number }
  | { type: "setTool"; tool: Tool }
  | { type: "setColor"; color: string }
  | { type: "toggle"; key: "symmetry" | "grid" | "onion" | "guide" }
  | { type: "setName"; name: string }
  | { type: "setOnionOpacity"; value: number }
  | { type: "pointer"; phase: PointerPhase; x: number; y: number }
  | { type: "flip" }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "addLanding"; copyBase: boolean }
  | { type: "removeLanding" }
  | { type: "resizeGrid"; width: number; height: number }
  | { type: "loadSprite"; sprite: PixelSprite }
  /** 이미지 불러오기 결과를 지금 프레임에 넣는다 (캐릭터 탭만) */
  | { type: "setFrameSprite"; sprite: Sprite }
  | { type: "restoreDraft"; draft: EditorDraft }
  | { type: "markSaved" };

/** 이미지 프레임을 도트로 바꿀 때 쓰는 격자 */
const DEFAULT_GRID = CONFIG.character.gridSizes[0];

function tab(doc: Doc): TabState {
  return { history: createHistory(doc), baseline: doc };
}

function baseState(palette: string[]) {
  return {
    frame: 0,
    tool: "pen" as Tool,
    color: palette[0] ?? "#3d2c5e",
    symmetry: false,
    grid: true,
    onion: true,
    onionOpacity: 0.35,
    guide: true,
    stroke: null,
    name: "",
    savedName: "",
  };
}

/** 주인공·발판 편집 */
export function createEditorState(save: Pick<SaveData, "hero" | "platforms" | "palette">): EditorState {
  return {
    ...baseState(save.palette),
    keys: TAB_KEYS,
    tabs: {
      hero: tab({ frames: [...save.hero.frames] }),
      basic: tab({ frames: [save.platforms.basic] }),
      highJump: tab({ frames: [save.platforms.highJump] }),
      oneTime: tab({ frames: [save.platforms.oneTime] }),
    },
    active: "hero",
  };
}

/** 동료 한 명 편집. 그림이 없는 슬롯은 빈 16×18에서 시작한다 */
export function createCompanionEditorState(slot: CompanionSlot, palette: string[]): EditorState {
  const frames: Sprite[] = slot.character
    ? [...slot.character.frames]
    : [blankSprite(DEFAULT_GRID.width, DEFAULT_GRID.height)];
  const name = slot.name ?? "";
  return {
    ...baseState(palette),
    keys: ["companion"],
    tabs: { companion: tab({ frames }) },
    active: "companion",
    name,
    savedName: name,
  };
}

/** 이 에디터에 있는 탭의 상태 (없는 탭을 찾으면 프로그래밍 오류) */
export function tabState(s: EditorState, k: TabKey = s.active): TabState {
  const t = s.tabs[k];
  if (!t) throw new Error(`에디터에 ${k} 탭이 없습니다`);
  return t;
}

// ── 조회 ──

export function currentDoc(s: EditorState): Doc {
  return tabState(s).history.present;
}

export function currentSprite(s: EditorState): Sprite {
  const doc = currentDoc(s);
  return doc.frames[Math.min(s.frame, doc.frames.length - 1)];
}

/** 그림이 바뀌었는지. 탭을 정하지 않으면 모든 탭 + 동료 이름까지 */
export function isDirty(s: EditorState, key?: TabKey): boolean {
  if (key) {
    const t = tabState(s, key);
    return t.history.present !== t.baseline;
  }
  return s.keys.some((k) => isDirty(s, k)) || nameChanged(s);
}

function nameChanged(s: EditorState) {
  return s.name.trim() !== s.savedName.trim();
}

/** 탭 줄에 보여줄 항목: 이 에디터에 있는 탭만 (동료 모드는 동료 탭 하나) */
export function editorTabItems(s: EditorState) {
  return s.keys.map((k) => ({ id: k, label: TAB_LABEL[k].replace(" 발판", ""), marked: isDirty(s, k) }));
}

export function canUndo(s: EditorState) {
  return tabState(s).history.past.length > 0;
}

export function canRedo(s: EditorState) {
  return tabState(s).history.future.length > 0;
}

// ── 수정 도우미 ──

function withFrame(doc: Doc, frame: number, sprite: Sprite): Doc {
  if (doc.frames[frame] === sprite) return doc;
  const frames = doc.frames.slice();
  frames[frame] = sprite;
  return { frames };
}

function setTabHistory(s: EditorState, history: History<Doc>): EditorState {
  const t = tabState(s);
  if (t.history === history) return s;
  return { ...s, tabs: { ...s.tabs, [s.active]: { ...t, history } } };
}

/** 기록 한 칸을 남기며 바꾼다 */
function commit(s: EditorState, next: Doc): EditorState {
  return setTabHistory(s, pushHistory(tabState(s).history, next));
}

/** 붓질 도중: 첫 변경만 기록을 남기고 이후는 같은 칸을 고친다 */
function strokeApply(s: EditorState, next: Doc): EditorState {
  if (!s.stroke) return commit(s, next);
  const h = tabState(s).history;
  if (next === h.present) return s;
  const history = s.stroke.pushed ? replacePresent(h, next) : pushHistory(h, next);
  return { ...setTabHistory(s, history), stroke: { ...s.stroke, pushed: true } };
}

function pixelFrame(s: EditorState): PixelSprite | null {
  const sprite = currentSprite(s);
  return sprite.kind === "pixel" ? sprite : null;
}

function paintAt(s: EditorState, cells: [number, number][]): EditorState {
  const sprite = pixelFrame(s);
  if (!sprite) return s;
  const target = s.symmetry ? withMirror(sprite, cells) : cells;
  const color = s.tool === "eraser" ? "" : s.color;
  return strokeApply(s, withFrame(currentDoc(s), s.frame, paintCells(sprite, target, color)));
}

function onPointer(s: EditorState, phase: PointerPhase, x: number, y: number): EditorState {
  const sprite = pixelFrame(s);
  if (!sprite) return s;

  if (phase === "cancel") {
    // 두 손가락(핀치) 등으로 붓질이 취소되면 붓질 전으로 되돌린다
    if (!s.stroke) return s;
    let h = tabState(s).history;
    if (s.stroke.pushed) {
      h = undo(h);
      h = { ...h, future: h.future.slice(1) };
    }
    return { ...setTabHistory(s, h), stroke: null };
  }
  if (phase === "end") return s.stroke ? { ...s, stroke: null } : s;

  switch (s.tool) {
    case "pen":
    case "eraser": {
      if (phase === "start") {
        const next = { ...s, stroke: { base: currentDoc(s), origin: [x, y], last: [x, y], pushed: false } as Stroke };
        return paintAt(next, [[x, y]]);
      }
      if (!s.stroke) return s;
      const [lx, ly] = s.stroke.last;
      const painted = paintAt(s, lineCells(lx, ly, x, y));
      return { ...painted, stroke: { ...painted.stroke!, last: [x, y] } };
    }
    case "fill":
      if (phase !== "start") return s;
      return commit(s, withFrame(currentDoc(s), s.frame, floodFill(sprite, x, y, s.color)));
    case "eyedropper": {
      if (phase !== "start") return s;
      const picked = getPixel(sprite, x, y);
      // 빈 칸을 찍으면 지우개로
      return picked ? { ...s, color: picked, tool: "pen" } : { ...s, tool: "eraser" };
    }
    case "move": {
      if (phase === "start") {
        return { ...s, stroke: { base: currentDoc(s), origin: [x, y], last: [x, y], pushed: false } };
      }
      if (!s.stroke) return s;
      const baseSprite = s.stroke.base.frames[s.frame];
      if (baseSprite.kind !== "pixel") return s;
      const moved = shift(baseSprite, x - s.stroke.origin[0], y - s.stroke.origin[1]);
      return strokeApply(s, withFrame(s.stroke.base, s.frame, moved));
    }
  }
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case "setTab":
      return a.tab === s.active || !s.tabs[a.tab] ? s : { ...s, active: a.tab, frame: 0, stroke: null };
    case "setFrame": {
      const count = currentDoc(s).frames.length;
      return { ...s, frame: Math.max(0, Math.min(count - 1, a.frame)), stroke: null };
    }
    case "setTool":
      return { ...s, tool: a.tool };
    case "setColor":
      return { ...s, color: a.color, tool: s.tool === "eraser" || s.tool === "eyedropper" ? "pen" : s.tool };
    case "toggle":
      return { ...s, [a.key]: !s[a.key] };
    case "setName":
      return { ...s, name: a.name.slice(0, CONFIG.limits.companionNameMax) };
    case "setOnionOpacity":
      return { ...s, onionOpacity: Math.max(0.1, Math.min(0.8, a.value)) };
    case "pointer":
      return onPointer(s, a.phase, a.x, a.y);
    case "flip": {
      const sprite = pixelFrame(s);
      return sprite ? commit(s, withFrame(currentDoc(s), s.frame, flipHorizontal(sprite))) : s;
    }
    case "clear": {
      const sprite = currentSprite(s);
      const { width, height } = sprite.kind === "pixel" ? sprite : DEFAULT_GRID;
      return commit(s, withFrame(currentDoc(s), s.frame, blankSprite(width, height)));
    }
    case "undo":
      return { ...setTabHistory(s, undo(tabState(s).history)), stroke: null, frame: clampFrame(s, undo) };
    case "redo":
      return { ...setTabHistory(s, redo(tabState(s).history)), stroke: null, frame: clampFrame(s, redo) };
    case "addLanding": {
      if (!isCharacterTab(s.active)) return s;
      const doc = currentDoc(s);
      if (doc.frames.length >= 2) return { ...s, frame: 1 };
      const base = doc.frames[0];
      const empty = base.kind === "pixel" ? blankSprite(base.width, base.height) : blankSprite(DEFAULT_GRID.width, DEFAULT_GRID.height);
      const landing = a.copyBase ? base : empty;
      return { ...commit(s, { frames: [base, landing] }), frame: 1 };
    }
    case "removeLanding": {
      const doc = currentDoc(s);
      if (!isCharacterTab(s.active) || doc.frames.length < 2) return s;
      return { ...commit(s, { frames: [doc.frames[0]] }), frame: 0 };
    }
    case "resizeGrid": {
      if (!isCharacterTab(s.active)) return s;
      const doc = currentDoc(s);
      const frames = doc.frames.map((f) => (f.kind === "pixel" ? resizeSprite(f, a.width, a.height) : f));
      return commit(s, { frames });
    }
    case "loadSprite": {
      // 캐릭터 탭은 기본 그림을 바꾸고 착지 프레임은 뺀다 (다른 캐릭터의 착지 그림이 남지 않게)
      if (isCharacterTab(s.active)) return { ...commit(s, { frames: [a.sprite] }), frame: 0 };
      return commit(s, { frames: [a.sprite] });
    }
    case "setFrameSprite": {
      if (!isCharacterTab(s.active)) return s;
      return commit(s, withFrame(currentDoc(s), s.frame, a.sprite));
    }
    case "restoreDraft": {
      const tabs = { ...s.tabs };
      for (const k of s.keys) {
        const doc = a.draft.docs[k];
        const t = tabs[k];
        if (doc && t) tabs[k] = { ...t, history: pushHistory(t.history, doc) };
      }
      const next = { ...s, tabs, active: tabs[a.draft.active] ? a.draft.active : s.active };
      const frames = currentDoc(next).frames.length;
      // 이름은 동료 모드에만 있다
      const name = s.tabs.companion ? (a.draft.name ?? s.name) : s.name;
      return { ...next, name, frame: Math.min(a.draft.frame, frames - 1), stroke: null };
    }
    case "markSaved": {
      const tabs = { ...s.tabs };
      for (const k of s.keys) {
        const t = tabState(s, k);
        tabs[k] = { ...t, baseline: t.history.present };
      }
      return { ...s, tabs, savedName: s.name };
    }
  }
}

/** 되돌리기로 착지 프레임이 사라질 수 있어서 프레임 번호를 맞춘다 */
function clampFrame(s: EditorState, op: (h: History<Doc>) => History<Doc>) {
  const count = op(tabState(s).history).present.frames.length;
  return Math.min(s.frame, count - 1);
}

// ── 완료(저장) ──

export type CommitCheck = { ok: true } | { ok: false; tab: TabKey; frame: number; message: string };

/** 비어 있는 그림이 있으면 어느 탭·프레임인지와 이유를 돌려준다 */
export function checkCommit(s: EditorState): CommitCheck {
  for (const k of s.keys) {
    const frames = tabState(s, k).history.present.frames;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.kind === "pixel" && isEmptySprite(f)) {
        const what = isCharacterTab(k) ? `${TAB_LABEL[k]} ${i === 0 ? "기본" : "착지"} 그림` : `${TAB_LABEL[k]} 그림`;
        const hint = isCharacterTab(k) && i === 1 ? " 그리거나 착지 프레임을 삭제해주세요." : " 한 칸 이상 그려주세요.";
        return { ok: false, tab: k, frame: i, message: `${what}이 비어 있어요.${hint}` };
      }
    }
  }
  return { ok: true };
}

/** 동료 슬롯에 저장할 값 (companion 모드). slot은 1~5. 이름이 비어 있으면 이름 없음 */
export function applyCompanionToSave(s: EditorState, save: SaveData, slot: number): SaveData {
  const frames = tabState(s, "companion").history.present.frames as Character["frames"];
  const name = s.name.trim();
  const next: CompanionSlot = name ? { character: { frames }, name } : { character: { frames } };
  return { ...save, companionSlots: save.companionSlots.map((c, i) => (i === slot - 1 ? next : c)) };
}

/** 저장 데이터에 반영할 값 (main 모드) */
export function applyToSave(s: EditorState, save: SaveData): SaveData {
  const hero = tabState(s, "hero").history.present.frames as Character["frames"];
  const plat = (k: keyof Platforms) => tabState(s, k).history.present.frames[0] as PixelSprite;
  return {
    ...save,
    hero: { frames: hero },
    platforms: { basic: plat("basic"), highJump: plat("highJump"), oneTime: plat("oneTime") },
  };
}

// ── 임시 저장 (크래시 복구) ──

export const DRAFT_KEY = "editor.draft";

/** 동료 슬롯별 임시 저장 키. 그리다 그만둔 그림은 여기 초안으로 남는다 (기획서 7-4) */
export function companionDraftKey(slot: number) {
  return `editor.draft.companion.${slot}`;
}

export type EditorDraft = {
  savedAt: number;
  active: TabKey;
  frame: number;
  /** 바뀐 탭만 담는다 */
  docs: Partial<Record<TabKey, Doc>>;
  /** 동료 이름 (companion 모드에서 바뀌었을 때만) */
  name?: string;
};

export function toDraft(s: EditorState): EditorDraft | null {
  const docs: Partial<Record<TabKey, Doc>> = {};
  for (const k of s.keys) if (isDirty(s, k)) docs[k] = tabState(s, k).history.present;
  const named = nameChanged(s);
  if (Object.keys(docs).length === 0 && !named) return null;
  const draft: EditorDraft = { savedAt: Date.now(), active: s.active, frame: s.frame, docs };
  if (named) draft.name = s.name;
  return draft;
}

/** 저장소에서 읽은 임시 저장본을 검증한다. 하나라도 이상하면 전체를 버린다 */
export function parseDraft(raw: unknown): EditorDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!ALL_KEYS.includes(r.active as TabKey) || typeof r.savedAt !== "number") return null;
  if (typeof r.docs !== "object" || r.docs === null) return null;
  const docs: Partial<Record<TabKey, Doc>> = {};
  for (const k of ALL_KEYS) {
    const d = (r.docs as Record<string, unknown>)[k];
    if (d === undefined) continue;
    if (isCharacterTab(k)) {
      const c = validateCharacter(d, "임시 저장 캐릭터");
      if (!c.ok) return null;
      docs[k] = { frames: [...c.value.frames] };
    } else {
      const frames = (d as { frames?: unknown[] })?.frames;
      const p = validatePixelSprite(Array.isArray(frames) ? frames[0] : null, "platform", "임시 저장 발판");
      if (!p.ok) return null;
      docs[k] = { frames: [p.value] };
    }
  }
  if (r.name !== undefined && typeof r.name !== "string") return null;
  const name = typeof r.name === "string" ? r.name.slice(0, CONFIG.limits.companionNameMax) : undefined;
  if (Object.keys(docs).length === 0 && name === undefined) return null;
  const frame = typeof r.frame === "number" && Number.isInteger(r.frame) && r.frame >= 0 ? r.frame : 0;
  const draft: EditorDraft = { savedAt: r.savedAt, active: r.active as TabKey, frame, docs };
  if (name !== undefined) draft.name = name;
  return draft;
}
