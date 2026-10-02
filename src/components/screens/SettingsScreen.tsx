"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { EditorScreen } from "@/editor/EditorScreen";
import type { TabKey } from "@/editor/session";
import { THEME_IDS, THEMES, type ThemeId } from "@/game/themes";
import { resolvePlatforms } from "@/game/themePlatforms";
import { formatScore, RECORD_HELP, RECORD_LABEL, scoreSize } from "@/lib/records";
import type { Settings } from "@/lib/schema";
import { CompanionSettings } from "../CompanionSettings";
import { InstallButton } from "../InstallButton";
import { usePwa } from "../PwaProvider";
import { DataManager } from "../DataManager";
import { useSaveData } from "../SaveProvider";
import { SpritePreview } from "../SpritePreview";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { PixelIcon } from "../ui/PixelIcon";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { useMediaQuery } from "../useMediaQuery";
import { ScreenLayout } from "./ScreenLayout";
import styles from "./SettingsScreen.module.css";

/** 설정 위에 덮어 여는 에디터: 동료 한 명 / 주인공·발판 */
type Editing = { kind: "companion"; slot: number } | { kind: "main"; tab: TabKey };

type EffectKey = keyof Pick<Settings, "shake" | "particles" | "sfx" | "specialPlatformMarker">;

const EFFECTS: { key: EffectKey; label: string; description: string }[] = [
  { key: "shake", label: "화면 흔들림", description: "고점프·부서지는 발판·합류 때 살짝 흔들려요" },
  { key: "particles", label: "파티클·착지 이펙트", description: "착지 먼지, 반짝이, 발판 조각, 통통 튀는 점프" },
  { key: "sfx", label: "효과음", description: "8비트 소리. 일시정지 메뉴에서도 끌 수 있어요" },
  { key: "specialPlatformMarker", label: "특수 발판 표식", description: "색약 대응: 고점프는 위 화살표, 일회용은 금 간 표시" },
];

/**
 * 설정 (기획서 11번). 섹션: 동료 | 캐릭터·발판 | 연출 | 테마 | 데이터 관리 | 앱.
 * 바꾸는 즉시 적용되고 자동 저장된다. 에디터는 설정 위에 덮어서 열어 게임이 진행 중이어도 끊기지 않는다.
 */
export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [data, update] = useSaveData();
  const { show } = useToast();
  const theme = data.settings.theme;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const osReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { installState, updateReady, applyUpdate } = usePwa();

  const openEditor = (next: Editing) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setEditing(next);
  };
  // 에디터를 닫으면 누른 버튼으로 포커스를 돌려준다 (inert가 풀린 뒤에)
  const closeEditor = () => {
    setEditing(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };

  const setEffect = (key: EffectKey, on: boolean) => update((d) => ({ ...d, settings: { ...d.settings, [key]: on } }));

  const choose = (id: ThemeId) => update((d) => ({ ...d, settings: { ...d.settings, theme: id } }));

  // 라디오 그룹 방향키 이동
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (index + d + THEME_IDS.length) % THEME_IDS.length;
    choose(THEME_IDS[next]);
    refs.current[next]?.focus();
  };

  const hasRecords = data.best.withCompanions > 0 || data.best.solo > 0;
  const resetBest = () => {
    update((d) => ({ ...d, best: { withCompanions: 0, solo: 0 } }));
    setConfirmReset(false);
    show("최고 기록을 초기화했어요.", "info");
  };

  return (
    <>
    <div className={styles.root} inert={editing !== null}>
    <ScreenLayout title="설정" onBack={onClose}>
      <div className={styles.sections}>
        <div className={styles.card}>
          <CompanionSettings onEdit={(slot) => openEditor({ kind: "companion", slot })} />
        </div>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="draw-title">
          <h2 id="draw-title" className={styles.sectionTitle}>
            캐릭터 · 발판
          </h2>
          <div className={styles.drawRow}>
            <span className={styles.drawPreview}>
              <SpritePreview sprite={data.hero.base} width={40} height={45} />
            </span>
            <Button variant="secondary" icon="pencil" block onClick={() => openEditor({ kind: "main", tab: "hero" })}>
              캐릭터 그리기
            </Button>
          </div>
          <div className={styles.drawRow}>
            <span className={styles.drawPreview}>
              <SpritePreview sprite={resolvePlatforms(data.platforms, theme).basic} width={48} height={12} />
            </span>
            <Button variant="secondary" icon="grid" block onClick={() => openEditor({ kind: "main", tab: "basic" })}>
              발판 만들기
            </Button>
          </div>
          <p className={styles.sectionHelp}>발판은 기본 · 고점프 · 일회용 · 움직이는 네 가지를 따로 그려요.</p>
        </section>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="effects-title">
          <h2 id="effects-title" className={styles.sectionTitle}>
            연출
          </h2>
          {osReducedMotion && (
            <p className={styles.sectionHelp}>
              기기에서 &quot;동작 줄이기&quot;가 켜져 있어요. 처음엔 흔들림·파티클이 꺼진 채로 시작하고, 여기서 바꾼 값이 우선이에요.
            </p>
          )}
          <div className={styles.switches}>
            {EFFECTS.map((e) => (
              <Switch
                key={e.key}
                label={e.label}
                description={e.description}
                checked={data.settings[e.key]}
                onChange={(on) => setEffect(e.key, on)}
              />
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="theme-title">
          <h2 id="theme-title" className={styles.sectionTitle}>
            테마
          </h2>
          <p className={styles.sectionHelp}>화면과 게임 배경의 분위기가 함께 바뀌어요.</p>
          <div className={styles.themes} role="radiogroup" aria-labelledby="theme-title" aria-describedby="theme-desc">
            {THEME_IDS.map((id, i) => {
              const t = THEMES[id];
              const checked = id === theme;
              const [bg, fillA, fillB, line] = t.swatches;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className={styles.theme}
                  onClick={() => choose(id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  {/* 미리보기: 그 테마의 배경 위에 버튼 두 개 */}
                  <span className={styles.preview} style={{ background: bg }} aria-hidden="true">
                    <span className={styles.previewPill} style={{ background: fillA, borderColor: line, boxShadow: `0 3px 0 ${line}` }} />
                    <span className={styles.previewPill} style={{ background: fillB, borderColor: line, boxShadow: `0 3px 0 ${line}` }} />
                  </span>
                  <span className={styles.themeName}>{t.name}</span>
                  <span className={styles.check} aria-hidden="true">
                    {checked && <PixelIcon name="check" size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
          <p id="theme-desc" className={styles.themeDesc} aria-live="polite">
            <strong>{THEMES[theme].name}</strong> · {THEMES[theme].description}
          </p>
        </section>

        <div className={styles.card}>
          <DataManager />
        </div>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="app-title">
          <h2 id="app-title" className={styles.sectionTitle}>
            앱
          </h2>
          <dl className={styles.records} aria-label="최고 기록">
            {(["withCompanions", "solo"] as const).map((k) => (
              <div key={k} className={styles.record}>
                <dt>{RECORD_LABEL[k]}</dt>
                <dd className={scoreSize(data.best[k]) ? styles.recordLong : undefined}>{formatScore(data.best[k])}m</dd>
              </div>
            ))}
          </dl>
          <p className={styles.sectionHelp}>{RECORD_HELP}</p>
          {updateReady && (
            <Button variant="primary" icon="download" block onClick={applyUpdate}>
              새 버전으로 업데이트
            </Button>
          )}
          {installState === "installed" ? (
            <p className={styles.sectionHelp}>앱으로 설치되어 있어요. 인터넷이 없어도 열 수 있어요.</p>
          ) : installState === "unavailable" ? (
            <p className={styles.sectionHelp}>
              이 브라우저에서는 설치 버튼을 띄울 수 없어요. 브라우저 메뉴에서 &quot;홈 화면에 추가&quot; 또는 &quot;앱 설치&quot;를 찾아보세요.
            </p>
          ) : (
            <>
              <InstallButton block />
              <p className={styles.sectionHelp}>설치하면 홈 화면에서 바로 열리고, 인터넷이 없어도 플레이할 수 있어요.</p>
            </>
          )}
          {/* 되돌릴 수 없는 동작은 섹션 맨 아래에 */}
          <div className={styles.danger}>
            <Button variant="danger" icon="trash" block disabled={!hasRecords} onClick={() => setConfirmReset(true)}>
              최고 기록 초기화
            </Button>
            {!hasRecords && <p className={styles.sectionHelp}>아직 지울 기록이 없어요.</p>}
          </div>
        </section>
      </div>
    </ScreenLayout>
    </div>

    <Dialog
      open={confirmReset}
      title="최고 기록을 초기화할까요?"
      description={`${RECORD_LABEL.withCompanions} · ${RECORD_LABEL.solo} 기록이 모두 0m가 돼요. 되돌릴 수 없어요.`}
      onClose={() => setConfirmReset(false)}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button variant="danger" icon="trash" block onClick={resetBest}>
            초기화
          </Button>
          <Button ref={cancelRef} variant="ghost" block onClick={() => setConfirmReset(false)}>
            취소
          </Button>
        </>
      }
    />

    {editing !== null && (
      <div className={styles.editor}>
        {editing.kind === "companion" ? (
          <EditorScreen companion={{ slot: editing.slot, inGame: false, onSaved: closeEditor }} onClose={closeEditor} />
        ) : (
          <EditorScreen initialTab={editing.tab} onClose={closeEditor} />
        )}
      </div>
    )}
    </>
  );
}
