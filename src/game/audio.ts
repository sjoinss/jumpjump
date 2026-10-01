import { CONFIG } from "./config";

/**
 * 8비트 효과음 (기획서 12번). 파일 없이 Web Audio 오실레이터로 만든다. BGM은 없다.
 * - 브라우저 정책상 첫 터치·클릭·키 입력 이후에만 소리를 켤 수 있다 → unlock()
 * - 앱이 백그라운드로 가면 소리를 멈춘다 → visibilitychange에서 suspend
 */

export type SfxName = "land" | "highJump" | "break" | "candidate" | "success" | "fail" | "gameover" | "region" | "countdown" | "go";

/** 음 하나: 시작 시각(초)부터 길이만큼, 주파수는 from → to로 미끄러진다 */
export type Note = {
  at: number;
  duration: number;
  from: number;
  to?: number;
  wave: OscillatorType | "noise";
  /** 0~1, 전체 볼륨에 곱한다 */
  gain: number;
};

const n = (at: number, duration: number, from: number, wave: Note["wave"], gain: number, to?: number): Note => ({ at, duration, from, to, wave, gain });

/** 소리 설계표. 자주 나는 소리(착지)는 짧고 작게 */
export const SFX: Record<SfxName, Note[]> = {
  land: [n(0, 0.06, 520, "square", 0.35, 300)],
  highJump: [n(0, 0.2, 330, "square", 0.5, 990)],
  break: [n(0, 0.12, 0, "noise", 0.5), n(0, 0.12, 180, "square", 0.35, 70)],
  candidate: [n(0, 0.09, 660, "triangle", 0.7), n(0.09, 0.16, 990, "triangle", 0.7)],
  success: [523, 659, 784, 1047].map((f, i) => n(i * 0.09, i === 3 ? 0.25 : 0.1, f, "square", 0.45)),
  fail: [392, 330, 262].map((f, i) => n(i * 0.14, i === 2 ? 0.3 : 0.14, f, "triangle", 0.7)),
  gameover: [n(0, 0.6, 440, "square", 0.45, 110)],
  region: [523, 784, 1047].map((f, i) => n(i * 0.1, i === 2 ? 0.3 : 0.1, f, "triangle", 0.6)),
  countdown: [n(0, 0.08, 660, "square", 0.35)],
  go: [n(0, 0.18, 990, "square", 0.4)],
};

/** 소리 하나의 전체 길이(초) */
export function sfxDuration(name: SfxName) {
  return Math.max(...SFX[name].map((x) => x.at + x.duration));
}

class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private hidden = false;

  /** 설정의 효과음 스위치 */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) void this.ctx?.suspend();
    else if (!this.hidden) void this.ctx?.resume();
  }

  /** 사용자 입력 이벤트 안에서 불러야 소리가 난다 (브라우저 자동 재생 정책) */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.sfx.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.enabled && !this.hidden && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** 앱이 백그라운드로 가면 멈추고, 돌아오면 다시 */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) void this.ctx?.suspend();
    else if (this.enabled) void this.ctx?.resume();
  }

  play(name: SfxName) {
    const { ctx, master } = this;
    if (!ctx || !master || !this.enabled || this.hidden || ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.005;
    for (const note of SFX[name]) {
      const start = t0 + note.at;
      const end = start + note.duration;
      const env = ctx.createGain();
      // 짧게 올라갔다가 끝까지 줄어드는 볼륨 (딸깍 소리 방지)
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(note.gain, start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      env.connect(master);

      let src: AudioScheduledSourceNode;
      if (note.wave === "noise") {
        const buf = ctx.createBufferSource();
        buf.buffer = this.noiseBuffer(ctx);
        src = buf;
      } else {
        const osc = ctx.createOscillator();
        osc.type = note.wave;
        osc.frequency.setValueAtTime(note.from, start);
        if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, end);
        src = osc;
      }
      src.connect(env);
      src.start(start);
      src.stop(end + 0.02);
      src.onended = () => env.disconnect();
    }
  }

  private noiseBuffer(ctx: AudioContext) {
    if (this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // 8비트 느낌: 몇 샘플씩 같은 값을 유지하는 거친 잡음
    let v = 0;
    for (let i = 0; i < len; i++) {
      if (i % 6 === 0) v = Math.random() * 2 - 1;
      data[i] = v;
    }
    this.noise = buf;
    return buf;
  }
}

/** 앱 전체에서 하나만 쓴다 */
export const sfx = new SoundPlayer();
