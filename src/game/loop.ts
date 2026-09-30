import { CONFIG } from "./config";

/**
 * 고정 시간 스텝 루프. 화면 주사율과 상관없이 update는 항상 같은 dt로 불린다.
 * render의 alpha(0~1)는 마지막 스텝 이후 남은 시간 비율로, 보간에 쓸 수 있다.
 */
export class FixedStepLoop {
  private rafId = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning() {
    return this.running;
  }

  private tick = (now: number) => {
    if (!this.running) return;
    const { fixedStep, maxFrameTime } = CONFIG.loop;
    const frame = Math.min((now - this.last) / 1000, maxFrameTime);
    this.last = now;
    this.acc += frame;
    while (this.acc >= fixedStep) {
      this.update(fixedStep);
      this.acc -= fixedStep;
    }
    this.render(this.acc / fixedStep);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
