"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "./color";
import styles from "./ColorPicker.module.css";

type Props = {
  open: boolean;
  /** 열 때의 색 (취소하면 이 색으로 돌아간다) */
  color: string;
  /** 고르는 동안 바로바로 알린다 (그림에 쓸 색이 즉시 바뀜) */
  onChange: (color: string) => void;
  onClose: () => void;
};

/**
 * 색 고르기 (포토샵·PC 피커식): 큰 네모에서 채도(가로)·밝기(세로)를 한 번에, 아래 막대에서 색조를.
 * 휴대폰 기본 피커처럼 색조·채도·명도를 따로따로 맞출 필요 없이 손가락 하나로 끌면 된다.
 * 키보드: 네모는 ←→ 채도 · ↑↓ 밝기, 막대는 ←→ 색조 (Shift면 크게).
 */
export function ColorPicker({ open, color, onChange, onClose }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
  const [original, setOriginal] = useState(color);
  const [hexText, setHexText] = useState(color);
  const [hexError, setHexError] = useState(false);

  // 열릴 때마다 지금 색에서 시작
  useEffect(() => {
    if (!open) return;
    setHsv(hexToHsv(color));
    setOriginal(color);
    setHexText(color);
    setHexError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열리는 순간의 색만 쓴다
  }, [open]);

  const apply = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    setHexError(false);
    onChange(hex);
  };

  const current = hsvToHex(hsv);
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <Dialog
      open={open}
      title="색 고르기"
      onClose={onClose}
      actions={
        <>
          <Button
            onClick={() => {
              onChange(original);
              onClose();
            }}
          >
            취소
          </Button>
          <Button variant="primary" icon="check" data-autofocus onClick={onClose}>
            이 색으로
          </Button>
        </>
      }
    >
      <div className={styles.picker}>
        <Area2d
          className={styles.sv}
          style={{ backgroundColor: pure }}
          label="채도와 밝기"
          valueText={`채도 ${Math.round(hsv.s * 100)}%, 밝기 ${Math.round(hsv.v * 100)}%`}
          x={hsv.s}
          y={1 - hsv.v}
          onMove={(x, y) => apply({ ...hsv, s: x, v: 1 - y })}
          onKey={(dx, dy) => apply({ ...hsv, s: clamp(hsv.s + dx), v: clamp(hsv.v - dy) })}
          thumbColor={current}
        />
        <Area2d
          className={styles.hue}
          label="색조"
          valueText={`색조 ${Math.round(hsv.h)}도`}
          x={hsv.h / 360}
          y={0.5}
          onMove={(x) => apply({ ...hsv, h: Math.min(359.9, x * 360) })}
          onKey={(dx) => apply({ ...hsv, h: (hsv.h + dx * 360 + 360) % 360 })}
          thumbColor={pure}
          horizontalOnly
        />

        <div className={styles.compare}>
          <span className={styles.before} style={{ background: original }} title="원래 색">
            <span className="visually-hidden">원래 색 {original}</span>
          </span>
          <span className={styles.after} style={{ background: current }} title="고른 색">
            <span className="visually-hidden">고른 색 {current}</span>
          </span>
          <label className={styles.hexField}>
            <span className={styles.hexLabel}>색 코드</span>
            <input
              className={styles.hex}
              value={hexText}
              maxLength={7}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-invalid={hexError}
              aria-describedby={hexError ? "hex-error" : undefined}
              onChange={(e) => {
                setHexText(e.target.value);
                const n = normalizeHex(e.target.value);
                setHexError(false);
                if (n && e.target.value.replace("#", "").length === 6) {
                  setHsv(hexToHsv(n));
                  onChange(n);
                }
              }}
              onBlur={() => {
                const n = normalizeHex(hexText);
                if (n) {
                  setHsv(hexToHsv(n));
                  setHexText(n);
                  onChange(n);
                } else setHexError(true);
              }}
            />
          </label>
        </div>
        {hexError && (
          <p id="hex-error" className={styles.error}>
            #과 6자리(0~9, a~f)로 적어 주세요. 예: #ff8fab
          </p>
        )}
      </div>
    </Dialog>
  );
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** 끌어서 고르는 면 (네모 또는 막대). x·y는 0~1 */
function Area2d(props: {
  className: string;
  style?: React.CSSProperties;
  label: string;
  valueText: string;
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  /** 방향키: dx·dy는 -1~1 범위의 변화량 */
  onKey: (dx: number, dy: number) => void;
  thumbColor: string;
  horizontalOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const moveTo = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    props.onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const v = d[e.key];
    if (!v || (props.horizontalOnly && v[0] === 0)) return;
    e.preventDefault();
    props.onKey(v[0], v[1]);
  };

  return (
    <div
      ref={ref}
      className={props.className}
      style={props.style}
      role="slider"
      tabIndex={0}
      aria-label={props.label}
      aria-valuetext={props.valueText}
      aria-valuenow={Math.round(props.x * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) moveTo(e);
      }}
      onKeyDown={onKeyDown}
    >
      <span
        className={styles.thumb}
        style={{ left: `${props.x * 100}%`, top: `${props.y * 100}%`, background: props.thumbColor }}
        aria-hidden="true"
      />
    </div>
  );
}
