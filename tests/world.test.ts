import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/game/config";
import { gapAt, maxJumpHeight, mulberry32, toMeters, World, type WorldEvent } from "../src/game/world";
import type { MoveIntent } from "../src/input/controller";

const DT = CONFIG.loop.fixedStep;
const NONE: MoveIntent = { kind: "none" };
const make = (seed = 1) => new World({ rng: mulberry32(seed), playHeight: 720, viewHeight: 720 });

/** 마지막으로 착지한 높이 (자동 조종이 "다음 발판"을 고르는 기준) */
const lastLand = new WeakMap<World, number>();

function run(w: World, seconds: number, intent: (w: World) => MoveIntent = () => NONE) {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const ev = w.step(DT, intent(w));
    for (const e of ev) if (e.type === "land") lastLand.set(w, e.platform.y);
    events.push(...ev);
  }
  return events;
}

/** 마지막으로 밟은 발판 바로 위 발판의 가운데를 따라가는 간단한 자동 조종 */
function autopilot(w: World): MoveIntent {
  const base = lastLand.get(w) ?? 0;
  const target = w.platforms.filter((p) => p.y > base + 1).sort((a, b) => a.y - b.y)[0];
  if (!target) return NONE;
  return { kind: "target", x: target.x + target.width / 2 };
}

test("최대 점프 높이와 간격 상한: 어느 높이에서도 80%를 넘지 않는다", () => {
  const cap = maxJumpHeight() * CONFIG.world.maxGapRatio;
  for (const h of [0, 1000, 8000, 16000, 100000]) assert.ok(gapAt(h) <= cap + 1e-9, `height ${h}`);
  assert.ok(gapAt(16000) > gapAt(0), "높을수록 간격이 넓어진다");
});

test("생성된 발판 사이 간격은 항상 도달 가능", () => {
  const w = make(7);
  w.launch();
  // 일회용 발판은 밟으면 사라지므로, 만들어진 발판을 모두 기록해서 본다
  const seen = new Map<number, number>();
  run(w, 30, (world) => {
    for (const p of world.platforms) if (p.kind !== "ground") seen.set(p.id, p.y);
    return autopilot(world);
  });
  assert.ok(seen.size > 30);
  const ys = [...seen.values()].sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] <= maxJumpHeight() * 0.8 + 1e-6);
});

test("바닥에서 자동 점프, 서 있을 땐 0m", () => {
  const w = make();
  assert.equal(w.score, 0);
  const ev = run(w, 0.1);
  assert.ok(ev.some((e) => e.type === "land" && e.platform.kind === "ground"));
});

test("단방향 발판: 올라가는 중엔 통과, 내려올 때만 착지", () => {
  const w = make();
  w.platforms = w.platforms.filter((p) => p.kind === "ground");
  w.platforms.push({ id: 99, kind: "basic", x: w.hero.x, y: 100, width: 128, touched: false });
  w.launch();
  // 올라가는 동안(약 0.45초) 착지 없음
  const up = run(w, 0.3);
  assert.equal(up.filter((e) => e.type === "land").length, 0);
  assert.ok(w.hero.y > 100, "발판을 뚫고 올라감");
  const down = run(w, 0.5);
  const land = down.find((e) => e.type === "land");
  assert.ok(land && land.type === "land" && land.platform.id === 99);
});

test("점수 = 올라간 가장 높은 곳(m, 내림). 같은 자리에서 여러 번 튀어도 오르지 않는다", () => {
  const px = CONFIG.score.pxPerMeter;
  assert.equal(toMeters(0), 0);
  assert.equal(toMeters(px - 1), 0);
  assert.equal(toMeters(px), 1);
  assert.equal(toMeters(-50), 0);

  const w = make();
  w.platforms = [{ id: 99, kind: "basic", x: w.hero.x, y: 0, width: 128, touched: false }];
  w.launch();
  const ev = run(w, 3);
  const top = toMeters(maxJumpHeight());
  assert.equal(w.score, top, "제자리 점프 최고점");
  // 점수 이벤트는 1m 오를 때마다 한 번씩만
  assert.deepEqual(
    ev.filter((e) => e.type === "score").map((e) => e.type === "score" && e.score),
    Array.from({ length: top }, (_, i) => i + 1),
  );
});

test("떨어져도 점수는 줄지 않는다", () => {
  const w = make();
  w.hero.y = 10 * CONFIG.score.pxPerMeter + 5;
  w.hero.vy = 0;
  run(w, DT);
  assert.equal(w.score, 10);
  w.hero.y = 2 * CONFIG.score.pxPerMeter;
  run(w, DT);
  assert.equal(w.score, 10);
});

test("카메라는 위로만 움직인다", () => {
  const w = make(3);
  w.launch();
  let prev = w.cameraY;
  for (let i = 0; i < 600; i++) {
    w.step(DT, autopilot(w));
    assert.ok(w.cameraY >= prev);
    prev = w.cameraY;
  }
  assert.ok(w.cameraY > 0, "올라가면 따라 올라감");
});

test("자동 조종으로 꾸준히 올라가며 점수가 오른다 (발판 배치 검증)", () => {
  const w = make(11);
  w.launch();
  run(w, 20, autopilot);
  assert.equal(w.over, false);
  assert.ok(w.score >= 20, `score ${w.score}m`);
});

test("화면 아래로 떨어지면 게임오버, 이후 step은 아무 일도 안 함", () => {
  const w = make();
  w.launch();
  run(w, 4, autopilot);
  w.platforms = []; // 발판을 모두 없애서 떨어뜨린다
  const ev = run(w, 5);
  assert.ok(ev.some((e) => e.type === "gameover"));
  assert.equal(w.over, true);
  assert.deepEqual(w.step(DT, NONE), []);
});

test("지나간 발판은 지우고 위쪽은 미리 채운다", () => {
  const w = make(5);
  w.launch();
  run(w, 15, autopilot);
  assert.ok(w.platforms.every((p) => p.y >= w.cameraY - CONFIG.world.removeBelow));
  const top = Math.max(...w.platforms.map((p) => p.y));
  assert.ok(top >= w.cameraY + w.viewHeight, "보이는 화면 위까지 발판이 있음");
});

test("같은 시드면 같은 결과 (고정 시간 스텝)", () => {
  const a = make(42);
  const b = make(42);
  a.launch();
  b.launch();
  run(a, 5, autopilot);
  run(b, 5, autopilot);
  assert.equal(a.score, b.score);
  assert.equal(a.hero.y, b.hero.y);
});

test("좌우 벽에서 멈춘다 (반대편으로 넘어가지 않음)", () => {
  const w = make();
  run(w, 2, () => ({ kind: "axis", dir: -1 }));
  assert.equal(w.hero.x, 0);
  run(w, 3, () => ({ kind: "axis", dir: 1 }));
  assert.equal(w.hero.x, CONFIG.view.width - CONFIG.character.width);
});

// ── 8단계: 특수 발판·지역 ──
import { pickKind } from "../src/game/world";
import { regionBlendAt, regionIndexAt, regionName } from "../src/game/regions";

test("특수 발판 확률표(높이 m): 15m 전엔 기본만, 고점프는 15m부터, 일회용은 35m부터", () => {
  for (const roll of [0, 0.1, 0.5, 0.99]) assert.equal(pickKind(5, roll), "basic");
  assert.equal(pickKind(20, 0.05), "highJump");
  assert.equal(pickKind(20, 0.2), "basic", "35m 전엔 일회용 없음");
  assert.equal(pickKind(40, 0.05), "highJump");
  assert.equal(pickKind(40, 0.2), "oneTime");
  assert.equal(pickKind(40, 0.5), "basic");
});

test("고점프 발판은 기본보다 높이 튄다", () => {
  const peak = (kind: "basic" | "highJump") => {
    const w = make();
    w.platforms = [{ id: 1, kind, x: w.hero.x, y: 0, width: 128, touched: false }];
    let top = 0;
    for (let i = 0; i < 240; i++) {
      w.step(DT, NONE);
      top = Math.max(top, w.hero.y);
    }
    return top;
  };
  const basic = peak("basic");
  const high = peak("highJump");
  const m = CONFIG.special.highJumpVelocityMultiplier;
  assert.ok(Math.abs(high / basic - m * m) < 0.05, `ratio ${high / basic}`);
});

test("일회용 발판: 한 번 밟으면 부서지고, 잠시 뒤 사라지며 다시 밟을 수 없다", () => {
  const w = make();
  w.platforms = [{ id: 7, kind: "oneTime", x: w.hero.x, y: -1, width: 128, touched: false }];
  w.hero.y = 0;
  const ev = run(w, 0.05);
  assert.ok(ev.some((e) => e.type === "land" && e.platform.id === 7));
  assert.equal(w.platforms.find((p) => p.id === 7)?.broken !== undefined, true, "부서짐 표시");
  run(w, CONFIG.special.oneTimeBreakDuration + 0.05);
  assert.equal(w.platforms.some((p) => p.id === 7), false, "사라짐");
});

test("지역: 경계 높이(m)에서 들어가고, 한 판에 지역마다 한 번만 알린다", () => {
  assert.equal(regionIndexAt(0), 0);
  assert.equal(regionIndexAt(74), 0);
  assert.equal(regionIndexAt(75), 1);
  assert.equal(regionIndexAt(600), 3);
  assert.equal(regionName(2), "하늘");

  const w = make();
  // 지상 경계(75m) 바로 아래 발판에서 튀어 올라 경계를 넘는다
  const y = 74 * CONFIG.score.pxPerMeter;
  w.score = 74;
  w.hero.y = y;
  w.platforms = [{ id: 1, kind: "basic", x: w.hero.x, y: y - 1, width: 128, touched: false }];
  const ev = run(w, 0.3);
  assert.deepEqual(ev.filter((e) => e.type === "region"), [{ type: "region", index: 1 }]);
  w.platforms.push({ id: 2, kind: "basic", x: w.hero.x, y: w.hero.y - 1, width: 128, touched: false });
  const again = run(w, 2);
  assert.equal(again.filter((e) => e.type === "region").length, 0, "지상은 이미 알림");
});

test("배경 섞임: 경계 ±25m에서 0→1, 그 밖은 한 지역", () => {
  assert.equal(regionBlendAt(0), 0);
  assert.equal(regionBlendAt(49), 0);
  assert.equal(regionBlendAt(75), 0.5);
  assert.equal(regionBlendAt(100), 1);
  assert.equal(regionBlendAt(200), 1);
  assert.equal(regionBlendAt(260), 1.5);
  assert.equal(regionBlendAt(2000), 3);
});

test("일회용 발판을 밟으면 아래 발판이 가까운 것부터 무너진다: 그 아래로 떨어지면 끝, 화면은 끌어올리지 않음", () => {
  const w = make();
  w.platforms = [
    { id: 1, kind: "basic", x: w.hero.x, y: 300, width: 128, touched: true },
    { id: 2, kind: "oneTime", x: w.hero.x, y: 500, width: 128, touched: false },
    { id: 3, kind: "basic", x: w.hero.x, y: 900, width: 128, touched: false },
  ];
  w.hero.y = 501;
  w.hero.vy = -10;
  const landed = run(w, 0.1);
  assert.ok(landed.some((e) => e.type === "land" && e.platform.id === 2));
  const lower = w.platforms.find((p) => p.id === 1);
  assert.ok(lower?.broken !== undefined && lower.broken < 0, "아래 발판은 무너질 차례를 기다림 (이미 못 밟음)");
  assert.ok(w.cameraY < 300, "화면 아래 끝을 확 끌어올리지 않음");
  // 다음 발판 없이 떨어진다 → 아래 기본 발판(300)까지 가지 못하고 끝
  const ev = run(w, 5);
  assert.ok(ev.some((e) => e.type === "gameover"));
  assert.ok(!ev.some((e) => e.type === "land" && e.platform.id === 1), "아래 발판에 내려앉지 못함");
  assert.equal(w.platforms.find((p) => p.id === 3)?.broken, undefined, "위 발판은 그대로");
});

test("지역을 넘을 때마다 조금씩 빨라진다 (점프 높이는 그대로, 최대 +15%)", () => {
  const apex = (region: number) => {
    const w = make();
    w.region = region;
    w.platforms = [{ id: 1, kind: "basic", x: w.hero.x, y: 0, width: 128, touched: true }];
    w.launch();
    let t = 0;
    let top = 0;
    while (w.hero.vy > 0 && t < 3) {
      w.step(DT, NONE);
      t += DT;
      top = Math.max(top, w.hero.y);
    }
    return { t, top };
  };
  const speeds = CONFIG.regions.speedScale;
  assert.deepEqual([...speeds].sort((a, b) => a - b), [...speeds], "점점 빨라짐");
  assert.ok(speeds.at(-1)! <= 1.2, "너무 빨라지지 않음");
  const cave = apex(0);
  const space = apex(3);
  assert.ok(space.t < cave.t, "우주에서 더 빨리 꼭대기");
  assert.ok(Math.abs(space.top - cave.top) < 3, "점프 높이는 같음");
});

test("움직이는 발판: 좌우 벽 사이를 오가고, 벽에 닿으면 돌아선다", () => {
  const w = make();
  const p = { id: 9, kind: "moving" as const, x: 220, y: 5000, width: 128, touched: false, vx: 80 };
  w.platforms.push(p);
  const xs: number[] = [];
  for (let i = 0; i < 4 / DT; i++) {
    w.step(DT, NONE);
    xs.push(p.x);
  }
  assert.ok(xs.every((x) => x >= 0 && x <= CONFIG.view.width - p.width + 1e-6), "화면 밖으로 안 나감");
  assert.ok(Math.max(...xs) > CONFIG.view.width - p.width - 1 && Math.min(...xs) < 1, "양쪽 벽까지 오감");
});

test("움직이는 발판: 60m 전엔 안 나오고, 높이 올라갈수록 많이 나온다", () => {
  const share = (m: number) => {
    let n = 0;
    for (let i = 0; i < 1000; i++) if (pickKind(m, i / 1000) === "moving") n++;
    return n / 1000;
  };
  assert.equal(share(50), 0);
  assert.ok(share(70) > 0);
  assert.ok(share(400) > share(200) && share(200) > share(70));
  const gen = make(4);
  gen.cameraY = 40000;
  gen.setView(720, 720);
  const moving = gen.platforms.filter((p) => p.kind === "moving");
  assert.ok(moving.length > 0);
  for (const p of moving) {
    const { speedMin, speedMax } = CONFIG.special.moving;
    assert.ok(Math.abs(p.vx!) >= speedMin && Math.abs(p.vx!) <= speedMax);
    assert.ok(toMeters(p.y) >= 60);
  }
});

test("움직이는 발판에도 위에서 내려오면 착지한다", () => {
  const w = make();
  w.platforms = [{ id: 3, kind: "moving", x: w.hero.x - 20, y: -1, width: 128, touched: false, vx: 60 }];
  w.hero.y = 0;
  const ev = run(w, 0.05);
  assert.ok(ev.some((e) => e.type === "land" && e.platform.id === 3));
});
