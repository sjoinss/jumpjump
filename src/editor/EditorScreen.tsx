"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PixelPreview } from "@/components/PixelPreview";
import { SpritePreview } from "@/components/SpritePreview";
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
import { CHARACTER_PRESETS, PLATFORM_PRESETS } from "@/game/presets";
import type { PixelSprite, Sprite } from "@/lib/schema";
import { DotCanvas, type Underlay } from "./DotCanvas";
import { ImageImportScreen } from "./ImageImportScreen";
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
  currentDoc,
  currentSprite,
  DRAFT_KEY,
  editorReducer,
  isCharacterTab,
  isDirty,
  parseDraft,
  TAB_KEYS,
  TAB_LABEL,
  toDraft,
  type EditorDraft,
  type TabKey,
  type Tool,
} from "./session";
import { TOOLS } from "./Toolbar";
import { Toolbar } from "./Toolbar";
import styles from "./EditorScreen.module.css";

type DialogKind = null | "canvas" | "landing" | "leave" | "backup";

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
};

/**
 * 도트 에디터. 탭(캐릭터 / 발판 3종)마다 따로 그리고 "완료"를 누르면 한꺼번에 게임에 적용한다.
 * 그리는 동안에는 임시 저장(editor.draft)만 계속 갱신해서, 앱이 닫혀도 다음에 이어서 그릴 수 있다.
 * companion을 주면 같은 화면이 동료 한 명 그리기(이름 · 주인공 가이드)로 바뀐다.
 */
export function EditorScreen({ onClose, companion }: Props) {
  const [data, update] = useSaveData();
  const kv = useKeyValueStore();
  const { show } = useToast();
  const [state, dispatch] = useReducer(editorReducer, data, (d) =>
    companion ? createCompanionEditorState(d.companionSlots[companion.slot - 1], d.palette) : createEditorState(d),
  );
  const draftKey = companion ? companionDraftKey(companion.slot) : DRAFT_KEY;
  const inGame = companion?.inGame ?? false;
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draftPrompt, setDraftPrompt] = useState<EditorDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
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

  // 게임 중 동료는 그림이 그대로여도 "완료" = 이 모습으로 함께 가기
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

  // 밑그림: 주인공 가이드(동료만) → 내 기본 그림(착지 프레임 작업 때)
  const heroGuide = data.hero.frames[0];
  const onionBase = isHero && state.frame === 1 && state.onion ? doc.frames[0] : null;
  const underlays = useMemo(() => {
    const list: Underlay[] = [];
    if (companion && state.guide) list.push({ sprite: heroGuide, opacity: GUIDE_OPACITY });
    if (onionBase) list.push({ sprite: onionBase, opacity: state.onionOpacity });
    return list;
  }, [companion, state.guide, heroGuide, onionBase, state.onionOpacity]);
  const tabItems = TAB_KEYS.map((k) => ({ id: k, label: TAB_LABEL[k].replace(" 발판", ""), marked: isDirty(state, k) }));
  const title = companion ? `동료 ${companion.slot} 그리기` : "그리기";
  const frameName = isHero ? (state.frame === 1 ? " 착지 그림" : " 기본 그림") : "";

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
            <div className={styles.frames} role="group" aria-label="프레임">
              <button
                type="button"
                className={styles.chip}
                aria-pressed={state.frame === 0}
                onClick={() => dispatch({ type: "setFrame", frame: 0 })}
              >
                기본
              </button>
              {doc.frames.length > 1 ? (
                <>
                  <button
                    type="button"
                    className={styles.chip}
                    aria-pressed={state.frame === 1}
                    onClick={() => dispatch({ type: "setFrame", frame: 1 })}
                  >
                    착지
                  </button>
                  {state.frame === 1 && (
                    <button
                      type="button"
                      className={styles.chipGhost}
                      onClick={() => dispatch({ type: "removeLanding" })}
                      title="착지 프레임 삭제 (되돌리기 가능)"
                    >
                      <PixelIcon name="trash" size={12} />
                      착지 삭제
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className={styles.chipGhost} onClick={() => setDialog("landing")}>
                  <PixelIcon name="plus" size={12} />
                  착지 추가
                </button>
              )}
            </div>
          ) : (
            <p className={styles.sizeNote}>발판 · 32×8칸</p>
          )}
          <button type="button" className={styles.chipGhost} onClick={() => setDialog("canvas")}>
            <PixelIcon name="grid" size={12} />
            {isHero ? "불러오기·크기" : "기본 발판"}
          </button>
        </div>

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

        {isHero && state.frame === 1 && (
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

      <Dialog
        open={dialog === "landing"}
        title="착지 프레임 추가"
        description="발판에 착지하는 순간 잠깐(0.2초) 보이는 그림이에요. 눈을 감거나 찌그러진 모습을 그려보세요!"
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button
              variant="primary"
              block
              data-autofocus
              onClick={() => {
                dispatch({ type: "addLanding", copyBase: true });
                setDialog(null);
              }}
            >
              기본 그림 복사해서 시작
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                dispatch({ type: "addLanding", copyBase: false });
                setDialog(null);
              }}
            >
              빈 칸에서 시작
            </Button>
          </>
        }
      />

      <CanvasDialog
        open={dialog === "canvas"}
        tab={state.active}
        sprite={sprite.kind === "pixel" ? sprite : null}
        hero={heroGuide}
        onClose={() => setDialog(null)}
        onLoad={(s, name) => {
          // 도트는 기본 그림을 바꾸고(착지 빠짐), 이미지(주인공이 이미지일 때)는 지금 프레임에
          dispatch(s.kind === "pixel" ? { type: "loadSprite", sprite: s } : { type: "setFrameSprite", sprite: s });
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
              완료하고 함께 가기
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
          onDone={(sprite) => {
            dispatch({ type: "setFrameSprite", sprite });
            setImporting(null);
            show("이미지를 넣었어요. 완료를 누르면 게임에 적용돼요.", "success");
          }}
        />
      </div>
    )}
    </>
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
  /** 주인공 기본 그림 (동료 탭의 "주인공 그림 가져오기") */
  hero: Sprite;
  onClose: () => void;
  onLoad: (sprite: Sprite, name: string) => void;
  onResize: (width: number, height: number) => void;
  onImportImage: () => void;
};

/**
 * 캐릭터: 기본 캐릭터 불러오기 + 칸 크기 / 동료: 주인공 그림 가져오기 + 칸 크기 (동료 기본 세트는 없음)
 * 발판: 기본 발판으로 되돌리기
 */
function CanvasDialog({ open, tab, sprite, hero, onClose, onLoad, onResize, onImportImage }: CanvasDialogProps) {
  const [pendingShrink, setPendingShrink] = useState(false);
  const sizes = CONFIG.character.gridSizes;

  useEffect(() => {
    if (!open) setPendingShrink(false);
  }, [open]);

  if (!isCharacterTab(tab)) {
    const preset = PLATFORM_PRESETS[tab as keyof typeof PLATFORM_PRESETS];
    return (
      <Dialog open={open} title={TAB_LABEL[tab]} onClose={onClose}>
        <div className={styles.platformPreset}>
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
    <Dialog open={open} title="불러오기 · 크기" onClose={onClose}>
      <section className={styles.dialogSection}>
        <Button variant="secondary" icon="image" block onClick={onImportImage}>
          내 이미지 불러오기
        </Button>
        <p className={styles.helper}>사진이나 그림 파일을 캐릭터로 써요. 지금 보고 있는 프레임에 들어가요.</p>
      </section>

      {tab === "companion" ? (
        <section className={styles.dialogSection} aria-labelledby="hero-copy-title">
          <h3 id="hero-copy-title" className={styles.dialogHeading}>
            주인공 그림 가져오기
          </h3>
          <button type="button" className={styles.preset} onClick={() => onLoad(hero, "주인공 그림")}>
            <SpritePreview sprite={hero} width={48} height={54} />
            <span>주인공</span>
          </button>
          <p className={styles.helper}>주인공 그림을 복사해서 고쳐 그려요. 지금 그림은 바뀌어요.</p>
        </section>
      ) : (
      <section className={styles.dialogSection} aria-labelledby="preset-title">
        <h3 id="preset-title" className={styles.dialogHeading}>
          기본 캐릭터 불러오기
        </h3>
        <ul className={styles.presets}>
          {CHARACTER_PRESETS.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.preset} onClick={() => onLoad(p.sprite, p.name)}>
                <PixelPreview sprite={p.sprite} width={48} height={54} />
                <span>{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.helper}>불러오면 지금 그림을 바꿔요. 착지 프레임은 빠져요.</p>
      </section>
      )}

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
