import { canOfferCompanion, candidateHeight } from "./companions";
import { CONFIG } from "./config";
import { cameraRatioFor, formationSize } from "./formation";
import { regionIndexAt } from "./regions";
import { stepMover, type Mover } from "../input/movement";
import type { MoveIntent } from "../input/controller";

/**
 * 게임 세계 (DOM 없는 순수 로직 — 테스트 가능).
 * 좌표: x는 판정 영역(폭 360) 기준 왼쪽 끝, y는 위로 갈수록 커지는 높이(바닥 윗면 = 0).
 * 카메라 cameraY는 "화면 맨 아래"의 세계 높이다.
 */

export type PlatformKind = "ground" | "basic" | "highJump" | "oneTime" | "moving";

export type Platform = {
  id: number;
  kind: PlatformKind;
  x: number;
  /** 윗면 높이 */
  y: number;
  width: number;
  /** 한 번이라도 밟았는지 (처음 밟았을 때만 착지 이벤트 first) */
  touched: boolean;
  /**
   * 부서진 뒤 지난 시간. 부서진 발판은 밟을 수 없고 잠시 뒤 사라진다.
   * 음수면 무너지기 직전(일회용 아래 발판이 차례를 기다리며 흔들리는 중) — 이때도 밟을 수 없다
   */
  broken?: number;
  /** 움직이는 발판의 가로 빠르기(px/초, 부호 = 방향). 벽에 닿으면 돌아선다 */
  vx?: number;
};

/**
 * 동료 후보 블록 (기획서 7-2). 발판 위에 떠 있고, 대열이 닿으면 선택창을 연다.
 * - active: 닿으면 선택창
 * - dismissed: 선택창을 띄웠거나 "아니오"를 눌렀음. 대열이 한 번 떨어졌다가 다시 닿으면 다시 물어본다
 * - fading: 조건(C < M)이 사라져 조용히 사라지는 중
 */
export type Candidate = {
  id: number;
  /** 가운데 x, 아래쪽 y (세계 좌표) */
  x: number;
  y: number;
  state: "active" | "dismissed" | "fading";
  /** fading 경과 시간 */
  fade: number;
  /** 이 후보에서 거절을 이미 셌는지 (같은 블록은 한 번만) */
  refusalCounted: boolean;
};

export type WorldEvent =
  | { type: "land"; platform: Platform; first: boolean }
  | { type: "score"; score: number }
  | { type: "gameover"; score: number }
  /** 새 지역에 처음 들어옴 (한 판에 지역마다 한 번) */
  | { type: "region"; index: number }
  /** 대열이 동료 후보에 닿음. slot = 합류하면 들어갈 동료 슬롯 번호(1~5) */
  | { type: "candidate"; candidate: Candidate; slot: number };

export type Rng = () => number;

/** 시드가 있는 난수 (테스트에서 같은 발판 배치를 재현하려고) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 바닥 윗면 기준 높이(px) → m (점수 단위, 내림) */
export function toMeters(height: number) {
  return Math.floor(Math.max(0, height) / CONFIG.score.pxPerMeter);
}

/** 이 높이(m)에 만드는 발판의 종류 (높이대별 확률표, 기획서 3-4) */
export function pickKind(meters: number, roll: number): PlatformKind {
  let row: (typeof CONFIG.special.table)[number] = CONFIG.special.table[0];
  for (const r of CONFIG.special.table) if (meters >= r.from) row = r;
  if (roll < row.highJump) return "highJump";
  if (roll < row.highJump + row.oneTime) return "oneTime";
  if (roll < row.highJump + row.oneTime + row.moving) return "moving";
  return "basic";
}

/** 최대 점프 높이 = v² / 2g */
export function maxJumpHeight() {
  const { gravity, jumpVelocity } = CONFIG.physics;
  return (jumpVelocity * jumpVelocity) / (2 * gravity);
}

/** 높이에 따른 발판 간격 상한 (최대 점프 높이의 maxGapRatio를 넘지 않는다) */
export function gapAt(height: number) {
  const w = CONFIG.world;
  const cap = maxJumpHeight() * w.maxGapRatio;
  const t = Math.max(0, Math.min(1, height / w.gapGrowthHeight));
  return w.minGap + (cap - w.minGap) * t;
}

export type WorldOptions = {
  rng: Rng;
  /** 판정 영역 높이(640~840)와 실제로 보이는 논리 높이 (길쭉한 폰은 더 크다) */
  playHeight: number;
  viewHeight: number;
  /** 판 시작 때의 동료 최대 인원 M (설정 화면에서 바꾼 값은 다음 판부터) */
  companionMax?: number;
};

export class World {
  readonly rng: Rng;
  playHeight: number;
  viewHeight: number;

  /** 대열 전체. x는 대열 왼쪽 끝, y는 맨 아래 줄 발밑 높이 */
  hero: Mover & { y: number; vy: number } = { x: 0, vx: 0, y: 0, vy: 0 };
  /** 보간용 이전 스텝 값 */
  prev = { x: 0, y: 0, cameraY: 0 };
  platforms: Platform[] = [];
  candidates: Candidate[] = [];
  cameraY = 0;
  /** 점수 = 이번 판에서 올라간 가장 높은 곳(m). 떨어져도 줄지 않는다 */
  score = 0;
  over = false;
  /** 이번 판에서 들어와 본 가장 먼 지역 */
  region = 0;
  /** 지금 동료 수 C (0~5). 판이 끝나면 0으로 (저장하지 않는 런타임 상태) */
  companions = 0;
  /** 동료 최대 인원 M. 판 도중엔 자동 설정으로만 바뀐다 */
  companionMax: number;
  /** 판 시작 때의 M (동료 없음 사용자의 발판 폭 보정 기준) */
  private readonly companionMaxAtStart: number;
  private nextId = 1;
  private topY = 0;
  /** 다음 후보 순번 (candidateHeight(n)) */
  private nextCandidate = 0;

  constructor(opts: WorldOptions) {
    this.rng = opts.rng;
    this.playHeight = opts.playHeight;
    this.viewHeight = opts.viewHeight;
    this.companionMax = opts.companionMax ?? CONFIG.companion.defaultMax;
    this.companionMaxAtStart = this.companionMax;
    this.reset();
  }

  /** 대열 크기. 착지 판정은 맨 아래 줄(주인공 + 동료1)의 폭 (기획서 3-2) */
  get formation() {
    return formationSize(this.companions);
  }

  get platformWidth() {
    const w = CONFIG.world;
    const solo = this.companionMaxAtStart === 0 ? w.platformWidthBonusSolo : 0;
    return CONFIG.platform.width + solo - w.platformWidthShrinkPerCompanion * this.companions;
  }

  setView(playHeight: number, viewHeight: number) {
    this.playHeight = playHeight;
    this.viewHeight = viewHeight;
    this.spawn();
  }

  /** 바닥 위 가운데에 서 있는 처음 상태 (동료 0명) */
  reset() {
    const w = CONFIG.view.width;
    this.companions = 0;
    this.hero = { x: (w - this.formation.width) / 2, vx: 0, y: 0, vy: 0 };
    // 바닥 윗면이 시작 장면과 같은 위치에 오도록 (화면 아래에서 groundHeight만큼 위)
    this.cameraY = -CONFIG.view.groundHeight;
    this.prev = { x: this.hero.x, y: 0, cameraY: this.cameraY };
    this.score = 0;
    this.over = false;
    this.region = 0;
    this.nextId = 1;
    this.nextCandidate = 0;
    this.candidates = [];
    this.platforms = [{ id: 0, kind: "ground", x: -w, y: 0, width: w * 3, touched: true }];
    this.topY = CONFIG.world.firstPlatformY - gapAt(0);
    this.spawn();
  }

  /** 바닥에서 첫 점프 */
  launch() {
    this.hero.vy = CONFIG.physics.jumpVelocity;
  }

  // ── 동료 ──

  /** 합류 (선택창 "예" → 미니게임 성공): 다음 슬롯에. 대열이 넓어지면 벽 안쪽으로 밀어 넣는다 */
  acceptCandidate(id: number) {
    this.candidates = this.candidates.filter((c) => c.id !== id);
    if (this.companions >= CONFIG.companion.maxCount) return;
    this.companions += 1;
    const maxX = CONFIG.view.width - this.formation.width;
    if (this.hero.x > maxX) this.hero.x = maxX;
    this.prev.x = this.hero.x;
    this.refreshCandidates();
  }

  /**
   * 선택창 "아니오"(또는 닫기): 그 구슬은 사라진다.
   * @param count 거절로 셀지 (Esc·닫기처럼 명시적으로 "아니오"를 고르지 않은 경우는 false)
   * @returns 이번에 거절로 새로 셌는지 (같은 블록은 한 번만)
   */
  refuseCandidate(id: number, count = true): boolean {
    const c = this.candidates.find((x) => x.id === id);
    if (!c) return false;
    // 거절한 구슬은 조용히 사라진다 (같은 구슬이 다시 묻지 않게, 사용자 요청)
    c.state = "fading";
    if (!count) return false;
    const first = !c.refusalCounted;
    c.refusalCounted = true;
    return first;
  }

  /** 그리다 그만둠: 구슬은 그 자리에 남는다 (다시 닿으면 초안을 이어 그릴 수 있게) */
  keepCandidate(id: number) {
    const c = this.candidates.find((x) => x.id === id);
    if (c) c.state = "dismissed";
  }

  /** 미니게임 실패: 그 후보는 없어진다. 그린 그림은 슬롯에 남아 다음 후보가 그 모습으로 나온다 (기획서 7-4) */
  dropCandidate(id: number) {
    this.candidates = this.candidates.filter((c) => c.id !== id);
  }

  /** 자동 설정 등으로 M이 바뀜. 조건이 거짓이 되면 화면의 후보를 조용히 없앤다 (기획서 7-2) */
  setCompanionMax(m: number) {
    this.companionMax = m;
    this.refreshCandidates();
  }

  private refreshCandidates() {
    if (canOfferCompanion(this.companions, this.companionMax)) return;
    for (const c of this.candidates) c.state = "fading";
  }

  private overlapsCandidate(c: Candidate) {
    const size = CONFIG.companion.candidateSize;
    const f = this.formation;
    const h = this.hero;
    return h.x < c.x + size / 2 && h.x + f.width > c.x - size / 2 && h.y < c.y + size && h.y + f.height > c.y;
  }

  /**
   * 게임 속도 배율: 새 지역에 들어갈 때마다 조금씩 빨라진다 (난이도). 시간을 빠르게 흘려서
   * 점프 높이·발판 간격(= 닿을 수 있는 거리)은 그대로이고 반응할 시간만 줄어든다.
   */
  get speed() {
    const list = CONFIG.regions.speedScale;
    return list[Math.min(this.region, list.length - 1)];
  }

  step(realDt: number, intent: MoveIntent): WorldEvent[] {
    if (this.over) return [];
    const dt = realDt * this.speed;
    const events: WorldEvent[] = [];
    const h = this.hero;
    const f = this.formation;
    this.prev = { x: h.x, y: h.y, cameraY: this.cameraY };

    // 좌우 이동: 대열 폭 기준으로 벽에서 멈춤 (반대편 등장 없음)
    stepMover(h, intent, dt, 0, CONFIG.view.width - f.width, f.width / 2);

    // 움직이는 발판: 좌우 벽 사이를 오간다 (착지 판정 전에 옮긴다)
    for (const p of this.platforms) {
      if (p.vx === undefined) continue;
      p.x += p.vx * dt;
      const maxX = CONFIG.view.width - p.width;
      if (p.x < 0) {
        p.x = -p.x;
        p.vx = Math.abs(p.vx);
      } else if (p.x > maxX) {
        p.x = 2 * maxX - p.x;
        p.vx = -Math.abs(p.vx);
      }
    }

    // 중력
    const prevFeet = h.y;
    h.vy -= CONFIG.physics.gravity * dt;
    h.y += h.vy * dt;

    // 단방향 발판: 내려올 때, 이전 스텝엔 윗면 위였고 지금은 아래일 때만. 판정은 맨 아래 줄 발밑·폭
    if (h.vy <= 0) {
      let hit: Platform | null = null;
      for (const p of this.platforms) {
        if (p.broken !== undefined) continue;
        if (prevFeet < p.y || h.y > p.y) continue;
        if (h.x + f.width <= p.x || h.x >= p.x + p.width) continue;
        if (!hit || p.y > hit.y) hit = p;
      }
      if (hit) {
        h.y = hit.y;
        const boost = hit.kind === "highJump" ? CONFIG.special.highJumpVelocityMultiplier : 1;
        h.vy = CONFIG.physics.jumpVelocity * boost;
        const first = !hit.touched;
        hit.touched = true;
        if (hit.kind === "oneTime") {
          hit.broken = 0;
          // 아래 발판은 모두 무너진다 (가까운 것부터 차례로). 놓치면 돌아갈 곳 없이 끝 — 갇혀서 계속 튀기만 하는 일이 없다
          for (const p of this.platforms) {
            if (p.broken === undefined && p.y < hit.y) p.broken = -(hit.y - p.y) / CONFIG.special.collapseWaveSpeed;
          }
          // 무너진 발판 위 후보 구슬도 조용히 사라진다 (떨어지는 도중 닿아서 선택창이 뜨지 않게). 후보 id = 발판 id
          for (const c of this.candidates) {
            const p = this.platforms.find((x) => x.id === c.id);
            if (p && p.broken !== undefined && p !== hit) c.state = "fading";
          }
        }
        events.push({ type: "land", platform: hit, first });
      }
    }

    // 점수: 맨 아래 줄 발밑이 올라간 가장 높은 곳(m). 공중에서 올라간 높이도 친다
    const meters = toMeters(h.y);
    if (meters > this.score) {
      this.score = meters;
      events.push({ type: "score", score: this.score });
      // 경계를 넘으면 새 지역 (한 번에 여러 경계를 넘을 일은 없지만 혹시 몰라 하나씩)
      const reached = regionIndexAt(this.score);
      while (this.region < reached) {
        this.region += 1;
        events.push({ type: "region", index: this.region });
      }
    }

    // 카메라: 위로만. 맨 아래 줄 발밑이 화면 위에서 (줄 수에 따른) 비율 위치에 오도록
    const target = h.y - this.playHeight * (1 - cameraRatioFor(this.companions));
    if (target > this.cameraY) this.cameraY = target;

    // 부서진 발판: (차례를 기다렸다가) 잠깐 떨어지는 모습을 보여준 뒤 없앤다
    for (const p of this.platforms) if (p.broken !== undefined) p.broken += dt;
    const breakTime = CONFIG.special.oneTimeBreakDuration;

    this.spawn();
    const floor = this.cameraY - CONFIG.world.removeBelow;
    this.platforms = this.platforms.filter((p) => p.y >= floor && (p.broken === undefined || p.broken < breakTime));

    // 후보: 사라지는 중이면 시간만, 닿으면 선택창. 화면 밖으로 지나가면 그냥 없어진다 (다음 후보로)
    for (const c of this.candidates) {
      if (c.state === "fading") {
        c.fade += dt;
        continue;
      }
      const touching = this.overlapsCandidate(c);
      if (c.state === "dismissed" && !touching) c.state = "active";
      else if (c.state === "active" && touching && canOfferCompanion(this.companions, this.companionMax)) {
        c.state = "dismissed"; // 선택창이 닫힌 뒤 대열이 떨어질 때까지 다시 부르지 않게
        events.push({ type: "candidate", candidate: c, slot: this.companions + 1 });
      }
    }
    const fadeTime = CONFIG.companion.candidateFade;
    this.candidates = this.candidates.filter((c) => c.y + CONFIG.companion.candidateSize >= floor && c.fade < fadeTime);

    // 대열 전체가 화면 아래로 벗어나면 끝
    if (h.y + f.height < this.cameraY) {
      this.over = true;
      events.push({ type: "gameover", score: this.score });
    }
    return events;
  }

  /** 화면 위쪽까지 발판을 채운다. 후보 높이를 처음 넘는 발판엔 후보 블록을 올린다 */
  private spawn() {
    const limit = this.cameraY + this.viewHeight + CONFIG.world.spawnAhead;
    while (this.topY < limit) {
      const width = this.platformWidth;
      const gap = gapAt(this.topY) * (1 - CONFIG.world.gapJitter * this.rng());
      this.topY += gap;
      const meters = toMeters(this.topY);
      const hasCandidate = meters >= candidateHeight(this.nextCandidate);
      while (meters >= candidateHeight(this.nextCandidate)) this.nextCandidate += 1;
      // 후보가 올라가는 발판은 부서지지 않는 기본 발판으로
      const kind = hasCandidate ? "basic" : pickKind(meters, this.rng());
      const x = this.rng() * (CONFIG.view.width - width);
      const id = this.nextId++;
      // 움직이는 발판: 방향·빠르기는 발판마다 다르게
      const m = CONFIG.special.moving;
      const vx = kind === "moving" ? (this.rng() < 0.5 ? -1 : 1) * (m.speedMin + (m.speedMax - m.speedMin) * this.rng()) : undefined;
      this.platforms.push(vx === undefined ? { id, kind, x, y: this.topY, width, touched: false } : { id, kind, x, y: this.topY, width, touched: false, vx });
      // 후보는 C < M일 때만 생긴다 (M = 0이면 처음부터 없음)
      if (hasCandidate && canOfferCompanion(this.companions, this.companionMax)) {
        this.candidates.push({
          id,
          x: x + width / 2,
          y: this.topY + CONFIG.companion.candidateLift,
          state: "active",
          fade: 0,
          refusalCounted: false,
        });
      }
    }
  }
}
