import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/game/config";
import { createMinigame, MINIGAME_IDS, MINIGAMES, pickMinigame } from "../src/game/minigames";
import { DodgeGame } from "../src/game/minigames/dodge";
import { FlappyGame } from "../src/game/minigames/flappy";
import { RopeGame } from "../src/game/minigames/rope";
import { ShooterGame } from "../src/game/minigames/shooter";
import { ACTOR, ARENA, type MiniEvent, type MiniInput, type MinigameLogic } from "../src/game/minigames/types";
import { mulberry32 } from "../src/game/world";

const DT = CONFIG.loop.fixedStep;
const IDLE: MiniInput = { move: { kind: "none" }, taps: 0 };

/** 끝나거나 seconds가 지날 때까지 돌린다 */
function play<G extends MinigameLogic>(g: G, seconds: number, pilot: (g: G) => MiniInput = () => IDLE) {
  const events: MiniEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT) && g.status === "playing"; i++) events.push(...g.step(DT, pilot(g)));
  return events;
}

const tap: MiniInput = { move: { kind: "none" }, taps: 1 };
const goTo = (x: number): MiniInput => ({ move: { kind: "target", x }, taps: 0 });

// ── 공통 ──

test("랜덤 출제: 4종 모두 나오고, 바로 앞 게임은 피한다", () => {
  const rng = mulberry32(7);
  const seen = new Set(Array.from({ length: 200 }, () => pickMinigame(rng)));
  assert.deepEqual([...seen].sort(), [...MINIGAME_IDS].sort());
  for (let i = 0; i < 100; i++) assert.notEqual(pickMinigame(rng, "rope"), "rope");
  for (const id of MINIGAME_IDS) {
    const g = createMinigame(id, rng);
    assert.equal(g.id, id);
    assert.equal(g.status, "playing");
    assert.ok(MINIGAMES[id].progress(0, g.goal).length > 0);
  }
});

test("끝난 게임은 더 진행되지 않는다 (재도전 없음)", () => {
  const g = new RopeGame();
  play(g, 30);
  assert.equal(g.status, "fail");
  assert.deepEqual(g.step(DT, tap), []);
});

// ── 줄넘기 ──

/** 줄이 발밑에 오기 약 0.35초 전에 탭 (체공 0.69초의 한가운데) */
function ropePilot(g: RopeGame): MiniInput {
  const frac = g.phase % 1;
  const lead = 0.35 / CONFIG.minigame.rope.period;
  return frac > 0.5 - lead && frac < 0.5 - lead + 0.02 ? tap : IDLE;
}

test("줄넘기: 타이밍 맞춰 뛰면 5번 넘고 성공, 목숨은 그대로", () => {
  const g = new RopeGame();
  const ev = play(g, 20, ropePilot);
  assert.equal(g.status, "success");
  assert.equal(g.current, 5);
  assert.equal(g.lives, CONFIG.minigame.rope.lives);
  assert.deepEqual(ev.at(-1), { type: "end", success: true });
});

test("줄넘기: 판정 창이 넓다 (줄이 오기 0.1~0.6초 전 아무 때나 뛰어도 넘음)", () => {
  for (const lead of [0.1, 0.3, 0.6]) {
    const g = new RopeGame();
    const ahead = lead / CONFIG.minigame.rope.period;
    play(g, 12, (x) => {
      const frac = x.phase % 1;
      return frac > 0.5 - ahead && frac < 0.5 - ahead + 0.01 ? tap : IDLE;
    });
    assert.equal(g.status, "success", `${lead}초 전`);
  }
});

test("줄넘기: 가만히 있으면 줄에 걸려 목숨을 잃고 실패", () => {
  const g = new RopeGame();
  const ev = play(g, 30);
  assert.equal(g.status, "fail");
  assert.deepEqual(
    ev.filter((e) => e.type === "hit").map((e) => e.type === "hit" && e.lives),
    [2, 1, 0],
  );
});

test("줄넘기: 공중에서는 다시 뛸 수 없다", () => {
  const g = new RopeGame();
  g.step(DT, tap);
  const vy = g.vy;
  g.step(DT, tap);
  assert.ok(g.vy < vy, "두 번째 탭은 무시되고 떨어지기 시작");
});

// ── 슈팅 ──

/** 다가오는 적 탄이 있으면 비켜서고, 아니면 적 밑으로 */
function shooterPilot(s: ShooterGame): MiniInput {
  const me = s.player.x + ACTOR.width / 2;
  const threat = s.enemyBullets.find((b) => b.y > s.playerY - 220 && b.y < s.playerY + ACTOR.height && Math.abs(b.x - me) < ACTOR.width);
  if (threat) return goTo(threat.x > me || threat.x > ARENA.width - 80 ? threat.x - 90 : threat.x + 90);
  const target = s.enemies.find((e) => e.alive);
  return target ? goTo(s.enemyX(target)) : IDLE;
}

test("슈팅: 탄을 피하며 적을 따라다니면 10마리 모두 물리치고 성공", () => {
  for (const seed of [1, 2, 3]) {
    const g = new ShooterGame(mulberry32(seed));
    play(g, 60, shooterPilot);
    assert.equal(g.status, "success", `seed ${seed}`);
    assert.equal(g.current, 10);
    assert.ok(g.lives > 0);
  }
});

test("슈팅: 적 탄에 맞으면 목숨 -1, 잠깐 무적이라 연달아 맞지 않음", () => {
  const g = new ShooterGame(mulberry32(1));
  const center = { x: g.player.x + ACTOR.width / 2, y: g.playerY + ACTOR.height / 2 };
  g.enemyBullets = [{ ...center }, { ...center }];
  const ev = g.step(DT, IDLE);
  assert.deepEqual(ev.filter((e) => e.type === "hit"), [{ type: "hit", lives: 2 }]);
  assert.ok(g.invincible > 0);
});

// ── 파닥파닥 ──

function flappyPilot(g: FlappyGame): MiniInput {
  if (!g.started) return tap;
  const next = g.pipes.find((p) => !p.passed);
  const target = next ? next.gapY + 20 : ARENA.height / 2;
  return g.y > target && g.vy >= 0 ? tap : IDLE;
}

test("파닥파닥: 첫 탭 전에는 떠서 기다린다", () => {
  const g = new FlappyGame(mulberry32(1));
  const y = g.y;
  play(g, 5);
  assert.equal(g.y, y);
  assert.equal(g.pipes.length, 0);
  assert.equal(g.status, "playing");
});

test("파닥파닥: 통로를 따라가면 5개 지나고 성공", () => {
  for (const seed of [1, 2, 3, 4]) {
    const g = new FlappyGame(mulberry32(seed));
    play(g, 60, flappyPilot);
    assert.equal(g.status, "success", `seed ${seed}`);
    assert.equal(g.lives, CONFIG.minigame.flappy.lives, `seed ${seed} 한 번도 안 부딪힘`);
  }
});

test("파닥파닥: 한 번 날고 손을 놓으면 바닥에 부딪혀 실패", () => {
  const g = new FlappyGame(mulberry32(1));
  g.step(DT, tap);
  play(g, 30);
  assert.equal(g.status, "fail");
  assert.equal(g.lives, 0);
});

// ── 피하기 ──

function dodgePilot(g: DodgeGame): MiniInput {
  // 아래쪽에 가까운 낙하물들과 가로로 가장 멀리 떨어진 자리로
  const danger = g.fallers.filter((f) => f.y > ARENA.height * 0.35);
  let best = g.player.x + ACTOR.width / 2;
  let bestScore = -1;
  for (let x = ACTOR.width / 2; x <= ARENA.width - ACTOR.width / 2; x += 6) {
    const score = Math.min(999, ...danger.map((f) => Math.abs(f.x - x)));
    const keep = score - Math.abs(x - (g.player.x + ACTOR.width / 2)) * 0.05;
    if (keep > bestScore) {
      bestScore = keep;
      best = x;
    }
  }
  return goTo(best);
}

test("피하기: 피해 다니면 15초 버티고 성공, 1초마다 진행", () => {
  for (const seed of [1, 2, 3]) {
    const g = new DodgeGame(mulberry32(seed));
    const ev = play(g, 20, dodgePilot);
    assert.equal(g.status, "success", `seed ${seed}`);
    assert.equal(g.current, 15);
    assert.equal(ev.filter((e) => e.type === "progress").length, 15);
  }
});

test("피하기: 낙하물에 맞으면 목숨 -1", () => {
  const g = new DodgeGame(mulberry32(1));
  const box = g.playerBox;
  g.fallers = [{ x: box.x + box.w / 2, y: box.y + box.h / 2, vy: 0 }];
  const ev = g.step(DT, IDLE);
  assert.deepEqual(ev.filter((e) => e.type === "hit"), [{ type: "hit", lives: 2 }]);
});

// ── 15단계: 사람처럼 실수해도 대부분 성공 (기획서 8번 "첫 시도 성공률 약 80%") ──
// 반응이 0.24초 늦고 판단이 조금씩 흔들리는 자동 플레이로 여러 판을 돌려 성공 비율을 본다.

function gauss(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HUMAN = { delay: 0.24, sigma: 0.11 };
const lagFrames = Math.round(HUMAN.delay / DT);

function humanFlappy(seed: number) {
  const rng = mulberry32(seed);
  const g = new FlappyGame(mulberry32(seed + 99));
  const seen: { y: number; vy: number; gap?: number }[] = [];
  let cool = 0;
  play(g, 60, (x) => {
    seen.push({ y: x.y, vy: x.vy, gap: x.pipes.find((p) => !p.passed)?.gapY });
    if (!x.started) return tap;
    const s = seen[Math.max(0, seen.length - 1 - lagFrames)];
    cool -= DT;
    if (cool <= 0 && s.y > (s.gap ?? ARENA.height / 2) + 15 && s.vy >= 0) {
      cool = 0.18 + Math.abs(HUMAN.sigma * gauss(rng));
      return tap;
    }
    return IDLE;
  });
  return g.status === "success";
}

function humanDodge(seed: number) {
  const rng = mulberry32(seed);
  const g = new DodgeGame(mulberry32(seed + 3));
  const seen: { x: number; y: number }[][] = [];
  let goal = g.player.x + ACTOR.width / 2;
  let rethink = 0;
  play(g, 20, (x) => {
    seen.push(x.fallers.map((f) => ({ x: f.x, y: f.y })));
    const s = seen[Math.max(0, seen.length - 1 - lagFrames)];
    rethink -= DT;
    if (rethink <= 0) {
      rethink = 0.15;
      const danger = s.filter((f) => f.y > 220);
      let best = goal;
      let bestScore = -1;
      for (let px = ACTOR.width / 2; px <= ARENA.width - ACTOR.width / 2; px += 8) {
        const score = Math.min(999, ...danger.map((f) => Math.abs(f.x - px))) - Math.abs(px - (x.player.x + ACTOR.width / 2)) * 0.08;
        if (score > bestScore) {
          bestScore = score;
          best = px;
        }
      }
      goal = best + 6 * gauss(rng);
    }
    return goTo(goal);
  });
  return g.status === "success";
}

const rate = (fn: (seed: number) => boolean, n = 80) => Array.from({ length: n }, (_, i) => fn(5000 + i)).filter(Boolean).length / n;

test("밸런스: 파닥파닥은 반응이 느려도 대부분 성공 (75% 이상)", () => {
  const r = rate(humanFlappy);
  assert.ok(r >= 0.75, `성공률 ${Math.round(r * 100)}%`);
});

test("밸런스: 피하기는 반응이 느려도 대부분 성공 (75% 이상)", () => {
  const r = rate(humanDodge);
  assert.ok(r >= 0.75, `성공률 ${Math.round(r * 100)}%`);
});
