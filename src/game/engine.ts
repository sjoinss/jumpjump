import { drawBackground, drawGround } from "./background";
import { CONFIG } from "./config";
import { FixedStepLoop } from "./loop";
import { regionBlendAt } from "./regions";
import { memberCell } from "./formation";
import { COMPANION_QUESTION } from "./presets";
import { drawSprite } from "./sprites";
import { DEFAULT_THEME, SCENE, type ScenePalette, type ThemeId } from "./themes";
import { computeViewport, type Viewport } from "./viewport";
import { mulberry32, World, type Candidate, type Platform } from "./world";
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
  /** 대열이 동료 후보에 닿음 → 게임이 멈추고 React가 선택창을 연다 (기획서 7-4) */
  onCandidate?: (c: { id: number; slot: number }) => void;
};

/** 판을 시작할 때 정해지는 값 */
export type RunOptions = { companionMax: number };

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
  /** 동료 슬롯 1~5의 그림 (없으면 null → 물음표 방울) */
  private companionLooks: (Character | null)[] = [];
  /** 합류 연출: 대열 몇 번째 멤버가 몇 초 남았는지 */
  private joinPop = new Map<number, number>();
  private runOptions: RunOptions = { companionMax: CONFIG.companion.defaultMax };

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
      companionMax: this.runOptions.companionMax,
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

  setCompanionLooks(looks: (Character | null)[]) {
    this.companionLooks = looks;
    this.render(0);
  }

  get companions() {
    return this.world.companions;
  }

  /** 선택창 "예"·"수정하기" → 동료 그리기 화면. 그리는 동안에도 게임은 멈춰 있다 */
  beginDrawing() {
    if (this.phase === "companionPrompt") this.setPhase("drawing");
  }

  /** 그림이 정해지면 미니게임 (게임은 계속 멈춰 있다) */
  beginMinigame() {
    if (this.phase === "companionPrompt" || this.phase === "drawing") this.setPhase("minigame");
  }

  /** 미니게임 실패: 후보는 없어지고(다음 후보로) 게임오버 없이 이어 간다. 거절로 세지 않음 */
  failCandidate(id: number) {
    this.world.dropCandidate(id);
    this.backToPlay();
  }

  /** 미니게임 성공 → 합류. 합류 연출 후 게임을 이어 간다 */
  acceptCandidate(id: number) {
    this.world.acceptCandidate(id);
    this.joinPop.set(this.world.companions, CONFIG.companion.joinPop);
    this.backToPlay();
  }

  /**
   * 선택창 "아니오" 또는 그리기 그만두기. count=false면 거절로 세지 않고 닫기만 (그리기 취소도 세지 않음).
   * @returns 이번에 거절로 셌는지
   */
  refuseCandidate(id: number, count = true) {
    const counted = this.world.refuseCandidate(id, count);
    this.backToPlay();
    return counted;
  }

  private backToPlay() {
    if (this.phase === "companionPrompt" || this.phase === "drawing" || this.phase === "minigame") this.setPhase("playing");
  }

  /** 자동 설정으로 동료 최대 인원이 바로 바뀜 (조건이 사라진 후보는 조용히 사라진다) */
  setCompanionMax(m: number) {
    this.world.setCompanionMax(m);
    this.runOptions = { ...this.runOptions, companionMax: m };
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

  start(opts: RunOptions) {
    if (this.phase !== "ready") return;
    // 동료 최대 인원은 판을 시작할 때 정한다 (설정에서 바꾼 값은 다음 판부터)
    this.runOptions = opts;
    this.world.setCompanionMax(opts.companionMax);
    this.world.launch();
    this.setPhase("playing");
    this.events.onRegion?.(0);
  }

  /** 게임오버 후 "다시 하기": 바닥에서 바로 다시 출발 */
  restart(opts: RunOptions) {
    this.runOptions = opts;
    this.world = this.createWorld();
    this.landingTimer = 0;
    this.blend = 0;
    this.joinPop.clear();
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
    for (const [m, t] of this.joinPop) {
      if (t - dt <= 0) this.joinPop.delete(m);
      else this.joinPop.set(m, t - dt);
    }
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
      else if (e.type === "candidate") {
        // 선택창이 열려 있는 동안 게임은 멈춘다
        this.setPhase("companionPrompt");
        this.events.onCandidate?.({ id: e.candidate.id, slot: e.slot });
        return;
      } else if (e.type === "gameover") {
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

    // 동료 후보
    for (const c of world.candidates) this.drawCandidate(c, vp.playX, screenY);

    // 대열 (주인공 + 동료). 위 줄부터 그린다
    const { width: cw, height: ch } = CONFIG.character;
    const x = vp.playX + lerp(world.prev.x, world.hero.x);
    let feet = lerp(world.prev.y, world.hero.y);
    if (this.phase === "ready") feet += this.idleHop();

    if (this.phase === "ready" || feet < 40) {
      // 바닥 근처에서만 그림자 (높이 올라갈수록 작게)
      const shadowW = Math.max(16, 48 - feet * 0.12) * (world.companions > 0 ? 2 : 1);
      ctx.fillStyle = this.scene.shadow;
      ctx.fillRect(Math.round(x + (world.formation.width - shadowW) / 2), Math.round(groundTop - 2), Math.round(shadowW), 6);
    }

    for (let m = world.companions; m >= 0; m--) {
      const { col, row } = memberCell(m);
      const look = m === 0 ? this.hero : this.companionLooks[m - 1];
      const frames = look?.frames ?? [COMPANION_QUESTION];
      const sprite = this.landingTimer > 0 && frames[1] ? frames[1] : frames[0];
      // 합류 연출: 발밑 가운데를 기준으로 작게 시작해 톡 튀어나온다
      const pop = this.joinPop.get(m);
      const s = pop === undefined || this.reducedMotion ? 1 : popScale(1 - pop / CONFIG.companion.joinPop);
      const w = cw * s;
      const h = ch * s;
      const baseX = x + col * cw;
      const bottom = screenY(feet + row * ch);
      drawSprite(ctx, sprite, Math.round(baseX + (cw - w) / 2), Math.round(bottom - h), w, h);
    }
  };

  /**
   * 동료 후보 (기획서 7-3). 그림 없는 슬롯은 물음표 방울, 그림이 있으면 동그란 방울 속 그 동료.
   * 색이 아니라 모양(방울 테두리)과 둥실 움직임으로 구분한다.
   */
  private drawCandidate(c: Candidate, playX: number, screenY: (y: number) => number) {
    const { ctx } = this;
    const size = CONFIG.companion.candidateSize;
    const fadeK = c.state === "fading" ? 1 - c.fade / CONFIG.companion.candidateFade : 1;
    if (fadeK <= 0) return;
    const bob = this.reducedMotion ? 0 : Math.round(Math.sin(this.time * 3 + c.id) * 3);
    const cx = playX + c.x;
    const bottom = screenY(c.y) + bob;
    const look = this.companionLooks[this.world.companions]; // 합류하면 들어갈 다음 슬롯
    ctx.globalAlpha = fadeK;
    if (look) {
      // 방울 테두리 + 그 동료 그림
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.strokeStyle = "#3d2c5e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, bottom - size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawSprite(ctx, look.frames[0], Math.round(cx - 24), Math.round(bottom - size / 2 - 27), 48, 54);
    } else {
      drawSprite(ctx, COMPANION_QUESTION, Math.round(cx - 32), Math.round(bottom - 72), 64, 72);
    }
    ctx.globalAlpha = 1;
  }

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

/** 0→1 진행도에 따라 살짝 넘쳤다 돌아오는 크기 (합류 연출) */
function popScale(t: number) {
  const c = 1.7;
  const k = t - 1;
  return Math.max(0.2, 1 + (c + 1) * k * k * k + c * k * k);
}

const ARROW_MARK =["...#...", "..###..", ".#####.", "#######", "..###..", "..###.."];
const CRACK_MARK = ["#...#...#", ".#.#.#.#.", "..#...#.."];
