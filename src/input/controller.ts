import { CONFIG } from "../game/config";

export type InputSource = "touch" | "mouse" | "keyboard";

/**
 * 입력 장치와 상관없는 "이동 목표".
 * - drag: 지난 프레임 이후 손가락이 움직인 논리 px
 * - target: 따라가야 할 논리 x (마우스)
 * - axis: 키보드 방향 (-1 왼쪽, 0 없음/동시 입력, 1 오른쪽)
 */
export type MoveIntent =
  | { kind: "none" }
  | { kind: "drag"; dx: number }
  | { kind: "target"; x: number }
  | { kind: "axis"; dir: -1 | 0 | 1 };

export type InputAction = "confirm" | "pause" | "autoPause";

type Options = {
  /** 포인터 이벤트를 받을 요소 (게임 캔버스) */
  element: HTMLElement;
  /** 화면 좌표(clientX) → 논리 x */
  clientToLogicalX: (clientX: number) => number;
  /** CSS px → 논리 px 배율 */
  logicalPerCssPx: () => number;
  onAction?: (action: InputAction) => void;
};

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const CONFIRM_KEYS = new Set(["Enter", "Space", "NumpadEnter"]);
const PAUSE_KEYS = new Set(["Escape", "KeyP"]);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * 터치·마우스·키보드를 하나의 MoveIntent로 합친다.
 * 마지막에 사용한 입력이 우선이고, 키를 누르고 있는 동안에는 마우스 이동을 무시한다.
 */
export class InputController {
  private readonly opts: Options;
  private left = false;
  private right = false;
  private lastSource: InputSource | null = null;

  private dragPointerId: number | null = null;
  private dragLastClientX = 0;
  private pendingDx = 0;

  private mouseX: number | null = null;
  private mouseClientX = NaN;
  private mouseClientY = NaN;
  private attached = false;

  constructor(opts: Options) {
    this.opts = opts;
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    const el = this.opts.element;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerEnd);
    el.addEventListener("pointercancel", this.onPointerEnd);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    const el = this.opts.element;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerEnd);
    el.removeEventListener("pointercancel", this.onPointerEnd);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.reset();
  }

  /** 키·드래그 상태를 모두 비운다. 일시정지·화면 전환 때 부른다 */
  reset() {
    this.left = false;
    this.right = false;
    this.dragPointerId = null;
    this.pendingDx = 0;
  }

  /** 매 스텝 한 번 부른다. drag의 dx는 읽으면 비워진다 */
  consumeIntent(): MoveIntent {
    switch (this.lastSource) {
      case "touch": {
        const dx = this.pendingDx;
        this.pendingDx = 0;
        return { kind: "drag", dx };
      }
      case "mouse":
        return this.mouseX === null ? { kind: "none" } : { kind: "target", x: this.mouseX };
      case "keyboard":
        return { kind: "axis", dir: this.left === this.right ? 0 : this.left ? -1 : 1 };
      default:
        return { kind: "none" };
    }
  }

  get source() {
    return this.lastSource;
  }

  private get keyHeld() {
    return this.left || this.right;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return; // 마우스는 클릭 없이 위치만 따라간다
    if (this.dragPointerId !== null) return; // 두 번째 손가락은 무시
    this.dragPointerId = e.pointerId;
    this.dragLastClientX = e.clientX;
    this.lastSource = "touch";
    this.opts.element.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      // 브라우저는 마우스가 가만히 있어도 pointermove를 보낼 때가 있다. 실제로 움직였을 때만 마우스를 "마지막 입력"으로 본다
      const moved = e.clientX !== this.mouseClientX || e.clientY !== this.mouseClientY;
      this.mouseClientX = e.clientX;
      this.mouseClientY = e.clientY;
      if (!moved || this.keyHeld) return;
      this.mouseX = this.opts.clientToLogicalX(e.clientX);
      this.lastSource = "mouse";
      return;
    }
    if (e.pointerId !== this.dragPointerId) return;
    const dxCss = e.clientX - this.dragLastClientX;
    this.dragLastClientX = e.clientX;
    this.pendingDx += dxCss * this.opts.logicalPerCssPx() * CONFIG.input.dragRatio;
  };

  private onPointerEnd = (e: PointerEvent) => {
    if (e.pointerId === this.dragPointerId) this.dragPointerId = null;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    const code = e.code;
    if (LEFT_KEYS.has(code) || RIGHT_KEYS.has(code)) {
      e.preventDefault();
      if (LEFT_KEYS.has(code)) this.left = true;
      else this.right = true;
      this.lastSource = "keyboard";
      // 키를 쓰는 동안에는 마지막 마우스 위치로 되돌아가지 않게 비운다
      this.mouseX = null;
      return;
    }
    if (e.repeat) return;
    // 포커스된 버튼 위의 Enter/Space는 버튼이 처리하게 둔다
    if (CONFIRM_KEYS.has(code) && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      this.opts.onAction?.("confirm");
    } else if (PAUSE_KEYS.has(code)) {
      e.preventDefault();
      this.opts.onAction?.("pause");
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (LEFT_KEYS.has(e.code)) this.left = false;
    else if (RIGHT_KEYS.has(e.code)) this.right = false;
  };

  private onBlur = () => {
    this.reset();
    this.opts.onAction?.("autoPause");
  };

  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.onBlur();
  };
}
