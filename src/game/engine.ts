import { drawBackground, drawGround } from "./background";
import { CONFIG } from "./config";
import { FixedStepLoop } from "./loop";
import { regionBlendAt } from "./regions";
import { drawSprite } from "./sprites";
import { DEFAULT_THEME, SCENE, type ScenePalette, type ThemeId } from "./themes";
import { computeViewport, type Viewport } from "./viewport";
import { mulberry32, World, type Platform } from "./world";
import { InputController, type InputAction } from "../input/controller";
import type { Character, Platforms } from "../lib/schema";

/**
 * 게임 상태 머신 (기획서 2번 + 시작 장면).
 * ready(시작 장면) → playing → (companionPrompt → drawing → minigame → result) → playing → gameover
 */
export type Phase = "ready" | "playing" | "paused" | "companionPrompt" | "drawing" | "minigame" | "result" | "gameover";

/** React 쪽 오버레이(시작 카드 등)를 캔버스 장면에 맞춰 놓기 위한 값 (CSS px) */
export type SceneLayout = { scale: number; groundHeight: number };

/** 착지 이벤트. 착지 프레임·효과음·파티클이 모두 이것 하나를 듣는다 (기획서 20-7) */
export type LandEvent = { platform: Platform; first: boolean };
type LandListener = (e: LandEvent) => void;

export type EngineEvents = {
  onPhaseChange?: (phase: Phase) => void;
  /** 일시정지 키(Esc/P) 또는 창 포커스 이탈. React가 일시정지 메뉴를 연다 */
  onPauseRequest?: (reason: "key" | "blur") => void;
  onLayout?: (layout: SceneLayout) => void;
  onScore?: (score: number) => void;
  onGameOver?: (score: number) => void;
  /** 새 지역에 들어옴 (게임 시작 때 동굴 포함). React가 지역 이름 배너를 띄운다 */
  onRegion?: (index: number) => void;
};

/**
 * 입력 → World.step(고정 스텝) → 그리기. 게임 규칙은 world.ts에 있고 여기서는 연결과 렌더링만 한다.
 */
export class Engine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly events: EngineEvents;
  private readonly loop: FixedStepLoop;
  private readonly input: InputController;
  private readonly reducedMotion: boolean;
  private readonly landListeners = new Set<LandListener>();
  private viewport: Viewport;
  private world: World;
  private phase: Phase = "ready";
  private hero: Character;
  private platformSprites: Platforms | null = null;
  private scene: ScenePalette = SCENE[DEFAULT_THEME];
  private time = 0;
  /** 착지 프레임을 보여줄 남은 시간 */
  private landingTimer = 0;
  /** 시작 장면에서는 발판을 숨기고, 시작하면 짧게 나타나게 한다 (0 → 1) */
  private platformAlpha = 0;
  /** 화면에 보이는 지역 섞임 위치. 점수로 정한 목표를 천천히 따라간다 */
  private blend = 0;
  /** 특수 발판 표식 (색약 대응, 설정에서 끌 수 있음) */
  private markers = true;

  constructor(canvas: HTMLCanvasElement, hero: Character, events: EngineEvents = {}) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D를 사용할 수 없습니다");
    this.canvas = canvas;
    this.ctx = ctx;
    this.hero = hero;
    this.events = events;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.viewport = computeViewport(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    this.world = this.createWorld();
    this.loop = new FixedStepLoop(this.update, this.render);
    this.input = new InputController({
      element: canvas,
      clientToLogicalX: (clientX) => {
        const rect = this.canvas.getBoundingClientRect();
        return (clientX - rect.left) / this.viewport.scale - this.viewport.playX;
      },
      logicalPerCssPx: () => 1 / this.viewport.scale,
      onAction: this.onAction,
    });
    // 착지 프레임도 착지 이벤트를 듣는 쪽 중 하나
    this.onLand(() => {
      this.landingTimer = CONFIG.character.landingFrameDuration;
    });
  }

  private createWorld() {
    return new World({
      rng: mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0),
      playHeight: this.viewport.playHeight,
      viewHeight: this.viewport.logicalHeight,
    });
  }

  /** 착지 이벤트 구독. 해제 함수를 돌려준다 */
  onLand(fn: LandListener) {
    this.landListeners.add(fn);
    return () => this.landListeners.delete(fn);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.viewport = computeViewport(cssWidth, cssHeight, dpr);
    const { dpr: d, scale } = this.viewport;
    this.canvas.width = Math.round(cssWidth * d);
    this.canvas.height = Math.round(cssHeight * d);
    this.world.setView(this.viewport.playHeight, this.viewport.logicalHeight);
    this.events.onLayout?.({ scale, groundHeight: CONFIG.view.groundHeight * scale });
    this.render(0);
  }

  setTheme(theme: ThemeId) {
    this.scene = SCENE[theme];
    this.render(0);
  }

  setHero(hero: Character) {
    this.hero = hero;
    this.render(0);
  }

  setMarkers(on: boolean) {
    this.markers = on;
    this.render(0);
  }

  setPlatformSprites(platforms: Platforms) {
    this.platformSprites = platforms;
    this.render(0);
  }

  /** 시작 장면. 루프는 배경 애니메이션을 위해 돌지만 입력은 받지 않는다 */
  showReady() {
    this.world = this.createWorld();
    this.platformAlpha = 0;
    this.blend = 0;
    this.landingTimer = 0;
    this.events.onScore?.(0);
    this.setPhase("ready");
  }

  start() {
    if (this.phase !== "ready") return;
    this.world.launch();
    this.setPhase("playing");
    this.events.onRegion?.(0);
  }

  /** 게임오버 후 "다시 하기": 바닥에서 바로 다시 출발 */
  restart() {
    this.world = this.createWorld();
    this.landingTimer = 0;
    this.blend = 0;
    this.events.onScore?.(0);
    this.world.launch();
    this.setPhase("playing");
    this.events.onRegion?.(0);
  }

  pause() {
    if (this.phase === "playing") this.setPhase("paused");
  }

  resume() {
    if (this.phase === "paused") this.setPhase("playing");
  }

  get currentPhase() {
    return this.phase;
  }

  destroy() {
    this.loop.stop();
    this.input.detach();
    this.landListeners.clear();
  }

  private setPhase(next: Phase) {
    this.phase = next;
    // 플레이 중에만 입력을 받는다. 멈추면 키 상태도 비워서 재개 때 튀지 않게 한다
    if (next === "playing") this.input.attach();
    else this.input.detach();
    if (next === "playing" || next === "ready") this.loop.start();
    else {
      this.loop.stop();
      this.render(1);
    }
    this.events.onPhaseChange?.(next);
  }

  private onAction = (action: InputAction) => {
    if (this.phase !== "playing") return;
    if (action === "pause") this.events.onPauseRequest?.("key");
    else if (action === "autoPause") this.events.onPauseRequest?.("blur");
  };

  private update = (dt: number) => {
    this.time += dt;
    if (this.phase !== "ready" && this.platformAlpha < 1) this.platformAlpha = Math.min(1, this.platformAlpha + dt / 0.35);
    if (this.landingTimer > 0) this.landingTimer = Math.max(0, this.landingTimer - dt);
    // 배경 지역: 점수로 정한 목표 위치를 천천히 따라간다 (동작 줄이기면 바로)
    const target = regionBlendAt(this.world.score);
    if (this.reducedMotion) this.blend = target;
    else {
      const step = CONFIG.regions.followSpeed * dt;
      this.blend += Math.max(-step, Math.min(step, target - this.blend));
    }
    if (this.phase !== "playing") return;

    for (const e of this.world.step(dt, this.input.consumeIntent())) {
      if (e.type === "land") this.landListeners.forEach((fn) => fn({ platform: e.platform, first: e.first }));
      else if (e.type === "score") this.events.onScore?.(e.score);
      else if (e.type === "region") this.events.onRegion?.(e.index);
      else if (e.type === "gameover") {
        this.setPhase("gameover");
        this.events.onGameOver?.(e.score);
        return;
      }
    }
  };

  private render = (alpha: number) => {
    const { ctx, world } = this;
    const vp = this.viewport;
    const k = vp.scale * vp.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const cameraY = lerp(world.prev.cameraY, world.cameraY);
    // 세계 높이 → 화면 y (화면 맨 아래 = cameraY)
    const screenY = (y: number) => vp.logicalHeight - (y - cameraY);

    drawBackground(ctx, this.scene, vp.logicalWidth, vp.logicalHeight, {
      blend: this.blend,
      cameraY,
      time: this.time,
      reducedMotion: this.reducedMotion,
    });

    const groundTop = screenY(0);
    if (groundTop < vp.logicalHeight) {
      drawGround(ctx, this.scene, 0, vp.logicalWidth, Math.round(groundTop), vp.logicalHeight - groundTop + 4);
    }

    // 발판 (바닥 제외). 시작 장면에서는 숨긴다
    if (this.platformSprites && this.platformAlpha > 0) {
      ctx.globalAlpha = this.reducedMotion ? 1 : this.platformAlpha;
      const { width, height } = CONFIG.platform;
      for (const p of world.platforms) {
        if (p.kind === "ground") continue;
        const y = screenY(p.y);
        if (y > vp.logicalHeight || y + height < 0) continue;
        const px = Math.round(vp.playX + p.x + (p.width - width) / 2);
        if (p.broken !== undefined) {
          // 부서진 일회용 발판: 떨어지며 흐려진다
          const k = p.broken / CONFIG.special.oneTimeBreakDuration;
          ctx.globalAlpha = this.platformAlpha * Math.max(0, 1 - k);
          drawSprite(ctx, this.platformSprites.oneTime, px, Math.round(y + k * 40), width, height);
          ctx.globalAlpha = this.platformAlpha;
          continue;
        }
        const sprite = p.kind === "highJump" ? this.platformSprites.highJump : p.kind === "oneTime" ? this.platformSprites.oneTime : this.platformSprites.basic;
        drawSprite(ctx, sprite, px, Math.round(y), width, height);
        if (this.markers) this.drawMarker(p.kind, px + width / 2, Math.round(y));
      }
      ctx.globalAlpha = 1;
    }

    // 캐릭터
    const { width: cw, height: ch } = CONFIG.character;
    const x = vp.playX + lerp(world.prev.x, world.hero.x);
    let feet = lerp(world.prev.y, world.hero.y);
    if (this.phase === "ready") feet += this.idleHop();

    if (this.phase === "ready" || feet < 40) {
      // 바닥 근처에서만 그림자 (높이 올라갈수록 작게)
      const shadowW = Math.max(16, 48 - feet * 0.12);
      ctx.fillStyle = this.scene.shadow;
      ctx.fillRect(Math.round(x + (cw - shadowW) / 2), Math.round(groundTop - 2), Math.round(shadowW), 6);
    }

    const frames = this.hero.frames;
    const sprite = this.landingTimer > 0 && frames[1] ? frames[1] : frames[0];
    drawSprite(ctx, sprite, x, Math.round(screenY(feet) - ch), cw, ch);
  };

  /**
   * 색약 대응 표식 (기획서 18): 색만으로 구분하지 않도록 모양으로 알려준다.
   * 고점프 = 위 화살표(살짝 둥실), 일회용 = 금 간 표시(깜빡임). 흰 테두리로 어느 배경에서도 보이게.
   */
  private drawMarker(kind: Platform["kind"], cx: number, top: number) {
    const cell = 3;
    const shape = kind === "highJump" ? ARROW_MARK : kind === "oneTime" ? CRACK_MARK : null;
    if (!shape) return;
    if (kind === "oneTime" && !this.reducedMotion && (this.time * 1.6) % 1 > 0.65) return;
    const bob = kind === "highJump" && !this.reducedMotion ? Math.round(Math.sin(this.time * 5) * 2) : 0;
    const w = shape[0].length * cell;
    const x = Math.round(cx - w / 2);
    const y = kind === "highJump" ? top - shape.length * cell - 4 + bob : top + 12;
    const draw = (dx: number, dy: number, color: string) => {
      this.ctx.fillStyle = color;
      shape.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === "#") this.ctx.fillRect(x + rx * cell + dx, y + ry * cell + dy, cell, cell);
      });
    };
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) draw(dx, dy, "#ffffff");
    draw(0, 0, "#3d2c5e");
  }

  /** 시작 장면에서 제자리 폴짝 (그림만, 판정 없음) */
  private idleHop() {
    if (this.reducedMotion) return 0;
    const { idleHopInterval, idleHopDuration, idleHopHeight } = CONFIG.home;
    const t = (this.time % idleHopInterval) / idleHopDuration;
    return t > 1 ? 0 : 4 * idleHopHeight * t * (1 - t);
  }
}

const ARROW_MARK = ["...#...", "..###..", ".#####.", "#######", "..###..", "..###.."];
const CRACK_MARK = ["#...#...#", ".#.#.#.#.", "..#...#.."];
