"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { PixelPreview } from "@/components/PixelPreview";
import { SpritePreview } from "@/components/SpritePreview";
import { requestPersistentStorage } from "@/components/PwaProvider";
import { useKeyValueStore, useSaveData } from "@/components/SaveProvider";
import { ScreenLayout } from "@/components/screens/ScreenLayout";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { CONFIG } from "@/game/config";
import { CHARACTER_PRESETS } from "@/game/presets";
import { resolvePlatforms, THEME_PLATFORMS } from "@/game/themePlatforms";
import type { ThemeId } from "@/game/themes";
import { POSE_INFO } from "@/lib/character";
import { POSES, SAVED_CHARACTER_MAX, SAVED_PLATFORM_MAX, type Character, type PixelSprite, type Sprite } from "@/lib/schema";
import { DotCanvas, type Underlay } from "./DotCanvas";
import { ImageImportScreen } from "./ImageImportScreen";
import { LibrarySection } from "./LibrarySection";
import { PngSaveSection } from "./PngSaveSection";
import { isLossyDownscale } from "./grid";
import { Palette } from "./Palette";
import {
  applyCompanionToSave,
  applyToSave,
  canRedo,
  canUndo,
  checkCommit,
  companionDraftKey,
  createCompanionEditorState,
  createEditorState,
  currentCharacter,
  currentDoc,
  currentPlatforms,
  currentSprite,
  DRAFT_KEY,
  editedPresetBase,
  presetPoseOwner,
  editorReducer,
  editorTabItems,
  isCharacterTab,
  isDirty,
  poseAt,
  parseDraft,
  TAB_LABEL,
  toDraft,
  type EditorDraft,
  type TabKey,
  type Tool,
} from "./session";
import { TOOLS } from "./Toolbar";
import { Toolbar } from "./Toolbar";
import styles from "./EditorScreen.module.css";

type DialogKind = null | "canvas" | "addFall" | "addLand" | "leave" | "backup" | "presetDraw";

const DRAFT_DEBOUNCE_MS = 500;

/** 주인공 가이드 진하기 (기본 그림 깔기보다 옅게) */
const GUIDE_OPACITY = 0.22;

/** 동료 한 명을 그릴 때 (설정의 슬롯 관리 / 게임 중 후보 선택창) */
export type CompanionTarget = {
  /** 1~5 */
  slot: number;
  /** 게임 중에 열었는지. 게임 중엔 그만두면 초안을 남기고 후보로 돌아간다 */
  inGame: boolean;
  /** 완료(저장)한 뒤 */
  onSaved: () => void;
};

type Props = {
  /** 그만두기·뒤로 (저장하지 않음) */
  onClose: () => void;
  /** 있으면 동료 한 명만 그리는 모드 */
  companion?: CompanionTarget;
  /** 주인공·발판 모드에서 처음 열 탭 (설정의 "발판 만들기") */
  initialTab?: TabKey;
};

/**
 * 도트 에디터. 탭(캐릭터 / 발판 4종)마다 따로 그리고 "완료"를 누르면 한꺼번에 게임에 적용한다.
 * 그리는 동안에는 임시 저장(editor.draft)만 계속 갱신해서, 앱이 닫혀도 다음에 이어서 그릴 수 있다.
 * companion을 주면 같은 화면이 동료 한 명 그리기(이름 · 주인공 가이드)로 바뀐다.
 */
export function EditorScreen({ onClose, companion, initialTab }: Props) {
  const [data, update] = useSaveData();
  const kv = useKeyValueStore();
  const { show } = useToast();
  const [state, dispatch] = useReducer(editorReducer, data, (d) =>
    companion
      ? createCompanionEditorState(d.companionSlots[companion.slot - 1], d.palette)
      : // 기본 발판은 지금 테마의 발판으로 보여준다
        editorReducer(createEditorState({ ...d, platforms: resolvePlatforms(d.platforms, d.settings.theme) }), {
          type: "setTab",
          tab: initialTab ?? "hero",
        }),
  );
  const draftKey = companion ? companionDraftKey(companion.slot) : DRAFT_KEY;
  const inGame = companion?.inGame ?? false;
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draftPrompt, setDraftPrompt] = useState<EditorDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  /** 기본 캐릭터 모습에 넣으려는 이미지 (내려갈 때·착지를 지울지 묻는 중) */
  const [pendingImage, setPendingImage] = useState<Sprite | null>(null);
  /** 기본 캐릭터를 고쳐 그릴 때 한 번만 묻는다 (이 화면을 여는 동안) */
  const askedDraw = useRef(false);
  /** 화면을 열 때의 기본 모습. 이번에 고친 게 아니면(예전에 "남겨두기"로 저장한 그림) 묻지 않는다 */
  const baseAtOpen = useRef((state.tabs.hero ?? state.tabs.companion)?.history.present.frames[0]);
  /** 이미지 불러오기 화면. file이 있으면 끌어다 놓은 파일로 바로 시작 */
  const [importing, setImporting] = useState<{ file: File | null } | null>(null);

  const sprite = currentSprite(state);
  const doc = currentDoc(state);
  const isHero = isCharacterTab(state.active);
  const dirty = isDirty(state);

  // ── 크래시 복구: 들어올 때 임시 저장본 확인 ──
  useEffect(() => {
    let cancelled = false;
    kv.get(draftKey)
      .then((raw) => {
        if (cancelled) return;
        const draft = parseDraft(raw);
        if (draft) setDraftPrompt(draft);
        else setDraftChecked(true);
      })
      .catch(() => !cancelled && setDraftChecked(true));
    return () => {
      cancelled = true;
    };
  }, [kv, draftKey]);

  // ── 임시 저장: 바뀐 게 있으면 잠시 뒤 쓰고, 없으면 지운다 ──
  const stateRef = useRef(state);
  stateRef.current = state;
  const draftFailed = useRef(false);
  const writeDraft = useCallback(() => {
    const draft = toDraft(stateRef.current);
    (draft ? kv.set(draftKey, draft) : kv.delete(draftKey))
      .then(() => {
        draftFailed.current = false;
      })
      .catch(() => {
        if (!draftFailed.current) show("임시 저장을 하지 못했어요. 완료를 눌러 저장해주세요.", "warning");
        draftFailed.current = true;
      });
  }, [kv, show, draftKey]);

  useEffect(() => {
    if (!draftChecked) return;
    const t = setTimeout(writeDraft, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state.tabs, state.active, state.frame, state.name, draftChecked, writeDraft]);

  useEffect(() => {
    if (!draftChecked) return;
    const flush = () => writeDraft();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [draftChecked, writeDraft]);

  // ── 완료 / 나가기 ──
  const commit = useCallback((): boolean => {
    const check = checkCommit(state);
    if (!check.ok) {
      dispatch({ type: "setTab", tab: check.tab });
      dispatch({ type: "setFrame", frame: check.frame });
      show(check.message, "error");
      return false;
    }
    // 첫 저장이면 백업 안내 (게임 중엔 흐름을 끊지 않도록 다음 기회로 미룬다)
    const firstTime = !inGame && data.settings.onboarding.backupReminderAt === null;
    update((d) => {
      const next = companion ? applyCompanionToSave(state, d, companion.slot) : applyToSave(state, d);
      if (!firstTime) return next;
      return {
        ...next,
        settings: { ...next.settings, onboarding: { ...next.settings.onboarding, backupReminderAt: Date.now() } },
      };
    });
    dispatch({ type: "markSaved" });
    kv.delete(draftKey).catch(() => {});
    // 그린 그림이 생겼으니 브라우저에 데이터를 지우지 말아 달라고 요청 (기획서 16번)
    void requestPersistentStorage();
    if (!inGame) show(companion ? `동료 ${companion.slot}번 그림을 저장했어요.` : "저장했어요! 게임에 바로 적용돼요.", "success");
    if (firstTime) setDialog("backup");
    else finish();
    return true;
  }, [state, data.settings.onboarding.backupReminderAt, update, kv, show, companion, inGame, draftKey]);

  /** 저장을 마치고 나가기: 동료면 저장 뒤 흐름(게임 중엔 합류)으로 */
  function finish() {
    if (companion) companion.onSaved();
    else onClose();
  }

  // 게임 중 동료는 그림이 그대로여도 "완료" = 이 모습으로 미니게임에 도전
  const onDone = () => (dirty || inGame ? commit() : onClose());
  const onBack = () => (dirty ? setDialog("leave") : onClose());

  const discardAndLeave = () => {
    kv.delete(draftKey).catch(() => {});
    onClose();
  };

  /** 게임 중 그만두기: 그림은 초안으로 남기고 후보로 돌아간다 (기획서 7-4) */
  const keepDraftAndLeave = () => {
    writeDraft();
    onClose();
  };

  // 기본 캐릭터의 기본 모습을 고쳐 그리면(붓질이 끝난 뒤) 한 번 묻는다: 그 캐릭터의 내려갈 때·착지 그림을 지울지
  useEffect(() => {
    if (askedDraw.current || state.stroke || state.frame !== 0 || !isHero || dialog || draftPrompt) return;
    if (doc.frames[0] === baseAtOpen.current || !editedPresetBase(doc)) return;
    askedDraw.current = true;
    setDialog("presetDraw");
  }, [doc, state.stroke, state.frame, isHero, dialog, draftPrompt]);

  // ── 단축키 (대화창이 열려 있거나 입력 중이면 무시) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || draftPrompt) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (!mod && !e.altKey) {
        const tool = TOOLS.find((x) => x.key.toLowerCase() === key);
        if (tool) dispatch({ type: "setTool", tool: tool.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, draftPrompt]);

  // 밑그림: 주인공 가이드(동료만) → 내 기본 그림(내려갈 때·착지 모습 작업 때)
  const heroGuide = data.hero.base;
  const onionBase = isHero && state.frame > 0 && state.onion ? doc.frames[0] : null;
  const underlays = useMemo(() => {
    const list: Underlay[] = [];
    if (companion && state.guide) list.push({ sprite: heroGuide, opacity: GUIDE_OPACITY });
    if (onionBase) list.push({ sprite: onionBase, opacity: state.onionOpacity });
    return list;
  }, [companion, state.guide, heroGuide, onionBase, state.onionOpacity]);
  // ── 보관함: 캐릭터 탭이면 캐릭터 5개, 발판 탭이면 발판 세트(4종) 3개 ──
  const keep = () => void requestPersistentStorage();
  const library = isHero ? (
    <LibrarySection
      what="캐릭터"
      max={SAVED_CHARACTER_MAX}
      saveLabel="지금 그림 보관"
      items={data.savedCharacters.map((c) => ({ name: c.name, preview: <SpritePreview sprite={c.character.base} width={32} height={36} /> }))}
      cantSave={currentCharacter(state) ? null : "빈 그림이 있어서 보관할 수 없어요. 한 칸 이상 그리거나 빈 모습을 삭제해주세요."}
      onLoad={(i) => {
        const item = data.savedCharacters[i];
        dispatch({ type: "loadCharacter", character: structuredClone(item.character) });
        setDialog(null);
        show(`「${item.name}」을(를) 불러왔어요. 되돌리기로 돌아갈 수 있어요.`, "info");
      }}
      onDelete={(i) => update((d) => ({ ...d, savedCharacters: d.savedCharacters.filter((_, j) => j !== i) }))}
      onSave={(name) => {
        const character = currentCharacter(state);
        if (!character) return;
        update((d) => ({ ...d, savedCharacters: [...d.savedCharacters, { name, character: structuredClone(character) }].slice(0, SAVED_CHARACTER_MAX) }));
        keep();
        show(`「${name}」을(를) 보관했어요.`, "success");
      }}
    />
  ) : (
    <LibrarySection
      what="발판 세트"
      max={SAVED_PLATFORM_MAX}
      saveLabel="발판 4종 보관"
      items={data.savedPlatforms.map((p) => {
        const shown = resolvePlatforms(p.platforms, data.settings.theme);
        return {
          name: p.name,
          preview: (
            <>
              <PixelPreview sprite={shown.basic} width={32} height={8} />
              <PixelPreview sprite={shown.highJump} width={32} height={8} />
              <PixelPreview sprite={shown.oneTime} width={32} height={8} />
              <PixelPreview sprite={shown.moving} width={32} height={8} />
            </>
          ),
        };
      })}
      cantSave={currentPlatforms(state) ? null : "빈 발판이 있어서 보관할 수 없어요. 발판 4종을 모두 그려주세요."}
      onLoad={(i) => {
        const item = data.savedPlatforms[i];
        dispatch({ type: "loadPlatforms", platforms: structuredClone(resolvePlatforms(item.platforms, data.settings.theme)) });
        setDialog(null);
        show(`「${item.name}」 발판 4종을 불러왔어요. 완료를 누르면 게임에 적용돼요.`, "info");
      }}
      onDelete={(i) => update((d) => ({ ...d, savedPlatforms: d.savedPlatforms.filter((_, j) => j !== i) }))}
      onSave={(name) => {
        const platforms = currentPlatforms(state);
        if (!platforms) return;
        update((d) => ({ ...d, savedPlatforms: [...d.savedPlatforms, { name, platforms: structuredClone(platforms) }].slice(0, SAVED_PLATFORM_MAX) }));
        keep();
        show(`「${name}」 발판 세트를 보관했어요.`, "success");
      }}
    />
  );
  // 지금 보고 있는 도트 그림을 배경 투명 PNG로 (이미지 그림은 안내만)
  const pngSave = (
    <PngSaveSection
      sprite={sprite.kind === "pixel" ? sprite : null}
      platform={!isHero}
      label={isHero ? `${companion ? "동료" : "캐릭터"} ${POSE_INFO[poseAt(state.frame)].name} 모습` : TAB_LABEL[state.active]}
      fileBase={
        isHero
          ? `jumpjump-${companion ? `companion${companion.slot}` : "character"}-${poseAt(state.frame)}`
          : `jumpjump-platform-${state.active}`
      }
    />
  );
  const tabItems = editorTabItems(state);
  const title = companion ? `동료 ${companion.slot} 그리기` : "그리기";
  const pose = poseAt(state.frame);
  const frameName = isHero ? ` ${POSE_INFO[pose].name} 그림` : "";

  return (
    <>
    <div className={styles.root} inert={importing !== null}>
    <ScreenLayout
      title={title}
      onBack={onBack}
      backLabel={inGame ? "그만 그리기" : "뒤로"}
      fill
      headerAction={
        <Button variant="primary" icon="check" onClick={onDone}>
          완료
        </Button>
      }
    >
      {!companion && (
        <Tabs
          items={tabItems}
          value={state.active}
          onChange={(tab: TabKey) => dispatch({ type: "setTab", tab })}
          label="그릴 대상"
          idPrefix="editor-tab"
          panelId="editor-panel"
        />
      )}

      <section
        id="editor-panel"
        role={companion ? undefined : "tabpanel"}
        aria-labelledby={companion ? undefined : `editor-tab-${state.active}`}
        aria-label={companion ? title : undefined}
        className={styles.panel}
        onDragOver={(e) => isHero && e.preventDefault()}
        onDrop={(e) => {
          // PC: 캐릭터 탭에 이미지 파일을 끌어다 놓으면 바로 불러오기
          if (!isHero) return;
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) setImporting({ file });
        }}
      >
        <div className={styles.frameBar}>
          {isHero ? (
            <div className={styles.frames} role="group" aria-label="모습">
              {/* 기본은 늘 있고, 내려갈 때·착지는 그린 것만 칩, 아직 없으면 "+ 추가" (어디까지 그릴지 고른다) */}
              {POSES.map((p, i) =>
                doc.frames[i] ? (
                  <button
                    key={p}
                    type="button"
                    className={styles.chip}
                    aria-pressed={state.frame === i}
                    onClick={() => dispatch({ type: "setFrame", frame: i })}
                  >
                    {POSE_INFO[p].name}
                  </button>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={styles.chipGhost}
                    onClick={() => setDialog(p === "fall" ? "addFall" : "addLand")}
                    aria-label={`${POSE_INFO[p].name} 모습 추가`}
                  >
                    <PixelIcon name="plus" size={12} />
                    {POSE_INFO[p].name}
                  </button>
                ),
              )}
            </div>
          ) : (
            <p className={styles.sizeNote}>발판 · 32×8칸</p>
          )}
          <button type="button" className={styles.chipGhost} onClick={() => setDialog("canvas")}>
            <PixelIcon name="grid" size={12} />
            {isHero ? "불러오기 · 저장" : "기본 발판 · 저장"}
          </button>
        </div>

        {isHero && (
          <div className={styles.poseHint}>
            <p>
              <strong>{POSE_INFO[pose].name}</strong> · {POSE_INFO[pose].when}
              {pose !== "base" && " 안 그리면 기본 그림이 나와요."}
            </p>
            {pose !== "base" && (
              <button type="button" className={styles.chipGhost} onClick={() => dispatch({ type: "removePose" })}>
                <PixelIcon name="trash" size={12} />
                {POSE_INFO[pose].name} 삭제
              </button>
            )}
          </div>
        )}

        {companion && (
          <div className={styles.companionBar}>
            <label className={styles.nameField}>
              <span>이름</span>
              <input
                type="text"
                value={state.name}
                maxLength={CONFIG.limits.companionNameMax}
                placeholder="(선택)"
                autoComplete="off"
                onChange={(e) => dispatch({ type: "setName", name: e.target.value })}
              />
            </label>
            {/* 주인공 모습을 반투명하게 깔아 크기·위치를 맞추기 쉽게 (기획서 4-4: "내 기본 그림 깔기"와 라벨 구분) */}
            <Switch label="주인공 가이드" checked={state.guide} onChange={() => dispatch({ type: "toggle", key: "guide" })} />
          </div>
        )}

        {isHero && state.frame > 0 && (
          <div className={styles.onion}>
            <Switch
              label={companion ? "내 기본 그림 깔기" : "기본 그림 깔기"}
              checked={state.onion}
              onChange={() => dispatch({ type: "toggle", key: "onion" })}
            />
            {state.onion && (
              <label className={styles.opacity}>
                <span>진하기</span>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={Math.round(state.onionOpacity * 100)}
                  onChange={(e) => dispatch({ type: "setOnionOpacity", value: Number(e.target.value) / 100 })}
                  aria-valuetext={`${Math.round(state.onionOpacity * 100)}%`}
                />
              </label>
            )}
          </div>
        )}

        {sprite.kind === "pixel" ? (
          <DotCanvas
            sprite={sprite}
            underlays={underlays}
            showGrid={state.grid}
            symmetry={state.symmetry}
            tool={state.tool}
            label={`${companion ? `동료 ${companion.slot}` : TAB_LABEL[state.active]}${frameName} 그리기, ${sprite.width}×${sprite.height}칸`}
            onCell={(phase, x, y) => dispatch({ type: "pointer", phase, x, y })}
          />
        ) : (
          <div className={styles.imageFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 넣은 base64 이미지를 그대로 보여준다 */}
            <img src={`data:${sprite.mime};base64,${sprite.data}`} alt="불러온 이미지 그림" width={128} height={144} />
            <InlineMessage tone="info" title="이미지 그림이에요">
              이미지는 도트 도구로 고칠 수 없어요. 다른 이미지로 바꾸거나 도트로 새로 그릴 수 있어요.
            </InlineMessage>
            <div className={styles.imageActions}>
              <Button variant="secondary" icon="image" onClick={() => setImporting({ file: null })}>
                이미지 바꾸기
              </Button>
              <Button variant="ghost" icon="pencil" onClick={() => dispatch({ type: "clear" })}>
                도트로 새로 그리기
              </Button>
            </div>
          </div>
        )}
      </section>

      <Toolbar
        tool={state.tool}
        onTool={(tool: Tool) => dispatch({ type: "setTool", tool })}
        symmetry={state.symmetry}
        grid={state.grid}
        canUndo={canUndo(state)}
        canRedo={canRedo(state)}
        disabled={sprite.kind !== "pixel"}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onToggleSymmetry={() => dispatch({ type: "toggle", key: "symmetry" })}
        onToggleGrid={() => dispatch({ type: "toggle", key: "grid" })}
        onFlip={() => dispatch({ type: "flip" })}
        onClear={() => {
          dispatch({ type: "clear" });
          show("전체 지웠어요. 되돌리기로 돌아갈 수 있어요.", "info");
        }}
      />

      <Palette
        color={state.color}
        palette={data.palette}
        onColor={(color) => dispatch({ type: "setColor", color })}
        onPaletteChange={(palette) => update((d) => ({ ...d, palette }))}
      />

      {/* ── 대화창 ── */}
      <Dialog
        open={draftPrompt !== null}
        title="그리던 그림이 있어요"
        description={draftPrompt ? `${formatTime(draftPrompt.savedAt)}에 저장하지 않고 닫힌 그림이 있어요. 이어서 그릴까요?` : undefined}
        onClose={() => {
          // ESC는 그림을 잃지 않는 쪽(이어서 그리기)으로
          if (draftPrompt) dispatch({ type: "restoreDraft", draft: draftPrompt });
          setDraftPrompt(null);
          setDraftChecked(true);
        }}
        showClose={false}
        actions={
          <>
            <Button
              variant="primary"
              block
              data-autofocus
              onClick={() => {
                if (draftPrompt) dispatch({ type: "restoreDraft", draft: draftPrompt });
                setDraftPrompt(null);
                setDraftChecked(true);
              }}
            >
              이어서 그리기
            </Button>
            <Button
              variant="ghost"
              block
              onClick={() => {
                kv.delete(DRAFT_KEY).catch(() => {});
                setDraftPrompt(null);
                setDraftChecked(true);
              }}
            >
              버리고 새로 시작
            </Button>
          </>
        }
      />

      <AddPoseDialog
        pose={dialog === "addFall" ? "fall" : dialog === "addLand" ? "land" : null}
        onClose={() => setDialog(null)}
        onAdd={(p, copyBase) => {
          dispatch({ type: "addPose", pose: p, copyBase });
          setDialog(null);
        }}
      />

      <CanvasDialog
        open={dialog === "canvas"}
        tab={state.active}
        sprite={sprite.kind === "pixel" ? sprite : null}
        hero={data.hero}
        theme={data.settings.theme}
        library={library}
        pngSave={pngSave}
        onClose={() => setDialog(null)}
        onLoad={(s, name) => {
          // 발판: 기본 발판으로 되돌리기
          dispatch({ type: "loadSprite", sprite: s });
          setDialog(null);
          show(`${name}을(를) 불러왔어요. 되돌리기로 돌아갈 수 있어요.`, "info");
        }}
        onLoadCharacter={(c, name) => {
          // 기본 캐릭터·주인공 그림은 세 모습을 그대로
          dispatch({ type: "loadCharacter", character: c });
          setDialog(null);
          show(`${name}을(를) 불러왔어요. 되돌리기로 돌아갈 수 있어요.`, "info");
        }}
        onResize={(width, height) => dispatch({ type: "resizeGrid", width, height })}
        onImportImage={() => {
          setDialog(null);
          setImporting({ file: null });
        }}
      />

      <Dialog
        open={dialog === "leave" && inGame}
        title="그리기를 그만둘까요?"
        description="그리던 그림은 초안으로 남겨 둬요. 후보는 그 자리에 있어서, 다시 닿으면 이어서 그릴 수 있어요."
        onClose={() => setDialog(null)}
        initialFocusRef={stayRef}
        actions={
          <>
            <Button
              variant="primary"
              block
              icon="check"
              onClick={() => {
                setDialog(null);
                commit();
              }}
            >
              완료하고 미니게임 하기
            </Button>
            <Button variant="secondary" block onClick={keepDraftAndLeave}>
              그만 그리기
            </Button>
            <Button ref={stayRef} variant="ghost" block onClick={() => setDialog(null)}>
              계속 그리기
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "leave" && !inGame}
        title="저장하지 않은 그림이 있어요"
        description={companion ? "완료를 눌러야 동료 슬롯에 저장돼요." : "완료를 눌러야 게임에 적용돼요."}
        onClose={() => setDialog(null)}
        initialFocusRef={stayRef}
        actions={
          <>
            <Button
              variant="primary"
              block
              icon="check"
              onClick={() => {
                setDialog(null);
                commit();
              }}
            >
              저장하고 나가기
            </Button>
            <Button variant="danger" block onClick={discardAndLeave}>
              저장하지 않고 나가기
            </Button>
            <Button ref={stayRef} variant="ghost" block onClick={() => setDialog(null)}>
              계속 그리기
            </Button>
          </>
        }
      />

      <Dialog
        open={pendingImage !== null}
        title="기본 캐릭터 그림이 사라져요"
        description={`지금은 ${presetPoseOwner(doc)?.name ?? "기본 캐릭터"}의 내려갈 때·착지 그림이 들어 있어요. 내 이미지로 바꾸면서 두 그림을 지울까요? 남겨두면 게임에서 그 모습일 때 ${presetPoseOwner(doc)?.name ?? "기본 캐릭터"}가 보여요.`}
        onClose={() => {
          // 닫기 = 남겨두고 넣기 (그림을 잃지 않는 쪽)
          if (pendingImage) dispatch({ type: "setFrameSprite", sprite: pendingImage });
          setPendingImage(null);
        }}
        actions={
          <>
            <Button
              variant="primary"
              block
              data-autofocus
              onClick={() => {
                if (pendingImage) dispatch({ type: "setFrameSprite", sprite: pendingImage, dropPoses: true });
                setPendingImage(null);
                show("이미지를 넣고 내려갈 때·착지 그림은 지웠어요. 되돌리기로 돌아갈 수 있어요.", "success");
              }}
            >
              두 그림 지우고 넣기
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                if (pendingImage) dispatch({ type: "setFrameSprite", sprite: pendingImage });
                setPendingImage(null);
                show("이미지를 넣었어요. 내려갈 때·착지 그림은 그대로예요.", "success");
              }}
            >
              남겨두고 넣기
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "presetDraw"}
        title="기본 캐릭터 그림이 사라져요"
        description={`${editedPresetBase(doc)?.name ?? "기본 캐릭터"}를 고쳐 그리고 있어요. 내 캐릭터로 만들면서 ${editedPresetBase(doc)?.name ?? "기본 캐릭터"}의 내려갈 때·착지 그림을 지울까요? 남겨두면 게임에서 그 모습일 때 예전 모습이 보여요.`}
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button
              variant="primary"
              block
              data-autofocus
              onClick={() => {
                dispatch({ type: "dropPoses" });
                setDialog(null);
                show("내려갈 때·착지 그림을 지웠어요. 되돌리기로 돌아갈 수 있어요.", "info");
              }}
            >
              두 그림 지우기
            </Button>
            <Button variant="secondary" block onClick={() => setDialog(null)}>
              남겨두기
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "backup"}
        title="그림을 백업해두세요"
        description="그림은 이 브라우저에만 저장돼요. 브라우저 데이터가 지워지면 함께 사라지니, 설정의 데이터 관리에서 내보내기를 해두면 안전해요."
        onClose={finish}
        actions={
          <Button variant="primary" block data-autofocus onClick={finish}>
            알겠어요
          </Button>
        }
      />
    </ScreenLayout>
    </div>

    {importing && (
      <div className={styles.overlay}>
        <ImageImportScreen
          initialFile={importing.file}
          onCancel={() => setImporting(null)}
          onDoneCharacter={(character) => {
            dispatch({ type: "loadCharacter", character });
            setImporting(null);
            show("스킨으로 세 모습(올라갈 때·내려갈 때·착지)을 만들었어요. 바로 고칠 수 있어요.", "success");
          }}
          onDone={(sprite) => {
            setImporting(null);
            // 기본 캐릭터 → 내 이미지: 그 캐릭터의 내려갈 때·착지 그림을 지울지 먼저 묻는다
            if (state.frame === 0 && presetPoseOwner(doc)) {
              askedDraw.current = true;
              setPendingImage(sprite);
              return;
            }
            dispatch({ type: "setFrameSprite", sprite });
            show(sprite.kind === "pixel" ? "도트로 바꿨어요. 바로 고칠 수 있어요." : "이미지를 넣었어요. 완료를 누르면 게임에 적용돼요.", "success");
          }}
        />
      </div>
    )}
    </>
  );
}

const POSE_TIP = {
  fall: "떨어지는 동안 보이는 그림이에요. 팔을 위로 들거나 놀란 표정을 그려보세요!",
  land: "발판에 닿는 순간 잠깐(0.2초) 보이는 그림이에요. 눈을 감거나 찌그러진 모습을 그려보세요!",
} as const;

/** 내려갈 때·착지 모습 추가: 기본 그림을 복사해서 고치거나 빈 칸에서 */
function AddPoseDialog({
  pose,
  onClose,
  onAdd,
}: {
  pose: "fall" | "land" | null;
  onClose: () => void;
  onAdd: (pose: "fall" | "land", copyBase: boolean) => void;
}) {
  return (
    <Dialog
      open={pose !== null}
      title={pose ? `${POSE_INFO[pose].name} 모습 추가` : ""}
      description={pose ? POSE_TIP[pose] : undefined}
      onClose={onClose}
      actions={
        pose && (
          <>
            <Button variant="primary" block data-autofocus onClick={() => onAdd(pose, true)}>
              기본 그림 복사해서 시작
            </Button>
            <Button variant="secondary" block onClick={() => onAdd(pose, false)}>
              빈 칸에서 시작
            </Button>
          </>
        )
      }
    />
  );
}

function formatTime(ms: number) {
  const d = new Date(ms);
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `오늘 ${time}` : `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`;
}

type CanvasDialogProps = {
  open: boolean;
  tab: TabKey;
  sprite: PixelSprite | null;
  /** 주인공 (동료 탭의 "주인공 그림 가져오기") */
  hero: Character;
  /** 지금 테마 (기본 발판 그림) */
  theme: ThemeId;
  /** 보관함 (맨 위) */
  library: ReactNode;
  /** PNG로 저장 (보관함 아래) */
  pngSave: ReactNode;
  onClose: () => void;
  /** 발판 기본 그림 */
  onLoad: (sprite: PixelSprite, name: string) => void;
  /** 기본 캐릭터·주인공 그림 (세 모습) */
  onLoadCharacter: (character: Character, name: string) => void;
  onResize: (width: number, height: number) => void;
  onImportImage: () => void;
};

/**
 * 캐릭터: 기본 캐릭터 불러오기 + 칸 크기 / 동료: 주인공 그림 가져오기 + 칸 크기 (동료 기본 세트는 없음)
 * 발판: 기본 발판으로 되돌리기
 */
function CanvasDialog({ open, tab, sprite, hero, theme, library, pngSave, onClose, onLoad, onLoadCharacter, onResize, onImportImage }: CanvasDialogProps) {
  const [pendingShrink, setPendingShrink] = useState(false);
  const sizes = CONFIG.character.gridSizes;

  useEffect(() => {
    if (!open) setPendingShrink(false);
  }, [open]);

  if (!isCharacterTab(tab)) {
    const preset = THEME_PLATFORMS[theme][tab as keyof typeof THEME_PLATFORMS.dot];
    return (
      <Dialog open={open} title="발판 불러오기 · 저장" onClose={onClose}>
        {library}
        {pngSave}
        <div className={styles.platformPreset}>
          <h3 className={styles.dialogHeading}>{TAB_LABEL[tab]} 기본 그림 (지금 테마)</h3>
          <PixelPreview sprite={preset} width={192} height={48} label={`기본 ${TAB_LABEL[tab]} 그림`} />
          <Button variant="secondary" block onClick={() => onLoad(preset, `기본 ${TAB_LABEL[tab]}`)}>
            기본 발판으로 되돌리기
          </Button>
        </div>
      </Dialog>
    );
  }

  const current = sprite ? sizes.findIndex((g) => g.width === sprite.width) : -1;
  return (
    <Dialog open={open} title="불러오기 · 저장 · 크기" onClose={onClose}>
      {library}
      {pngSave}

      <section className={styles.dialogSection}>
        <Button variant="secondary" icon="image" block onClick={onImportImage}>
          내 이미지 불러오기
        </Button>
        <p className={styles.helper}>사진이나 그림 파일을 캐릭터로 써요. 지금 보고 있는 프레임에 들어가요.</p>
      </section>

      <section className={styles.dialogSection} aria-labelledby="preset-title">
        <h3 id="preset-title" className={styles.dialogHeading}>
          기본 캐릭터 불러오기
        </h3>
        <ul className={styles.presets}>
          {/* 동료는 주인공 그림도 가져올 수 있다 */}
          {tab === "companion" && (
            <li>
              <button type="button" className={styles.preset} onClick={() => onLoadCharacter(hero, "주인공 그림")}>
                <SpritePreview sprite={hero.base} width={48} height={54} />
                <span>주인공</span>
              </button>
            </li>
          )}
          {CHARACTER_PRESETS.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.preset} onClick={() => onLoadCharacter(p.character, p.name)}>
                <PixelPreview sprite={p.sprite} width={48} height={54} />
                <span>{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.helper}>
          기본 캐릭터는 기본 · 내려갈 때 · 착지 세 모습이 다 들어 있어서 그대로 쓰거나 참고해서 고쳐 그릴 수 있어요. 불러오면 지금 그림은 바뀌어요.
        </p>
      </section>

      {sprite && (
        <section className={styles.dialogSection}>
          <Segmented
            label="칸 크기"
            value={current}
            options={sizes.map((g, i) => ({ value: i, label: `${g.width}×${g.height}` }))}
            onChange={(i) => {
              const g = sizes[i];
              if (g.width < sprite.width && isLossyDownscale(sprite, g.width, g.height)) {
                setPendingShrink(true);
                return;
              }
              setPendingShrink(false);
              onResize(g.width, g.height);
            }}
          />
          <p className={styles.helper}>32×36은 더 섬세하게 그릴 수 있어요. 게임에서 보이는 크기는 같아요.</p>
          {pendingShrink && (
            <InlineMessage
              tone="warning"
              title="작게 줄이면 모양이 뭉개질 수 있어요"
              action={
                <Button
                  variant="danger"
                  onClick={() => {
                    setPendingShrink(false);
                    onResize(sizes[0].width, sizes[0].height);
                  }}
                >
                  그래도 16×18로 줄이기
                </Button>
              }
            >
              2×2칸을 한 칸으로 합쳐요. 되돌리기로 돌아갈 수 있어요.
            </InlineMessage>
          )}
        </section>
      )}
    </Dialog>
  );
}
