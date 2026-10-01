import { CONFIG } from "./config";

/**
 * 화면 흔들림과 파티클 (기획서 12번). DOM 없는 순수 로직이라 테스트할 수 있다.
 * 좌표는 world.ts와 같다: x는 판정 영역 기준, y는 위로 갈수록 커지는 높이.
 * 흔들림·파티클은 설정에서 따로 끈다. 꺼져 있으면 새로 만들지 않는다.
 */

export type ParticleKind = "dust" | "sparkle" | "shard" | "star";

export type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 남은 수명과 처음 수명 (투명도·크기에 쓴다) */
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type Rng = () => number;

type Burst = { count: number; speed: number; life: number };

export class Effects {
  particles: Particle[] = [];
  shakeOn = true;
  particlesOn = true;
  /** 1 = 보통, 0.5 = 느린 기기라 절반만 */
  quality = 1;
  private shakeLeft = 0;
  private shakeTotal = 0;
  private shakeMag = 0;
  private frameTimes: number[] = [];

  constructor(private readonly rng: Rng = Math.random) {}

  set(opts: { shake: boolean; particles: boolean }) {
    this.shakeOn = opts.shake;
    this.particlesOn = opts.particles;
    if (!opts.particles) this.particles = [];
    if (!opts.shake) this.shakeLeft = 0;
  }

  clear() {
    this.particles = [];
    this.shakeLeft = 0;
  }

  shake(kind: keyof typeof CONFIG.effects.shake) {
    if (!this.shakeOn) return;
    const s = CONFIG.effects.shake[kind];
    // 더 센 흔들림이 오면 덮어쓴다
    if (s.magnitude >= this.shakeMag || this.shakeLeft <= 0) {
      this.shakeMag = s.magnitude;
      this.shakeLeft = s.duration;
      this.shakeTotal = s.duration;
    }
  }

  /** 지금 화면을 얼마나 옮길지 (논리 px). 끝으로 갈수록 약해진다 */
  shakeOffset(): { x: number; y: number } {
    if (this.shakeLeft <= 0) return { x: 0, y: 0 };
    const k = (this.shakeLeft / this.shakeTotal) * this.shakeMag;
    return { x: Math.round((this.rng() * 2 - 1) * k), y: Math.round((this.rng() * 2 - 1) * k) };
  }

  /** 착지 먼지: 발밑 양옆으로 낮게 퍼진다 */
  dust(x: number, y: number, width: number, color: string) {
    this.burst("dust", CONFIG.effects.dust, color, (i, n) => {
      const side = i % 2 === 0 ? -1 : 1;
      return { x: x + (side < 0 ? 0 : width), y, angle: side < 0 ? Math.PI - 0.3 * (i / n) : 0.3 * (i / n) };
    });
  }

  /** 고점프: 발밑에서 위로 튀는 반짝이 */
  sparkle(x: number, y: number, width: number, color: string) {
    this.burst("sparkle", CONFIG.effects.sparkle, color, (i, n) => ({
      x: x + (width * (i + 0.5)) / n,
      y,
      angle: Math.PI / 2 + (this.rng() - 0.5) * 0.9,
    }));
  }

  /** 일회용 발판 조각: 사방으로 흩어지며 떨어진다 */
  shards(x: number, y: number, width: number, color: string) {
    this.burst("shard", CONFIG.effects.shard, color, (i, n) => ({
      x: x + (width * (i + 0.5)) / n,
      y,
      angle: Math.PI * (0.15 + 0.7 * this.rng()),
    }));
  }

  /** 합류: 새 동료 둘레로 별 */
  stars(cx: number, cy: number, color: string) {
    this.burst("star", CONFIG.effects.star, color, (i, n) => ({ x: cx, y: cy, angle: (Math.PI * 2 * i) / n }));
  }

  private burst(kind: ParticleKind, b: Burst, color: string, at: (i: number, n: number) => { x: number; y: number; angle: number }) {
    if (!this.particlesOn) return;
    const n = Math.max(1, Math.round(b.count * this.quality));
    for (let i = 0; i < n; i++) {
      const p = at(i, n);
      const speed = b.speed * (0.6 + 0.4 * this.rng());
      this.particles.push({
        kind,
        x: p.x,
        y: p.y,
        vx: Math.cos(p.angle) * speed,
        vy: Math.sin(p.angle) * speed,
        life: b.life,
        maxLife: b.life,
        size: kind === "dust" ? 6 : kind === "shard" ? 5 : 4,
        color,
      });
    }
    // 너무 많으면 오래된 것부터 버린다
    const max = CONFIG.effects.maxParticles;
    if (this.particles.length > max) this.particles.splice(0, this.particles.length - max);
  }

  step(dt: number) {
    if (this.shakeLeft > 0) this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.particles.length === 0) return;
    const g = CONFIG.effects.gravity;
    for (const p of this.particles) {
      p.life -= dt;
      // 먼지는 공기 저항으로 금방 멈추고, 나머지는 중력을 받는다
      if (p.kind === "dust") {
        p.vx *= Math.exp(-6 * dt);
        p.vy *= Math.exp(-6 * dt);
      } else p.vy -= g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /**
   * 그린 프레임 시간을 기록한다. 느린 프레임이 많으면 파티클을 절반으로 (기획서 18 성능 저하 대응).
   * 탭 전환처럼 한 번 튀는 건 무시하도록 최근 60프레임 비율로 본다.
   */
  recordFrame(ms: number) {
    if (ms > 250) return;
    this.frameTimes.push(ms);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (this.frameTimes.length < 60) return;
    const slow = this.frameTimes.filter((t) => t > CONFIG.effects.slowFrameMs).length / this.frameTimes.length;
    this.quality = slow >= CONFIG.effects.slowFrameRatio ? 0.5 : 1;
  }
}
