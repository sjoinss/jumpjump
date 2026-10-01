import { test } from "node:test";
import assert from "node:assert/strict";
import { SFX, sfxDuration, type SfxName } from "../src/game/audio";
import { CONFIG } from "../src/game/config";
import { Effects } from "../src/game/effects";
import { mulberry32 } from "../src/game/world";

const DT = CONFIG.loop.fixedStep;
const run = (e: Effects, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) e.step(DT);
};

test("파티클: 터뜨리면 생기고 수명이 다하면 사라진다", () => {
  const e = new Effects(mulberry32(1));
  e.dust(100, 50, 64, "#fff");
  assert.equal(e.particles.length, CONFIG.effects.dust.count);
  run(e, CONFIG.effects.dust.life + 0.05);
  assert.equal(e.particles.length, 0);
});

test("파티클: 고점프 반짝이는 위로, 조각은 중력으로 떨어진다", () => {
  const e = new Effects(mulberry32(2));
  e.sparkle(100, 0, 64, "#fff");
  run(e, 0.1);
  assert.ok(e.particles.every((p) => p.y > 0), "처음엔 위로 튐");
  const f = new Effects(mulberry32(3));
  f.shards(100, 0, 128, "#fff");
  run(f, 0.5);
  assert.ok(f.particles.every((p) => p.vy < 0), "곧 떨어짐");
});

test("설정에서 끄면 새로 만들지 않고, 남은 것도 지운다", () => {
  const e = new Effects(mulberry32(1));
  e.stars(0, 0, "#fff");
  e.set({ shake: false, particles: false });
  assert.equal(e.particles.length, 0);
  e.dust(0, 0, 64, "#fff");
  e.shake("break");
  assert.equal(e.particles.length, 0);
  assert.deepEqual(e.shakeOffset(), { x: 0, y: 0 });
});

test("흔들림: 약하게, 시간이 지나면 멈춘다", () => {
  const e = new Effects(mulberry32(4));
  e.shake("break");
  const max = CONFIG.effects.shake.break.magnitude;
  for (let i = 0; i < 20; i++) {
    const o = e.shakeOffset();
    assert.ok(Math.abs(o.x) <= max && Math.abs(o.y) <= max);
  }
  run(e, CONFIG.effects.shake.break.duration + 0.01);
  assert.deepEqual(e.shakeOffset(), { x: 0, y: 0 });
});

test("파티클 수는 상한을 넘지 않는다", () => {
  const e = new Effects(mulberry32(5));
  for (let i = 0; i < 100; i++) e.stars(0, 0, "#fff");
  assert.equal(e.particles.length, CONFIG.effects.maxParticles);
});

test("느린 프레임이 이어지면 파티클을 절반으로, 빨라지면 되돌린다", () => {
  const e = new Effects(mulberry32(6));
  for (let i = 0; i < 60; i++) e.recordFrame(i % 2 === 0 ? 40 : 16);
  assert.equal(e.quality, 0.5);
  e.dust(0, 0, 64, "#fff");
  assert.equal(e.particles.length, Math.round(CONFIG.effects.dust.count * 0.5));
  for (let i = 0; i < 60; i++) e.recordFrame(16);
  assert.equal(e.quality, 1);
  e.recordFrame(5000);
  assert.equal(e.quality, 1, "탭 전환 같은 한 번의 긴 프레임은 무시");
});

test("효과음 설계표: 기획서의 7종 + 카운트다운, 모두 짧고 들을 수 있는 음역", () => {
  const required: SfxName[] = ["land", "highJump", "break", "candidate", "success", "fail", "gameover", "region"];
  for (const name of required) assert.ok(SFX[name].length > 0, name);
  for (const [name, notes] of Object.entries(SFX)) {
    assert.ok(sfxDuration(name as SfxName) <= 1, `${name}은 1초 이내`);
    for (const n of notes) {
      assert.ok(n.gain > 0 && n.gain <= 1, name);
      if (n.wave !== "noise") assert.ok(n.from >= 60 && n.from <= 4000, name);
    }
  }
  assert.ok(sfxDuration("land") <= 0.1, "자주 나는 착지 소리는 아주 짧게");
});
