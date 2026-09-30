"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Segmented.module.css";

type Option<T extends string | number> = { value: T; label: ReactNode; ariaLabel?: string };

type Props<T extends string | number> = {
  label: string;
  /** false면 label은 스크린리더에만 */
  showLabel?: boolean;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
};

/** 단계 선택기 (radiogroup). 방향키로 바로 선택이 바뀐다 */
export function Segmented<T extends string | number>({ label, showLabel = true, options, value, onChange, size = "md" }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (index + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.field}>
      <span className={showLabel ? styles.label : "visually-hidden"} id={labelId}>
        {label}
      </span>
      <div className={`${styles.group} ${styles[size]}`} role="radiogroup" aria-labelledby={labelId}>
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={String(o.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={o.ariaLabel}
              tabIndex={checked ? 0 : -1}
              className={styles.option}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
