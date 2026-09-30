"use client";

import styles from "./Switch.module.css";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
};

/** 켜짐/꺼짐 스위치. 상태를 색뿐 아니라 "켜짐/꺼짐" 글자로도 보여준다 */
export function Switch({ label, checked, onChange, description }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.state}>{checked ? "켜짐" : "꺼짐"}</span>
    </button>
  );
}
