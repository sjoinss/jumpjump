"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Engine, type Phase, type SceneLayout } from "@/game/engine";
import { CHARACTER_PRESETS } from "@/game/presets";
import { SCENE } from "@/game/themes";
import { needsBackupReminder } from "@/lib/dataFile";
import type { BestScores, Character } from "@/lib/schema";
import { ControlsGuide } from "../ControlsGuide";
import { GameOverDialog, type GameResult } from "../GameOverDialog";
import { useSaveData, useStorageBanner } from "../SaveProvider";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InlineMessage } from "../ui/InlineMessage";
import { PixelIcon } from "../ui/PixelIcon";
import { useToast } from "../ui/Toast";
import styles from "./PlayScreen.module.css";

type Props = {
  /** 설정 화면이 위에 덮여 있으면 true. 이때는 일시정지 메뉴를 숨긴다 */
  covered: boolean;
  onOpenSettings: () => void;
  onOpenEditor: () => void;
};

/**
 * 시작 장면과 게임을 한 화면에서 처리한다.
 * ready: 캐릭터가 바닥에 서 있고 좌우에 "시작하기 / 캐릭터 만들기" 카드
 * playing/paused: HUD(점수 · 설정 · 일시정지)
 */
export function PlayScreen({ covered, onOpenSettings, onOpenEditor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [layout, setLayout] = useState<SceneLayout>({ scale: 1, groundHeight: 88 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  /** 판 시작 시점의 동료 최대 인원 (최고 기록 구분 기준, 기획서 7-8). 저장하지 않는 런타임 값 */
  const runRef = useRef({ companionMaxAtStart: 0 });
  const [data, update] = useSaveData();
  const banner = useStorageBanner();
  // 주기적 백업 안내 (기획서 10-4). 저장소 경고가 있으면 그쪽이 먼저
  const [now] = useState(() => Date.now());
  const showBackup = !banner && needsBackupReminder(data, now);
  const snoozeBackup = () =>
    update((d) => ({ ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, backupReminderAt: Date.now() } } }));
  const { announce } = useToast();
  const announceRef = useRef(announce);
  announceRef.current = announce;

  const heroRef = useRef(data.hero);
  heroRef.current = data.hero;
  const dataRef = useRef(data);
  dataRef.current = data;

  const markRunStart = () => {
    runRef.current = { companionMaxAtStart: dataRef.current.settings.companionMax };
  };

  const openMenu = useCallback(() => {
    engineRef.current?.pause();
    setMenuOpen(true);
  }, []);

  const resume = useCallback(() => {
    setMenuOpen(false);
    // 재개 3초 카운트다운은 12단계에서 붙인다
    engineRef.current?.resume();
    canvasRef.current?.focus({ preventScroll: true });
  }, []);

  const [guideOpen, setGuideOpen] = useState(false);
  const guideShown = data.settings.onboarding.controlsGuideShown;

  /** 조작법 안내를 본 것으로 기록 (✕로 닫아도 다시 띄우지 않는다) */
  const markGuideShown = useCallback(() => {
    update((d) =>
      d.settings.onboarding.controlsGuideShown
        ? d
        : { ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, controlsGuideShown: true } } },
    );
  }, [update]);

  const beginPlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.currentPhase !== "ready") return;
    markRunStart();
    engine.start();
    canvasRef.current?.focus({ preventScroll: true });
    announce("게임 시작");
    update((d) =>
      d.settings.onboarding.firstRunDone
        ? d
        : { ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, firstRunDone: true } } },
    );
  }, [announce, update]);

  /** 시작하기: 첫 판이면 조작법 안내부터 (기획서 10-2) */
  const start = useCallback(() => {
    if (engineRef.current?.currentPhase !== "ready") return;
    if (!guideShown) setGuideOpen(true);
    else beginPlay();
  }, [guideShown, beginPlay]);

  /** 게임오버: 기록 갱신 확인 후 결과 창 */
  const onGameOver = useCallback(
    (final: number) => {
      const withCompanions = runRef.current.companionMaxAtStart > 0;
      const key = withCompanions ? "withCompanions" : "solo";
      const prevBest = dataRef.current.best[key];
      const isNew = final > prevBest;
      if (isNew) update((d) => ({ ...d, best: { ...d.best, [key]: Math.max(d.best[key], final) } }));
      setResult({ score: final, best: Math.max(prevBest, final), isNew, withCompanions });
      announce(`게임 끝. ${final}점${isNew ? ", 최고 기록!" : ""}`);
    },
    [announce, update],
  );
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const restart = useCallback(() => {
    setResult(null);
    markRunStart();
    engineRef.current?.restart();
    canvasRef.current?.focus({ preventScroll: true });
    announce("다시 시작");
  }, [announce]);

  const backToStart = useCallback(() => {
    setMenuOpen(false);
    setResult(null);
    engineRef.current?.showReady();
    logoRef.current?.focus({ preventScroll: true });
  }, []);

  const openSettings = useCallback(() => {
    // 게임 중이면 멈추고, 설정을 닫으면 일시정지 메뉴로 돌아온다
    if (engineRef.current?.currentPhase === "playing") openMenu();
    onOpenSettings();
  }, [onOpenSettings, openMenu]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, heroRef.current, {
      onPhaseChange: setPhase,
      onPauseRequest: () => openMenu(),
      onLayout: setLayout,
      onScore: (s) => {
        setScore(s);
        // 스크린리더에는 10점마다만 알린다 (매 발판마다 읽으면 너무 시끄럽다)
        if (s > 0 && s % 10 === 0) announceRef.current(`${s}점`);
      },
      onGameOver: (s) => onGameOverRef.current(s),
    });
    engine.setPlatformSprites(dataRef.current.platforms);
    // 개발 중 디버깅용 (배포 빌드에는 들어가지 않음)
    if (process.env.NODE_ENV === "development") (window as unknown as { __engine?: Engine }).__engine = engine;
    engineRef.current = engine;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      engine.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    // DPR만 바뀌는 경우(창을 다른 모니터로 옮김)도 잡는다
    window.addEventListener("resize", fit);
    engine.showReady();
    logoRef.current?.focus({ preventScroll: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      engine.destroy();
      engineRef.current = null;
    };
  }, [openMenu]);

  // 테마를 바꾸면 게임 장면 색도 바로 바꾼다
  const theme = data.settings.theme;
  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  // 에디터에서 발판을 바꾸면 바로 반영
  useEffect(() => {
    engineRef.current?.setPlatformSprites(data.platforms);
  }, [data.platforms]);

  // 에디터에서 캐릭터를 바꾸면 바로 반영
  useEffect(() => {
    engineRef.current?.setHero(data.hero);
  }, [data.hero]);

  // 시작 장면: 버튼 밖에서 Enter/Space를 누르면 시작 (기획서 3-1)
  useEffect(() => {
    if (phase !== "ready" || covered || guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.code !== "Enter" && e.code !== "Space" && e.code !== "NumpadEnter")) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, input, select, textarea, dialog")) return;
      e.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, covered, guideOpen, start]);

  const ready = phase === "ready";
  const inGame = phase === "playing" || phase === "paused" || phase === "gameover";
  const sceneStyle = { "--ground": `${layout.groundHeight}px`, background: SCENE[theme].cssBackground } as CSSProperties;

  return (
    <main className={styles.screen} style={sceneStyle}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={ready ? -1 : 0}
        role="application"
        aria-label="게임 화면. 화면을 누른 채 좌우로 끌거나, 왼쪽·오른쪽 방향키 또는 A·D 키로 움직여요. Esc나 P로 일시정지해요."
      />

      <div className={styles.hud}>
        <div className={styles.hudLeft}>
          {inGame ? (
            <p className={styles.score}>
              <span className="visually-hidden">점수 </span>
              <span className={styles.scoreValue}>{score}</span>
              <span className={styles.scoreUnit}>점</span>
            </p>
          ) : (
            <BestBadge best={data.best} />
          )}
        </div>
        <div className={styles.hudRight}>
          <IconButton icon="gear" label="설정" onClick={openSettings} />
          {(phase === "playing" || phase === "paused") && (
            <IconButton icon="pause" label="일시정지" variant="primary" onClick={openMenu} disabled={phase !== "playing"} />
          )}
        </div>
      </div>

      {ready && (
        <>
          <div className={styles.logoArea}>
            <h1 ref={logoRef} tabIndex={-1} className={styles.logo}>
              <span className={styles.logoMain}>점프점프</span>
            </h1>
            {banner && (
              <div className={styles.banner}>
                <InlineMessage tone="warning" title={banner.title}>
                  {banner.message}
                </InlineMessage>
              </div>
            )}
            {showBackup && (
              <div className={styles.banner}>
                <InlineMessage
                  tone="info"
                  title="그림을 백업해 둘까요?"
                  action={
                    <div className={styles.bannerActions}>
                      <Button variant="secondary" icon="download" onClick={onOpenSettings}>
                        내보내러 가기
                      </Button>
                      <Button variant="ghost" onClick={snoozeBackup}>
                        나중에
                      </Button>
                    </div>
                  }
                >
                  한동안 내보내지 않았어요. 설정의 데이터 관리에서 파일로 보관할 수 있어요.
                </InlineMessage>
              </div>
            )}
          </div>

          <nav className={styles.cards} aria-label="시작 메뉴">
            <button type="button" className={`${styles.card} ${styles.cardStart}`} onClick={start}>
              <span className={styles.cardIcon}>
                <PixelIcon name="play" size={28} />
              </span>
              <span className={styles.cardTitle}>시작하기</span>
              <span className={styles.cardCaption}>{isPresetHero(data.hero) ? "기본 캐릭터로" : "내 캐릭터로"}</span>
            </button>
            <button type="button" className={`${styles.card} ${styles.cardEditor}`} onClick={onOpenEditor}>
              <span className={styles.cardIcon}>
                <PixelIcon name="pencil" size={28} />
              </span>
              <span className={styles.cardTitle}>캐릭터 만들기</span>
              <span className={styles.cardCaption}>직접 그리기</span>
            </button>
          </nav>
        </>
      )}

      {!ready && <h1 className="visually-hidden">게임 중</h1>}

      <ControlsGuide
        open={guideOpen && !covered}
        hero={data.hero.frames[0]}
        onStart={() => {
          setGuideOpen(false);
          markGuideShown();
          beginPlay();
        }}
        onClose={() => {
          setGuideOpen(false);
          markGuideShown();
        }}
      />

      <GameOverDialog
        result={covered ? null : result}
        onRetry={restart}
        onEditor={() => {
          backToStart();
          onOpenEditor();
        }}
        onHome={backToStart}
      />

      <Dialog
        open={menuOpen && !covered}
        title="일시정지"
        onClose={resume}
        initialFocusRef={resumeRef}
        actions={
          <>
            <Button ref={resumeRef} variant="primary" size="lg" icon="play" block onClick={resume}>
              계속하기
            </Button>
            <Button variant="secondary" icon="gear" block onClick={onOpenSettings}>
              설정
            </Button>
            <Button variant="ghost" icon="back" block onClick={backToStart}>
              처음으로
            </Button>
          </>
        }
      />
    </main>
  );
}

/** 시작 장면 왼쪽 위 최고 기록. 기록이 없으면 표시하지 않는다 */
function BestBadge({ best }: { best: BestScores }) {
  if (best.withCompanions === 0 && best.solo === 0) return null;
  return (
    <div className={styles.best}>
      <span className={styles.bestIcon}>
        <PixelIcon name="crown" size={16} />
      </span>
      <span className="visually-hidden">최고 기록</span>
      <dl className={styles.bestList}>
        {best.withCompanions > 0 && (
          <div>
            <dt>동료와</dt>
            <dd>{best.withCompanions}</dd>
          </div>
        )}
        {best.solo > 0 && (
          <div>
            <dt>혼자</dt>
            <dd>{best.solo}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** 주인공이 기본 캐릭터 그대로인지 (시작 카드 문구용) */
function isPresetHero(hero: Character) {
  const f = hero.frames[0];
  if (hero.frames.length > 1 || f.kind !== "pixel") return false;
  const key = f.pixels.join(",");
  return CHARACTER_PRESETS.some((p) => p.sprite.width === f.width && p.sprite.pixels.join(",") === key);
}
