"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "@/game/config";
import { FixedStepLoop } from "@/game/loop";
import { createMinigame, MINIGAMES, pickMinigame, type MiniEvent, type MinigameId, type MinigameLogic } from "@/game/minigames";
import { drawMinigame, MINIGAME_BG } from "@/game/minigames/draw";
import { ARENA } from "@/game/minigames/types";
import { COMPANION_QUESTION } from "@/game/presets";
import { InputController } from "@/input/controller";
import type { Character } from "@/lib/schema";
import { Button, IconButton } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { PixelIcon, type PixelIconName } from "./ui/PixelIcon";
import { useToast } from "./ui/Toast";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./MinigameScreen.module.css";

type Props = {
  /** 합류할 동료 슬롯 (1~5) */
  slot: number;
  hero: Character;
  companion: Character | null;
  /** 바로 앞에 했던 미니게임 (되도록 다른 걸 낸다) */
  previous?: MinigameId | null;
  /** 결과 창에서 "계속하기" */
  onDone: (result: { success: boolean; id: MinigameId }) => void;
};

type Phase = "countdown" | "playing" | "paused" | "result";

/**
 * 미니게임 한 판 (기획서 8번). 랜덤 1종, 재도전 없음.
 * 카운트다운 3초 동안 조작법을 그림 + 글로 보여주고 → 플레이 → 결과 텍스트.
 * 창을 벗어나거나 Esc·P를 누르면 멈추고, 다시 시작할 때도 카운트다운을 한다 (재도전이 없으니 공정하게).
 */
export function MinigameScreen({ slot, hero, companion, previous, onDone }: Props) {
  const [game] = useState<MinigameLogic>(() => createMinigame(pickMinigame(Math.random, previous), Math.random));
  const info = MINIGAMES[game.id];
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState<number>(CONFIG.minigame.countdown);
  const [current, setCurrent] = useState(0);
  const [lives, setLives] = useState(game.lives);
  const { announce } = useToast();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(any-pointer: coarse)");
  const fine = useMediaQuery("(any-pointer: fine)");
  const showPc = fine || !touch;

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const tapsRef = useRef(0);
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const looksRef = useRef({ hero: hero.frames[0], companion: companion?.frames[0] ?? COMPANION_QUESTION });
  looksRef.current = { hero: hero.frames[0], companion: companion?.frames[0] ?? COMPANION_QUESTION };

  const pause = useCallback(() => {
    if (phaseRef.current === "playing") setPhase("paused");
  }, []);

  // ── 카운트다운 (시작 전 · 멈춘 뒤 다시 시작) ──
  useEffect(() => {
    if (phase !== "countdown") return;
    announceRef.current(count > 0 ? String(count) : "시작!");
    if (count === 0) {
      setPhase("playing");
      setCount(CONFIG.minigame.countdown);
      canvasRef.current?.focus({ preventScroll: true });
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  // 처음 열릴 때 무슨 게임인지 알린다 (숫자 읽기보다 먼저)
  useEffect(() => {
    announceRef.current(`미니게임 ${info.name}. ${info.goal}`);
  }, [info]);

  // ── 루프 · 입력 · 그리기 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !box || !ctx) return;

    let view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 1, h: 1 };
    const fit = () => {
      const { width, height } = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const scale = Math.min(width / ARENA.width, height / ARENA.height);
      view = { scale, ox: (width - ARENA.width * scale) / 2, oy: (height - ARENA.height * scale) / 2, dpr, w: width, h: height };
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    const input = new InputController({
      element: canvas,
      clientToLogicalX: (clientX) => (clientX - canvas.getBoundingClientRect().left - view.ox) / view.scale,
      logicalPerCssPx: () => 1 / view.scale,
      onAction: (a) => {
        if (a === "confirm" && phaseRef.current === "playing") tapsRef.current += 1;
        else if (a === "pause" || a === "autoPause") pause();
      },
    });
    input.attach();
    // 탭·클릭 (터치·마우스·펜 모두). 키보드 Space/Enter는 위 confirm으로
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (phaseRef.current === "playing") tapsRef.current += 1;
    };
    canvas.addEventListener("pointerdown", onDown);

    let time = 0;
    const handle = (events: MiniEvent[]) => {
      for (const e of events) {
        if (e.type === "progress") {
          setCurrent(e.current);
          if (game.id !== "dodge" || e.current % 5 === 0) announceRef.current(info.progress(e.current, game.goal));
        } else if (e.type === "hit") {
          setLives(e.lives);
          if (e.lives > 0) announceRef.current(`앗! 목숨 ${e.lives}개 남았어요`);
        } else if (e.type === "end") {
          setPhase("result");
          announceRef.current(e.success ? "성공!" : "실패");
        }
      }
    };

    const loop = new FixedStepLoop(
      (dt) => {
        time += dt;
        if (phaseRef.current !== "playing") {
          input.consumeIntent();
          tapsRef.current = 0;
          return;
        }
        const taps = tapsRef.current;
        tapsRef.current = 0;
        handle(game.step(dt, { move: input.consumeIntent(), taps }));
      },
      () => {
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.fillStyle = MINIGAME_BG[game.id];
        ctx.fillRect(0, 0, view.w, view.h);
        ctx.translate(view.ox, view.oy);
        ctx.scale(view.scale, view.scale);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, ARENA.width, ARENA.height);
        ctx.clip();
        drawMinigame(ctx, game, looksRef.current, { time, reducedMotion: reducedRef.current });
        ctx.restore();
      },
    );
    loop.start();

    return () => {
      loop.stop();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      input.detach();
    };
  }, [game, info, pause]);

  const success = game.status === "success";
  const controlIcon: PixelIconName = info.control === "tap" ? "hand" : "move";

  return (
    <div className={styles.screen}>
      <header className={styles.hud}>
        <h1 className={styles.title}>{info.name}</h1>
        <p className={styles.progress}>
          <span className="visually-hidden">진행 </span>
          {info.progress(current, game.goal)}
        </p>
        <p className={styles.lives}>
          <span className="visually-hidden">목숨 {lives}개</span>
          {/* 잃은 목숨은 빈 하트(옅게 + 점선 테두리)로: 색만으로 구분하지 않는다 */}
          {Array.from({ length: initialLives(game) }, (_, i) => (
            <span key={i} className={i < lives ? styles.heart : styles.lost}>
              <PixelIcon name="heart" size={18} />
            </span>
          ))}
        </p>
        <IconButton icon="pause" label="일시정지" onClick={pause} disabled={phase !== "playing"} />
      </header>

      <div ref={boxRef} className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={0}
          role="application"
          aria-label={`미니게임 ${info.name}: ${info.goal}. ${info.touch}. 키보드는 ${info.pc}.`}
        />

        {phase === "countdown" && (
          <div className={styles.intro}>
            <p className={styles.introTitle}>동료 {slot}번과 함께하려면</p>
            <p className={styles.goal}>
              <PixelIcon name="star" size={18} />
              {info.goal}
            </p>
            <ul className={styles.ways}>
              {touch && (
                <li>
                  <PixelIcon name={controlIcon} size={22} />
                  {info.touch}
                </li>
              )}
              {showPc && (
                <li>
                  <PixelIcon name={info.control === "tap" ? "mouse" : "move"} size={22} />
                  {info.pc}
                </li>
              )}
            </ul>
            <p key={count} className={styles.count} aria-hidden="true">
              {count > 0 ? count : "시작!"}
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={phase === "paused"}
        title="잠깐 멈췄어요"
        description="계속하면 3초 뒤에 다시 시작해요."
        onClose={() => setPhase("countdown")}
        actions={
          <Button variant="primary" size="lg" icon="play" block data-autofocus onClick={() => setPhase("countdown")}>
            계속하기
          </Button>
        }
      />

      <Dialog
        open={phase === "result"}
        title={success ? "함께하게 됐어요!" : "아쉬워요!"}
        description={
          success
            ? `동료 ${slot}번이 대열에 들어와요.`
            : "이번엔 함께하지 못했어요. 그린 그림은 남아 있으니 다음 동료 기회에 다시 도전해요."
        }
        onClose={() => onDone({ success, id: game.id })}
        showClose={false}
        actions={
          <Button variant="primary" size="lg" icon={success ? "check" : "play"} block data-autofocus onClick={() => onDone({ success, id: game.id })}>
            계속하기
          </Button>
        }
      />
    </div>
  );
}

/** 처음 목숨 수 (잃은 하트를 빈 하트로 보여주려고) */
function initialLives(g: MinigameLogic) {
  return CONFIG.minigame[g.id].lives;
}
