"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Engine, type Phase, type SceneLayout } from "@/game/engine";
import { COMPANION_QUESTION } from "@/game/presets";
import { isPresetHero } from "@/lib/character";
import { SCENE } from "@/game/themes";
import { resolvePlatforms } from "@/game/themePlatforms";
import { needsBackupReminder } from "@/lib/dataFile";
import { formatScore, RECORD_LABEL, scoreSize } from "@/lib/records";
import type { BestScores, Character } from "@/lib/schema";
import { CompanionPrompt } from "../CompanionPrompt";
import { ControlsGuide } from "../ControlsGuide";
import { applyRefusal } from "@/game/companions";
import { EditorScreen } from "@/editor/EditorScreen";
import type { MinigameId } from "@/game/minigames";
import { MinigameScreen } from "../MinigameScreen";
import { GameOverDialog, type GameResult } from "../GameOverDialog";
import { RegionBanner } from "../RegionBanner";
import { regionBlendAt, regionIndexAt, regionName } from "@/game/regions";
import { CONFIG } from "@/game/config";
import { sfx } from "@/game/audio";
import { useSaveData, useStorageBanner } from "../SaveProvider";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InlineMessage } from "../ui/InlineMessage";
import { InstallButton } from "../InstallButton";
import { usePwa } from "../PwaProvider";
import { useMediaQuery } from "../useMediaQuery";
import { Switch } from "../ui/Switch";
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
 * playing/paused: HUD(점수(높이 m) · 설정 · 일시정지)
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
  /** 지역 이름 배너. id가 바뀔 때마다 새로 뜬다 */
  const [regionBanner, setRegionBanner] = useState<{ id: number; name: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 판 시작 시점의 동료 최대 인원 (최고 기록 구분 기준, 기획서 7-8). 저장하지 않는 런타임 값 */
  const runRef = useRef({ companionMaxAtStart: 0 });
  const [data, update] = useSaveData();
  const banner = useStorageBanner();
  // 주기적 백업 안내 (기획서 10-4). 저장소 경고가 있으면 그쪽이 먼저
  const [now] = useState(() => Date.now());
  const { updateReady, applyUpdate } = usePwa();
  const showBackup = !banner && !updateReady && needsBackupReminder(data, now);
  // PC는 프레임 옆에 설치 버튼이 있으니, 휴대폰(터치)일 때만 시작 장면에 둔다
  const touchDevice = useMediaQuery("(pointer: coarse)");
  const snoozeBackup = () =>
    update((d) => ({ ...d, settings: { ...d.settings, onboarding: { ...d.settings.onboarding, backupReminderAt: Date.now() } } }));
  const { announce, show } = useToast();
  const announceRef = useRef(announce);
  announceRef.current = announce;

  const heroRef = useRef(data.hero);
  heroRef.current = data.hero;
  const dataRef = useRef(data);
  dataRef.current = data;
  const slots = data.companionSlots;

  const markRunStart = () => {
    runRef.current = { companionMaxAtStart: dataRef.current.settings.companionMax };
  };
  /** 엔진에 넘길 이번 판 설정: 동료 최대 인원 + 이번 모드의 최고 기록(최고 기록 선) */
  const runOptions = () => {
    const companionMax = runRef.current.companionMaxAtStart;
    return { companionMax, best: dataRef.current.best[companionMax > 0 ? "withCompanions" : "solo"] };
  };

  /** 일시정지 메뉴에서 "계속하기" 뒤 다시 움직이기까지 남은 초 (기획서 9-6). null이면 세는 중 아님 */
  const [resumeCount, setResumeCount] = useState<number | null>(null);

  const openMenu = useCallback(() => {
    engineRef.current?.pause();
    setResumeCount(null);
    setMenuOpen(true);
  }, []);

  const resume = useCallback(() => {
    setMenuOpen(false);
    setResumeCount(CONFIG.resumeCountdown);
    canvasRef.current?.focus({ preventScroll: true });
  }, []);

  // 재개 카운트다운: 숫자를 크게 보여주고 스크린리더에도 읽어 준다. 끝나면 다시 움직인다
  useEffect(() => {
    if (resumeCount === null) return;
    if (resumeCount === 0) {
      setResumeCount(null);
      sfx.play("go");
      announce("시작");
      engineRef.current?.resume();
      return;
    }
    sfx.play("countdown");
    announce(String(resumeCount));
    const t = setTimeout(() => setResumeCount((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [resumeCount, announce]);

  // 세는 도중 창을 벗어나면 다시 일시정지 메뉴로
  useEffect(() => {
    if (resumeCount === null) return;
    const back = () => {
      setResumeCount(null);
      setMenuOpen(true);
    };
    const onVisibility = () => document.visibilityState === "hidden" && back();
    window.addEventListener("blur", back);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", back);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resumeCount]);

  const sfxOn = data.settings.sfx;
  const toggleSfx = (on: boolean) => update((d) => ({ ...d, settings: { ...d.settings, sfx: on } }));

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
    engine.start(runOptions());
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
      // 결과 이미지: 게임오버 높이의 배경 + 주인공과 이번 판에 합류한 동료 (기획서 13-1)
      const d = dataRef.current;
      const joined = engineRef.current?.companions ?? 0;
      const members = [d.hero, ...d.companionSlots.slice(0, joined).map((s) => s.character ?? { base: COMPANION_QUESTION })];
      const card = {
        score: final,
        isNew,
        withCompanions,
        regionName: regionName(regionIndexAt(final, SCENE[d.settings.theme].regions), SCENE[d.settings.theme].regions),
        blend: regionBlendAt(final, SCENE[d.settings.theme].regions),
        members,
        platform: resolvePlatforms(d.platforms, d.settings.theme).basic,
        scene: SCENE[d.settings.theme],
        caption: d.settings.cardCaption,
      };
      setResult({ score: final, best: Math.max(prevBest, final), isNew, withCompanions, card });
      announce(`게임 끝. ${final}미터${isNew ? ", 최고 기록!" : ""}`);
    },
    [announce, update],
  );
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const restart = useCallback(() => {
    setResult(null);
    markRunStart();
    engineRef.current?.restart(runOptions());
    canvasRef.current?.focus({ preventScroll: true });
    announce("다시 시작");
  }, [announce]);

  // ── 동료 후보 선택창 → 그리기 → 미니게임 (기획서 7-4, 8) ──
  type CandidateRef = { id: number; slot: number };
  const [prompt, setPrompt] = useState<CandidateRef | null>(null);
  /** 게임 중 동료 그리기 화면. 그리는 동안 게임은 멈춰 있다 */
  const [drawing, setDrawing] = useState<CandidateRef | null>(null);
  /** 미니게임 중인 후보. 끝나면 성공이면 합류, 실패면 후보만 없어진다 */
  const [minigame, setMinigame] = useState<CandidateRef | null>(null);
  /** 바로 앞 미니게임 (같은 게임이 연달아 나오지 않게) */
  const lastMinigame = useRef<MinigameId | null>(null);

  const closePrompt = () => {
    setPrompt(null);
    canvasRef.current?.focus({ preventScroll: true });
  };

  const join = (c: CandidateRef) => {
    engineRef.current?.acceptCandidate(c.id);
    announce(`동료 ${c.slot}번이 합류했어요!`);
  };

  /** 그림이 있는 동료도 자동 합류하지 않고 미니게임을 통과해야 한다 (기획서 7-3) */
  const startMinigame = (c: CandidateRef) => {
    engineRef.current?.beginMinigame();
    setMinigame(c);
  };

  const finishMinigame = ({ success, id }: { success: boolean; id: MinigameId }) => {
    if (!minigame) return;
    lastMinigame.current = id;
    if (success) join(minigame);
    else {
      // 실패: 게임오버 없이 계속. 그림은 슬롯에 남고 다음 후보가 그 모습으로 나온다 (거절로 세지 않음)
      engineRef.current?.failCandidate(minigame.id);
      announce("다음 동료 기회에 다시 도전해요");
    }
    setMinigame(null);
    canvasRef.current?.focus({ preventScroll: true });
  };

  const startDrawing = () => {
    if (!prompt) return;
    engineRef.current?.beginDrawing();
    setDrawing(prompt);
    setPrompt(null);
  };

  /** "예": 그림이 있으면 바로 미니게임, 없으면 그리러 간다 */
  const acceptCompanion = () => {
    if (!prompt) return;
    if (!slots[prompt.slot - 1]?.character) {
      startDrawing();
      return;
    }
    startMinigame(prompt);
    setPrompt(null);
  };

  const closeDrawing = () => {
    setDrawing(null);
    canvasRef.current?.focus({ preventScroll: true });
  };

  /** 그림을 완성함(슬롯에 저장됨) → 미니게임 */
  const finishDrawing = () => {
    if (!drawing) return;
    setDrawing(null);
    startMinigame(drawing);
  };

  /** 그리다 그만둠: 초안은 에디터가 남기고, 후보는 그 자리에 (거절로 세지 않음) */
  const cancelDrawing = () => {
    if (!drawing) return;
    engineRef.current?.keepCandidate(drawing.id);
    closeDrawing();
  };

  const refuseCompanion = (count: boolean) => {
    if (!prompt) return;
    const engine = engineRef.current;
    const counted = engine?.refuseCandidate(prompt.id, count) ?? false;
    closePrompt();
    if (!counted || !engine) return;
    // 거절 누적 → 설정을 직접 건드린 적이 없으면 3번째에 자동 설정 (기획서 7-6)
    const outcome = applyRefusal(dataRef.current.settings, engine.companions);
    update((d) => ({ ...d, settings: applyRefusal(d.settings, engine.companions).settings }));
    if (outcome.autoSetTo !== null) {
      engine.setCompanionMax(outcome.autoSetTo);
      show(`동료 ${outcome.autoSetTo}명까지만 나오도록 설정했어요. 설정에서 바꿀 수 있어요.`, "info");
    }
  };

  const backToStart = useCallback(() => {
    setMenuOpen(false);
    setResult(null);
    setRegionBanner(null);
    setPrompt(null);
    setDrawing(null);
    setMinigame(null);
    engineRef.current?.showReady();
    logoRef.current?.focus({ preventScroll: true });
  }, []);

  const openSettings = useCallback(() => {
    // 게임 중(재개 카운트다운 중 포함)이면 멈추고, 설정을 닫으면 일시정지 메뉴로 돌아온다
    const p = engineRef.current?.currentPhase;
    if (p === "playing" || p === "paused") openMenu();
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
        // 스크린리더에는 일정 간격(m)마다만 알린다 (1m마다 읽으면 너무 시끄럽다)
        const every = CONFIG.score.announceEvery;
        if (s > 0 && s % every === 0) announceRef.current(`${s}미터`);
      },
      onGameOver: (s) => {
        sfx.play("gameover");
        onGameOverRef.current(s);
      },
      onCandidate: (c) => {
        sfx.play("candidate");
        setPrompt(c);
      },
      onRegion: (index, name) => {
        if (index > 0) sfx.play("region");
        setRegionBanner((prev) => ({ id: (prev?.id ?? 0) + 1, name }));
        announceRef.current(name);
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setRegionBanner(null), CONFIG.regions.bannerSeconds * 1000 + 200);
      },
    });
    engine.setPlatformSprites(resolvePlatforms(dataRef.current.platforms, dataRef.current.settings.theme));
    // 효과음도 착지 이벤트를 듣는다 (착지 프레임·파티클과 같은 훅)
    engine.onLand(({ platform }) => {
      sfx.play(platform.kind === "highJump" ? "highJump" : platform.kind === "oneTime" ? "break" : "land");
    });
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
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
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

  // 동료 슬롯 그림 (후보·대열 모습)
  useEffect(() => {
    engineRef.current?.setCompanionLooks(slots.map((s) => s.character));
  }, [slots]);

  // 연출 설정: 화면 흔들림 / 파티클·착지 이펙트 (각각 따로)
  const { shake, particles } = data.settings;
  useEffect(() => {
    engineRef.current?.setEffects({ shake, particles });
  }, [shake, particles]);

  // 특수 발판 표식 (색약 대응) 설정
  const markers = data.settings.specialPlatformMarker;
  useEffect(() => {
    engineRef.current?.setMarkers(markers);
  }, [markers]);

  // 에디터에서 발판을 바꾸거나 테마를 바꾸면 바로 반영 (기본 발판은 테마마다 다르다)
  useEffect(() => {
    engineRef.current?.setPlatformSprites(resolvePlatforms(data.platforms, data.settings.theme));
  }, [data.platforms, data.settings.theme]);

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
  // 동료 선택창이 떠 있는 동안에도 게임 중 HUD(점수)를 그대로 보여준다
  const inGame = !ready;
  const sceneStyle = { "--ground": `${layout.groundHeight}px`, background: SCENE[theme].cssBackground } as CSSProperties;

  return (
    <>
    <main className={styles.screen} style={sceneStyle} inert={drawing !== null || minigame !== null}>
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
              <span className="visually-hidden">높이 </span>
              <span className={`${styles.scoreValue} ${scoreSize(score) ? styles[scoreSize(score)] : ""}`}>{formatScore(score)}</span>
              <span className={styles.scoreUnit} aria-hidden="true">m</span>
              <span className="visually-hidden">미터</span>
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
            {updateReady && (
              <div className={styles.banner}>
                <InlineMessage
                  tone="info"
                  title="새 버전이 있어요"
                  action={
                    <Button variant="primary" icon="download" onClick={applyUpdate}>
                      업데이트
                    </Button>
                  }
                >
                  누르면 바로 새로고침돼요. 그림과 기록은 그대로예요.
                </InlineMessage>
              </div>
            )}
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
            {touchDevice && <InstallButton variant="ghost" />}
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
        hero={data.hero.base}
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

      {regionBanner && !ready && <RegionBanner id={regionBanner.id} name={regionBanner.name} />}

      {resumeCount !== null && resumeCount > 0 && (
        <div className={styles.resumeCount} aria-hidden="true">
          <span key={resumeCount}>{resumeCount}</span>
        </div>
      )}

      <CompanionPrompt
        prompt={prompt && !covered ? { slot: prompt.slot, data: slots[prompt.slot - 1] } : null}
        onYes={acceptCompanion}
        onEdit={startDrawing}
        onNo={() => refuseCompanion(true)}
        onDismiss={() => refuseCompanion(false)}
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
            {/* 효과음은 일시정지 메뉴에서 바로 끌 수 있다 (기획서 12번) */}
            <div className={styles.menuSwitch}>
              <Switch label="효과음" checked={sfxOn} onChange={toggleSfx} />
            </div>
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

    {minigame && (
      <div className={styles.drawing} inert={covered}>
        <MinigameScreen
          slot={minigame.slot}
          hero={data.hero}
          companion={slots[minigame.slot - 1]?.character ?? null}
          previous={lastMinigame.current}
          onDone={finishMinigame}
        />
      </div>
    )}

    {drawing && (
      <div className={styles.drawing} inert={covered}>
        <EditorScreen
          companion={{ slot: drawing.slot, inGame: true, onSaved: finishDrawing }}
          onClose={cancelDrawing}
        />
      </div>
    )}
    </>
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
            <dt>{RECORD_LABEL.withCompanions}</dt>
            <dd>{formatScore(best.withCompanions)}m</dd>
          </div>
        )}
        {best.solo > 0 && (
          <div>
            <dt>{RECORD_LABEL.solo}</dt>
            <dd>{formatScore(best.solo)}m</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

