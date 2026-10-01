import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRefusal, canOfferCompanion, candidateHeight } from "../src/game/companions";
import { CONFIG } from "../src/game/config";
import { cameraRatioFor, formationSize, memberCell } from "../src/game/formation";
import { mulberry32, World, type WorldEvent } from "../src/game/world";
import { createDefaultSettings } from "../src/lib/defaults";

const DT = CONFIG.loop.fixedStep;
const make = (companionMax = 5, seed = 1) => new World({ rng: mulberry32(seed), playHeight: 720, viewHeight: 720, companionMax });

function run(w: World, seconds: number) {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) events.push(...w.step(DT, { kind: "none" }));
  return events;
}

/** 후보 하나를 대열 바로 앞에 놓고, 대열은 그 아래 발판 위에서 제자리 점프 */
function withCandidateAbove(w: World) {
  w.platforms = [{ id: 1, kind: "basic", x: w.hero.x, y: 0, width: 128, touched: true }];
  w.candidates = [{ id: 1, x: w.hero.x + 32, y: CONFIG.companion.candidateLift, state: "active", fade: 0, refusalCounted: false }];
  return w.candidates[0];
}

// ── 대열 ──

test("대열 배치: 주인공 왼쪽 아래, 동료1 오른쪽, 2·3은 그 위, 4·5는 맨 위", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(memberCell), [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 0, row: 2 },
    { col: 1, row: 2 },
  ]);
});

test("대열 크기: 동료1이 오면 폭 64→128, 그 뒤로는 폭 그대로 위로만", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((c) => formationSize(c).width), [64, 128, 128, 128, 128, 128]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((c) => formationSize(c).rows), [1, 1, 2, 2, 3, 3]);
  assert.equal(formationSize(5).height, 216, "3줄 높이 216px (기획서 3-3)");
});

test("카메라 보정: 줄이 많을수록 맨 아래 줄을 화면 아래쪽으로", () => {
  assert.ok(cameraRatioFor(0) < cameraRatioFor(2));
  assert.ok(cameraRatioFor(2) < cameraRatioFor(4));
  assert.equal(cameraRatioFor(5), cameraRatioFor(4));
});

test("착지 판정은 맨 아래 줄 전체 폭: 동료1이 있으면 오른쪽 칸으로도 발판을 밟는다", () => {
  const w = make();
  w.acceptCandidate(-1); // 동료1 합류 (후보 없이도 인원만 늘리는 경로)
  assert.equal(w.companions, 1);
  // 발판이 대열 오른쪽 칸(동료1) 아래에만 걸치게
  w.platforms = [{ id: 5, kind: "basic", x: w.hero.x + 100, y: 50, width: 128, touched: false }];
  w.hero.y = 60;
  w.hero.vy = -10;
  const ev = run(w, 0.1);
  assert.ok(ev.some((e) => e.type === "land" && e.platform.id === 5));
});

test("합류로 대열이 넓어지면 벽 안쪽으로 밀어 넣는다", () => {
  const w = make();
  w.hero.x = CONFIG.view.width - 64; // 오른쪽 벽에 붙어 있음
  w.acceptCandidate(-1);
  assert.equal(w.hero.x, CONFIG.view.width - 128);
});

test("게임오버는 대열 전체가 화면 아래로 벗어났을 때", () => {
  const w = make();
  for (let i = 0; i < 5; i++) w.acceptCandidate(-1);
  w.platforms = [];
  w.cameraY = 1000;
  w.hero.y = 1000 - 200; // 맨 아래 줄은 화면 밖이지만 위쪽 줄은 아직 보임 (대열 높이 216)
  w.hero.vy = 0;
  assert.equal(w.step(DT, { kind: "none" }).some((e) => e.type === "gameover"), false);
  run(w, 1);
  assert.equal(w.over, true);
});

// ── 후보 ──

test("후보 높이: 25, 75, 175, 350, 650m 다음엔 300m 간격", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(candidateHeight), [25, 75, 175, 350, 650, 950, 1250]);
});

test("후보 조건: C < M일 때만, M = 0이면 없음", () => {
  assert.equal(canOfferCompanion(0, 5), true);
  assert.equal(canOfferCompanion(2, 2), false);
  assert.equal(canOfferCompanion(0, 0), false);
});

test("후보는 정해진 높이를 처음 넘는 발판 위에 생긴다 (그 발판은 기본 발판)", () => {
  const w = make(5, 3);
  w.cameraY = 30000; // 위쪽까지 발판을 한꺼번에 만든다 (350m ≈ 25200px까지 넉넉히)
  w.setView(720, 720);
  const px = CONFIG.score.pxPerMeter;
  const platformOf = (id: number) => w.platforms.find((p) => p.id === id)!;
  assert.equal(w.candidates.length, 4);
  w.candidates.forEach((c, n) => {
    const p = platformOf(c.id);
    assert.equal(p.kind, "basic");
    assert.ok(p.y >= candidateHeight(n) * px, `${n}번째 후보 ${p.y}px`);
    // 바로 아래 발판은 아직 그 높이에 못 미친다
    const below = w.platforms.filter((q) => q.y < p.y && q.kind !== "ground").at(-1);
    if (below) assert.ok(below.y < candidateHeight(n) * px);
  });
});

test("M = 0이면 후보가 처음부터 나오지 않는다", () => {
  const w = make(0);
  w.cameraY = 8000;
  w.setView(720, 720);
  assert.equal(w.candidates.length, 0);
});

test("후보에 닿으면 선택창 이벤트 (합류할 슬롯 번호 포함), 선택창이 닫혀도 떨어졌다 다시 닿을 때까지 조용", () => {
  const w = make();
  withCandidateAbove(w);
  w.launch();
  const first = run(w, 0.2).filter((e) => e.type === "candidate");
  assert.equal(first.length, 1);
  assert.ok(first[0].type === "candidate" && first[0].slot === 1);
  // 계속 겹쳐 있는 동안은 다시 부르지 않음
  assert.equal(run(w, 0.05).filter((e) => e.type === "candidate").length, 0);
});

test("거절: 같은 블록은 한 번만 세고, 대열이 떨어졌다 다시 닿으면 다시 묻는다", () => {
  const w = make();
  const c = withCandidateAbove(w);
  w.launch();
  run(w, 0.2);
  assert.equal(w.refuseCandidate(c.id), true, "처음 거절");
  // 제자리 점프를 몇 번 하는 동안 떨어졌다 다시 닿는다
  const again = run(w, 3).filter((e) => e.type === "candidate");
  assert.ok(again.length >= 1, "다시 물어봄");
  assert.equal(w.refuseCandidate(c.id), false, "같은 블록 두 번째 거절은 세지 않음");
});

test("M이 C 이하로 바뀌면 화면의 후보는 조용히 사라진다", () => {
  const w = make();
  const c = withCandidateAbove(w);
  w.setCompanionMax(0);
  assert.equal(c.state, "fading");
  const ev = run(w, 0.1);
  assert.equal(ev.filter((e) => e.type === "candidate").length, 0, "사라지는 후보는 선택창을 열지 않음");
  run(w, CONFIG.companion.candidateFade);
  assert.equal(w.candidates.length, 0);
});

test("합류: 후보가 없어지고 동료 수가 는다. 5명이 차면 남은 후보도 사라진다", () => {
  const w = make();
  const c = withCandidateAbove(w);
  w.acceptCandidate(c.id);
  assert.equal(w.companions, 1);
  assert.equal(w.candidates.length, 0);
  const d = withCandidateAbove(w);
  w.setCompanionMax(2);
  w.acceptCandidate(-1);
  assert.equal(w.companions, 2);
  assert.equal(d.state, "fading", "C = M이 되어 조건이 거짓");
});

// ── 거절 누적·자동 설정 ──

test("거절 누적: 'default'일 때만 세고, 3번째에 그때 동료 수로 자동 설정", () => {
  let s = createDefaultSettings({ reducedMotion: false });
  let r = applyRefusal(s, 2);
  assert.equal(r.settings.refusalCount, 1);
  assert.equal(r.autoSetTo, null);
  s = applyRefusal(r.settings, 2).settings;
  r = applyRefusal(s, 2);
  assert.equal(r.autoSetTo, 2);
  assert.equal(r.settings.companionMax, 2);
  assert.equal(r.settings.companionMaxSource, "auto");
  // 자동 설정 뒤에는 더 세지 않음
  assert.equal(applyRefusal(r.settings, 0).settings.refusalCount, 3);
});

test("직접 설정한 적이 있으면 거절을 세지 않는다", () => {
  const s = { ...createDefaultSettings({ reducedMotion: false }), companionMaxSource: "user" as const };
  const r = applyRefusal(s, 1);
  assert.equal(r.settings, s);
  assert.equal(r.autoSetTo, null);
});

test("동료 최대 인원 0으로 시작한 판은 발판 판정 폭이 넓다 (혼자 하는 사람 보정)", () => {
  const solo = make(0);
  const withM = make(5);
  assert.equal(solo.platformWidth, CONFIG.platform.width + CONFIG.world.platformWidthBonusSolo);
  assert.equal(withM.platformWidth, CONFIG.platform.width);
  assert.ok(CONFIG.world.platformWidthBonusSolo > 0);
  // 넓어져도 화면 폭 안에서만 생긴다
  solo.cameraY = 5000;
  solo.setView(720, 720);
  for (const p of solo.platforms.filter((q) => q.kind !== "ground")) assert.ok(p.x >= 0 && p.x + p.width <= CONFIG.view.width);
});
