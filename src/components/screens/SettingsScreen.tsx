"use client";

import { useRef, type KeyboardEvent } from "react";
import { THEME_IDS, THEMES, type ThemeId } from "@/game/themes";
import { DataManager } from "../DataManager";
import { useSaveData } from "../SaveProvider";
import { InlineMessage } from "../ui/InlineMessage";
import { PixelIcon } from "../ui/PixelIcon";
import { ScreenLayout } from "./ScreenLayout";
import styles from "./SettingsScreen.module.css";

/**
 * 설정. 지금은 테마·데이터 관리가 있고, 동료·연출·앱 섹션은 12단계에서 채운다.
 * 바꾸는 즉시 적용되고 자동 저장된다.
 */
export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [data, update] = useSaveData();
  const theme = data.settings.theme;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

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

  return (
    <ScreenLayout title="설정" onBack={onClose}>
      <div className={styles.sections}>
        <section className={styles.section} aria-labelledby="theme-title">
          <h2 id="theme-title" className={styles.sectionTitle}>
            테마
          </h2>
          <p className={styles.sectionHelp}>화면과 게임 배경의 분위기가 함께 바뀌어요.</p>
          <div className={styles.themes} role="radiogroup" aria-labelledby="theme-title">
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
                  <span className={styles.themeText}>
                    <span className={styles.themeName}>{t.name}</span>
                    <span className={styles.themeDesc}>{t.description}</span>
                  </span>
                  <span className={styles.check} aria-hidden="true">
                    {checked && <PixelIcon name="check" size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <DataManager />

        <InlineMessage tone="info" title="다른 설정은 곧 추가돼요">
          동료 최대 인원, 화면 흔들림·효과음 같은 연출은 다음 단계에서 이 화면에 들어와요.
        </InlineMessage>
      </div>
    </ScreenLayout>
  );
}
